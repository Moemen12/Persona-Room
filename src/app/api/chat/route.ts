import { type UIMessage } from "ai";

import { createCompanionChatStream } from "@/features/chat/chat.service";
import { chatRequestSchema } from "@/features/chat/chat.schemas";
import { createErrorResponse } from "@/lib/http";
import { getSupabaseAuthUser } from "@/infrastructure/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = chatRequestSchema.parse(await request.json());
    const user = await getSupabaseAuthUser(input.accessToken);
    return await createCompanionChatStream({
      sessionId: input.sessionId,
      supabaseAuthId: user.id,
      messages: input.messages as UIMessage[],
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}
