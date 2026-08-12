import { z } from "zod";

import { broadcastRoomEvent } from "@/features/audience/audience.service";
import { getSessionBootstrap, updateSessionCompanion } from "@/features/auth/auth.service";
import { COMPANION_IDS } from "@/features/persona/persona.types";
import { getSupabaseAuthUser } from "@/infrastructure/supabase/server";
import { AuthenticationError, MethodNotAllowedError } from "@/lib/errors";
import { createErrorResponse, createSuccessResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

const companionUpdateSchema = z.object({
  sessionId: z.uuid(),
  companionId: z.enum(COMPANION_IDS),
});

function getAccessToken(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
}

export async function POST(request: Request) {
  try {
    const accessToken = getAccessToken(request);
    if (!accessToken) return createErrorResponse(new AuthenticationError());
    const authUser = await getSupabaseAuthUser(accessToken);
    const bootstrap = await getSessionBootstrap(authUser.id);
    return createSuccessResponse(bootstrap);
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const accessToken = getAccessToken(request);
    if (!accessToken) return createErrorResponse(new AuthenticationError());
    const input = companionUpdateSchema.parse(await request.json());
    const authUser = await getSupabaseAuthUser(accessToken);
    const session = await updateSessionCompanion(input.sessionId, authUser.id, input.companionId);
    await broadcastRoomEvent(session.id, { type: "companion-changed", companionId: session.companionId });
    return createSuccessResponse({ session });
  } catch (error) {
    return createErrorResponse(error);
  }
}

async function handleNotAllowed(request: Request) {
  return createErrorResponse(new MethodNotAllowedError(request.method, ["POST", "PUT"]));
}

export {
  handleNotAllowed as GET,
  handleNotAllowed as DELETE,
  handleNotAllowed as PATCH,
};
