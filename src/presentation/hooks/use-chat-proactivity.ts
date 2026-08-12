"use client";

import type { UIMessage } from "ai";
import { useEffect, useState } from "react";

import type { CompanionId } from "@/features/persona";

interface UseChatProactivityOptions {
  messages: UIMessage[];
  isStreaming: boolean;
  companionId: CompanionId;
  enabled?: boolean;
}

const QUIET_PERIOD_MS = 18_000;

export function useChatProactivity({
  messages,
  isStreaming,
  companionId,
  enabled = true,
}: UseChatProactivityOptions) {
  const [hint, setHint] = useState<{ anchorId: string; text: string }>();
  const latestMessage = messages.at(-1);
  const latestAssistant = [...messages].reverse().find((message) => message.role === "assistant");
  const hasUserMessage = messages.some((message) => message.role === "user");
  const latestAssistantId = latestAssistant?.id;

  useEffect(() => {
    if (!enabled || isStreaming || !hasUserMessage || latestMessage?.role !== "assistant" || !latestAssistantId) {
      return;
    }

    const timer = setTimeout(() => {
      setHint({
        anchorId: latestAssistantId,
        text:
          companionId === "joon"
            ? "The studio light is still on. Want to tell me one more thing?"
            : "I was about to ask… are you still there, or did I distract you?",
      });
    }, QUIET_PERIOD_MS);

    return () => clearTimeout(timer);
  }, [companionId, enabled, hasUserMessage, isStreaming, latestAssistantId, latestMessage?.id, latestMessage?.role]);

  const proactiveHint =
    hint && hint.anchorId === latestAssistantId && latestMessage?.role === "assistant"
      ? hint.text
      : undefined;

  return { proactiveHint };
}
