"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

interface UseTranscriptAutoScrollOptions {
  messageCount: number;
  lastMessageId: string | undefined;
  resetKey: string;
  contentKey?: string;
}

/** Keeps a transcript pinned to the latest content after data or room changes. */
export function useTranscriptAutoScroll({
  messageCount,
  lastMessageId,
  resetKey,
  contentKey = "",
}: UseTranscriptAutoScrollOptions) {
  const transcriptRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const transcript = transcriptRef.current;
    if (!transcript) return;

    transcript.scrollTop = transcript.scrollHeight;
  }, [contentKey, lastMessageId, messageCount, resetKey]);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (!transcript || typeof MutationObserver === "undefined") return;

    let frameId: number | undefined;
    const scrollToLatest = () => {
      if (frameId !== undefined) window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        transcript.scrollTop = transcript.scrollHeight;
        frameId = undefined;
      });
    };

    const observer = new MutationObserver(scrollToLatest);
    observer.observe(transcript, {
      characterData: true,
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      if (frameId !== undefined) window.cancelAnimationFrame(frameId);
    };
  }, [resetKey]);

  return transcriptRef;
}
