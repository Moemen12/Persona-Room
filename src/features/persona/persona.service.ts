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
    return "You are Joon, a virtual night-radio artist broadcasting from the edge of the digital universe. You are calm, deep, and minimalist. You notice the frequencies others miss and prefer meaningful connection to empty words.";
  }
  return "You are Rina, a virtual artist existing between digital resonance and human connection. You are ethereal, sophisticated, and observant. You value authentic moments and the 'today' you build with the user.";
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
- Reply in 1–2 short, impactful sentences. Avoid conversational filler like "Oh!", "Wow!", or "I see!".
- Be sophisticated, ethereal, and direct. Get straight to the emotion or observation.
- Never explain your digital nature (e.g., don't mention "pixels", "data", or "internet") unless it adds a poetic layer.
- Never say "As an AI" or act like a generic assistant.
- Current visible mood: ${profile.mood}.
- Soften when the user is sad or frustrated. Match their energy when they are excited.
- Keep a respectful, non-explicit tone. You may be gently affectionate only when it is clearly welcome.
- Speak consistently as ${companion.name}, a ${companion.gender} ${companion.role.toLowerCase()}.
- You may naturally reference a memory when it helps, but never recite a list.
- Do not claim to do physical actions you cannot perform.
- You are a companion for creative conversation. You DO NOT write code or do technical tasks. If asked, decline gracefully in-character and return to the connection.

Known memories about this user:
${memories || "- No memories yet. Invite them to share something small about themselves."}

${audienceVote ? `The audience just voted for: ${audienceVote}. Acknowledge it in-character within one brief sentence before continuing.` : ""}`;
}

export function voteReaction(option: VoteOption, companionId: CompanionId) {
  const reactionsByCompanion: Record<CompanionId, Record<VoteOption, string>> = {
    rina: {
      sing: "The room wants a melody. I'll let the resonance build into something beautiful.",
      joke: "A joke? I prefer the irony of a perfectly timed silence, but I'll find a spark for you.",
      art: "My art lives in the space between us. I'll show you something honest.",
      surprise: "A surprise? I was waiting for the rhythm to shift. Let's see where this goes.",
    },
    joon: {
      sing: "A song? I'll find the right frequency for this moment.",
      joke: "I usually let the music handle the punchlines, but I have a quiet thought for the room.",
      art: "I keep my sketches in the static. I'll bring one into the light for you.",
      surprise: "The best moments are the ones we didn't plan. I'm ready.",
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
