"use client";

import type { UIMessage } from "ai";
import { useEffect, useRef } from "react";

interface UseAutoSpeakOptions {
  messages: UIMessage[];
  isStreaming: boolean;
  enabled: boolean;
  resetKey?: string;
  speak: (text: string) => void;
}

function messageText(message: UIMessage) {
  return message.parts
    .filter(
      (part): part is Extract<(typeof message.parts)[number], { type: "text" }> =>
        part.type === "text",
    )
    .map((part) => part.text)
    .join("")
    .trim();
}

/** Synchronizes completed assistant replies with the optional neural voice enhancement. */
export function useAutoSpeak({
  messages,
  isStreaming,
  enabled,
  resetKey = "default",
  speak,
}: UseAutoSpeakOptions) {
  const initializedRef = useRef(false);
  const pendingGeneratedReplyRef = useRef(false);
  const previousResetKeyRef = useRef(resetKey);
  const lastSpokenMessageIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const latestAssistant = [...messages].reverse().find((message) => message.role === "assistant");

    if (previousResetKeyRef.current !== resetKey) {
      previousResetKeyRef.current = resetKey;
      initializedRef.current = false;
      pendingGeneratedReplyRef.current = false;
      lastSpokenMessageIdRef.current = undefined;
      return;
    }

    if (!latestAssistant) return;

    if (!initializedRef.current) {
      if (isStreaming) {
        pendingGeneratedReplyRef.current = true;
        return;
      }

      initializedRef.current = true;
      const text = messageText(latestAssistant);
      const isGeneratedReply = pendingGeneratedReplyRef.current;
      pendingGeneratedReplyRef.current = false;

      if (isGeneratedReply && enabled && text) {
        lastSpokenMessageIdRef.current = latestAssistant.id;
        speak(text);
      } else {
        lastSpokenMessageIdRef.current = latestAssistant.id;
      }
      return;
    }

    if (latestAssistant.id === lastSpokenMessageIdRef.current || isStreaming) return;

    const text = messageText(latestAssistant);
    if (!text) return;

    lastSpokenMessageIdRef.current = latestAssistant.id;
    if (enabled) speak(text);
  }, [enabled, isStreaming, messages, resetKey, speak]);
}
