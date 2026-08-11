import { Ratelimit } from "@upstash/ratelimit";

import { getInternalUserForSession } from "@/features/auth/auth.service";
import { voteReaction } from "@/features/persona/persona.service";
import { APP_CONFIG, VOTE_OPTIONS, type VoteOption } from "@/lib/config/app";
import { NotFoundError, RateLimitError } from "@/lib/errors";
import { getRedisClient, withRedisFallback } from "@/infrastructure/redis/client";
import { getSupabaseAdminClient } from "@/infrastructure/supabase/server";

import * as audienceRepository from "./audience.repository";
import type { RoomBroadcast, RoomSnapshot, VoteTally, AudienceServiceDependencies } from "./audience.types";

function emptyTally(): VoteTally {
  return Object.fromEntries(VOTE_OPTIONS.map((option) => [option.value, 0])) as VoteTally;
}

function roomChannel(sessionId: string) {
  return `room:${sessionId}`;
}

const defaultDependencies: AudienceServiceDependencies = {
  findRoomMessages: audienceRepository.findRoomMessages,
  findVoteTally: audienceRepository.findVoteTally,
  insertVote: audienceRepository.insertVote,
  insertAssistantReaction: audienceRepository.insertAssistantReaction,
};

export async function broadcastRoomEvent(sessionId: string, event: RoomBroadcast) {
  const client = getSupabaseAdminClient();
  const channel = client.channel(roomChannel(sessionId));
  try {
    await channel.httpSend("room-event", event);
  } finally {
    await client.removeChannel(channel);
  }
}

export async function getVoteTally(
  sessionId: string,
  dependencies: AudienceServiceDependencies = defaultDependencies,
): Promise<VoteTally> {
  const fallback = async () => {
    const rawTally = await dependencies.findVoteTally(sessionId);
    return VOTE_OPTIONS.reduce<VoteTally>((tally, option) => {
      tally[option.value] = Number(rawTally[option.value] ?? 0);
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

export async function getRoomSnapshot(
  sessionId: string,
  dependencies: AudienceServiceDependencies = defaultDependencies,
): Promise<RoomSnapshot> {
  const { session, user } = await getInternalUserForSession(sessionId);
  if (!session.audienceEnabled) throw new NotFoundError("Room");

  const messages = await dependencies.findRoomMessages(
    user.id,
    session.companionId,
    APP_CONFIG.publicTranscriptLimit,
  );

  return {
    id: session.id,
    audienceEnabled: session.audienceEnabled,
    companionId: session.companionId,
    messages,
    tally: await getVoteTally(sessionId, dependencies),
  };
}

export async function submitVote(
  sessionId: string,
  option: VoteOption,
  fingerprint: string,
  dependencies: AudienceServiceDependencies = defaultDependencies,
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

  await dependencies.insertVote(sessionId, option, fingerprint);

  const tally = await withRedisFallback(
    async () => {
      const redis = getRedisClient();
      await redis.hincrby(`room:${sessionId}:votes`, option, 1);
      await redis.expire(`room:${sessionId}:votes`, APP_CONFIG.voteCacheSeconds);
      await redis.set(`room:${sessionId}:last-vote`, option, { ex: APP_CONFIG.voteCacheSeconds });
      return getVoteTally(sessionId, dependencies);
    },
    () => getVoteTally(sessionId, dependencies),
  );

  const reactionContent = voteReaction(option, session.companionId);
  const message = await dependencies.insertAssistantReaction(
    user.id,
    session.companionId,
    reactionContent,
  );

  await broadcastRoomEvent(sessionId, {
    type: "persona-reaction",
    message,
    tally,
    option,
  });

  return { tally, message };
}
