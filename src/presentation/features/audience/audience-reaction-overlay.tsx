"use client";

import { Flame, Heart, Laugh, Sparkles, Zap } from "lucide-react";
import type { CSSProperties } from "react";

interface AudienceReactionOverlayProps {
  reaction?: {
    id: number;
    kind: "vote" | "surprise" | "welcome" | "heart" | "fire" | "laugh";
    label: string;
  };
}

const CONFETTI_COLORS = ["#ff5cf3", "#38ef7d", "#ffcc00", "#00f2fe", "#ffffff", "#ff4b2b"];

export function AudienceReactionOverlay({ reaction }: AudienceReactionOverlayProps) {
  if (!reaction) return null;

  const Icon =
    reaction.kind === "vote"
      ? Zap
      : reaction.kind === "surprise"
        ? Sparkles
        : reaction.kind === "fire"
          ? Flame
          : reaction.kind === "laugh"
            ? Laugh
            : Heart;

  const variantClass =
    reaction.kind === "fire"
      ? "audience-reaction__toast--fire"
      : reaction.kind === "laugh"
        ? "audience-reaction__toast--laugh"
        : reaction.kind === "heart"
          ? "audience-reaction__toast--heart"
          : "audience-reaction__toast--default";

  return (
    <div className="audience-reaction" key={reaction.id} aria-live="polite">
      <div className={`audience-reaction__toast ${variantClass}`}>
        <span className="audience-reaction__icon" aria-hidden="true">
          <Icon size={17} />
        </span>
        <span>{reaction.label}</span>
      </div>
      <div className="audience-reaction__confetti" aria-hidden="true">
        {Array.from({ length: 18 }, (_, index) => {
          const style = {
            "--confetti-delay": `${(index % 6) * 45}ms`,
            "--confetti-x": `${(index % 2 === 0 ? 1 : -1) * (18 + ((index * 13) % 64))}px`,
            "--confetti-rotate": `${index * 37}deg`,
            "--confetti-color": CONFETTI_COLORS[index % CONFETTI_COLORS.length],
          } as CSSProperties;

          return <span className="audience-reaction__confetti-piece" key={index} style={style} />;
        })}
      </div>
    </div>
  );
}
