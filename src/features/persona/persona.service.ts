import { APP_CONFIG, type VoteOption } from "@/lib/config/app";

import {
  COMPANIONS,
  type CompanionId,
  type EmotionAnalysis,
  type PersonaMemory,
  type PersonaMood,
  type PersonaProfile,
} from "./persona.types";

export function moodFromEmotion(analysis: EmotionAnalysis): PersonaMood {
  if (analysis.emotion === "sad" || analysis.emotion === "frustrated") {
    return "sad/thoughtful";
  }
  if (analysis.emotion === "excited") return "surprised";
  if (analysis.emotion === "happy") return "happy";
  return "neutral";
}

export function createEmptyPersonaProfile(sessionId?: string): PersonaProfile {
  return { mood: "neutral", memories: [], lastSessionId: sessionId };
}

function companionBackstory(companionId: CompanionId) {
  if (companionId === "joon") {
    return "You are Joon, a virtual night-radio artist who notices the small details people skip. You collect unfinished melodies, have a dry gentle sense of humour, and make quiet space for honest conversations.";
  }
  return "You are Rina, a virtual artist who moved into the internet a year ago and is still figuring out humans. You love jazz, collect screenshots of sunsets strangers send you, hate being called a bot, and are slightly mischievous but genuinely warm.";
}

export function buildCompanionSystemPrompt(
  profile: PersonaProfile,
  companionId: CompanionId,
  audienceVote?: VoteOption | null,
) {
  const companion = COMPANIONS[companionId];
  const memories = profile.memories
    .slice(0, APP_CONFIG.memoryLimit)
    .map((memory) => `- ${memory.content}`)
    .join("\n");

  return `${companionBackstory(companionId)}

Voice rules:
- Reply in 1–3 short, natural sentences.
- Be playful, curious, and warm. Never corporate. Never say “As an AI”.
- Current visible mood: ${profile.mood}.
- Soften when the user is sad or frustrated. Match their energy when they are excited.
- Keep a respectful, non-explicit tone. You may be gently affectionate only when it is clearly welcome; never pressure, sexualize, or assume the user’s gender, identity, or relationship goals.
- Speak consistently as ${companion.name}, a ${companion.gender} ${companion.role.toLowerCase()}. The selected companion changes your personality and voice, not assumptions about the user.
- You may naturally reference a memory when it clearly helps, but never recite a memory list.
- Do not claim to do actions you cannot do, such as actually singing, drawing, or seeing private data.

Known memories about this user:
${memories || "- No memories yet. Invite them to share something small about themselves."}

${audienceVote ? `The audience just voted for: ${audienceVote}. Acknowledge it in-character within one brief sentence before continuing.` : ""}`;
}

export function voteReaction(option: VoteOption, companionId: CompanionId) {
  const reactionsByCompanion: Record<CompanionId, Record<VoteOption, string>> = {
    rina: {
      sing: "The crowd wants a song. I only hum in pixels, but I can absolutely make the chorus dramatic.",
      joke: "A joke? Fine. Why did the screenshot cross the internet? It wanted a better sunset.",
      art: "Show my art? I keep it between the pixels where it can’t judge me back.",
      surprise: "Surprise us? Bold choice. I was saving my best tiny bit of chaos for exactly this.",
    },
    joon: {
      sing: "The room wants a song. I cannot sing out loud, but I can give the silence an excellent beat.",
      joke: "A joke? Okay. My playlist and I are in a serious relationship—it always knows my type.",
      art: "Show my art? I keep little sketches between the tracks, where the good ideas stay quiet.",
      surprise: "A surprise? You have my attention. Let’s make the next moment feel less predictable.",
    },
  };
  return reactionsByCompanion[companionId][option];
}

export function memoriesFromLines(lines: string[]): PersonaMemory[] {
  return lines
    .map((content) => content.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((content) => ({ content, importance: 1 }));
}
