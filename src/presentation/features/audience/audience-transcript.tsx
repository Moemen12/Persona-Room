"use client";

import { Radio } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import type { RoomBroadcast, RoomSnapshot } from "@/features/audience";
import { AUDIENCE_REACTIONS, type AudienceReaction } from "@/lib/config/app";
import { sortRoomMessages } from "@/lib/message-order";
import type { PersonaMood } from "@/features/persona";
import { submitBatchedReactionsAction } from "@/actions/audience.actions";
import { MessageBubble } from "@/presentation/components/message-bubble";
import { useAudienceReaction } from "@/presentation/hooks/use-audience-reaction";
import { useRoomRealtime } from "@/presentation/hooks/use-room-realtime";
import { useTranscriptAutoScroll } from "@/presentation/hooks/use-transcript-auto-scroll";

import { AudienceReactionOverlay } from "./audience-reaction-overlay";

interface AudienceTranscriptProps {
  initialSnapshot: RoomSnapshot;
  roomId: string;
  onViewerCountChange?: (count: number) => void;
  onMoodChange?: (mood: PersonaMood) => void;
  onPerformance?: () => void;
  onListeningChange?: (isListening: boolean) => void;
}

export function AudienceTranscript({
  initialSnapshot,
  roomId,
  onViewerCountChange,
  onMoodChange,
  onPerformance,
  onListeningChange,
}: AudienceTranscriptProps) {
  const [snapshot, setSnapshot] = useState<RoomSnapshot>(() => ({
    ...initialSnapshot,
    messages: sortRoomMessages(initialSnapshot.messages),
  }));
  const [, setMood] = useState<PersonaMood>("neutral");
  const [isPerformerThinking, setIsPerformerThinking] = useState(false);
  const [, startReactionTransition] = useTransition();
  const { reactions, triggerReaction } = useAudienceReaction();
  const reactionBufferRef = useRef<AudienceReaction[]>([]);
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const transcriptRef = useTranscriptAutoScroll({
    messageCount: snapshot.messages.length,
    lastMessageId: snapshot.messages.at(-1)?.id,
    resetKey: snapshot.companionId,
    contentKey: isPerformerThinking ? "performer-thinking" : "performer-ready",
  });

  useRoomRealtime({
    roomId,
    onViewerCount: onViewerCountChange ?? (() => {}),
    onEvent: (event: RoomBroadcast) => {
      if (event.type === "companion-changed") {
        setMood("neutral");
        onMoodChange?.("neutral");
        setIsPerformerThinking(false);
        onListeningChange?.(false);
        triggerReaction("welcome", "👋");
        setSnapshot((current) => ({
          ...current,
          companionId: event.companionId,
          messages: [],
        }));
        return;
      }

      if (event.type === "audience-reaction") {
        onPerformance?.();
        if (event.reactions) {
          event.reactions.forEach((r) => {
            const definition = AUDIENCE_REACTIONS.find((item) => item.value === r);
            triggerReaction(r, definition?.emoji ?? "✨");
          });
        } else if (event.reaction) {
          const definition = AUDIENCE_REACTIONS.find((item) => item.value === event.reaction);
          triggerReaction(event.reaction, definition?.emoji ?? "✨");
        }
        return;
      }

      if (event.type === "vote-tally" || event.type === "persona-reaction") {
        setMood("surprised");
        onMoodChange?.("surprised");
        onPerformance?.();
        triggerReaction(
          event.type === "vote-tally" ? "vote" : "surprise",
          event.type === "vote-tally" ? "🗳️" : "✨"
        );
      }

      const incomingMessage = "message" in event ? event.message : undefined;
      if (incomingMessage?.role === "user") {
        setIsPerformerThinking(true);
        onListeningChange?.(true);
        onMoodChange?.("neutral");
      }
      if (incomingMessage?.role === "assistant") {
        setIsPerformerThinking(false);
        onListeningChange?.(false);
        onPerformance?.();
        if (event.type === "message" && event.mood) onMoodChange?.(event.mood);
      }
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

  const handleReaction = (nextReaction: AudienceReaction) => {
    const definition = AUDIENCE_REACTIONS.find((item) => item.value === nextReaction);
    triggerReaction(nextReaction, definition?.emoji ?? "✨");

    // Add to buffer for senior-level batching
    reactionBufferRef.current.push(nextReaction);

    if (!flushTimeoutRef.current) {
      flushTimeoutRef.current = setTimeout(() => {
        const batch = [...reactionBufferRef.current];
        reactionBufferRef.current = [];
        flushTimeoutRef.current = null;

        startReactionTransition(async () => {
          await submitBatchedReactionsAction(roomId, batch);
        });
      }, 500); // 500ms window to accumulate clicks
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current);
    };
  }, []);

  return (
    <section className="audience-transcript">
      <AudienceReactionOverlay reactions={reactions} />
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

      <div className="audience-reactions" aria-label="Send a room reaction">
        <div className="audience-reactions__buttons">
          {AUDIENCE_REACTIONS.map((candidate) => (
            <button
              key={candidate.value}
              type="button"
              className="audience-reaction-button"
              onClick={() => handleReaction(candidate.value)}
              aria-label={candidate.label}
            >
              <span aria-hidden="true">{candidate.emoji}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
