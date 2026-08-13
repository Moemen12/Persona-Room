"use server";

import { getInternalUserForSession } from "@/features/auth/auth.service";
import { transcribeVoiceAudio } from "@/features/voice";
import { getSupabaseAuthUser } from "@/infrastructure/supabase/server";
import { NotFoundError } from "@/lib/errors";

export interface TranscriptionState {
  transcript?: string;
  error?: string;
  status: "idle" | "pending" | "success" | "error";
}

export async function transcribeAction(
  prevState: TranscriptionState,
  formData: FormData,
): Promise<TranscriptionState> {
  try {
    const accessToken = formData.get("accessToken") as string;
    const sessionId = formData.get("sessionId") as string;
    const companionId = formData.get("companionId") as string;
    const audio = formData.get("audio") as File;

    if (!accessToken || !sessionId || !companionId || !audio) {
      return { status: "error", error: "Missing required transcription data." };
    }

    const authUser = await getSupabaseAuthUser(accessToken);
    const { session, user } = await getInternalUserForSession(sessionId);

    if (user.supabaseAuthId !== authUser.id || session.companionId !== companionId) {
      throw new NotFoundError("Voice session");
    }

    const { transcript } = await transcribeVoiceAudio({ audio });

    if (!transcript) {
      return { status: "error", error: "I didn't catch that. Please try again." };
    }

    return { status: "success", transcript };
  } catch (error) {
    console.error("[Transcription Action Error]", error);
    return {
      status: "error",
      error: error instanceof Error ? error.message : "Transcription failed.",
    };
  }
}
