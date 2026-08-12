import type { CompanionId } from "@/features/persona";

export interface VoiceSynthesisInput {
  companionId: CompanionId;
  text: string;
}

export interface VoiceSynthesisResult {
  audioBase64: string;
  companionId: CompanionId;
  voice: string;
  cacheHit: boolean;
  mimeType: "audio/mpeg";
}
