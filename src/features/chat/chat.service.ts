import "server-only";

import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";

import { broadcastRoomEvent } from "@/features/audience/audience.service";
import { getInternalUserForSession } from "@/features/auth/auth.service";
import {
  buildCompanionSystemPrompt,
  createEmptyPersonaProfile,
  memoriesFromLines,
  moodFromEmotion,
} from "@/features/persona/persona.service";
import type { CompanionId, PersonaProfile } from "@/features/persona/persona.types";
import { APP_CONFIG, type VoteOption } from "@/lib/config/app";
import { DailyLimitError, NotFoundError } from "@/lib/errors";
import { getRedisClient, withRedisFallback } from "@/infrastructure/redis/client";
import { getSupabaseAdminClient } from "@/infrastructure/supabase/server";

import {
  classifyEmotion,
  extractUserMemories,
  streamRinaResponse,
} from "./gemini.service";
import type { StoredConversation } from "./chat.types";

function profileKey(userId: string) {
  return `user:${userId}:profile`;
}

async function loadProfile(userId: string, sessionId: string): Promise<PersonaProfile> {
  const fallback = async () => {
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from("memories")
      .select("id, content, importance, created_at")
      .eq("user_id", userId)
      .order("importance", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(APP_CONFIG.memoryLimit);
    if (error) throw error;

    const profile: PersonaProfile = {
      ...createEmptyPersonaProfile(sessionId),
      memories: (data ?? []).map((row) => ({
        id: Number(row.id),
        content: String(row.content),
        importance: Number(row.importance),
        createdAt: String(row.created_at),
      })),
    };
    try {
      await getRedisClient().set(profileKey(userId), profile, {
        ex: APP_CONFIG.profileCacheSeconds,
      });
    } catch (error) {
      console.warn("Unable to refresh profile cache", error);
    }
    return profile;
  };

  return withRedisFallback(
    async () => {
      const cached = await getRedisClient().get<PersonaProfile>(profileKey(userId));
      return cached ?? fallback();
    },
    fallback,
  );
}

async function saveProfile(userId: string, profile: PersonaProfile) {
  try {
    await getRedisClient().set(profileKey(userId), profile, {
      ex: APP_CONFIG.profileCacheSeconds,
    });
  } catch (error) {
    console.warn("Unable to save profile cache", error);
  }
}

async function loadConversationHistory(
  userId: string,
  companionId: CompanionId,
): Promise<StoredConversation[]> {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("conversations")
    .select("role, content")
    .eq("user_id", userId)
    .eq("companion_id", companionId)
    .order("created_at", { ascending: false })
    .limit(APP_CONFIG.conversationHistoryLimit);
  if (error) throw error;
  return (data ?? [])
    .reverse()
    .map((row) => ({
      role: row.role as "user" | "assistant",
      content: String(row.content),
    }));
}

async function getLastVote(sessionId: string): Promise<VoteOption | null> {
  try {
    return await getRedisClient().get<VoteOption>(`room:${sessionId}:last-vote`);
  } catch (error) {
    console.warn("Unable to load audience context", error);
    return null;
  }
}

async function assertWithinDailyGeminiRequestCap() {
  const key = `global:gemini_requests:${new Date().toISOString().slice(0, 10)}`;
  try {
    const redis = getRedisClient();
    const totalRequests = await redis.incr(key);
    if (totalRequests === 1) await redis.expire(key, 60 * 60 * 36);
    if (totalRequests > APP_CONFIG.dailyGeminiRequestCap) throw new DailyLimitError();
  } catch (error) {
    if (error instanceof DailyLimitError) throw error;
    console.warn("Gemini request cap unavailable; continuing without a Redis guard.", error);
  }
}

function textFromUIMessage(message: UIMessage) {
  return message.parts
    .filter(
      (part): part is Extract<(typeof message.parts)[number], { type: "text" }> =>
        part.type === "text",
    )
    .map((part) => part.text)
    .join("")
    .trim();
}

async function persistConversation(
  sessionId: string,
  userId: string,
  userText: string,
  assistantText: string,
  profile: PersonaProfile,
  companionId: CompanionId,
) {
  const client = getSupabaseAdminClient();
  const { error: conversationError } = await client.from("conversations").insert([
    { user_id: userId, companion_id: companionId, role: "user", content: userText },
    { user_id: userId, companion_id: companionId, role: "assistant", content: assistantText },
  ]);
  if (conversationError) throw conversationError;

  try {
    const memories = memoriesFromLines(
      await extractUserMemories(userText, assistantText),
    );
    if (memories.length) {
      const { error: memoryError } = await client
        .from("memories")
        .insert(memories.map((memory) => ({ user_id: userId, ...memory })));
      if (memoryError) throw memoryError;

      profile.memories = [...memories, ...profile.memories].slice(
        0,
        APP_CONFIG.memoryLimit,
      );
      const { data: overflow } = await client
        .from("memories")
        .select("id")
        .eq("user_id", userId)
        .order("importance", { ascending: true })
        .order("created_at", { ascending: true })
        .range(APP_CONFIG.memoryLimit, APP_CONFIG.memoryLimit + 20);
      if (overflow?.length) {
        await client.from("memories").delete().in(
          "id",
          overflow.map((row) => row.id),
        );
      }
      await saveProfile(userId, profile);
    }
  } catch (error) {
    console.warn("Gemini memory extraction failed after conversation persistence", error);
  }

  await broadcastRoomEvent(sessionId, {
    type: "message",
    message: {
      id: crypto.randomUUID(),
      role: "assistant",
      content: assistantText,
      createdAt: new Date().toISOString(),
    },
  });
}

export async function createCompanionChatStream(input: {
  sessionId: string;
  supabaseAuthId: string;
  messages: UIMessage[];
}) {
  await assertWithinDailyGeminiRequestCap();
  const { session, user } = await getInternalUserForSession(input.sessionId);
  if (user.supabaseAuthId !== input.supabaseAuthId) throw new NotFoundError("Room");

  const currentMessage = input.messages.at(-1);
  if (!currentMessage || currentMessage.role !== "user") {
    throw new NotFoundError("Message");
  }
  const userText = textFromUIMessage(currentMessage);
  if (!userText || userText.length > APP_CONFIG.maxMessageCharacters) {
    throw new NotFoundError("Message");
  }

  const [profile, history, audienceVote, emotion] = await Promise.all([
    loadProfile(user.id, session.id),
    loadConversationHistory(user.id, session.companionId),
    getLastVote(session.id),
    classifyEmotion(userText),
  ]);

  profile.mood = moodFromEmotion(emotion);
  profile.lastSessionId = session.id;
  await saveProfile(user.id, profile);

  const geminiStream = await streamRinaResponse({
    systemInstruction: buildCompanionSystemPrompt(profile, session.companionId, audienceVote),
    history,
    userText,
  });
  const textPartId = crypto.randomUUID();
  let assistantText = "";

  const stream = createUIMessageStream({
    originalMessages: input.messages,
    execute: async ({ writer }) => {
      writer.write({ type: "text-start", id: textPartId });
      for await (const chunk of geminiStream) {
        const delta = chunk.text;
        if (!delta) continue;
        assistantText += delta;
        writer.write({ type: "text-delta", id: textPartId, delta });
      }
      writer.write({ type: "text-end", id: textPartId });

      try {
        await persistConversation(
          session.id,
          user.id,
          userText,
          assistantText,
          profile,
          session.companionId,
        );
      } catch (error) {
        console.error("Unable to persist completed Gemini conversation", error);
      }
    },
    onError: () => "Rina’s brain is taking a tiny pause. Please try again.",
  });

  return createUIMessageStreamResponse({ stream });
}
