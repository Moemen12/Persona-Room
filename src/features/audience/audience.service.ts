import * as audienceRepo from './audience.repository';
import { cacheSet, cacheGet, cacheIncrement } from '@/infrastructure/database/redis';
import { VoteOption } from './audience.schemas';
import { VoteTally } from './audience.types';

export async function submitVote(
  sessionId: string,
  option: VoteOption,
  voterFingerprint: string,
): Promise<boolean> {
  // Check rate limit (1 vote per 5 seconds)
  const canVote = await audienceRepo.checkVoteRateLimit(sessionId, voterFingerprint, 5);
  if (!canVote) {
    return false;
  }

  // Add vote to database
  await audienceRepo.addVote(sessionId, option, voterFingerprint);

  // Update vote count in cache
  const cacheKey = `votes:${sessionId}:${option}`;
  await cacheIncrement(cacheKey);

  // Invalidate tally cache
  await cacheSet(`votes:${sessionId}:tally`, null, 0);

  return true;
}

export async function getVoteTally(sessionId: string): Promise<VoteTally> {
  // Try cache first
  const cached = await cacheGet<VoteTally>(`votes:${sessionId}:tally`);
  if (cached) {
    return cached;
  }

  // Fall back to database
  const tally = await audienceRepo.getVoteTally(sessionId);

  // Cache for 5 minutes
  await cacheSet(`votes:${sessionId}:tally`, tally, 300);

  return tally;
}

export async function getSessionTranscript(sessionId: string) {
  return await audienceRepo.getSessionTranscript(sessionId);
}

export async function trackActiveSession(sessionId: string) {
  // Mark session as active in cache (1 hour TTL)
  await cacheSet(`session:${sessionId}:active`, true, 3600);
}
