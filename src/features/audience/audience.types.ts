import { VoteOption } from './audience.schemas';

export interface Vote {
  id: number;
  sessionId: string;
  option: VoteOption;
  voterFingerprint: string;
  createdAt: Date;
}

export interface VoteTally {
  'Sing a song': number;
  'Tell a joke': number;
  'Show your art': number;
  'Surprise us': number;
}

export interface Transcript {
  id: number;
  userId: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  mood?: string;
  createdAt: Date;
}
