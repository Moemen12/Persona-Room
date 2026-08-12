import { getSupabaseAdminClient } from "@/infrastructure/supabase/server";
import { type VoteOption } from "@/lib/config/app";
import { sortRoomMessages } from "@/lib/message-order";
import { type RoomMessage } from "./audience.types";
import { type CompanionId } from "@/features/persona/persona.types";

export async function findRoomMessages(userId: string, companionId: CompanionId, limit: number): Promise<RoomMessage[]> {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("conversations")
    .select("id, role, content, created_at")
    .eq("user_id", userId)
    .eq("companion_id", companionId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return sortRoomMessages(
    (data ?? []).map((row) => ({
      id: String(row.id),
      role: row.role as "user" | "assistant",
      content: String(row.content),
      createdAt: String(row.created_at),
    })),
  );
}

export async function findVoteTally(sessionId: string): Promise<Record<string, number>> {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("votes")
    .select("option")
    .eq("session_id", sessionId);
  if (error) throw error;

  const tally: Record<string, number> = {};
  (data ?? []).forEach((row) => {
    const option = row.option as string;
    tally[option] = (tally[option] ?? 0) + 1;
  });
  return tally;
}

export async function insertVote(sessionId: string, option: VoteOption, fingerprint: string): Promise<void> {
  const client = getSupabaseAdminClient();
  const { error } = await client
    .from("votes")
    .insert({ session_id: sessionId, option, voter_fingerprint: fingerprint });
  if (error) throw error;
}

export async function insertAssistantReaction(
  userId: string,
  companionId: CompanionId,
  content: string
): Promise<RoomMessage> {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("conversations")
    .insert({
      user_id: userId,
      companion_id: companionId,
      role: "assistant",
      content,
    })
    .select("id, role, content, created_at")
    .single();
  if (error || !data) throw error ?? new Error("Reaction failed");
  return {
    id: String(data.id),
    role: data.role as "assistant",
    content: String(data.content),
    createdAt: String(data.created_at),
  };
}
