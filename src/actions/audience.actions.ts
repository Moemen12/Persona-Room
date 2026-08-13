"use server";

import { revalidatePath } from "next/cache";

import { audienceReactionSchema, batchedReactionsSchema } from "@/features/audience/audience.schemas";
import { publishAudienceReaction, publishBatchedReactions, submitVote } from "@/features/audience/audience.service";
import type { AudienceReaction, VoteOption } from "@/lib/config/app";

export async function submitAudienceReactionAction(
  sessionId: string,
  reaction: AudienceReaction,
) {
  try {
    const parsed = audienceReactionSchema.parse({ reaction });
    await publishAudienceReaction(sessionId, parsed.reaction);
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "That reaction did not land. Try again.",
    };
  }
}

export async function submitBatchedReactionsAction(
  sessionId: string,
  reactions: AudienceReaction[],
) {
  try {
    const parsed = batchedReactionsSchema.parse({ reactions });
    await publishBatchedReactions(sessionId, parsed.reactions);
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Reactions could not be synced.",
    };
  }
}

export async function submitVoteAction(sessionId: string, option: VoteOption, voterToken: string) {
  try {
    const tally = await submitVote(sessionId, option, voterToken);
    revalidatePath(`/room/${sessionId}`);
    return { success: true, tally };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "That vote did not land. Try again.",
    };
  }
}
