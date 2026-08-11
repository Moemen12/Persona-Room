export const PERSONA_MOODS = [
  "neutral",
  "happy",
  "surprised",
  "sad/thoughtful",
] as const;

export const COMPANION_IDS = ["rina", "joon"] as const;

export type PersonaMood = (typeof PERSONA_MOODS)[number];
export type CompanionId = (typeof COMPANION_IDS)[number];
export type CompanionGender = "female" | "male";
export type ClassifiedEmotion =
  | "happy"
  | "sad"
  | "excited"
  | "neutral"
  | "frustrated";

export interface CompanionDefinition {
  id: CompanionId;
  name: string;
  gender: CompanionGender;
  role: string;
  tagline: string;
  selectorCopy: string;
  welcome: string;
  avatarDirectory: string;
}

export const COMPANIONS: Record<CompanionId, CompanionDefinition> = {
  rina: {
    id: "rina",
    name: "Rina",
    gender: "female",
    role: "VIRTUAL ARTIST",
    tagline: "Soft voice. Bright little chaos.",
    selectorCopy: "Playful, luminous, and gently mischievous.",
    welcome: "Rina saved you a little corner of the night.",
    avatarDirectory: "rina",
  },
  joon: {
    id: "joon",
    name: "Joon",
    gender: "male",
    role: "NIGHT-RADIO ARTIST",
    tagline: "Warm focus. Quiet confidence.",
    selectorCopy: "Calm, observant, and softly magnetic.",
    welcome: "Joon left the studio light on for you.",
    avatarDirectory: "joon",
  },
};

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
