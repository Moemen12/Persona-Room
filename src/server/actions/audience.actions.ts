'use server';

import * as audienceService from '@/features/audience/audience.service';
import { submitVoteSchema, getVoteTallySchema, getTranscriptSchema } from '@/features/audience/audience.schemas';
import { createApiResponse, createApiError, ApiResponse } from '@/lib/errors';

export async function submitAudienceVote(input: unknown): Promise<ApiResponse> {
  try {
    const parsed = submitVoteSchema.parse(input);
    const success = await audienceService.submitVote(
      parsed.sessionId,
      parsed.option,
      parsed.voterFingerprint,
    );
    return createApiResponse({ success });
  } catch (error) {
    return createApiError(error);
  }
}

export async function getAudienceVoteTally(input: unknown): Promise<ApiResponse> {
  try {
    const parsed = getVoteTallySchema.parse(input);
    const tally = await audienceService.getVoteTally(parsed.sessionId);
    return createApiResponse(tally);
  } catch (error) {
    return createApiError(error);
  }
}

export async function getAudienceTranscript(input: unknown): Promise<ApiResponse> {
  try {
    const parsed = getTranscriptSchema.parse(input);
    const transcript = await audienceService.getSessionTranscript(parsed.sessionId);
    return createApiResponse(transcript);
  } catch (error) {
    return createApiError(error);
  }
}
