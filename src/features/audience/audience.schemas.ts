import { z } from 'zod';

export const VOTE_OPTIONS = ['Sing a song', 'Tell a joke', 'Show your art', 'Surprise us'] as const;

export const submitVoteSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  option: z.enum(VOTE_OPTIONS),
  voterFingerprint: z.string().min(1, 'Voter fingerprint required'),
});

export const getVoteTallySchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
});

export const getTranscriptSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
});

export type SubmitVoteInput = z.infer<typeof submitVoteSchema>;
export type GetVoteTallyInput = z.infer<typeof getVoteTallySchema>;
export type GetTranscriptInput = z.infer<typeof getTranscriptSchema>;
export type VoteOption = (typeof VOTE_OPTIONS)[number];
