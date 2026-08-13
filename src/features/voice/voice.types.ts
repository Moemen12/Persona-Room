import type { CompanionId, ConversationLanguage } from "@/features/persona";

export interface VoiceSynthesisInput {
  companionId: CompanionId;
  language: ConversationLanguage;
  text: string;
}

export interface VoiceSynthesisResult {
  audioBase64: string;
  companionId: CompanionId;
  voice: string;
  cacheHit: boolean;
  mimeType: "audio/mpeg";
}

export interface VoiceTranscriptionInput {
  accessToken: string;
  sessionId: string;
  companionId: CompanionId;
  language: ConversationLanguage;
  audio: File;
}

export interface VoiceTranscriptionResult {
  transcript: string;
}
