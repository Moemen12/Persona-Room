import { z } from "zod";

import { getRoomSnapshot } from "@/features/audience/audience.service";
import { MethodNotAllowedError } from "@/lib/errors";
import { createErrorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  id: z.string().uuid("Invalid room ID format."),
});

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const validatedParams = paramsSchema.parse({ id });
    return Response.json(await getRoomSnapshot(validatedParams.id));
  } catch (error) {
    return createErrorResponse(error);
  }
}

async function handleNotAllowed(request: Request) {
  return createErrorResponse(new MethodNotAllowedError(request.method, ["GET"]));
}

export {
  handleNotAllowed as POST,
  handleNotAllowed as PUT,
  handleNotAllowed as DELETE,
  handleNotAllowed as PATCH,
};
