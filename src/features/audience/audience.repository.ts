import { createServerClient } from '@/infrastructure/database/supabase';
import { Vote, VoteTally, Transcript } from './audience.types';
import { VoteOption } from './audience.schemas';

export async function addVote(
  sessionId: string,
  option: VoteOption,
  voterFingerprint: string,
): Promise<Vote> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('votes')
    .insert({
      session_id: sessionId,
      option,
      voter_fingerprint: voterFingerprint,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    sessionId: data.session_id,
    option: data.option,
    voterFingerprint: data.voter_fingerprint,
    createdAt: new Date(data.created_at),
  };
}

export async function getVoteTally(sessionId: string): Promise<VoteTally> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('votes')
    .select()
    .eq('session_id', sessionId);

  if (error) throw error;

  const tally: VoteTally = {
    'Sing a song': 0,
    'Tell a joke': 0,
    'Show your art': 0,
    'Surprise us': 0,
  };

  (data || []).forEach((vote) => {
    if (vote.option in tally) {
      tally[vote.option as VoteOption]++;
    }
  });

  return tally;
}

export async function getSessionTranscript(sessionId: string): Promise<Transcript[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('conversations')
    .select()
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });

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

export async function checkVoteRateLimit(
  sessionId: string,
  voterFingerprint: string,
  windowSeconds = 5,
): Promise<boolean> {
  const supabase = await createServerClient();

  const now = new Date();
  const windowStart = new Date(now.getTime() - windowSeconds * 1000);

  const { data, error } = await supabase
    .from('votes')
    .select()
    .eq('session_id', sessionId)
    .eq('voter_fingerprint', voterFingerprint)
    .gte('created_at', windowStart.toISOString());

  if (error) throw error;

  return (data || []).length === 0;
}
