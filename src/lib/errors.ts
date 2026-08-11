export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
  }
}

export class AuthenticationError extends AppError {
  constructor() {
    super("Your session needs to be refreshed.", "UNAUTHENTICATED", 401);
    this.name = "AuthenticationError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} was not found.`, "NOT_FOUND", 404);
    this.name = "NotFoundError";
  }
}

export class RateLimitError extends AppError {
  constructor() {
    super("Slow down a second, the room is still catching up.", "RATE_LIMITED", 429);
    this.name = "RateLimitError";
  }
}

export class BudgetExceededError extends AppError {
  constructor() {
    super("Demo on pause — back soon.", "BUDGET_EXCEEDED", 429);
    this.name = "BudgetExceededError";
  }
}

export class ConfigurationError extends AppError {
  constructor() {
    super("This room is not configured yet.", "CONFIGURATION_ERROR", 503);
    this.name = "ConfigurationError";
  }
}
