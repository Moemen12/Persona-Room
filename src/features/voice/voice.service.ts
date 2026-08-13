import "server-only";

import { createHash } from "node:crypto";

import { GoogleGenAI } from "@google/genai";
import { Communicate, EdgeTTS } from "edge-tts-universal";

import { type CompanionId } from "@/features/persona";
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

function languageForText(text: string) {
  if (/[\uac00-\ud7af]/u.test(text)) return "ko-KR";
  if (/[\u0600-\u06ff]/u.test(text)) return "ar-SA";
  return "en-US";
}

function voiceForText(companionId: CompanionId, text: string) {
  const language = languageForText(text);
  return (
    voiceByCompanionAndLanguage[companionId][language] ??
    voiceByCompanionAndLanguage[companionId]["en-US"]
  );
}

function prosodyForCompanion(companionId: CompanionId) {
  return companionId === "rina"
    ? { rate: "+3%", pitch: "+2Hz", volume: "+0%" }
    : { rate: "-3%", pitch: "-2Hz", volume: "+0%" };
}

function cacheKey(input: VoiceSynthesisInput, voice: string) {
  const digest = createHash("sha256")
    .update(`${input.companionId}:${voice}:${input.text.trim()}`)
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
        text: "Transcribe the spoken words exactly. Return only the transcription, with no quotes, explanation, or additional text. Preserve the speaker's language.",
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
  const voice = voiceForText(input.companionId, text);
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
  const text = input.text.trim();
  const voice = voiceForText(input.companionId, text);
  const key = cacheKey({ ...input, text }, voice);
  const cachedAudio = await getCachedAudio(key);

  if (cachedAudio) {
    yield Buffer.from(cachedAudio, "base64");
    return;
  }

  const chunks: Buffer[] = [];
  let completed = false;

  try {
    const communicate = new Communicate(text, {
      voice,
      ...prosodyForCompanion(input.companionId),
    });

    for await (const chunk of communicate.stream()) {
      if (chunk.type !== "audio" || !chunk.data?.length) continue;
      const audioChunk = Buffer.from(chunk.data);
      chunks.push(audioChunk);
      yield audioChunk;
    }
    completed = true;
  } finally {
    if (completed && chunks.length > 0) {
      await cacheAudio(key, Buffer.concat(chunks).toString("base64"));
    }
  }
}
