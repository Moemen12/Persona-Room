import { getRoomSnapshot } from "@/features/audience";
import { AudienceHeader } from "./audience-header";
import { AudienceSpotlight } from "./audience-spotlight";
import { AudienceTranscript } from "./audience-transcript";
import { VotePanel } from "./vote-panel";

interface AudienceExperienceProps {
  roomId: string;
}

export async function AudienceExperience({ roomId }: AudienceExperienceProps) {
  const snapshot = await getRoomSnapshot(roomId);

  return (
    <main className="audience-shell">
      <div className="ambient-orb ambient-orb--violet" aria-hidden="true" />
      <div className="ambient-orb ambient-orb--lavender" aria-hidden="true" />

      <div className="audience-room">
        <AudienceHeader companionId={snapshot.companionId} viewerCount={1} />
        <AudienceSpotlight companionId={snapshot.companionId} mood="neutral" />
        <VotePanel
          roomId={roomId}
          companionId={snapshot.companionId}
          initialTally={snapshot.tally}
          fingerprint="server-rsc"
        />
        <div className="audience-layout">
          <AudienceTranscript initialSnapshot={snapshot} roomId={roomId} />
        </div>
      </div>
    </main>
  );
}
