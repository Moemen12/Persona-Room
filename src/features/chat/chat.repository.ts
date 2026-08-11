import { getRedisClient } from "@/infrastructure/redis/client";
import { getSupabaseAdminClient } from "@/infrastructure/supabase/server";
import { APP_CONFIG, type VoteOption } from "@/lib/config/app";
import { type CompanionId, type PersonaMemory, type PersonaProfile } from "@/features/persona/persona.types";
import { type StoredConversation } from "./chat.types";

export async function findMemoriesByUserId(userId: string): Promise<PersonaMemory[]> {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("memories")
    .select("id, content, importance, created_at")
    .eq("user_id", userId)
    .order("importance", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(APP_CONFIG.memoryLimit);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: Number(row.id),
    content: String(row.content),
    importance: Number(row.importance),
    createdAt: String(row.created_at),
  }));
}

export async function saveMemories(userId: string, memories: PersonaMemory[]): Promise<void> {
  const client = getSupabaseAdminClient();
  const { error } = await client
    .from("memories")
    .insert(memories.map((memory) => ({ user_id: userId, ...memory })));
  if (error) throw error;
}

export async function deleteMemoriesByIds(ids: number[]): Promise<void> {
  const client = getSupabaseAdminClient();
  const { error } = await client.from("memories").delete().in("id", ids);
  if (error) throw error;
}

export async function findOldMemoriesForCleanup(userId: string, limit: number) {
  const client = getSupabaseAdminClient();
  const { data } = await client
    .from("memories")
    .select("id")
    .eq("user_id", userId)
    .order("importance", { ascending: true })
    .order("created_at", { ascending: true })
    .range(limit, limit + 20);
  return data ?? [];
}

export async function saveConversations(
  userId: string,
  companionId: CompanionId,
  userText: string,
  assistantText: string,
): Promise<void> {
  const client = getSupabaseAdminClient();
  const { error } = await client.from("conversations").insert([
    { user_id: userId, companion_id: companionId, role: "user", content: userText },
    { user_id: userId, companion_id: companionId, role: "assistant", content: assistantText },
  ]);
  if (error) throw error;
}

export async function findConversationHistory(
  userId: string,
  companionId: CompanionId,
  limit: number,
): Promise<StoredConversation[]> {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("conversations")
    .select("role, content, created_at")
    .eq("user_id", userId)
    .eq("companion_id", companionId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;
  return (data ?? [])
    .slice(-limit)
    .map((row) => ({
      role: row.role as "user" | "assistant",
      content: String(row.content),
    }));
}

export async function getProfileCache(userId: string): Promise<PersonaProfile | null> {
  return getRedisClient().get<PersonaProfile>(`user:${userId}:profile`);
}

export async function setProfileCache(userId: string, profile: PersonaProfile): Promise<void> {
  await getRedisClient().set(`user:${userId}:profile`, profile, {
    ex: APP_CONFIG.profileCacheSeconds,
  });
}

export async function getLastVoteCache(sessionId: string): Promise<VoteOption | null> {
  return getRedisClient().get<VoteOption>(`room:${sessionId}:last-vote`);
}

export async function incrementGeminiRequestCount(): Promise<number> {
  const key = `global:gemini_requests:${new Date().toISOString().slice(0, 10)}`;
  const redis = getRedisClient();
  const total = await redis.incr(key);
  if (total === 1) await redis.expire(key, 60 * 60 * 36);
  return total;
}
