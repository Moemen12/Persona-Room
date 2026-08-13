import "server-only";

import { createHash } from "node:crypto";

import { GoogleGenAI } from "@google/genai";
import { EdgeTTS } from "edge-tts-universal";

import { LANGUAGES, type CompanionId, type ConversationLanguage } from "@/features/persona";
import { getRedisClient } from "@/infrastructure/redis/client";
import { APP_CONFIG } from "@/lib/config/app";
import { getServerEnvironment } from "@/infrastructure/shared/env";

import type { VoiceSynthesisInput, VoiceSynthesisResult } from "./voice.types";

const voiceByCompanionAndLanguage: Record<
  CompanionId,
  Record<string, string>
> = {
  rina: {
    "en-US": "en-US-AvaMultilingualNeural",
    "ko-KR": "ko-KR-SunHiNeural",
    "ar-SA": "ar-SA-ZariyahNeural",
  },
  joon: {
    "en-US": "en-US-GuyNeural",
    "ko-KR": "ko-KR-InJoonNeural",
    "ar-SA": "ar-SA-HamedNeural",
  },
};

const localeByLanguage: Record<ConversationLanguage, string> = {
  en: "en-US",
  ko: "ko-KR",
  ar: "ar-SA",
};

function voiceForLanguage(companionId: CompanionId, language: ConversationLanguage) {
  const locale = localeByLanguage[language];
  return voiceByCompanionAndLanguage[companionId][locale] ?? voiceByCompanionAndLanguage[companionId]["en-US"];
}

function prosodyForCompanion(companionId: CompanionId) {
  return companionId === "rina"
    ? { rate: "+3%", pitch: "+2Hz", volume: "+0%" }
    : { rate: "-3%", pitch: "-2Hz", volume: "+0%" };
}

function cacheKey(input: VoiceSynthesisInput, voice: string) {
  const digest = createHash("sha256")
    .update(`${input.companionId}:${input.language}:${voice}:${input.text.trim()}`)
    .digest("hex");
  return `persona-room:voice:${digest}`;
}

async function getCachedAudio(key: string) {
  try {
    return await getRedisClient().get<string>(key);
  } catch (error) {
    console.warn("Voice cache read failed; synthesizing without cache.", error);
    return null;
  }
}

async function cacheAudio(key: string, audioBase64: string) {
  try {
    await getRedisClient().set(key, audioBase64, {
      ex: APP_CONFIG.voiceCacheSeconds,
    });
  } catch (error) {
    console.warn(
      "Voice cache write failed; audio remains available for this request.",
      error
    );
  }
}

export async function transcribeVoiceAudio(input: {
  audio: File;
  language: ConversationLanguage;
}): Promise<{ transcript: string }> {
  const audioData = Buffer.from(await input.audio.arrayBuffer()).toString(
    "base64"
  );
  const response = await new GoogleGenAI({
    apiKey: getServerEnvironment().GEMINI_API_KEY,
  }).models.generateContent({
    model: getServerEnvironment().GEMINI_MODEL,
    contents: [
      {
        inlineData: {
          mimeType: input.audio.type || "audio/webm",
          data: audioData,
        },
      },
      {
        text: `Transcribe the spoken words exactly in ${LANGUAGES[input.language].label}. Return only the transcription, with no quotes, explanation, or additional text. Do not translate, summarize, or switch languages.`,
      },
    ],
  });

  const transcript = (response.text ?? "").trim();
  return { transcript: transcript.replace(/^['"`]([\s\S]*)['"`]$/u, "$1") };
}

export async function synthesizeCompanionVoice(
  input: VoiceSynthesisInput
): Promise<VoiceSynthesisResult> {
  const text = input.text.trim();
  const voice = voiceForLanguage(input.companionId, input.language);
  const key = cacheKey({ ...input, text }, voice);
  const cachedAudio = await getCachedAudio(key);

  if (cachedAudio) {
    return {
      audioBase64: cachedAudio,
      companionId: input.companionId,
      voice,
      cacheHit: true,
      mimeType: "audio/mpeg",
    };
  }

  const synthesis = await new EdgeTTS(
    text,
    voice,
    prosodyForCompanion(input.companionId)
  ).synthesize();
  const audioBase64 = Buffer.from(await synthesis.audio.arrayBuffer()).toString(
    "base64"
  );
  await cacheAudio(key, audioBase64);

  return {
    audioBase64,
    companionId: input.companionId,
    voice,
    cacheHit: false,
    mimeType: "audio/mpeg",
  };
}

export async function* streamCompanionVoice(
  input: VoiceSynthesisInput
): AsyncGenerator<Uint8Array, void, unknown> {
  const result = await synthesizeCompanionVoice(input);
  const audioBuffer = Buffer.from(result.audioBase64, "base64");
  const chunkSize = 16 * 1024;
  for (let i = 0; i < audioBuffer.length; i += chunkSize) {
    yield audioBuffer.subarray(i, i + chunkSize);
  }
}
