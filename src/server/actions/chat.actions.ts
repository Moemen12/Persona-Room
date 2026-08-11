'use server';

import { createServerClient } from '@/infrastructure/database/supabase';
import * as chatService from '@/features/chat/chat.service';
import * as chatRepo from '@/features/chat/chat.repository';
import { createSessionSchema, sendMessageSchema, getHistorySchema } from '@/features/chat/chat.schemas';
import { createApiResponse, createApiError, ApiResponse } from '@/lib/errors';

export async function createChatSession(input: unknown): Promise<ApiResponse> {
  try {
    const parsed = createSessionSchema.parse(input);
    const supabase = await createServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return createApiError(new Error('Unauthorized'));
    }

    const session = await chatService.createUserSession(user.id, parsed.audienceEnabled);
    return createApiResponse(session);
  } catch (error) {
    return createApiError(error);
  }
}

export async function sendChatMessage(input: unknown): Promise<ApiResponse> {
  try {
    const parsed = sendMessageSchema.parse(input);
    const supabase = await createServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return createApiError(new Error('Unauthorized'));
    }

    const result = await chatService.processUserMessage(user.id, parsed.sessionId, parsed.message);
    return createApiResponse(result);
  } catch (error) {
    return createApiError(error);
  }
}

export async function getChatHistory(input: unknown): Promise<ApiResponse> {
  try {
    const parsed = getHistorySchema.parse(input);
    const supabase = await createServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return createApiError(new Error('Unauthorized'));
    }

    const history = await chatService.getSessionConversations(user.id, parsed.sessionId, parsed.limit);
    return createApiResponse(history);
  } catch (error) {
    return createApiError(error);
  }
}
