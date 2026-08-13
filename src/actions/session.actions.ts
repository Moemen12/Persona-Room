"use server";

import { revalidatePath } from "next/cache";

import { broadcastRoomEvent } from "@/features/audience/audience.service";
import { getSessionBootstrap, updateSessionConfiguration } from "@/features/auth/auth.service";
import {
  COMPANION_IDS,
  CONVERSATION_LANGUAGES,
  PERSONALITY_IDS,
  type CompanionId,
  type ConversationLanguage,
  type PersonalityId,
} from "@/features/persona";
import { getSupabaseAuthUser } from "@/infrastructure/supabase/server";
import { z } from "zod";

export interface SessionState {
  bootstrap?: Awaited<ReturnType<typeof getSessionBootstrap>>;
  error?: string;
  status: "idle" | "pending" | "success" | "error";
}

const sessionConfigurationSchema = z.object({
  sessionId: z.uuid(),
  companionId: z.enum(COMPANION_IDS),
  language: z.enum(CONVERSATION_LANGUAGES),
  personalityId: z.enum(PERSONALITY_IDS),
});

function requiredString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

export async function updateCompanionAction(
  _prevState: SessionState,
  formData: FormData,
): Promise<SessionState> {
  try {
    const parsed = sessionConfigurationSchema.parse({
      sessionId: requiredString(formData.get("sessionId")),
      companionId: requiredString(formData.get("companionId")),
      language: requiredString(formData.get("language")),
      personalityId: requiredString(formData.get("personalityId")),
    });
    const accessToken = requiredString(formData.get("accessToken"));
    if (!accessToken) return { status: "error", error: "Your room session has expired. Refresh and try again." };

    const authUser = await getSupabaseAuthUser(accessToken);
    const session = await updateSessionConfiguration(parsed.sessionId, authUser.id, {
      companionId: parsed.companionId as CompanionId,
      language: parsed.language as ConversationLanguage,
      personalityId: parsed.personalityId as PersonalityId,
    });

    await broadcastRoomEvent(session.id, {
      type: "companion-changed",
      companionId: session.companionId,
      language: session.language,
      personalityId: session.personalityId,
    });

    const bootstrap = await getSessionBootstrap(authUser.id);
    revalidatePath("/");
    revalidatePath(`/room/${session.id}`);
    return { status: "success", bootstrap };
  } catch (error) {
    console.error("[Update Session Configuration Action Error]", error);
    return {
      status: "error",
      error: error instanceof Error ? error.message : "The room settings could not be saved.",
    };
  }
}
