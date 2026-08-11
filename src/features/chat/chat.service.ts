import * as chatRepo from './chat.repository';
import { generateRinaResponse, analyzeEmotionWithGemini, extractMemoriesFromConversation } from '@/infrastructure/config/gemini';
import { cacheSet, cacheGet } from '@/infrastructure/database/redis';
import { SendMessageResponse, MoodAnalysis } from './chat.types';
import { Mood } from '@/lib/errors';

export async function createUserSession(userId: string, audienceEnabled = true) {
  const session = await chatRepo.createSession(userId, audienceEnabled);
  return session;
}

export async function processUserMessage(
  userId: string,
  sessionId: string,
  userMessage: string,
): Promise<SendMessageResponse> {
  // Verify session belongs to user
  const session = await chatRepo.getSession(sessionId);
  if (session.userId !== userId) {
    throw new Error('Unauthorized: session does not belong to user');
  }

  // Add user message to conversation
  await chatRepo.addConversation(userId, sessionId, 'user', userMessage);

  // Get conversation history (last 8 messages)
  const history = await chatRepo.getConversationHistory(sessionId, 8);
  const conversationHistory = history
    .reverse()
    .map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

  // Get user memories
  const userMemories = await chatRepo.getUserMemories(userId, 6);
  const memoryTexts = userMemories.map((m) => m.content);

  // Get current mood from cache or default
  let currentMood = (await cacheGet<string>(`user:${userId}:mood`)) as Mood | null;
  if (!currentMood) {
    currentMood = 'neutral';
  }

  // Generate Rina response
  const rinaResponse = await generateRinaResponse(
    userMessage,
    conversationHistory,
    memoryTexts,
    currentMood,
  );

  // Analyze Rina's response for mood
  const rinaMoodAnalysis = await analyzeEmotionWithGemini(rinaResponse);

  // Add assistant message to conversation
  await chatRepo.addConversation(userId, sessionId, 'assistant', rinaResponse, rinaMoodAnalysis.emotion);

  // Extract new memories from conversation
  const newMemories = await extractMemoriesFromConversation(userMessage, rinaResponse);
  for (const memory of newMemories) {
    await chatRepo.addMemory(userId, memory, 2);
  }

  // Update mood in cache (1 hour TTL)
  await cacheSet(`user:${userId}:mood`, rinaMoodAnalysis.emotion, 3600);

  return {
    response: rinaResponse,
    mood: rinaMoodAnalysis.emotion,
    moodAnalysis: rinaMoodAnalysis,
  };
}

export async function getSessionConversations(userId: string, sessionId: string, limit = 50) {
  // Verify session belongs to user
  const session = await chatRepo.getSession(sessionId);
  if (session.userId !== userId) {
    throw new Error('Unauthorized: session does not belong to user');
  }

  const history = await chatRepo.getConversationHistory(sessionId, limit);
  return history.reverse();
}
