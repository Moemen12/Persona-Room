import "server-only";

import { GoogleGenAI } from "@google/genai";

import type { StoredConversation } from "@/features/chat/chat.types";
import type { EmotionAnalysis } from "@/features/persona/persona.types";
import { APP_CONFIG } from "@/lib/config/app";
import { getServerEnvironment } from "@/infrastructure/shared/env";

import { emotionSchema, memorySchema } from "./chat.schemas";

function getGeminiClient() {
  return new GoogleGenAI({ apiKey: getServerEnvironment().GEMINI_API_KEY });
}

function getGeminiModel() {
  return getServerEnvironment().GEMINI_MODEL;
}

async function generateJson(prompt: string) {
  const response = await getGeminiClient().models.generateContent({
    model: getGeminiModel(),
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      temperature: 0,
    },
  });
  return JSON.parse(response.text ?? "{}") as unknown;
}

export async function classifyEmotion(message: string): Promise<EmotionAnalysis> {
  const value = await generateJson(
    `Classify the emotion of this exact user message into exactly one of happy, sad, excited, neutral, frustrated. Return JSON only with this shape: {"emotion":"neutral","intensity":1}. Intensity must be an integer from 1 through 5. Message: ${message}`,
  );
  return emotionSchema.parse(value);
}

export async function extractUserMemories(userText: string, assistantText: string) {
  const value = await generateJson(
    `Extract at most two durable, useful facts about the user from this conversation. Use concise neutral facts. Do not infer sensitive attributes. Return JSON only with this shape: {"memories":["fact one"]}. User: ${userText}\nRina: ${assistantText}`,
  );
  return memorySchema.parse(value).memories;
}

function toGeminiContents(history: StoredConversation[], userText: string) {
  const normalizedHistory = history.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));

  while (normalizedHistory[0]?.role === "model") {
    normalizedHistory.shift();
  }

  return [...normalizedHistory, { role: "user", parts: [{ text: userText }] }];
}

export async function streamRinaResponse(input: {
  systemInstruction: string;
  history: StoredConversation[];
  userText: string;
}) {
  return getGeminiClient().models.generateContentStream({
    model: getGeminiModel(),
    contents: toGeminiContents(input.history, input.userText),
    config: {
      systemInstruction: input.systemInstruction,
      temperature: 0.85,
      maxOutputTokens: 220,
    },
  });
}

export const GEMINI_RUNTIME = {
  model: "GEMINI_MODEL",
  suggestedDefault: "gemini-2.5-flash-lite",
  maxReplyTokens: 220,
  dailyRequestCap: APP_CONFIG.dailyGeminiRequestCap,
} as const;
