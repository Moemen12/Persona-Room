import { type CompanionId } from "@/features/persona/persona.types";
import { APP_CONFIG } from "@/lib/config/app";
import { NotFoundError } from "@/lib/errors";
import { getSupabaseAdminClient } from "@/infrastructure/supabase/server";

import type { PersonaSession, PersonaUser, SessionBootstrap } from "./auth.types";

function guestName() {
  return `Guest-${Math.floor(1000 + Math.random() * 9000)}`;
}

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

export async function ensurePersonaUserAndSession(supabaseAuthId: string) {
  const client = getSupabaseAdminClient();
  const { data: existingUser, error: lookupError } = await client
    .from("users")
    .select("id, supabase_auth_id, display_name")
    .eq("supabase_auth_id", supabaseAuthId)
    .maybeSingle();
  if (lookupError) throw lookupError;

  let userRow = existingUser;
  if (!userRow) {
    const { data: createdUser, error: createUserError } = await client
      .from("users")
      .insert({ supabase_auth_id: supabaseAuthId, display_name: guestName() })
      .select("id, supabase_auth_id, display_name")
      .single();
    if (createUserError || !createdUser) throw createUserError ?? new NotFoundError("User");
    userRow = createdUser;
  }

  const user = toPersonaUser(userRow as Record<string, unknown>);

  const { data: existingSession, error: sessionError } = await client
    .from("sessions")
    .select("id, user_id, audience_enabled, companion_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sessionError) throw sessionError;
  if (existingSession) return { user, session: toPersonaSession(existingSession as Record<string, unknown>) };

  const { data: createdSession, error: createError } = await client
    .from("sessions")
    .insert({ user_id: user.id, audience_enabled: true, companion_id: "rina" })
    .select("id, user_id, audience_enabled, companion_id, created_at")
    .single();

  if (createError || !createdSession) throw createError ?? new NotFoundError("Session");
  return { user, session: toPersonaSession(createdSession as Record<string, unknown>) };
}

export async function getSessionBootstrap(supabaseAuthId: string): Promise<SessionBootstrap> {
  const { user, session } = await ensurePersonaUserAndSession(supabaseAuthId);
  const client = getSupabaseAdminClient();
  const { data: conversations, error } = await client
    .from("conversations")
    .select("id, role, content, created_at")
    .eq("user_id", user.id)
    .eq("companion_id", session.companionId)
    .order("created_at", { ascending: false })
    .limit(APP_CONFIG.conversationHistoryLimit);

  if (error) throw error;
  return {
    user,
    session,
    mood: "neutral",
    messages: (conversations ?? [])
      .reverse()
      .map((row) => ({
        id: String(row.id),
        role: row.role as "user" | "assistant",
        content: String(row.content),
        createdAt: String(row.created_at),
      })),
  };
}

export async function updateSessionCompanion(
  sessionId: string,
  supabaseAuthId: string,
  companionId: CompanionId,
): Promise<PersonaSession> {
  const { session, user } = await getInternalUserForSession(sessionId);
  if (user.supabaseAuthId !== supabaseAuthId) throw new NotFoundError("Room");
  if (session.companionId === companionId) return session;

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

export async function getInternalUserForSession(sessionId: string) {
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
