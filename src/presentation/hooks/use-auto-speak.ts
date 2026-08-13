"use client";

import type { UIMessage } from "ai";
import { useEffect, useRef } from "react";

interface SpeakOptions {
  onPlaybackStarted?: () => void;
  onPlaybackFinished?: () => void;
}

const VOICE_GATE_TIMEOUT_MS = 8_000;

interface UseAutoSpeakOptions {
  messages: UIMessage[];
  isStreaming: boolean;
  enabled: boolean;
  resetKey?: string;
  speak: (text: string, options?: SpeakOptions) => Promise<void> | void;
  stopSpeaking?: () => void;
  onAssistantResponseStarted?: (assistantId: string) => void;
  onAssistantPlaybackStarted?: (assistantId: string) => void;
  onAssistantPlaybackTimeout?: (assistantId: string) => void;
  onNarrationCompleted?: (assistantId: string) => void;
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

/** Speaks one completed assistant response, keeping bootstrap history silent. */
export function useAutoSpeak({
  messages,
  isStreaming,
  enabled,
  resetKey = "default",
  speak,
  stopSpeaking,
  onAssistantResponseStarted,
  onAssistantPlaybackStarted,
  onAssistantPlaybackTimeout,
  onNarrationCompleted,
}: UseAutoSpeakOptions) {
  const initializedRef = useRef(false);
  const baselineAssistantIdRef = useRef<string | undefined>(undefined);
  const activeAssistantIdRef = useRef<string | undefined>(undefined);
  const spokenAssistantIdRef = useRef<string | undefined>(undefined);
  const previousResetKeyRef = useRef(resetKey);
  const previousEnabledRef = useRef(enabled);
  const requestGenerationRef = useRef(0);
  const isPlaybackActiveRef = useRef(false);
  const playbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const latestAssistant = [...messages]
      .reverse()
      .find((message) => message.role === "assistant");

    if (previousResetKeyRef.current !== resetKey) {
      previousResetKeyRef.current = resetKey;
      initializedRef.current = false;
      baselineAssistantIdRef.current = undefined;
      activeAssistantIdRef.current = undefined;
      spokenAssistantIdRef.current = undefined;
      requestGenerationRef.current += 1;
      isPlaybackActiveRef.current = false;
      if (playbackTimeoutRef.current) clearTimeout(playbackTimeoutRef.current);
      playbackTimeoutRef.current = undefined;
      stopSpeaking?.();
      return;
    }

    if (!enabled && previousEnabledRef.current) {
      requestGenerationRef.current += 1;
      isPlaybackActiveRef.current = false;
      if (playbackTimeoutRef.current) clearTimeout(playbackTimeoutRef.current);
      playbackTimeoutRef.current = undefined;
      stopSpeaking?.();
    }
    previousEnabledRef.current = enabled;

    if (!latestAssistant) return;

    if (!initializedRef.current) {
      if (isStreaming) return;
      initializedRef.current = true;
      baselineAssistantIdRef.current = latestAssistant.id;
      return;
    }

    if (isStreaming) return;

    const isNewAssistantResponse =
      latestAssistant.id !== activeAssistantIdRef.current &&
      latestAssistant.id !== baselineAssistantIdRef.current;
    if (isNewAssistantResponse) {
      activeAssistantIdRef.current = latestAssistant.id;
      spokenAssistantIdRef.current = undefined;
      onAssistantResponseStarted?.(latestAssistant.id);
    }

    if (!enabled) {
      if (isNewAssistantResponse) {
        onAssistantPlaybackStarted?.(latestAssistant.id);
        onNarrationCompleted?.(latestAssistant.id);
      }
      return;
    }

    if (
      latestAssistant.id !== activeAssistantIdRef.current ||
      spokenAssistantIdRef.current === latestAssistant.id ||
      isPlaybackActiveRef.current
    ) {
      return;
    }

    const responseText = messageText(latestAssistant);
    if (!responseText) return;

    const generation = requestGenerationRef.current;
    spokenAssistantIdRef.current = latestAssistant.id;
    isPlaybackActiveRef.current = true;
    let settled = false;

    const settle = () => {
      if (settled || generation !== requestGenerationRef.current) return;
      settled = true;
      isPlaybackActiveRef.current = false;
      if (playbackTimeoutRef.current) clearTimeout(playbackTimeoutRef.current);
      playbackTimeoutRef.current = undefined;
      onNarrationCompleted?.(latestAssistant.id);
    };

    playbackTimeoutRef.current = setTimeout(() => {
      if (settled || generation !== requestGenerationRef.current) return;
      onAssistantPlaybackTimeout?.(latestAssistant.id);
      stopSpeaking?.();
      settle();
    }, VOICE_GATE_TIMEOUT_MS);

    try {
      const result = speak(responseText, {
        onPlaybackStarted: () => {
          if (playbackTimeoutRef.current) clearTimeout(playbackTimeoutRef.current);
          playbackTimeoutRef.current = undefined;
          onAssistantPlaybackStarted?.(latestAssistant.id);
        },
        onPlaybackFinished: settle,
      });
      if (result instanceof Promise) void result.catch(settle);
    } catch {
      settle();
    }
  }, [
    enabled,
    isStreaming,
    messages,
    onAssistantPlaybackStarted,
    onAssistantPlaybackTimeout,
    onAssistantResponseStarted,
    onNarrationCompleted,
    resetKey,
    speak,
    stopSpeaking,
  ]);
}
