"use client";

import { useCallback, useState } from "react";

export interface FloatingReaction {
  id: string;
  kind: "vote" | "surprise" | "welcome" | "heart" | "fire" | "laugh";
  emoji: string;
  x: number; // Horizontal offset in percentage (0-100)
  drift: number; // Horizontal drift in pixels
  rotate: number; // Final rotation in degrees
}

const REACTION_DURATION_MS = 2_800;

export function useAudienceReaction() {
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);

  const triggerReaction = useCallback((kind: FloatingReaction["kind"], emoji: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    // Random horizontal position between 10% and 90%
    const x = 10 + Math.random() * 80;
    // Random drift between -40px and 40px
    const drift = (Math.random() - 0.5) * 80;
    // Random rotation between -20 and 20 degrees
    const rotate = (Math.random() - 0.5) * 40;

    const newReaction: FloatingReaction = { id, kind, emoji, x, drift, rotate };

    setReactions((current) => [...current, newReaction]);

    setTimeout(() => {
      setReactions((current) => current.filter((r) => r.id !== id));
    }, REACTION_DURATION_MS);
  }, []);

  return { reactions, triggerReaction };
}
