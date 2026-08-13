export const APP_CONFIG = {
  productName: "Persona Room",
  personaName: "Rina",
  maxMessageCharacters: 2_000,
  maxUiMessagesInRequest: 50,
  conversationHistoryLimit: 8,
  memoryLimit: 6,
  profileCacheSeconds: 60 * 60,
  voiceCacheSeconds: 7 * 24 * 60 * 60,
  voteRateLimitSeconds: 5,
  voteCacheSeconds: 5 * 60,
  dailyGeminiRequestCap: 120,
  publicTranscriptLimit: 50,
} as const;

export const VOTE_OPTIONS = [
  {
    value: "sing",
    label: "Give us a tiny performance",
    shortLabel: "Perform something",
    emoji: "🎤",
    cue: "give the room a tiny performance or playful demonstration",
  },
  {
    value: "joke",
    label: "Make the room laugh",
    shortLabel: "Make us laugh",
    emoji: "😂",
    cue: "make the room laugh with a short, in-character moment",
  },
  {
    value: "art",
    label: "Open a personal thought",
    shortLabel: "Open up",
    emoji: "🎨",
    cue: "share one personal, harmless thought that helps the room feel closer",
  },
  {
    value: "surprise",
    label: "Take the conversation somewhere",
    shortLabel: "Surprise us",
    emoji: "✨",
    cue: "surprise the room with a safe, playful turn in the conversation",
  },
] as const;

export type VoteOption = (typeof VOTE_OPTIONS)[number]["value"];

export const AUDIENCE_REACTIONS = [
  { value: "heart", label: "Love it", emoji: "♥" },
  { value: "fire", label: "Fire", emoji: "🔥" },
  { value: "laugh", label: "Made me laugh", emoji: "😂" },
] as const;

export type AudienceReaction = (typeof AUDIENCE_REACTIONS)[number]["value"];
