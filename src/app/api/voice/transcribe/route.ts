import { getInternalUserForSession } from "@/features/auth/auth.service";
import {
  transcribeVoiceAudio,
  voiceAudioSchema,
  voiceTranscriptionMetadataSchema,
} from "@/features/voice";
import { getSupabaseAuthUser } from "@/infrastructure/supabase/server";
import { MethodNotAllowedError, NotFoundError } from "@/lib/errors";
import { createErrorResponse, createSuccessResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const metadata = voiceTranscriptionMetadataSchema.parse({
      accessToken: formData.get("accessToken"),
      sessionId: formData.get("sessionId"),
      companionId: formData.get("companionId"),
    });
    const { audio } = voiceAudioSchema.parse({ audio: formData.get("audio") });
    const authUser = await getSupabaseAuthUser(metadata.accessToken);
    const { session, user } = await getInternalUserForSession(
      metadata.sessionId
    );

    if (
      user.supabaseAuthId !== authUser.id ||
      session.companionId !== metadata.companionId
    ) {
      throw new NotFoundError("Voice session");
    }

    return createSuccessResponse(await transcribeVoiceAudio({ audio }));
  } catch (error) {
    return createErrorResponse(error);
  }
}

async function handleNotAllowed(request: Request) {
  return createErrorResponse(
    new MethodNotAllowedError(request.method, ["POST"])
  );
}

export {
  handleNotAllowed as GET,
  handleNotAllowed as PUT,
  handleNotAllowed as DELETE,
  handleNotAllowed as PATCH,
};
