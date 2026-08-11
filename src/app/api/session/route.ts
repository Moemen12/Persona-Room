import { getSessionBootstrap } from "@/features/auth/auth.service";
import { createErrorResponse } from "@/lib/http";
import { getSupabaseAuthUser } from "@/infrastructure/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization");
    const accessToken = authorization?.replace(/^Bearer\s+/i, "");
    if (!accessToken) return new Response(null, { status: 401 });
    const authUser = await getSupabaseAuthUser(accessToken);
    return Response.json(await getSessionBootstrap(authUser.id));
  } catch (error) {
    return createErrorResponse(error);
  }
}
