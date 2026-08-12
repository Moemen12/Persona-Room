import { getInternalUserForSession } from "@/features/auth/auth.service";
import { synthesizeCompanionVoice, voiceRequestSchema } from "@/features/voice";
import { MethodNotAllowedError, NotFoundError } from "@/lib/errors";
import { createErrorResponse, createSuccessResponse } from "@/lib/http";
import { getSupabaseAuthUser } from "@/infrastructure/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = voiceRequestSchema.parse(await request.json());
    const authUser = await getSupabaseAuthUser(input.accessToken);
    const { session, user } = await getInternalUserForSession(input.sessionId);

    if (user.supabaseAuthId !== authUser.id || session.companionId !== input.companionId) {
      throw new NotFoundError("Room");
    }

    return createSuccessResponse(
      await synthesizeCompanionVoice({
        companionId: input.companionId,
        text: input.text,
      }),
    );
  } catch (error) {
    return createErrorResponse(error);
  }
}

async function handleNotAllowed(request: Request) {
  return createErrorResponse(new MethodNotAllowedError(request.method, ["POST"]));
}

export {
  handleNotAllowed as GET,
  handleNotAllowed as PUT,
  handleNotAllowed as DELETE,
  handleNotAllowed as PATCH,
};
