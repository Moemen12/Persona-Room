"use client";

import type { UIMessage } from "ai";
import { useEffect, useRef } from "react";

interface UseAutoSpeakOptions {
  messages: UIMessage[];
  isStreaming: boolean;
  enabled: boolean;
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

/** Synchronizes completed assistant replies with the optional browser speech enhancement. */
export function useAutoSpeak({ messages, isStreaming, enabled, speak }: UseAutoSpeakOptions) {
  const hasInitializedRef = useRef(false);
  const lastSpokenMessageIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const latestAssistant = [...messages].reverse().find((message) => message.role === "assistant");

    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      if (latestAssistant) lastSpokenMessageIdRef.current = latestAssistant.id;
      return;
    }

    if (!latestAssistant || !enabled || isStreaming || latestAssistant.id === lastSpokenMessageIdRef.current) return;

    const text = messageText(latestAssistant);
    if (!text) return;

    lastSpokenMessageIdRef.current = latestAssistant.id;
    speak(text);
  }, [enabled, isStreaming, messages, speak]);
}
