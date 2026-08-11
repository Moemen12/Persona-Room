import { type CompanionId } from "@/features/persona/persona.types";
import { getSupabaseAdminClient } from "@/infrastructure/supabase/server";
import { NotFoundError } from "@/lib/errors";

import type { PersonaSession, PersonaUser } from "./auth.types";

function toCompanionId(value: unknown): CompanionId {
  return value === "joon" ? "joon" : "rina";
}

function toPersonaUser(row: Record<string, unknown>): PersonaUser {
  return {
    id: String(row.id),
    supabaseAuthId: String(row.supabase_auth_id),
    displayName: String(row.display_name),
  };
}

function toPersonaSession(row: Record<string, unknown>): PersonaSession {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    audienceEnabled: Boolean(row.audience_enabled),
    companionId: toCompanionId(row.companion_id),
    createdAt: String(row.created_at),
  };
}

export async function findUserBySupabaseId(supabaseAuthId: string): Promise<PersonaUser | null> {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("users")
    .select("id, supabase_auth_id, display_name")
    .eq("supabase_auth_id", supabaseAuthId)
    .maybeSingle();
  if (error) throw error;
  return data ? toPersonaUser(data as Record<string, unknown>) : null;
}

export async function createUser(supabaseAuthId: string, displayName: string): Promise<PersonaUser> {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("users")
    .insert({ supabase_auth_id: supabaseAuthId, display_name: displayName })
    .select("id, supabase_auth_id, display_name")
    .single();
  if (error || !data) throw error ?? new NotFoundError("User");
  return toPersonaUser(data as Record<string, unknown>);
}

export async function findLatestSessionByUserId(userId: string): Promise<PersonaSession | null> {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("sessions")
    .select("id, user_id, audience_enabled, companion_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? toPersonaSession(data as Record<string, unknown>) : null;
}

export async function createSession(userId: string, companionId: CompanionId): Promise<PersonaSession> {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("sessions")
    .insert({ user_id: userId, audience_enabled: true, companion_id: companionId })
    .select("id, user_id, audience_enabled, companion_id, created_at")
    .single();
  if (error || !data) throw error ?? new NotFoundError("Session");
  return toPersonaSession(data as Record<string, unknown>);
}

export async function updateSessionCompanion(
  sessionId: string,
  companionId: CompanionId,
): Promise<PersonaSession> {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("sessions")
    .update({ companion_id: companionId })
    .eq("id", sessionId)
    .select("id, user_id, audience_enabled, companion_id, created_at")
    .single();
  if (error || !data) throw error ?? new NotFoundError("Room");
  return toPersonaSession(data as Record<string, unknown>);
}

export async function findSessionWithUserById(sessionId: string) {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("sessions")
    .select("id, user_id, audience_enabled, companion_id, created_at, users!inner(id, supabase_auth_id, display_name)")
    .eq("id", sessionId)
    .single();

  if (error || !data) throw new NotFoundError("Room");
  const record = data as unknown as Record<string, unknown>;
  const joinedUser = record.users as Record<string, unknown>;
  return { session: toPersonaSession(record), user: toPersonaUser(joinedUser) };
}

export async function findConversationsByUserIdAndCompanionId(
  userId: string,
  companionId: CompanionId,
  limit: number,
) {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("conversations")
    .select("id, role, content, created_at")
    .eq("user_id", userId)
    .eq("companion_id", companionId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw error;
  return (data ?? []).slice(-limit).map((row) => ({
    id: String(row.id),
    role: row.role as "user" | "assistant",
    content: String(row.content),
    createdAt: String(row.created_at),
  }));
}
