import { getInternalUserForSession } from "@/features/auth/auth.service";
import {
  transcribeVoiceAudio,
  voiceAudioSchema,
  voiceTranscriptionMetadataSchema,
} from "@/features/voice";
import { getSupabaseAuthUser } from "@/infrastructure/supabase/server";
import { AuthenticationError, MethodNotAllowedError, NotFoundError } from "@/lib/errors";
import { createErrorResponse, createSuccessResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAccessToken(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
}

export async function POST(request: Request) {
  try {
    const accessToken = getAccessToken(request);
    if (!accessToken) throw new AuthenticationError();

    const formData = await request.formData();
    const metadata = voiceTranscriptionMetadataSchema.parse({
      sessionId: formData.get("sessionId"),
      companionId: formData.get("companionId"),
      language: formData.get("language"),
    });
    const { audio } = voiceAudioSchema.parse({ audio: formData.get("audio") });
    const authUser = await getSupabaseAuthUser(accessToken);
    const { session, user } = await getInternalUserForSession(
      metadata.sessionId
    );

    if (
      user.supabaseAuthId !== authUser.id ||
      session.companionId !== metadata.companionId ||
      session.language !== metadata.language
    ) {
      throw new NotFoundError("Voice session");
    }

    return createSuccessResponse(await transcribeVoiceAudio({ audio, language: metadata.language }));
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
