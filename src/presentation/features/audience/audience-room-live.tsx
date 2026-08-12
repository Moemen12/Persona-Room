"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { RoomSnapshot } from "@/features/audience";
import type { PersonaMood } from "@/features/persona";

import { AudienceHeader } from "./audience-header";
import { AudienceSpotlight } from "./audience-spotlight";
import { AudienceTranscript } from "./audience-transcript";
import { VotePanel } from "./vote-panel";

interface AudienceRoomLiveProps {
  roomId: string;
  initialSnapshot: RoomSnapshot;
}

export function AudienceRoomLive({ roomId, initialSnapshot }: AudienceRoomLiveProps) {
  const [viewerCount, setViewerCount] = useState(1);
  const [mood, setMood] = useState<PersonaMood>("neutral");
  const [isPerforming, setIsPerforming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const performanceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handlePerformance = useCallback(() => {
    if (performanceTimerRef.current) clearTimeout(performanceTimerRef.current);
    setIsPerforming(true);
    performanceTimerRef.current = setTimeout(() => {
      setIsPerforming(false);
      performanceTimerRef.current = undefined;
    }, 900);
  }, []);

  useEffect(() => {
    return () => {
      if (performanceTimerRef.current) clearTimeout(performanceTimerRef.current);
    };
  }, []);

  return (
    <main className={`audience-shell audience-shell--mood-${mood.replace("/", "-")} stage-enter`}>
      <div className="ambient-orb ambient-orb--violet" aria-hidden="true" />
      <div className="ambient-orb ambient-orb--lavender" aria-hidden="true" />
      <div className="stage-sweep" aria-hidden="true" />
      <div className="stage-sparkle stage-sparkle--one" aria-hidden="true" />
      <div className="stage-sparkle stage-sparkle--two" aria-hidden="true" />

      <div className="audience-room audience-room--entrance">
        <AudienceHeader companionId={initialSnapshot.companionId} viewerCount={viewerCount} />
        <AudienceSpotlight
          companionId={initialSnapshot.companionId}
          mood={mood}
          isPerforming={isPerforming}
          isListening={isListening}
        />
        <VotePanel
          roomId={roomId}
          companionId={initialSnapshot.companionId}
          initialTally={initialSnapshot.tally}
        />
        <div className="audience-layout">
          <AudienceTranscript
            initialSnapshot={initialSnapshot}
            roomId={roomId}
            onViewerCountChange={setViewerCount}
            onMoodChange={setMood}
            onPerformance={handlePerformance}
            onListeningChange={setIsListening}
          />
        </div>
      </div>
    </main>
  );
}
