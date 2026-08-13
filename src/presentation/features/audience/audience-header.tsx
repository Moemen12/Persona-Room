import { LockKeyhole, Sparkles, Users, Volume2, VolumeX } from "lucide-react";

import {
  COMPANIONS,
  LANGUAGES,
  PERSONALITIES,
  type CompanionId,
  type ConversationLanguage,
  type PersonalityId,
} from "@/features/persona";
import { ThemeToggle } from "@/presentation/components/theme-toggle";
import { useInterfaceSound } from "@/presentation/hooks/use-interface-sound";

interface AudienceHeaderProps {
  companionId: CompanionId;
  language: ConversationLanguage;
  personalityId: PersonalityId;
  viewerCount: number;
}

function audienceLabel(viewerCount: number) {
  return viewerCount === 1 ? "1 person is here" : `${viewerCount} people are here`;
}

export function AudienceHeader({ companionId, language, personalityId, viewerCount }: AudienceHeaderProps) {
  const companion = COMPANIONS[companionId];
  const roomLanguage = LANGUAGES[language];
  const personality = PERSONALITIES[personalityId];
  const { play, setSoundEnabled, soundEnabled } = useInterfaceSound();

  return (
    <header className="audience-header">
      <div>
        <span className="eyebrow"><Sparkles aria-hidden="true" size={13} /> {companion.name.toUpperCase()}’S ROOM</span>
        <h1>Help shape the next reply.</h1>
        <span className="audience-header__identity">
          <LockKeyhole aria-hidden="true" size={12} /> {roomLanguage.nativeLabel} · {personality.name} personality
        </span>
      </div>
      <div className="audience-header__actions">
        <ThemeToggle />
        <div className="audience-viewers" role="status">
          <Users aria-hidden="true" size={14} />
          <span key={viewerCount} className="audience-viewers__label">{audienceLabel(viewerCount)}</span>
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
