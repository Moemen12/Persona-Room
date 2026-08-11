import { useState, useCallback } from 'react';
import { createChatSession, sendChatMessage, getChatHistory } from '@/server/actions/chat.actions';
import { Conversation } from '@/features/chat/chat.types';
import { Mood } from '@/lib/errors';

interface UseChatState {
  sessionId: string | null;
  messages: Conversation[];
  currentMood: Mood;
  loading: boolean;
  error: string | null;
}

export function useChat() {
  const [state, setState] = useState<UseChatState>({
    sessionId: null,
    messages: [],
    currentMood: 'neutral',
    loading: false,
    error: null,
  });

  const initSession = useCallback(async (audienceEnabled = true) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const response = await createChatSession({ audienceEnabled });
      if (response.success && response.data) {
        setState((prev) => ({
          ...prev,
          sessionId: response.data.id,
          loading: false,
        }));
        return response.data.id;
      } else {
        throw new Error(response.error?.message || 'Failed to create session');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setState((prev) => ({ ...prev, error: message, loading: false }));
      throw error;
    }
  }, []);

  const sendMessage = useCallback(
    async (message: string) => {
      if (!state.sessionId) throw new Error('No active session');

      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const response = await sendChatMessage({
          sessionId: state.sessionId,
          message,
        });

        if (response.success && response.data) {
          setState((prev) => ({
            ...prev,
            currentMood: response.data.moodAnalysis.emotion,
            loading: false,
          }));
          return response.data;
        } else {
          throw new Error(response.error?.message || 'Failed to send message');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        setState((prev) => ({ ...prev, error: message, loading: false }));
        throw error;
      }
    },
    [state.sessionId],
  );

  const loadHistory = useCallback(async (limit = 50) => {
    if (!state.sessionId) throw new Error('No active session');

    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const response = await getChatHistory({
        sessionId: state.sessionId,
        limit,
      });

      if (response.success && response.data) {
        setState((prev) => ({
          ...prev,
          messages: response.data,
          loading: false,
        }));
      } else {
        throw new Error(response.error?.message || 'Failed to load history');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setState((prev) => ({ ...prev, error: message, loading: false }));
      throw error;
    }
  }, [state.sessionId]);

  return {
    ...state,
    initSession,
    sendMessage,
    loadHistory,
  };
}
