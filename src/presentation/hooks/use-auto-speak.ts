"use client";

import type { UIMessage } from "ai";
import { useEffect, useRef } from "react";

interface UseAutoSpeakOptions {
  messages: UIMessage[];
  isStreaming: boolean;
  enabled: boolean;
  resetKey?: string;
  speak: (text: string, onPlaybackStarted?: () => void) => Promise<void> | void;
  stopSpeaking?: () => void;
  onSegmentPlaybackStarted?: (assistantId: string, segment: string) => void;
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

function takeReadySegments(text: string, flushRemainder: boolean) {
  const segments: string[] = [];
  let remaining = text.trimStart();

  while (remaining) {
    const punctuationMatch = /[.!?。！？](?:\s|$)/u.exec(remaining);
    const punctuationEnd = punctuationMatch
      ? (punctuationMatch.index ?? 0) + punctuationMatch[0].length
      : -1;
    const longEnough = remaining.length >= 120;
    const splitAtWhitespace = longEnough
      ? remaining.slice(0, 120).lastIndexOf(" ") + 1
      : -1;
    const splitIndex = punctuationEnd > 0 ? punctuationEnd : splitAtWhitespace;

    if (splitIndex <= 0) break;
    segments.push(remaining.slice(0, splitIndex).trim());
    remaining = remaining.slice(splitIndex).trimStart();
  }

  if (flushRemainder && remaining.trim()) {
    segments.push(remaining.trim());
    remaining = "";
  }

  return { segments, remainder: remaining };
}

/** Speaks complete streamed phrases while keeping bootstrap messages silent. */
export function useAutoSpeak({
  messages,
  isStreaming,
  enabled,
  resetKey = "default",
  speak,
  stopSpeaking,
  onSegmentPlaybackStarted,
  onNarrationCompleted,
}: UseAutoSpeakOptions) {
  const initializedRef = useRef(false);
  const baselineAssistantIdRef = useRef<string | undefined>(undefined);
  const activeAssistantIdRef = useRef<string | undefined>(undefined);
  const observedTextRef = useRef("");
  const pendingSpeechTextRef = useRef("");
  const speechQueueRef = useRef<string[]>([]);
  const speechLoopActiveRef = useRef(false);
  const speechGenerationRef = useRef(0);
  const previousResetKeyRef = useRef(resetKey);
  const previousEnabledRef = useRef(enabled);
  const isStreamingRef = useRef(isStreaming);

  useEffect(() => {
    isStreamingRef.current = isStreaming;
    const latestAssistant = [...messages]
      .reverse()
      .find((message) => message.role === "assistant");

    if (previousResetKeyRef.current !== resetKey) {
      previousResetKeyRef.current = resetKey;
      initializedRef.current = false;
      baselineAssistantIdRef.current = undefined;
      activeAssistantIdRef.current = undefined;
      observedTextRef.current = "";
      pendingSpeechTextRef.current = "";
      speechQueueRef.current = [];
      speechGenerationRef.current += 1;
      stopSpeaking?.();
      return;
    }

    if (!enabled && previousEnabledRef.current) {
      speechQueueRef.current = [];
      pendingSpeechTextRef.current = "";
      speechGenerationRef.current += 1;
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

    if (!enabled) return;

    if (
      latestAssistant.id !== activeAssistantIdRef.current &&
      latestAssistant.id !== baselineAssistantIdRef.current
    ) {
      activeAssistantIdRef.current = latestAssistant.id;
      observedTextRef.current = "";
      pendingSpeechTextRef.current = "";
    }

    if (latestAssistant.id !== activeAssistantIdRef.current) return;

    const text = messageText(latestAssistant);
    const previousText = observedTextRef.current;
    const delta = text.startsWith(previousText) ? text.slice(previousText.length) : text;
    observedTextRef.current = text;
    pendingSpeechTextRef.current += delta;

    const { segments, remainder } = takeReadySegments(
      pendingSpeechTextRef.current,
      !isStreaming,
    );
    pendingSpeechTextRef.current = remainder;
    speechQueueRef.current.push(...segments);

    if (!speechQueueRef.current.length || speechLoopActiveRef.current) return;

    const generation = speechGenerationRef.current;
    speechLoopActiveRef.current = true;
    void (async () => {
      try {
        while (
          speechQueueRef.current.length &&
          generation === speechGenerationRef.current &&
          enabled
        ) {
          const segment = speechQueueRef.current.shift();
          const assistantId = activeAssistantIdRef.current;
          if (!segment || !assistantId) continue;
          await speak(segment, () => onSegmentPlaybackStarted?.(assistantId, segment));
        }
      } finally {
        speechLoopActiveRef.current = false;
        const assistantId = activeAssistantIdRef.current;
        if (
          assistantId &&
          generation === speechGenerationRef.current &&
          !isStreamingRef.current &&
          speechQueueRef.current.length === 0
        ) {
          onNarrationCompleted?.(assistantId);
        }
      }
    })();
  }, [
    enabled,
    isStreaming,
    messages,
    onNarrationCompleted,
    onSegmentPlaybackStarted,
    resetKey,
    speak,
    stopSpeaking,
  ]);
}
