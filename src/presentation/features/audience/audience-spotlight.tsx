import { Heart, LockKeyhole, Sparkles } from "lucide-react";

import {
  COMPANIONS,
  LANGUAGES,
  PERSONALITIES,
  type CompanionId,
  type ConversationLanguage,
  type PersonaMood,
  type PersonalityId,
} from "@/features/persona";
import { RinaAvatar } from "@/presentation/components/rina-avatar";

interface AudienceSpotlightProps {
  companionId: CompanionId;
  language: ConversationLanguage;
  personalityId: PersonalityId;
  mood: PersonaMood;
  isPerforming?: boolean;
  isListening?: boolean;
}

export function AudienceSpotlight({
  companionId,
  language,
  personalityId,
  mood,
  isPerforming = false,
  isListening = false,
}: AudienceSpotlightProps) {
  const companion = COMPANIONS[companionId];
  const roomLanguage = LANGUAGES[language];
  const personality = PERSONALITIES[personalityId];

  return (
    <section className="audience-spotlight">
      <div className="audience-spotlight__avatar">
        <RinaAvatar
          companionId={companionId}
          mood={mood}
          size="room"
          isPerforming={isPerforming}
          isListening={isListening}
        />
      </div>
      <div className="audience-spotlight__copy">
        <div className="live-chip">
          <span className="presence-pulse" aria-hidden="true" />
          <span>SHARED MOMENT</span>
        </div>
        <p>
          You can steer {companion.name}&apos;s next moment, react live, and leave the room with a story you helped create.
        </p>
        <span>
          {isPerforming
            ? `${companion.name} is answering the room`
            : isListening
              ? `${companion.name} is listening closely`
              : `The room is open — send a cue when you feel it`}
        </span>
      </div>
      <div className="audience-spotlight__mood" role="status">
        <Heart aria-hidden="true" size={14} />
        <span>{companion.name} feels <strong>{mood}</strong></span>
        <span className="audience-spotlight__lock" title="Room settings are locked for consistency">
          <LockKeyhole aria-hidden="true" size={12} />
          <span>{roomLanguage.nativeLabel} · {personality.name}</span>
        </span>
      </div>
      <span className="audience-spotlight__spark" aria-hidden="true"><Sparkles size={14} /></span>
    </section>
  );
}
