"use client";

import { Radio } from "lucide-react";
import { useState } from "react";

import type { RoomBroadcast, RoomSnapshot } from "@/features/audience";
import type { PersonaMood } from "@/features/persona";
import { MessageBubble } from "@/presentation/components/message-bubble";
import { useRoomRealtime } from "@/presentation/hooks/use-room-realtime";

interface AudienceTranscriptProps {
  initialSnapshot: RoomSnapshot;
  roomId: string;
}

export function AudienceTranscript({ initialSnapshot, roomId }: AudienceTranscriptProps) {
  const [snapshot, setSnapshot] = useState<RoomSnapshot>(initialSnapshot);
  const [, setMood] = useState<PersonaMood>("neutral");

  useRoomRealtime({
    roomId,
    onViewerCount: () => {},
    onEvent: (event: RoomBroadcast) => {
      if (event.type === "companion-changed") {
        setMood("neutral");
        setSnapshot((current) => ({
          ...current,
          companionId: event.companionId,
          messages: [],
        }));
        return;
      }

      if (event.type === "vote-tally" || event.type === "persona-reaction") {
        setMood("surprised");
      }

      const incomingMessage = event.message;
      setSnapshot((current) => {
        const nextMessages =
          incomingMessage && !current.messages.some((message) => message.id === incomingMessage.id)
            ? [...current.messages, incomingMessage]
            : current.messages;
        return {
          ...current,
          messages: nextMessages,
          tally: event.tally ?? current.tally,
        };
      });
    },
  });



  return (
    <section className="audience-transcript">
      <div className="audience-transcript__header">
        <span>
          <Radio aria-hidden="true" size={15} />
          <span>Public Room Feed</span>
        </span>
        <span className="chat-card__hint">Synced with room</span>
      </div>

      <div className="audience-transcript__body" tabIndex={0} aria-label="Room transcript">
        {snapshot.messages.length === 0 ? (
          <div className="waiting-state">
            <span>No conversation in this room yet. Send a message to start!</span>
          </div>
        ) : (
          snapshot.messages.map((message) => (
            <MessageBubble
              key={message.id}
              role={message.role === "user" ? "user" : "assistant"}
              text={message.content}
              assistantName={snapshot.companionId === "joon" ? "Joon" : "Rina"}
            />
          ))
        )}
      </div>
    </section>
  );
}
