import { type UIMessage } from "ai";

import { createCompanionChatStream } from "@/features/chat/chat.service";
import { chatRequestSchema } from "@/features/chat/chat.schemas";
import { AuthenticationError, MethodNotAllowedError } from "@/lib/errors";
import { createErrorResponse } from "@/lib/http";
import { getSupabaseAuthUser } from "@/infrastructure/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAccessToken(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
}

export async function POST(request: Request) {
  try {
    const accessToken = getAccessToken(request);
    if (!accessToken) throw new AuthenticationError();

    const input = chatRequestSchema.parse(await request.json());
    const user = await getSupabaseAuthUser(accessToken);
    return await createCompanionChatStream({
      sessionId: input.sessionId,
      supabaseAuthId: user.id,
      messages: input.messages as UIMessage[],
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
