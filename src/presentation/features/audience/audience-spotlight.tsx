import { Heart } from "lucide-react";

import { COMPANIONS, type CompanionId, type PersonaMood } from "@/features/persona/persona.types";
import { RinaAvatar } from "@/presentation/components/rina-avatar";

interface AudienceSpotlightProps {
  companionId: CompanionId;
  mood: PersonaMood;
}

export function AudienceSpotlight({ companionId, mood }: AudienceSpotlightProps) {
  const companion = COMPANIONS[companionId];

  return (
    <section className="audience-spotlight">
      <div className="audience-spotlight__avatar">
        <RinaAvatar companionId={companionId} mood={mood} size="room" />
      </div>
      <div className="audience-spotlight__copy">
        <div className="live-chip">
          <span className="presence-pulse" aria-hidden="true" />
          <span>INTERACTIVE</span>
        </div>
        <p>Vote on what {companion.name} does next and watch the room react in real time.</p>
        <span>Connected to {companion.name}&apos;s private feed</span>
      </div>
      <div className="audience-spotlight__mood" role="status">
        <Heart aria-hidden="true" size={14} />
        <span>Mood: <strong>{mood}</strong></span>
      </div>
    </section>
  );
}
