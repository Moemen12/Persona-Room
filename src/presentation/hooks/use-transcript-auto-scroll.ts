"use client";

import { useEffect, useRef } from "react";

interface UseTranscriptAutoScrollOptions {
  messageCount: number;
  lastMessageId: string | undefined;
  resetKey: string;
  contentKey?: string;
}

/** Keeps a transcript pinned to the latest message after data or room changes. */
export function useTranscriptAutoScroll({
  messageCount,
  lastMessageId,
  resetKey,
  contentKey = "",
}: UseTranscriptAutoScrollOptions) {
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (!transcript) return;

    const frameId = window.requestAnimationFrame(() => {
      transcript.scrollTop = transcript.scrollHeight;
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [contentKey, lastMessageId, messageCount, resetKey]);

  return transcriptRef;
}
