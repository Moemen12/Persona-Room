import type { VoteOption } from "@/lib/config/app";

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
  messages: RoomMessage[];
  tally: VoteTally;
}

export interface RoomBroadcast {
  type: "message" | "vote-tally" | "persona-reaction";
  message?: RoomMessage;
  tally?: VoteTally;
  option?: VoteOption;
}
