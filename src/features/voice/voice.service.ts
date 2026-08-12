import "server-only";

import { createHash } from "node:crypto";

import { EdgeTTS } from "edge-tts-universal";

import { type CompanionId } from "@/features/persona";
import { getRedisClient } from "@/infrastructure/redis/client";
import { APP_CONFIG } from "@/lib/config/app";

import type { VoiceSynthesisInput, VoiceSynthesisResult } from "./voice.types";

const voiceByCompanionAndLanguage: Record<CompanionId, Record<string, string>> = {
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
  return voiceByCompanionAndLanguage[companionId][language] ?? voiceByCompanionAndLanguage[companionId]["en-US"];
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
    await getRedisClient().set(key, audioBase64, { ex: APP_CONFIG.voiceCacheSeconds });
  } catch (error) {
    console.warn("Voice cache write failed; audio remains available for this request.", error);
  }
}

export async function synthesizeCompanionVoice(input: VoiceSynthesisInput): Promise<VoiceSynthesisResult> {
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

  const isRina = input.companionId === "rina";
  const synthesis = await new EdgeTTS(text, voice, {
    rate: isRina ? "+3%" : "-3%",
    pitch: isRina ? "+2Hz" : "-2Hz",
    volume: "+0%",
  }).synthesize();
  const audioBase64 = Buffer.from(await synthesis.audio.arrayBuffer()).toString("base64");
  await cacheAudio(key, audioBase64);

  return {
    audioBase64,
    companionId: input.companionId,
    voice,
    cacheHit: false,
    mimeType: "audio/mpeg",
  };
}
