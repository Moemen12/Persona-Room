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
import { APP_CONFIG } from "@/lib/config/app";
import { DailyLimitError, NotFoundError } from "@/lib/errors";
import { withRedisFallback } from "@/infrastructure/redis/client";

import * as chatRepository from "./chat.repository";
import {
  classifyEmotion,
  extractUserMemories,
  streamRinaResponse,
} from "./gemini.service";
import type { ChatServiceDependencies } from "./chat.types";

const defaultDependencies: ChatServiceDependencies = {
  findMemoriesByUserId: chatRepository.findMemoriesByUserId,
  saveMemories: chatRepository.saveMemories,
  deleteMemoriesByIds: chatRepository.deleteMemoriesByIds,
  findOldMemoriesForCleanup: chatRepository.findOldMemoriesForCleanup,
  saveConversations: chatRepository.saveConversations,
  findConversationHistory: chatRepository.findConversationHistory,
  getProfileCache: chatRepository.getProfileCache,
  setProfileCache: chatRepository.setProfileCache,
  getLastVoteCache: chatRepository.getLastVoteCache,
  incrementGeminiRequestCount: chatRepository.incrementGeminiRequestCount,
};

async function loadProfile(
  userId: string,
  sessionId: string,
  dependencies: ChatServiceDependencies,
): Promise<PersonaProfile> {
  const fallback = async () => {
    const memories = await dependencies.findMemoriesByUserId(userId);
    const profile: PersonaProfile = {
      ...createEmptyPersonaProfile(sessionId),
      memories,
    };
    try {
      await dependencies.setProfileCache(userId, profile);
    } catch (error) {
      console.warn("Unable to refresh profile cache", error);
    }
    return profile;
  };

  return withRedisFallback(
    async () => {
      const cached = await dependencies.getProfileCache(userId);
      return cached ?? fallback();
    },
    fallback,
  );
}

async function assertWithinDailyGeminiRequestCap(dependencies: ChatServiceDependencies) {
  try {
    const totalRequests = await dependencies.incrementGeminiRequestCount();
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
  dependencies: ChatServiceDependencies,
) {
  await dependencies.saveConversations(userId, companionId, userText, assistantText);

  try {
    const memories = memoriesFromLines(
      await extractUserMemories(userText, assistantText),
    );
    if (memories.length) {
      await dependencies.saveMemories(userId, memories);

      profile.memories = [...memories, ...profile.memories].slice(
        0,
        APP_CONFIG.memoryLimit,
      );
      
      const overflow = await dependencies.findOldMemoriesForCleanup(userId, APP_CONFIG.memoryLimit);
      if (overflow.length) {
        await dependencies.deleteMemoriesByIds(overflow.map((row) => Number(row.id)));
      }
      await dependencies.setProfileCache(userId, profile);
    }
  } catch (error) {
    console.warn("Gemini memory extraction failed after conversation persistence", error);
  }

  await broadcastRoomEvent(sessionId, {
    type: "message",
    mood: profile.mood,
    message: {
      id: crypto.randomUUID(),
      role: "assistant",
      content: assistantText,
      createdAt: new Date().toISOString(),
    },
  });
}

export async function createCompanionChatStream(
  input: {
    sessionId: string;
    supabaseAuthId: string;
    messages: UIMessage[];
  },
  dependencies: ChatServiceDependencies = defaultDependencies,
) {
  await assertWithinDailyGeminiRequestCap(dependencies);
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
    loadProfile(user.id, session.id, dependencies),
    dependencies.findConversationHistory(user.id, session.companionId, APP_CONFIG.conversationHistoryLimit),
    dependencies.getLastVoteCache(session.id),
    classifyEmotion(userText),
  ]);

  profile.mood = moodFromEmotion(emotion);
  profile.lastSessionId = session.id;
  await dependencies.setProfileCache(user.id, profile);

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
          dependencies,
        );
      } catch (error) {
        console.error("Unable to persist completed Gemini conversation", error);
      }
    },
    onError: () => "Rina’s brain is taking a tiny pause. Please try again.",
  });

  return createUIMessageStreamResponse({ stream });
}
