import { Heart, Sparkles } from "lucide-react";

import { COMPANIONS, type CompanionId, type PersonaMood } from "@/features/persona";
import { cn } from "@/lib/utils";
import { RinaAvatar } from "@/presentation/components/rina-avatar";

interface PersonaSidebarProps {
  companionId: CompanionId;
  mood: PersonaMood;
  isLive: boolean;
  viewerCount: number;
  isSpeaking: boolean;
  onOpenSelector: () => void;
}

function listenerLabel(viewerCount: number) {
  if (viewerCount === 0) return "private for now";
  return `${viewerCount} ${viewerCount === 1 ? "listener" : "listeners"}`;
}

export function PersonaSidebar({
  companionId,
  mood,
  isLive,
  viewerCount,
  isSpeaking,
  onOpenSelector,
}: PersonaSidebarProps) {
  const companion = COMPANIONS[companionId];
  const roomStatus = isLive ? listenerLabel(viewerCount) : "opening a private room";

  return (
    <aside className="persona-profile">
      <div
        className={cn("persona-profile__halo", mood !== "neutral" && "persona-profile__halo--ripple")}
        aria-hidden="true"
      />
      <div className="persona-profile__live">
        <span className="presence-pulse" aria-hidden="true" />
        <span>LIVE</span>
      </div>

      <RinaAvatar companionId={companionId} mood={mood} size="hero" isSpeaking={isSpeaking} />

      <div className="persona-profile__copy">
        <span className="eyebrow">
          <Sparkles aria-hidden="true" size={12} />
          {companion.tagline}
        </span>
        <h1>{companion.name}</h1>
        <p className="persona-profile__line">{companion.selectorCopy}</p>
      </div>

      <div className="persona-profile__signals">
        <div
          className={cn("persona-profile__mood", mood !== "neutral" && "persona-profile__mood--active")}
          role="status"
          aria-label={`Current mood: ${mood}`}
          key={mood}
        >
          <Heart aria-hidden="true" size={13} />
          <span>Feeling <strong>{mood}</strong></span>
        </div>
        <div className="persona-profile__status" role="status" aria-label={`Room status: ${roomStatus}`}>
          <span className={cn("connection-dot", isLive && "connection-dot--live")} aria-hidden="true" />
          <span>{roomStatus}</span>
        </div>
      </div>

      <button
        className="persona-profile__change"
        type="button"
        onClick={onOpenSelector}
      >
        Change companion ({companion.name})
      </button>
    </aside>
  );
}
