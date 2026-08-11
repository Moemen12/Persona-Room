import { NextResponse } from "next/server";
import { ZodError, type ZodIssue } from "zod";

import { AppError } from "@/lib/errors";

export function createSuccessResponse<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function createErrorResponse(error: unknown) {
  if (error instanceof ZodError) {
    const details = error.issues.map((e: ZodIssue) => ({
      field: e.path.join("."),
      message: e.message,
    }));
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid input parameters provided.",
          details,
        },
      },
      { status: 400 },
    );
  }

  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
        },
      },
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
