"use client";

import type { CSSProperties } from "react";
import type { FloatingReaction } from "@/presentation/hooks/use-audience-reaction";

interface AudienceReactionOverlayProps {
  reactions: FloatingReaction[];
}

export function AudienceReactionOverlay({ reactions }: AudienceReactionOverlayProps) {
  return (
    <div className="audience-reaction-container" aria-hidden="true">
      {reactions.map((reaction) => (
        <div
          key={reaction.id}
          className={`floating-reaction floating-reaction--${reaction.kind}`}
          style={{ 
            left: `${reaction.x}%`,
            "--drift-x": `${reaction.drift}px`,
            "--rotate-end": `${reaction.rotate}deg`
          } as CSSProperties}
        >
          <span className="floating-reaction__emoji">{reaction.emoji}</span>
        </div>
      ))}
    </div>
  );
}
