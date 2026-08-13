import { type CompanionId, type ConversationLanguage, type PersonalityId } from "@/features/persona/persona.types";
import { type AudienceReaction, type VoteOption } from "@/lib/config/app";
import type { PersonaMood } from "@/features/persona";
import type * as audienceRepository from "./audience.repository";

export type AudienceServiceDependencies = {
  findRoomMessages: typeof audienceRepository.findRoomMessages;
  findVoteTally: typeof audienceRepository.findVoteTally;
  insertVote: typeof audienceRepository.insertVote;
  insertAssistantReaction: typeof audienceRepository.insertAssistantReaction;
};

export interface RoomMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export type VoteTally = Record<VoteOption, number>;

export interface RoomSnapshot {
  id: string;
  audienceEnabled: boolean;
  companionId: CompanionId;
  language: ConversationLanguage;
  personalityId: PersonalityId;
  messages: RoomMessage[];
  tally: VoteTally;
}

export type RoomBroadcast = {
  type: "message" | "vote-tally" | "persona-reaction";
  message?: RoomMessage;
  mood?: PersonaMood;
  tally?: VoteTally;
  option?: VoteOption;
} | {
  type: "audience-reaction";
  reaction?: AudienceReaction;
  reactions?: AudienceReaction[];
  reactionId?: string;
  batchId?: string;
} | {
  type: "companion-changed";
  companionId: CompanionId;
  language: ConversationLanguage;
  personalityId: PersonalityId;
};
