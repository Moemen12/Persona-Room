export type Mood = 'neutral' | 'happy' | 'surprised' | 'sad/thoughtful';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string | number) {
    super('NOT_FOUND', `${resource} with id ${id} not found`, 404);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public details?: Record<string, string[]>) {
    super('VALIDATION_ERROR', message, 400);
    this.name = 'ValidationError';
  }
}

export function createApiResponse<T>(data: T): ApiResponse<T> {
  return { success: true, data };
}

export function createApiError(error: unknown): ApiResponse {
  if (error instanceof AppError) {
    return {
      success: false,
      error: { code: error.code, message: error.message },
    };
  }

  if (error instanceof Error) {
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    };
  }

  return {
    success: false,
    error: { code: 'UNKNOWN_ERROR', message: 'An unknown error occurred' },
  };
}
