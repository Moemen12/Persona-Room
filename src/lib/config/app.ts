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
  { value: "sing", label: "Sing a song", emoji: "🎤" },
  { value: "joke", label: "Tell a joke", emoji: "😂" },
  { value: "art", label: "Show your art", emoji: "🎨" },
  { value: "surprise", label: "Surprise us", emoji: "✨" },
] as const;

export type VoteOption = (typeof VOTE_OPTIONS)[number]["value"];
