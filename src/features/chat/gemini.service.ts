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

export async function extractUserMemories(
  userText: string,
  assistantText: string,
  existingMemories: string[] = [],
) {
  const existingContext = existingMemories.length
    ? `Existing memories about the user:\n${existingMemories.map((m) => `- ${m}`).join("\n")}`
    : "No existing memories.";

  const value = await generateJson(
    `You are a memory extraction engine for a virtual companion.
${existingContext}

Extract at most two durable, useful facts about the user from this new exchange.
STRICT RULES:
1. Return JSON only with this shape: {"memories":["fact one"]}.
2. Use concise, neutral, third-person facts (e.g., "The user likes jazz").
3. If the user corrects a previous fact (e.g., they said their name is Ali after being called Moemen), include the new corrected fact.
4. DO NOT repeat facts already present in the "Existing memories" list.
5. If no new useful facts are found, return an empty array: {"memories":[]}.

New Exchange:
User: ${userText}
Assistant: ${assistantText}`,
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
      temperature: 0.9,
      maxOutputTokens: 220,
    },
  });
}

export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const base64Audio = audioBuffer.toString("base64");
  const response = await getGeminiClient().models.generateContent({
    model: getGeminiModel(),
    contents: [
      {
        inlineData: {
          mimeType: mimeType || "audio/webm",
          data: base64Audio,
        },
      },
      {
        text: "Transcribe the spoken words exactly. Return only the transcription, with no quotes, explanation, or additional text. Preserve the speaker's language.",
      },
    ],
  });

  const transcript = (response.text ?? "").trim();
  return transcript.replace(/^['"`]([\s\S]*)['"`]$/u, "$1");
}

export const GEMINI_RUNTIME = {
  model: "GEMINI_MODEL",
  suggestedDefault: "gemini-2.5-flash-lite",
  maxReplyTokens: 220,
  dailyRequestCap: APP_CONFIG.dailyGeminiRequestCap,
} as const;
