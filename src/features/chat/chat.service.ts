import "server-only";

import { generateObject, streamText, type UIMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

import { getInternalUserForSession } from "@/features/auth/auth.service";
import {
  buildRinaSystemPrompt,
  createEmptyPersonaProfile,
  memoriesFromLines,
  moodFromEmotion,
} from "@/features/persona/persona.service";
import type { PersonaProfile } from "@/features/persona/persona.types";
import { broadcastRoomEvent } from "@/features/audience/audience.service";
import { APP_CONFIG, type VoteOption } from "@/lib/config/app";
import { BudgetExceededError, NotFoundError } from "@/lib/errors";
import { getRedisClient, withRedisFallback } from "@/infrastructure/redis/client";
import { getServerEnvironment } from "@/infrastructure/shared/env";
import { getSupabaseAdminClient } from "@/infrastructure/supabase/server";

import { emotionSchema, memorySchema } from "./chat.schemas";
import type { StoredConversation } from "./chat.types";

function openaiModel() {
  return createOpenAI({ apiKey: getServerEnvironment().OPENAI_API_KEY })("gpt-4o-mini");
}

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
      await getRedisClient().set(profileKey(userId), profile, { ex: APP_CONFIG.profileCacheSeconds });
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
    await getRedisClient().set(profileKey(userId), profile, { ex: APP_CONFIG.profileCacheSeconds });
  } catch (error) {
    console.warn("Unable to save profile cache", error);
  }
}

async function loadConversationHistory(userId: string): Promise<StoredConversation[]> {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("conversations")
    .select("role, content")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(APP_CONFIG.conversationHistoryLimit);
  if (error) throw error;
  return (data ?? [])
    .reverse()
    .map((row) => ({ role: row.role as "user" | "assistant", content: String(row.content) }));
}

async function getLastVote(sessionId: string): Promise<VoteOption | null> {
  try {
    return await getRedisClient().get<VoteOption>(`room:${sessionId}:last-vote`);
  } catch (error) {
    console.warn("Unable to load audience context", error);
    return null;
  }
}

async function assertWithinBudget() {
  const key = `global:llm_budget:${new Date().toISOString().slice(0, 10)}`;
  try {
    const current = (await getRedisClient().get<number>(key)) ?? 0;
    if (current >= APP_CONFIG.dailyBudgetUsd) throw new BudgetExceededError();
    await getRedisClient().incrbyfloat(key, APP_CONFIG.estimatedReplyCostUsd);
    await getRedisClient().expire(key, 60 * 60 * 36);
  } catch (error) {
    if (error instanceof BudgetExceededError) throw error;
    console.warn("Budget guard unavailable; continuing with durable service.", error);
  }
}

function textFromUIMessage(message: UIMessage) {
  return message.parts
    .filter((part): part is Extract<(typeof message.parts)[number], { type: "text" }> => part.type === "text")
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
) {
  const client = getSupabaseAdminClient();
  const { error: conversationError } = await client.from("conversations").insert([
    { user_id: userId, role: "user", content: userText },
    { user_id: userId, role: "assistant", content: assistantText },
  ]);
  if (conversationError) throw conversationError;

  try {
    const extraction = await generateObject({
      model: openaiModel(),
      schema: memorySchema,
      prompt: `Extract at most two durable, useful facts about the user from this message and reply. Use concise facts, never infer sensitive attributes. User: ${userText}\nRina: ${assistantText}`,
    });
    const memories = memoriesFromLines(extraction.object.memories);
    if (memories.length) {
      const { error: memoryError } = await client
        .from("memories")
        .insert(memories.map((memory) => ({ user_id: userId, ...memory })));
      if (memoryError) throw memoryError;
      profile.memories = [...memories, ...profile.memories].slice(0, APP_CONFIG.memoryLimit);
      const { data: overflow } = await client
        .from("memories")
        .select("id")
        .eq("user_id", userId)
        .order("importance", { ascending: true })
        .order("created_at", { ascending: true })
        .range(APP_CONFIG.memoryLimit, APP_CONFIG.memoryLimit + 20);
      if (overflow?.length) {
        await client.from("memories").delete().in("id", overflow.map((row) => row.id));
      }
      await saveProfile(userId, profile);
    }
  } catch (error) {
    console.warn("Memory extraction failed after conversation persistence", error);
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

export async function createRinaChatStream(input: {
  sessionId: string;
  supabaseAuthId: string;
  messages: UIMessage[];
}) {
  await assertWithinBudget();
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
    loadConversationHistory(user.id),
    getLastVote(session.id),
    generateObject({
      model: openaiModel(),
      schema: emotionSchema,
      prompt: `Classify the emotion of this exact user message into one of happy, sad, excited, neutral, frustrated. Return intensity from 1 through 5. Message: ${userText}`,
    }).then((result) => result.object),
  ]);

  profile.mood = moodFromEmotion(emotion);
  profile.lastSessionId = session.id;
  await saveProfile(user.id, profile);

  const result = streamText({
    model: openaiModel(),
    system: buildRinaSystemPrompt(profile, audienceVote),
    messages: [
      ...history.map((message) => ({ role: message.role, content: message.content })),
      { role: "user", content: userText },
    ],
    onFinish: async ({ text }) => {
      try {
        await persistConversation(session.id, user.id, userText, text, profile);
      } catch (error) {
        console.error("Unable to persist completed conversation", error);
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
