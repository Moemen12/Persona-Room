"use client";

import { Heart, LoaderCircle, Radio, Sparkles, Users, Volume2, VolumeX } from "lucide-react";
import { useReducer } from "react";

import type { RoomBroadcast, RoomSnapshot, VoteTally } from "@/features/audience/audience.types";
import type { PersonaMood } from "@/features/persona/persona.types";
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
  const nextMessages = event.message
    ? [...state.snapshot.messages, event.message]
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

  const tally = state.snapshot?.tally;
  const highestVote = Math.max(1, ...Object.values(tally ?? {}).map(Number));

  return (
    <main className="audience-shell">
      <div className="ambient-orb ambient-orb--violet" aria-hidden="true" />
      <div className="ambient-orb ambient-orb--lavender" aria-hidden="true" />
      <section className="audience-room">
        <header className="audience-header">
          <div>
            <p className="eyebrow"><Radio aria-hidden="true" size={13} /> LIVE AUDIENCE ROOM</p>
            <h1>Rina is listening.</h1>
          </div>
          <div className="audience-header__actions">
            <button
              className="icon-button"
              type="button"
              onClick={() => setSoundEnabled((current) => !current)}
              aria-label={soundEnabled ? "Turn interface sounds off" : "Turn interface sounds on"}
              aria-pressed={soundEnabled}
            >
              {soundEnabled ? <Volume2 aria-hidden="true" size={17} /> : <VolumeX aria-hidden="true" size={17} />}
            </button>
            <span className="audience-viewers"><Users aria-hidden="true" size={15} /> {audienceLabel(state.viewerCount)}</span>
          </div>
        </header>

        <section className="audience-spotlight" aria-label="Rina live status">
          <div className="audience-spotlight__avatar"><RinaAvatar mood={state.mood} size="room" /></div>
          <div className="audience-spotlight__copy">
            <span className="live-chip"><span className="presence-pulse" aria-hidden="true" /> OPEN TO THE ROOM</span>
            <p>She can feel the room leaning in.</p>
            <span>Vote for the next little spark.</span>
          </div>
          <div className="audience-spotlight__mood"><Heart aria-hidden="true" size={15} /> feeling <strong>{state.mood}</strong></div>
        </section>

        <div className="audience-layout">
          <section className="audience-transcript" aria-live="polite">
            <div className="audience-transcript__header">
              <span><Sparkles aria-hidden="true" size={13} /> LIVE TRANSCRIPT</span>
              <span>read only</span>
            </div>
            <div className="audience-transcript__body">
              {state.loading ? (
                <div className="empty-message"><LoaderCircle className="spin" aria-hidden="true" /> Joining the room…</div>
              ) : null}
              {state.error ? <div className="error-message">{state.error}</div> : null}
              {!state.loading && !state.error && state.snapshot?.messages.length === 0 ? (
                <div className="waiting-state">Waiting for someone to talk to Rina…</div>
              ) : null}
              {state.snapshot?.messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  role={message.role}
                  text={message.content}
                  createdAt={message.createdAt}
                />
              ))}
            </div>
          </section>

          <aside className="vote-panel" aria-labelledby="vote-heading">
            <div className="vote-panel__header">
              <div>
                <p className="eyebrow">YOUR TURN</p>
                <h2 id="vote-heading">Pick her next move.</h2>
              </div>
              <span>one tap</span>
            </div>
            <p className="vote-panel__description">The room decides what Rina does next. Your vote lands live.</p>
            <div className="vote-options">
              {VOTE_OPTIONS.map((option) => {
                const count = tally?.[option.value] ?? 0;
                const percent = Math.round((count / highestVote) * 100);
                const selected = state.submitting === option.value;
                return (
                  <button
                    key={option.value}
                    className={cn("vote-option", selected && "vote-option--selected")}
                    type="button"
                    onClick={() => void vote(option.value)}
                    disabled={!state.snapshot || Boolean(state.submitting)}
                  >
                    <span className="vote-option__main">
                      <span className="vote-option__emoji">{option.emoji}</span>
                      <span>{option.label}</span>
                    </span>
                    <span className="vote-option__count">{count}</span>
                    <span className="vote-option__track"><span style={{ width: `${percent}%` }} /></span>
                  </button>
                );
              })}
            </div>
            <div className="vote-panel__foot"><span className="presence-pulse" aria-hidden="true" /> reactions update for everyone</div>
          </aside>
        </div>
      </section>
    </main>
  );
}
