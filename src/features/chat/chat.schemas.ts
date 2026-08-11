import { z } from "zod";

import { APP_CONFIG } from "@/lib/config/app";

export const chatRequestSchema = z.object({
  sessionId: z.uuid(),
  accessToken: z.string().min(20),
  messages: z.array(z.unknown()).min(1).max(APP_CONFIG.maxUiMessagesInRequest),
});

export const emotionSchema = z.object({
  emotion: z.enum(["happy", "sad", "excited", "neutral", "frustrated"]),
  intensity: z.number().int().min(1).max(5),
});

export const memorySchema = z.object({
  memories: z.array(z.string().min(1).max(200)).max(2),
});
