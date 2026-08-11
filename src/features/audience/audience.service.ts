import { Ratelimit } from "@upstash/ratelimit";

import { getInternalUserForSession } from "@/features/auth/auth.service";
import { voteReaction } from "@/features/persona/persona.service";
import { APP_CONFIG, VOTE_OPTIONS, type VoteOption } from "@/lib/config/app";
import { NotFoundError, RateLimitError } from "@/lib/errors";
import { getRedisClient, withRedisFallback } from "@/infrastructure/redis/client";
import { getSupabaseAdminClient } from "@/infrastructure/supabase/server";

import type { RoomBroadcast, RoomSnapshot, VoteTally } from "./audience.types";

function emptyTally(): VoteTally {
  return Object.fromEntries(VOTE_OPTIONS.map((option) => [option.value, 0])) as VoteTally;
}

function roomChannel(sessionId: string) {
  return `room:${sessionId}`;
}

export async function broadcastRoomEvent(sessionId: string, event: RoomBroadcast) {
  const client = getSupabaseAdminClient();
  const channel = client.channel(roomChannel(sessionId));
  try {
    await channel.httpSend("room-event", event);
  } finally {
    await client.removeChannel(channel);
  }
}

export async function getVoteTally(sessionId: string): Promise<VoteTally> {
  const fallback = async () => {
    const client = getSupabaseAdminClient();
    const { data, error } = await client.from("votes").select("option").eq("session_id", sessionId);
    if (error) throw error;
    return (data ?? []).reduce<VoteTally>((tally, row) => {
      const option = row.option as VoteOption;
      if (option in tally) tally[option] += 1;
      return tally;
    }, emptyTally());
  };

  return withRedisFallback(
    async () => {
      const cached = await getRedisClient().hgetall<Record<string, number>>(`room:${sessionId}:votes`);
      return VOTE_OPTIONS.reduce<VoteTally>((tally, option) => {
        tally[option.value] = Number(cached?.[option.value] ?? 0);
        return tally;
      }, emptyTally());
    },
    fallback,
  );
}

export async function getRoomSnapshot(sessionId: string): Promise<RoomSnapshot> {
  const { session, user } = await getInternalUserForSession(sessionId);
  if (!session.audienceEnabled) throw new NotFoundError("Room");

  const client = getSupabaseAdminClient();
  const { data: conversations, error } = await client
    .from("conversations")
    .select("id, role, content, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(APP_CONFIG.publicTranscriptLimit);

  if (error) throw error;
  return {
    id: session.id,
    audienceEnabled: session.audienceEnabled,
    messages: (conversations ?? []).reverse().map((row) => ({
      id: String(row.id),
      role: row.role as "user" | "assistant",
      content: String(row.content),
      createdAt: String(row.created_at),
    })),
    tally: await getVoteTally(sessionId),
  };
}

export async function submitVote(
  sessionId: string,
  option: VoteOption,
  fingerprint: string,
) {
  const { session, user } = await getInternalUserForSession(sessionId);
  if (!session.audienceEnabled) throw new NotFoundError("Room");

  await withRedisFallback(
    async () => {
      const redis = getRedisClient();
      const limiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(1, `${APP_CONFIG.voteRateLimitSeconds} s`),
        prefix: "persona-room:vote",
      });
      const result = await limiter.limit(`${sessionId}:${fingerprint}`);
      if (!result.success) throw new RateLimitError();
      return undefined;
    },
    async () => undefined,
  );

  const client = getSupabaseAdminClient();
  const { error: insertError } = await client
    .from("votes")
    .insert({ session_id: sessionId, option, voter_fingerprint: fingerprint });
  if (insertError) throw insertError;

  const tally = await withRedisFallback(
    async () => {
      const redis = getRedisClient();
      await redis.hincrby(`room:${sessionId}:votes`, option, 1);
      await redis.expire(`room:${sessionId}:votes`, APP_CONFIG.voteCacheSeconds);
      await redis.set(`room:${sessionId}:last-vote`, option, { ex: APP_CONFIG.voteCacheSeconds });
      return getVoteTally(sessionId);
    },
    () => getVoteTally(sessionId),
  );

  const reaction = voteReaction(option);
  const { data: reactionRow, error: reactionError } = await client
    .from("conversations")
    .insert({ user_id: user.id, role: "assistant", content: reaction })
    .select("id, role, content, created_at")
    .single();
  if (reactionError || !reactionRow) throw reactionError ?? new NotFoundError("Reaction");

  const message = {
    id: String(reactionRow.id),
    role: reactionRow.role as "assistant",
    content: String(reactionRow.content),
    createdAt: String(reactionRow.created_at),
  };
  await broadcastRoomEvent(sessionId, {
    type: "persona-reaction",
    message,
    tally,
    option,
  });

  return { tally, message };
}
