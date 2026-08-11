import { createServerClient } from '@/infrastructure/database/supabase';
import { ChatSession, Conversation, Memory } from './chat.types';

export async function createSession(
  userId: string,
  audienceEnabled: boolean,
): Promise<ChatSession> {
  const supabase = await createServerClient();
  const sessionId = crypto.randomUUID();

  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({
      id: sessionId,
      user_id: userId,
      audience_enabled: audienceEnabled,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    userId: data.user_id,
    audienceEnabled: data.audience_enabled,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
}

export async function getSession(sessionId: string): Promise<ChatSession> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('chat_sessions')
    .select()
    .eq('id', sessionId)
    .single();

  if (error) throw error;
  if (!data) throw new Error('Session not found');

  return {
    id: data.id,
    userId: data.user_id,
    audienceEnabled: data.audience_enabled,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
}

export async function addConversation(
  userId: string,
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
  mood?: string,
): Promise<Conversation> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      user_id: userId,
      session_id: sessionId,
      role,
      content,
      mood,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    userId: data.user_id,
    sessionId: data.session_id,
    role: data.role,
    content: data.content,
    mood: data.mood,
    createdAt: new Date(data.created_at),
  };
}

export async function getConversationHistory(
  sessionId: string,
  limit = 50,
): Promise<Conversation[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('conversations')
    .select()
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data || []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    sessionId: row.session_id,
    role: row.role,
    content: row.content,
    mood: row.mood,
    createdAt: new Date(row.created_at),
  }));
}

export async function addMemory(
  userId: string,
  content: string,
  importance = 1,
): Promise<Memory> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('memories')
    .insert({
      user_id: userId,
      content,
      importance,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    userId: data.user_id,
    content: data.content,
    importance: data.importance,
    createdAt: new Date(data.created_at),
  };
}

export async function getUserMemories(userId: string, limit = 6): Promise<Memory[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('memories')
    .select()
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data || []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    content: row.content,
    importance: row.importance,
    createdAt: new Date(row.created_at),
  }));
}
