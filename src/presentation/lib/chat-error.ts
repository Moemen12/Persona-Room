const DEFAULT_CHAT_ERROR = "The room hit a little static. Please try again.";
const MAX_VISIBLE_ERROR_LENGTH = 180;

type ErrorPayload = {
  error?: {
    message?: unknown;
  };
  message?: unknown;
};

function isErrorPayload(value: unknown): value is ErrorPayload {
  return typeof value === "object" && value !== null;
}

function parseMessage(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const message = value.trim();
  if (!message) return undefined;

  try {
    const parsed: unknown = JSON.parse(message);
    if (isErrorPayload(parsed)) {
      const nestedMessage = isErrorPayload(parsed.error)
        ? parseMessage(parsed.error.message)
        : undefined;
      return nestedMessage ?? parseMessage(parsed.message);
    }
  } catch {
    // The provider may return a plain text error. Continue with the safe text path.
  }

  if (message.startsWith("<!DOCTYPE") || message.startsWith("<html")) {
    return undefined;
  }

  return message.length <= MAX_VISIBLE_ERROR_LENGTH ? message : undefined;
}

export function formatChatError(error: unknown) {
  if (error instanceof Error) {
    return parseMessage(error.message) ?? DEFAULT_CHAT_ERROR;
  }

  return parseMessage(error) ?? DEFAULT_CHAT_ERROR;
}
