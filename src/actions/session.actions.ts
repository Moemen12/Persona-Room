"use server";

import { revalidatePath } from "next/cache";

import { updateSessionCompanion, getSessionBootstrap } from "@/features/auth/auth.service";
import { getSupabaseAuthUser } from "@/infrastructure/supabase/server";
import type { SessionBootstrap } from "@/features/auth";
import type { CompanionId } from "@/features/persona";

export interface SessionState {
  bootstrap?: SessionBootstrap;
  error?: string;
  status: "idle" | "pending" | "success" | "error";
}

export async function updateCompanionAction(
  prevState: SessionState,
  formData: FormData,
): Promise<SessionState> {
  try {
    const accessToken = formData.get("accessToken") as string;
    const sessionId = formData.get("sessionId") as string;
    const companionId = formData.get("companionId") as CompanionId;

    if (!accessToken || !sessionId || !companionId) {
      return { status: "error", error: "Missing required session data." };
    }

    const authUser = await getSupabaseAuthUser(accessToken);
    await updateSessionCompanion(sessionId, authUser.id, companionId);

    const bootstrap = await getSessionBootstrap(authUser.id);

    revalidatePath("/");
    revalidatePath(`/room/${sessionId}`);

    return { status: "success", bootstrap };
  } catch (error) {
    console.error("[Update Companion Action Error]", error);
    return {
      status: "error",
      error: error instanceof Error ? error.message : "Failed to update companion.",
    };
  }
}
