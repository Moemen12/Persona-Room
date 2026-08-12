"use client";

import { useEffect, useState } from "react";

interface UseTypewriterTextOptions {
  text: string;
  enabled: boolean;
  charactersPerSecond?: number;
}

/** Reveals a complete, already-available message with a short cinematic type-in effect. */
export function useTypewriterText({
  text,
  enabled,
  charactersPerSecond = 72,
}: UseTypewriterTextOptions) {
  const [visibleLength, setVisibleLength] = useState(enabled ? 0 : text.length);

  useEffect(() => {
    if (!enabled || !text) return;

    let frame = 0;
    const startedAt = performance.now();
    const millisecondsPerCharacter = 1000 / charactersPerSecond;

    const animate = (now: number) => {
      const nextLength = Math.min(
        text.length,
        Math.floor((now - startedAt) / millisecondsPerCharacter),
      );
      setVisibleLength(nextLength);
      if (nextLength < text.length) {
        frame = requestAnimationFrame(animate);
      }
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [charactersPerSecond, enabled, text]);

  return enabled ? text.slice(0, visibleLength) : text;
}
