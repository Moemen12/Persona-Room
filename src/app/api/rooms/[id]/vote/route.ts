import { submitVote } from "@/features/audience/audience.service";
import { voteRequestSchema } from "@/features/audience/audience.schemas";
import { createErrorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const [{ id }, input] = await Promise.all([context.params, request.json()]);
    const { option, fingerprint } = voteRequestSchema.parse(input);
    return Response.json(await submitVote(id, option, fingerprint));
  } catch (error) {
    return createErrorResponse(error);
  }
}
