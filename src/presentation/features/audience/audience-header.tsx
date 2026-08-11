"use client";

import { Sparkles, Users, Volume2, VolumeX } from "lucide-react";

import { COMPANIONS, type CompanionId } from "@/features/persona";
import { useInterfaceSound } from "@/presentation/hooks/use-interface-sound";

interface AudienceHeaderProps {
  companionId: CompanionId;
  viewerCount: number;
}

function audienceLabel(viewerCount: number) {
  return viewerCount === 1 ? "1 person is here" : `${viewerCount} people are here`;
}

export function AudienceHeader({ companionId, viewerCount }: AudienceHeaderProps) {
  const companion = COMPANIONS[companionId];
  const { play, setSoundEnabled, soundEnabled } = useInterfaceSound();

  return (
    <header className="audience-header">
      <div>
        <span className="eyebrow"><Sparkles aria-hidden="true" size={13} /> {companion.name.toUpperCase()}’S STAGE</span>
        <h1>Live Audience</h1>
      </div>
      <div className="audience-header__actions">
        <div className="audience-viewers" role="status">
          <Users aria-hidden="true" size={14} />
          <span>{audienceLabel(viewerCount)}</span>
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={() => {
            play("share");
            setSoundEnabled(!soundEnabled);
          }}
          aria-label={soundEnabled ? "Mute interface sound" : "Enable interface sound"}
        >
          {soundEnabled ? <Volume2 aria-hidden="true" size={16} /> : <VolumeX aria-hidden="true" size={16} />}
        </button>
      </div>
    </header>
  );
}
