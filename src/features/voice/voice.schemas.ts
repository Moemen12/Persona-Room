import { z } from "zod";

import { COMPANION_IDS } from "@/features/persona";

export const voiceRequestSchema = z.object({
  accessToken: z.string().min(1),
  sessionId: z.uuid(),
  companionId: z.enum(COMPANION_IDS),
  text: z.string().trim().min(1).max(500),
});

export type VoiceRequest = z.infer<typeof voiceRequestSchema>;

export const voiceTranscriptionMetadataSchema = z.object({
  accessToken: z.string().min(1),
  sessionId: z.uuid(),
  companionId: z.enum(COMPANION_IDS),
});

export const voiceAudioSchema = z.object({
  audio: z
    .custom<File>(value => value instanceof File, "Audio file is required")
    .refine(file => file.size > 0, "Audio file cannot be empty")
    .refine(file => file.size <= 5 * 1024 * 1024, "Audio file is too large"),
});

export type VoiceTranscriptionMetadata = z.infer<
  typeof voiceTranscriptionMetadataSchema
>;
