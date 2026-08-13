"use server";

import { getInternalUserForSession } from "@/features/auth/auth.service";
import { CONVERSATION_LANGUAGES, type ConversationLanguage } from "@/features/persona";
import { transcribeVoiceAudio } from "@/features/voice";
import { getSupabaseAuthUser } from "@/infrastructure/supabase/server";
import { NotFoundError } from "@/lib/errors";

export interface TranscriptionState {
  transcript?: string;
  error?: string;
  status: "idle" | "pending" | "success" | "error";
}

function isConversationLanguage(value: string): value is ConversationLanguage {
  return CONVERSATION_LANGUAGES.includes(value as ConversationLanguage);
}

export async function transcribeAction(
  _prevState: TranscriptionState,
  formData: FormData,
): Promise<TranscriptionState> {
  try {
    const accessToken = formData.get("accessToken");
    const sessionId = formData.get("sessionId");
    const companionId = formData.get("companionId");
    const language = formData.get("language");
    const audio = formData.get("audio");

    if (
      typeof accessToken !== "string" ||
      typeof sessionId !== "string" ||
      typeof companionId !== "string" ||
      typeof language !== "string" ||
      !isConversationLanguage(language) ||
      !(audio instanceof File)
    ) {
      return { status: "error", error: "Missing or invalid voice session data." };
    }

    const authUser = await getSupabaseAuthUser(accessToken);
    const { session, user } = await getInternalUserForSession(sessionId);

    if (
      user.supabaseAuthId !== authUser.id ||
      session.companionId !== companionId ||
      session.language !== language
    ) {
      throw new NotFoundError("Voice session");
    }

    const { transcript } = await transcribeVoiceAudio({ audio, language });

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
