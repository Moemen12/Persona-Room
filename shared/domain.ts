/**
 * Shared domain types and errors for Persona Room
 */

export type Mood = 'neutral' | 'happy' | 'surprised' | 'sad/thoughtful';

export interface MoodAnalysis {
  emotion: Mood;
  intensity: number; // 1-5
}

export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string, id: string | number) {
    super('NOT_FOUND', `${resource} with id ${id} not found`, 404);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, public details?: Record<string, string[]>) {
    super('VALIDATION_ERROR', message, 400);
    this.name = 'ValidationError';
  }
}

export class ConversationNotFoundError extends NotFoundError {
  constructor(id: number) {
    super('Conversation', id);
    this.name = 'ConversationNotFoundError';
  }
}

export class SessionNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('Session', id);
    this.name = 'SessionNotFoundError';
  }
}

export class MemoryNotFoundError extends NotFoundError {
  constructor(id: number) {
    super('Memory', id);
    this.name = 'MemoryNotFoundError';
  }
}

export class GeminiError extends DomainError {
  constructor(message: string) {
    super('GEMINI_ERROR', `AI service error: ${message}`, 500);
    this.name = 'GeminiError';
  }
}

export class RedisError extends DomainError {
  constructor(message: string) {
    super('REDIS_ERROR', `Cache service error: ${message}`, 500);
    this.name = 'RedisError';
  }
}
