import { type CompanionId } from "@/features/persona/persona.types";
import { type AudienceReaction, type VoteOption } from "@/lib/config/app";
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
  messages: RoomMessage[];
  tally: VoteTally;
}

export type RoomBroadcast = {
  type: "message" | "vote-tally" | "persona-reaction";
  message?: RoomMessage;
  tally?: VoteTally;
  option?: VoteOption;
} | {
  type: "audience-reaction";
  reaction: AudienceReaction;
  reactionId: string;
} | {
  type: "companion-changed";
  companionId: CompanionId;
};
