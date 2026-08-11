import { Mood } from '@/lib/errors';

export interface ChatSession {
  id: string;
  userId: string;
  audienceEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Conversation {
  id: number;
  userId: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  mood?: string;
  createdAt: Date;
}

export interface Memory {
  id: number;
  userId: string;
  content: string;
  importance: number;
  createdAt: Date;
}

export interface MoodAnalysis {
  emotion: Mood;
  intensity: number;
}

export interface SendMessageResponse {
  response: string;
  mood: Mood;
  moodAnalysis: MoodAnalysis;
}
