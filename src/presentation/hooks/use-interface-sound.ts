"use client";

import { useCallback, useState } from "react";

export type InterfaceSound = "send" | "vote" | "share";

const soundShape: Record<InterfaceSound, { frequency: number; duration: number; offset?: number }> = {
  send: { frequency: 494, duration: 0.09 },
  vote: { frequency: 622, duration: 0.12, offset: 92 },
  share: { frequency: 740, duration: 0.1, offset: 62 },
};

export function useInterfaceSound() {
  const [soundEnabled, setSoundEnabled] = useState(true);

  const play = useCallback(
    (sound: InterfaceSound) => {
      if (!soundEnabled || typeof window === "undefined") return;
      try {
        const AudioContextConstructor = window.AudioContext;
        if (!AudioContextConstructor) return;

        const context = new AudioContextConstructor();
        const primary = context.createOscillator();
        const gain = context.createGain();
        const shape = soundShape[sound];
        const now = context.currentTime;

        primary.type = "sine";
        primary.frequency.setValueAtTime(shape.frequency, now);
        primary.frequency.exponentialRampToValueAtTime(shape.frequency * 1.11, now + shape.duration);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.075, now + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + shape.duration);
        primary.connect(gain).connect(context.destination);
        primary.start(now);
        primary.stop(now + shape.duration + 0.02);

        if (shape.offset) {
          const accent = context.createOscillator();
          accent.type = "triangle";
          accent.frequency.setValueAtTime(shape.frequency + shape.offset, now + 0.03);
          accent.connect(gain);
          accent.start(now + 0.03);
          accent.stop(now + shape.duration + 0.02);
        }
      } catch {
        // Sound feedback is a progressive enhancement; a silent interaction remains complete.
      }
    },
    [soundEnabled],
  );

  return { soundEnabled, setSoundEnabled, play };
}
