import { z } from 'zod';

export const createSessionSchema = z.object({
  audienceEnabled: z.boolean().default(true),
});

export const sendMessageSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  message: z.string().min(1, 'Message cannot be empty').max(2000, 'Message too long'),
});

export const getHistorySchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  limit: z.number().int().positive().default(50),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type GetHistoryInput = z.infer<typeof getHistorySchema>;
