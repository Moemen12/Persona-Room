import { z } from "zod";

import { broadcastRoomEvent } from "@/features/audience/audience.service";
import { getSessionBootstrap, updateSessionCompanion } from "@/features/auth/auth.service";
import { COMPANION_IDS } from "@/features/persona/persona.types";
import { getSupabaseAuthUser } from "@/infrastructure/supabase/server";
import { createErrorResponse } from "@/lib/http";

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
    if (!accessToken) return new Response(null, { status: 401 });
    const authUser = await getSupabaseAuthUser(accessToken);
    return Response.json(await getSessionBootstrap(authUser.id));
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const accessToken = getAccessToken(request);
    if (!accessToken) return new Response(null, { status: 401 });
    const input = companionUpdateSchema.parse(await request.json());
    const authUser = await getSupabaseAuthUser(accessToken);
    const session = await updateSessionCompanion(input.sessionId, authUser.id, input.companionId);
    await broadcastRoomEvent(session.id, { type: "companion-changed", companionId: session.companionId });
    return Response.json({ session });
  } catch (error) {
    return createErrorResponse(error);
  }
}
