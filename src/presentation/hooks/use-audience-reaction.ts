"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface AudienceReaction {
  id: number;
  kind: "vote" | "surprise" | "welcome";
  label: string;
}

const REACTION_DURATION_MS = 2_400;

export function useAudienceReaction() {
  const [reaction, setReaction] = useState<AudienceReaction>();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerReaction = useCallback((nextReaction: Omit<AudienceReaction, "id">) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const id = Date.now();
    setReaction({ ...nextReaction, id });
    timeoutRef.current = setTimeout(() => {
      setReaction(undefined);
      timeoutRef.current = null;
    }, REACTION_DURATION_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { reaction, triggerReaction };
}
