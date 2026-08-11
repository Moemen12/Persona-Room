export const PERSONA_MOODS = [
  "neutral",
  "happy",
  "surprised",
  "sad/thoughtful",
] as const;

export type PersonaMood = (typeof PERSONA_MOODS)[number];
export type ClassifiedEmotion =
  | "happy"
  | "sad"
  | "excited"
  | "neutral"
  | "frustrated";

export interface EmotionAnalysis {
  emotion: ClassifiedEmotion;
  intensity: number;
}

export interface PersonaMemory {
  id?: number;
  content: string;
  importance: number;
  createdAt?: string;
}

export interface PersonaProfile {
  mood: PersonaMood;
  memories: PersonaMemory[];
  lastSessionId?: string;
}
