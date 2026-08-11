import { z } from "zod";

import { submitVote } from "@/features/audience/audience.service";
import { voteRequestSchema } from "@/features/audience/audience.schemas";
import { createErrorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  id: z.string().uuid("Invalid room ID format."),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const [{ id }, input] = await Promise.all([context.params, request.json()]);
    const validatedParams = paramsSchema.parse({ id });
    const { option, fingerprint } = voteRequestSchema.parse(input);
    return Response.json(await submitVote(validatedParams.id, option, fingerprint));
  } catch (error) {
    return createErrorResponse(error);
  }
}
