"use client";

import { Heart, LoaderCircle, Radio, Sparkles, Users, Volume2, VolumeX } from "lucide-react";
import { useOptimistic, useReducer } from "react";

import type { RoomBroadcast, RoomSnapshot, VoteTally } from "@/features/audience/audience.types";
import { COMPANIONS, type PersonaMood } from "@/features/persona/persona.types";
import { appRoutes } from "@/infrastructure/config/routes";
import { VOTE_OPTIONS, type VoteOption } from "@/lib/config/app";
import { cn } from "@/lib/utils";
import { MessageBubble } from "@/presentation/components/message-bubble";
import { RinaAvatar } from "@/presentation/components/rina-avatar";
import { useInterfaceSound } from "@/presentation/hooks/use-interface-sound";
import { useMountEffect } from "@/presentation/hooks/use-mount-effect";
import { useRoomRealtime } from "@/presentation/hooks/use-room-realtime";

interface AudienceState {
  snapshot?: RoomSnapshot;
  fingerprint?: string;
  loading: boolean;
  submitting?: VoteOption;
  mood: PersonaMood;
  viewerCount: number;
  error?: string;
}

type AudienceAction =
  | { type: "loaded"; snapshot: RoomSnapshot; fingerprint: string }
  | { type: "failed"; message: string }
  | { type: "viewer-count"; count: number }
  | { type: "submitting"; option?: VoteOption }
  | { type: "room-event"; event: RoomBroadcast };

function createFingerprint() {
  const key = "persona-room-fingerprint";
  const current = window.localStorage.getItem(key);
  if (current) return current;
  const fingerprint = crypto.randomUUID();
  window.localStorage.setItem(key, fingerprint);
  return fingerprint;
}

function audienceReducer(state: AudienceState, action: AudienceAction): AudienceState {
  if (action.type === "loaded") {
    return {
      ...state,
      snapshot: action.snapshot,
      fingerprint: action.fingerprint,
      loading: false,
    };
  }
  if (action.type === "failed") return { ...state, loading: false, error: action.message };
  if (action.type === "viewer-count") return { ...state, viewerCount: action.count };
  if (action.type === "submitting") return { ...state, submitting: action.option, error: undefined };
  if (!state.snapshot) return state;

  const { event } = action;
  if (event.type === "companion-changed") {
    return {
      ...state,
      mood: "neutral",
      snapshot: { ...state.snapshot, companionId: event.companionId, messages: [] },
    };
  }

  const incomingMessage = event.message;
  const nextMessages =
    incomingMessage && !state.snapshot.messages.some((message) => message.id === incomingMessage.id)
      ? [...state.snapshot.messages, incomingMessage]
      : state.snapshot.messages;
  return {
    ...state,
    submitting: event.type === "vote-tally" ? undefined : state.submitting,
    mood:
      event.type === "vote-tally" || event.type === "persona-reaction"
        ? "surprised"
        : state.mood,
    snapshot: {
      ...state.snapshot,
      messages: nextMessages,
      tally: event.tally ?? state.snapshot.tally,
    },
  };
}

const initialState: AudienceState = { loading: true, mood: "neutral", viewerCount: 0 };

function audienceLabel(viewerCount: number) {
  return viewerCount === 1 ? "1 person is here" : `${viewerCount} people are here`;
}

export function AudienceExperience({ roomId }: { roomId: string }) {
  const [state, dispatch] = useReducer(audienceReducer, initialState);

  const { play, setSoundEnabled, soundEnabled } = useInterfaceSound();

  // React 19 useOptimistic for instant vote tally feedback
  const [optimisticTally, setOptimisticTally] = useOptimistic(
    state.snapshot?.tally ?? { sing: 0, joke: 0, art: 0, surprise: 0 },
    (currentTally, votedOption: VoteOption) => ({
      ...currentTally,
      [votedOption]: (currentTally[votedOption] ?? 0) + 1,
    })
  );



  useMountEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch(appRoutes.api.room(roomId), { signal: controller.signal });
        if (!response.ok) throw new Error("Room unavailable");
        const snapshot = (await response.json()) as RoomSnapshot;
        if (!controller.signal.aborted) {
          dispatch({ type: "loaded", snapshot, fingerprint: createFingerprint() });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error(error);
          dispatch({
            type: "failed",
            message: "This room is quiet right now. Try the link again in a moment.",
          });
        }
      }
    };
    void load();
    return () => controller.abort();
  });

  useRoomRealtime({
    roomId,
    onEvent: (event) => dispatch({ type: "room-event", event }),
    onViewerCount: (count) => dispatch({ type: "viewer-count", count }),
  });

  const vote = async (option: VoteOption) => {
    if (!state.fingerprint || state.submitting) return;
    play("vote");
    dispatch({ type: "submitting", option });
    
    // Apply optimistic update immediately
    setOptimisticTally(option);

    try {
      const response = await fetch(appRoutes.api.vote(roomId), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ option, fingerprint: state.fingerprint }),
      });
      const result = (await response.json()) as {
        tally?: VoteTally;
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(result.error?.message ?? "Vote unavailable");
      dispatch({
        type: "room-event",
        event: { type: "vote-tally", tally: result.tally },
      });
    } catch (error) {
      dispatch({ type: "submitting" });
      dispatch({
        type: "failed",
        message: error instanceof Error ? error.message : "That vote did not land. Try again.",
      });
    }
  };

  const companionId = state.snapshot?.companionId ?? "rina";
  const companion = COMPANIONS[companionId];
  const highestVote = Math.max(1, ...Object.values(optimisticTally).map(Number));

  return (
    <main className="audience-shell">
      <div className="ambient-orb ambient-orb--violet" aria-hidden="true" />
      <div className="ambient-orb ambient-orb--lavender" aria-hidden="true" />

      <div className="audience-room">
        <header className="audience-header">
          <div>
            <span className="eyebrow"><Sparkles aria-hidden="true" size={13} /> {companion.name.toUpperCase()}’S STAGE</span>
            <h1>Live Audience</h1>
          </div>
          <div className="audience-header__actions">
            <div className="audience-viewers" role="status">
              <Users aria-hidden="true" size={14} />
              <span>{audienceLabel(state.viewerCount)}</span>
            </div>
            <button
              className="icon-button"
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              aria-label={soundEnabled ? "Mute interface sound" : "Enable interface sound"}
            >
              {soundEnabled ? <Volume2 aria-hidden="true" size={16} /> : <VolumeX aria-hidden="true" size={16} />}
            </button>
          </div>
        </header>

        <section className="audience-spotlight">
          <div className="audience-spotlight__avatar">
            <RinaAvatar companionId={companionId} mood={state.mood} size="room" />
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
            <span>Mood: <strong>{state.mood}</strong></span>
          </div>
        </section>

        <section className="vote-panel" aria-labelledby="vote-title">
          <div className="vote-panel__header">
            <div>
              <span className="eyebrow">AUDIENCE VOTE</span>
              <h2 id="vote-title">Direct {companion.name}</h2>
            </div>
            <span>Live poll</span>
          </div>
          <p className="vote-panel__description">
            Cast your vote to shape {companion.name}&apos;s next response in the conversation.
          </p>

          <div className="vote-options">
            {VOTE_OPTIONS.map((candidate) => {
              const count = optimisticTally[candidate.value] ?? 0;
              const percentage = Math.round((count / highestVote) * 100);
              const isSelected = state.submitting === candidate.value;
              return (
                <button
                  key={candidate.value}
                  className={cn("vote-option", isSelected && "vote-option--selected")}
                  type="button"
                  onClick={() => void vote(candidate.value)}
                  disabled={Boolean(state.submitting)}
                >
                  <span className="vote-option__main">
                    <span className="vote-option__emoji" aria-hidden="true">{candidate.emoji}</span>
                    <span>{candidate.label}</span>
                  </span>
                  <span className="vote-option__count">{count}</span>
                  <span className="vote-option__track" aria-hidden="true">
                    <span style={{ width: `${Math.max(6, percentage)}%` }} />
                  </span>
                </button>
              );
            })}
          </div>

          <footer className="vote-panel__foot">
            <span className="presence-pulse" aria-hidden="true" />
            <span>Votes sync instantly via Supabase & Upstash</span>
          </footer>
        </section>

        <div className="audience-layout">
          <section className="audience-transcript">
            <div className="audience-transcript__header">
              <span>
                <Radio aria-hidden="true" size={15} />
                <span>Public Room Feed</span>
              </span>
              <span className="chat-card__hint">Synced with room</span>
            </div>

            <div className="audience-transcript__body" tabIndex={0} aria-label="Room transcript">
              {state.loading ? (
                <div className="waiting-state" role="status">
                  <LoaderCircle aria-hidden="true" size={20} className="spin" />
                  <span>Loading room feed...</span>
                </div>
              ) : state.error ? (
                <div className="error-message">
                  <p>{state.error}</p>
                </div>
              ) : state.snapshot?.messages.length === 0 ? (
                <div className="waiting-state">
                  <span>No conversation in this room yet. Send a message to start!</span>
                </div>
              ) : (
                state.snapshot?.messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    role={message.role === "user" ? "user" : "assistant"}
                    text={message.content}
                    assistantName={companion.name}
                  />
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
