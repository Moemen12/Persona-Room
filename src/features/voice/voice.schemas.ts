import { z } from "zod";

import { COMPANION_IDS } from "@/features/persona";

export const voiceRequestSchema = z.object({
  accessToken: z.string().min(1),
  sessionId: z.uuid(),
  companionId: z.enum(COMPANION_IDS),
  text: z.string().trim().min(1).max(500),
});

export type VoiceRequest = z.infer<typeof voiceRequestSchema>;
