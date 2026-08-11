import { NotFoundError } from "@/lib/errors";
import { createErrorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

async function handleNotFound() {
  return createErrorResponse(new NotFoundError("API Endpoint"));
}

export {
  handleNotFound as GET,
  handleNotFound as POST,
  handleNotFound as PUT,
  handleNotFound as DELETE,
  handleNotFound as PATCH,
  handleNotFound as OPTIONS,
  handleNotFound as HEAD,
};
