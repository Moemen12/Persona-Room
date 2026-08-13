import { getInternalUserForSession } from "@/features/auth/auth.service";
import { streamCompanionVoice, voiceRequestSchema } from "@/features/voice";
import { getSupabaseAuthUser } from "@/infrastructure/supabase/server";
import { MethodNotAllowedError, NotFoundError } from "@/lib/errors";
import { createErrorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = voiceRequestSchema.parse(await request.json());
    const authUser = await getSupabaseAuthUser(input.accessToken);
    const { session, user } = await getInternalUserForSession(input.sessionId);

    if (
      user.supabaseAuthId !== authUser.id ||
      session.companionId !== input.companionId ||
      session.language !== input.language
    ) {
      throw new NotFoundError("Room");
    }

    const iterator = streamCompanionVoice({
      companionId: input.companionId,
      language: input.language,
      text: input.text,
    });
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const next = await iterator.next();
          if (next.done) {
            controller.close();
            return;
          }
          controller.enqueue(next.value);
        } catch (error) {
          controller.error(error);
        }
      },
      async cancel() {
        await iterator.return?.();
      },
    });

    return new Response(body, {
      headers: {
        "cache-control": "no-store",
        "content-type": "audio/mpeg",
        "x-content-type-options": "nosniff",
      },
    });
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
