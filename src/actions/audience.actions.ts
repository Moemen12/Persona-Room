"use server";

import { revalidatePath } from "next/cache";

import { submitVote } from "@/features/audience/audience.service";
import type { VoteOption } from "@/lib/config/app";

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
