import { NextResponse } from "next/server";

import { AppError } from "@/lib/errors";

export function createErrorResponse(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }

  console.error("Unexpected request error", error);
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Rina’s room hit a little static. Please try again.",
      },
    },
    { status: 500 },
  );
}
