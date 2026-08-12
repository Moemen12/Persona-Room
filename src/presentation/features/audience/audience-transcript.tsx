"use client";

import { Radio } from "lucide-react";
import { useState } from "react";

import type { RoomBroadcast, RoomSnapshot } from "@/features/audience";
import { sortRoomMessages } from "@/lib/message-order";
import type { PersonaMood } from "@/features/persona";
import { VOTE_OPTIONS } from "@/lib/config/app";
import { MessageBubble } from "@/presentation/components/message-bubble";
import { useAudienceReaction } from "@/presentation/hooks/use-audience-reaction";
import { useRoomRealtime } from "@/presentation/hooks/use-room-realtime";
import { useTranscriptAutoScroll } from "@/presentation/hooks/use-transcript-auto-scroll";

import { AudienceReactionOverlay } from "./audience-reaction-overlay";

interface AudienceTranscriptProps {
  initialSnapshot: RoomSnapshot;
  roomId: string;
}

export function AudienceTranscript({ initialSnapshot, roomId }: AudienceTranscriptProps) {
  const [snapshot, setSnapshot] = useState<RoomSnapshot>(() => ({
    ...initialSnapshot,
    messages: sortRoomMessages(initialSnapshot.messages),
  }));
  const [, setMood] = useState<PersonaMood>("neutral");
  const [isPerformerThinking, setIsPerformerThinking] = useState(false);
  const { reaction, triggerReaction } = useAudienceReaction();
  const transcriptRef = useTranscriptAutoScroll({
    messageCount: snapshot.messages.length,
    lastMessageId: snapshot.messages.at(-1)?.id,
    resetKey: snapshot.companionId,
    contentKey: isPerformerThinking ? "performer-thinking" : "performer-ready",
  });

  useRoomRealtime({
    roomId,
    onViewerCount: () => {},
    onEvent: (event: RoomBroadcast) => {
      if (event.type === "companion-changed") {
        setMood("neutral");
        setIsPerformerThinking(false);
        triggerReaction({ kind: "welcome", label: `${event.companionId === "joon" ? "Joon" : "Rina"} is taking the stage` });
        setSnapshot((current) => ({
          ...current,
          companionId: event.companionId,
          messages: [],
        }));
        return;
      }

      if (event.type === "vote-tally" || event.type === "persona-reaction") {
        setMood("surprised");
        const optionLabel = event.option
          ? VOTE_OPTIONS.find((option) => option.value === event.option)?.label
          : undefined;
        triggerReaction({
          kind: event.type === "vote-tally" ? "vote" : "surprise",
          label: optionLabel ? `The room chose: ${optionLabel}` : "The room caught her attention",
        });
      }

      const incomingMessage = event.message;
      if (incomingMessage?.role === "user") setIsPerformerThinking(true);
      if (incomingMessage?.role === "assistant") setIsPerformerThinking(false);
      setSnapshot((current) => {
        const nextMessages =
          incomingMessage && !current.messages.some((message) => message.id === incomingMessage.id)
            ? sortRoomMessages([...current.messages, incomingMessage])
            : current.messages;
        return {
          ...current,
          messages: nextMessages,
          tally: event.tally ?? current.tally,
        };
      });
    },
  });



  const companionName = snapshot.companionId === "joon" ? "Joon" : "Rina";

  return (
    <section className="audience-transcript">
      <AudienceReactionOverlay reaction={reaction} />
      <div className="audience-transcript__header">
        <span>
          <Radio aria-hidden="true" size={15} />
          <span>Public Room Feed</span>
        </span>
        <span className="chat-card__hint">Synced with room</span>
      </div>

      <div
        className="audience-transcript__body"
        ref={transcriptRef}
        tabIndex={0}
        aria-label="Room transcript"
      >
        {snapshot.messages.length === 0 ? (
          <div className="waiting-state">
            <span>No conversation in this room yet. Send a message to start!</span>
          </div>
        ) : (
          <>
            {snapshot.messages.map((message) => (
              <MessageBubble
                key={message.id}
                role={message.role === "user" ? "user" : "assistant"}
                text={message.content}
                assistantName={companionName}
              />
            ))}
            {isPerformerThinking ? (
              <div className="audience-typing" role="status" aria-label={`${companionName} is composing a reply`}>
                <span className="audience-typing__avatar" aria-hidden="true">{companionName.slice(0, 1)}</span>
                <span>{companionName} is writing a little reply</span>
                <span className="audience-typing__dots" aria-hidden="true"><i /><i /><i /></span>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
