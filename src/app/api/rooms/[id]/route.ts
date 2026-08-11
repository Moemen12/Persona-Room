import { getRoomSnapshot } from "@/features/audience/audience.service";
import { createErrorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return Response.json(await getRoomSnapshot(id));
  } catch (error) {
    return createErrorResponse(error);
  }
}
