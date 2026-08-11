"use client";

import { Chat, useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  Check,
  Copy,
  Heart,
  LoaderCircle,
  Radio,
  Send,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { type FormEvent, useEffect, useReducer, useRef, useState } from "react";

import type { RoomBroadcast } from "@/features/audience/audience.types";
import type { SessionBootstrap } from "@/features/auth/auth.types";
import {
  COMPANIONS,
  type CompanionId,
  type PersonaMood,
} from "@/features/persona/persona.types";
import { appRoutes } from "@/infrastructure/config/routes";
import { getSupabaseBrowserClient } from "@/infrastructure/supabase/browser";
import { APP_CONFIG } from "@/lib/config/app";
import { cn } from "@/lib/utils";
import { MessageBubble } from "@/presentation/components/message-bubble";
import { RinaAvatar } from "@/presentation/components/rina-avatar";
import { useInterfaceSound } from "@/presentation/hooks/use-interface-sound";
import { useMountEffect } from "@/presentation/hooks/use-mount-effect";
import { useRoomRealtime } from "@/presentation/hooks/use-room-realtime";

interface IdentityState {
  bootstrap: SessionBootstrap;
  accessToken: string;
}

interface ChatClientState {
  identity?: IdentityState;
  mood: PersonaMood;
  draft: string;
  setupError?: string;
  copied: boolean;
  viewerCount: number;
  isSelectorOpen: boolean;
  isChangingCompanion: boolean;
}

type ChatClientAction =
  | { type: "initialized"; identity: IdentityState; mood: PersonaMood; openSelector: boolean }
  | { type: "set-mood"; mood: PersonaMood }
  | { type: "set-draft"; draft: string }
  | { type: "set-setup-error"; error: string }
  | { type: "set-copied"; copied: boolean }
  | { type: "set-viewer-count"; count: number }
  | { type: "set-selector-open"; open: boolean }
  | { type: "set-changing-companion"; changing: boolean }
  | { type: "companion-updated"; bootstrap: SessionBootstrap; mood: PersonaMood };

const CHAT_AUTH_STORAGE_KEY = "persona-room-chat-auth";
const COMPANION_SELECTION_KEY = "persona-room-companion-selected";
const COMPOSER_MAX_HEIGHT = 142;

function chatClientReducer(state: ChatClientState, action: ChatClientAction): ChatClientState {
  switch (action.type) {
    case "initialized":
      return {
        ...state,
        identity: action.identity,
        mood: action.mood,
        isSelectorOpen: action.openSelector,
        setupError: undefined,
      };
    case "set-mood":
      return { ...state, mood: action.mood };
    case "set-draft":
      return { ...state, draft: action.draft };
    case "set-setup-error":
      return { ...state, setupError: action.error };
    case "set-copied":
      return { ...state, copied: action.copied };
    case "set-viewer-count":
      return { ...state, viewerCount: action.count };
    case "set-selector-open":
      return { ...state, isSelectorOpen: action.open };
    case "set-changing-companion":
      return { ...state, isChangingCompanion: action.changing };
    case "companion-updated":
      return {
        ...state,
        identity: state.identity ? { ...state.identity, bootstrap: action.bootstrap } : undefined,
        mood: action.mood,
        draft: "",
        isSelectorOpen: false,
      };
    default:
      return state;
  }
}

const initialChatState: ChatClientState = {
  mood: "neutral",
  draft: "",
  copied: false,
  viewerCount: 0,
  isSelectorOpen: false,
  isChangingCompanion: false,
};

function chatRequestBody() {
  const stored = window.sessionStorage.getItem(CHAT_AUTH_STORAGE_KEY);
  if (!stored) return {};
  try {
    return JSON.parse(stored) as { sessionId: string; accessToken: string };
  } catch {
    window.sessionStorage.removeItem(CHAT_AUTH_STORAGE_KEY);
    return {};
  }
}

function asUiMessage(message: SessionBootstrap["messages"][number]): UIMessage {
  return {
    id: message.id,
    role: message.role,
    parts: [{ type: "text", text: message.content }],
  };
}

function messageText(message: UIMessage) {
  return message.parts
    .filter(
      (part): part is Extract<(typeof message.parts)[number], { type: "text" }> =>
        part.type === "text",
    )
    .map((part) => part.text)
    .join("");
}



function listenerLabel(viewerCount: number) {
  if (viewerCount === 0) return "private for now";
  return `${viewerCount} ${viewerCount === 1 ? "listener" : "listeners"}`;
}

function resizeComposer(textarea: HTMLTextAreaElement) {
  textarea.style.height = "auto";
  textarea.style.height = `${Math.min(textarea.scrollHeight, COMPOSER_MAX_HEIGHT)}px`;
  textarea.style.overflowY = textarea.scrollHeight > COMPOSER_MAX_HEIGHT ? "auto" : "hidden";
}

export function ChatExperience() {
  const [state, dispatch] = useReducer(chatClientReducer, initialChatState);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);

  const { play, setSoundEnabled, soundEnabled } = useInterfaceSound();

  const [chat] = useState(
    () =>
      new Chat({
        transport: new DefaultChatTransport({
          api: appRoutes.api.chat,
          body: chatRequestBody,
        }),
      }),
  );

  const { messages, setMessages, sendMessage, status, stop, error, clearError } = useChat({
    chat,
    experimental_throttle: 50,
  });

  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages, status]);

  useMountEffect(() => {
    const controller = new AbortController();
    const initialize = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const initialSession = await supabase.auth.getSession();
        const session =
          initialSession.data.session ??
          (await supabase.auth.signInAnonymously()).data.session;
        if (!session || controller.signal.aborted) {
          throw new Error("Anonymous session unavailable");
        }

        const response = await fetch(appRoutes.api.session, {
          method: "POST",
          headers: { authorization: `Bearer ${session.access_token}` },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Session setup failed");
        const bootstrap = (await response.json()) as SessionBootstrap;
        if (controller.signal.aborted) return;
        const identity = { bootstrap, accessToken: session.access_token };
        window.sessionStorage.setItem(
          CHAT_AUTH_STORAGE_KEY,
          JSON.stringify({
            sessionId: bootstrap.session.id,
            accessToken: session.access_token,
          }),
        );
        const selectionKey = `${COMPANION_SELECTION_KEY}:${bootstrap.session.id}`;
        const openSelector = window.localStorage.getItem(selectionKey) !== "confirmed";
        dispatch({ type: "initialized", identity, mood: bootstrap.mood, openSelector });
        setMessages(bootstrap.messages.map(asUiMessage));
      } catch (initializationError) {
        if (!controller.signal.aborted) {
          dispatch({
            type: "set-setup-error",
            error: "The room needs its Supabase settings before it can remember you.",
          });
          console.error(initializationError);
        }
      }
    };
    void initialize();
    return () => controller.abort();
  });

  useRoomRealtime({
    roomId: state.identity?.bootstrap.session.id,
    onViewerCount: (count) => dispatch({ type: "set-viewer-count", count }),
    onEvent: (event: RoomBroadcast) => {
      if (event.type === "companion-changed") return;
      if (event.type === "vote-tally" || event.type === "persona-reaction") {
        dispatch({ type: "set-mood", mood: "surprised" });
      }
      const roomMessage = event.message;
      if (roomMessage && roomMessage.role === "assistant") {
        setMessages((current) => {
          if (current.some((message) => messageText(message) === roomMessage.content)) {
            return current;
          }
          return [
            ...current,
            {
              id: roomMessage.id,
              role: "assistant",
              parts: [{ type: "text", text: roomMessage.content }],
            },
          ];
        });
      }
    },
  });

  const chooseCompanion = async (companionId: CompanionId) => {
    if (!state.identity) return;
    const currentCompanionId = state.identity.bootstrap.session.companionId;
    if (companionId === currentCompanionId) {
      window.localStorage.setItem(
        `${COMPANION_SELECTION_KEY}:${state.identity.bootstrap.session.id}`,
        "confirmed",
      );
      dispatch({ type: "set-selector-open", open: false });
      return;
    }
    if (state.isChangingCompanion) return;
    dispatch({ type: "set-changing-companion", changing: true });
    try {
      const response = await fetch(appRoutes.api.session, {
        method: "PUT",
        headers: {
          authorization: `Bearer ${state.identity.accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ sessionId: state.identity.bootstrap.session.id, companionId }),
      });
      if (!response.ok) throw new Error("Companion update failed");

      const bootstrapResponse = await fetch(appRoutes.api.session, {
        method: "POST",
        headers: { authorization: `Bearer ${state.identity.accessToken}` },
      });
      if (!bootstrapResponse.ok) throw new Error("Companion refresh failed");
      stop();
      const bootstrap = (await bootstrapResponse.json()) as SessionBootstrap;
      setMessages(bootstrap.messages.map(asUiMessage));
      dispatch({ type: "companion-updated", bootstrap, mood: bootstrap.mood });
      if (composerRef.current) composerRef.current.style.height = "50px";
      window.localStorage.setItem(
        `${COMPANION_SELECTION_KEY}:${bootstrap.session.id}`,
        "confirmed",
      );
      play("share");
    } catch (companionError) {
      dispatch({
        type: "set-setup-error",
        error: "The companion change could not be saved. Please try again.",
      });
      console.error(companionError);
    } finally {
      dispatch({ type: "set-changing-companion", changing: false });
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = state.draft.trim();
    if (!text || !state.identity || status !== "ready") return;
    play("send");
    dispatch({ type: "set-draft", draft: "" });
    if (composerRef.current) composerRef.current.style.height = "50px";
    clearError();
    await sendMessage({ text });
  };

  const shareRoom = async () => {
    if (!state.identity) return;
    const roomUrl = new URL(
      appRoutes.room(state.identity.bootstrap.session.id),
      window.location.origin,
    ).toString();
    await navigator.clipboard.writeText(roomUrl);
    play("share");
    dispatch({ type: "set-copied", copied: true });
    window.setTimeout(() => dispatch({ type: "set-copied", copied: false }), 1800);
  };

  const isLoading = !state.identity && !state.setupError;
  const isStreaming = status === "submitted" || status === "streaming";
  const companionId = state.identity?.bootstrap.session.companionId ?? "rina";
  const companion = COMPANIONS[companionId];
  const roomStatus = state.identity ? listenerLabel(state.viewerCount) : "opening a private room";

  return (
    <main className="persona-shell">
      <div className="ambient-orb ambient-orb--violet" aria-hidden="true" />
      <div className="ambient-orb ambient-orb--lavender" aria-hidden="true" />
      {state.isSelectorOpen && state.identity ? (
        <section
          className="companion-picker"
          role="dialog"
          aria-modal="true"
          aria-labelledby="companion-picker-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              dispatch({ type: "set-selector-open", open: false });
            }
          }}
        >
          <div className="companion-picker__panel">
            <div className="companion-picker__top">
              <span className="eyebrow"><Sparkles aria-hidden="true" size={13} /> YOUR PRIVATE ROOM</span>
              <button
                className="icon-button"
                type="button"
                onClick={() => dispatch({ type: "set-selector-open", open: false })}
                aria-label="Close companion picker"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>
            <h2 id="companion-picker-title">Who do you want to talk with?</h2>
            <p>Choose a companion for this room. You can change your choice later from the profile card.</p>
            <div className="companion-picker__choices">
              {(Object.values(COMPANIONS) as (typeof COMPANIONS)[CompanionId][]).map((candidate) => (
                <button
                  key={candidate.id}
                  className={cn("companion-choice", candidate.id === companionId && "companion-choice--selected")}
                  type="button"
                  onClick={() => void chooseCompanion(candidate.id)}
                  disabled={state.isChangingCompanion}
                >
                  <RinaAvatar companionId={candidate.id} mood="neutral" size="message" />
                  <span className="companion-choice__copy">
                    <strong>{candidate.name}</strong>
                    <span>{candidate.gender === "female" ? "Female companion" : "Male companion"}</span>
                    <small>{candidate.selectorCopy}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <div className="chat-stage">
        <header className="persona-header">
          <div className="persona-header__identity">
            <Radio aria-hidden="true" size={16} />
            <span>Persona Room</span>
            <span className="persona-header__slash" aria-hidden="true">/</span>
            <span className="persona-header__channel">private afterglow</span>
          </div>
          <div className="persona-header__actions">
            <button
              className="icon-button"
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              aria-label={soundEnabled ? "Mute interface sound" : "Enable interface sound"}
            >
              {soundEnabled ? <Volume2 aria-hidden="true" size={16} /> : <VolumeX aria-hidden="true" size={16} />}
            </button>
            <button className="share-button" type="button" onClick={() => void shareRoom()}>
              {state.copied ? <Check aria-hidden="true" size={15} /> : <Copy aria-hidden="true" size={15} />}
              <span>{state.copied ? "Link Copied" : "Invite the room"}</span>
            </button>
          </div>
        </header>

        <div className="chat-layout">
          <aside className="persona-profile">
            <div className="persona-profile__halo" aria-hidden="true" />
            <div className="persona-profile__live">
              <span className="presence-pulse" aria-hidden="true" />
              <span>LIVE</span>
            </div>

            <RinaAvatar companionId={companionId} mood={state.mood} size="hero" />

            <div className="persona-profile__copy">
              <span className="eyebrow">
                <Sparkles aria-hidden="true" size={12} />
                {companion.tagline}
              </span>
              <h1>{companion.name}</h1>
              <p className="persona-profile__line">{companion.selectorCopy}</p>
            </div>

            <div className="persona-profile__signals">
              <div className="persona-profile__mood" role="status" aria-label={`Current mood: ${state.mood}`}>
                <Heart aria-hidden="true" size={13} />
                <span>Feeling <strong>{state.mood}</strong></span>
              </div>
              <div className="persona-profile__status" role="status" aria-label={`Room status: ${roomStatus}`}>
                <span className={cn("connection-dot", state.identity && "connection-dot--live")} aria-hidden="true" />
                <span>{roomStatus}</span>
              </div>
            </div>

            <button
              className="persona-profile__change"
              type="button"
              onClick={() => dispatch({ type: "set-selector-open", open: true })}
            >
              Change companion ({companion.name})
            </button>
          </aside>

          <section className="chat-card">
            <div className="chat-card__topline">
              <div className="conversation-title">
                <span>memory onPrivate conversation</span>
              </div>
              <span className="chat-card__hint">say it like you mean it</span>
            </div>

            <div className="message-list" ref={messageListRef} tabIndex={0} aria-label="Conversation transcript">
              {isLoading ? (
                <div className="waiting-state" role="status">
                  <LoaderCircle aria-hidden="true" size={20} className="spin" />
                  <span>Opening {companion.name}’s room...</span>
                </div>
              ) : state.setupError ? (
                <div className="error-message">
                  <p>{state.setupError}</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="conversation-welcome">
                  <div className="conversation-welcome__spark">
                    <Sparkles aria-hidden="true" size={18} />
                  </div>
                  <p>Say hello to {companion.name}</p>
                  <span>{companion.welcome}</span>
                </div>
              ) : (
                messages.map((message) => {
                  const content = messageText(message);
                  const bubbleRole = message.role === "user" ? "user" : "assistant";
                  if (!content && message.role === "assistant" && isStreaming && message === messages[messages.length - 1]) {
                    return (
                      <MessageBubble
                        key={message.id}
                        role="assistant"
                        text=""
                        assistantName={companion.name}
                        isStreaming={true}
                      />
                    );
                  }
                  return (
                    <MessageBubble
                      key={message.id}
                      role={bubbleRole}
                      text={content}
                      assistantName={companion.name}
                      isStreaming={
                        isStreaming &&
                        message.role === "assistant" &&
                        message === messages[messages.length - 1]
                      }
                    />
                  );
                })
              )}
            </div>

            {(error || state.setupError) && (
              <div className="error-message error-message--actionable" role="alert">
                <span>{error?.message ?? state.setupError}</span>
                {error && (
                  <button type="button" onClick={() => clearError()}>
                    Try again
                  </button>
                )}
              </div>
            )}

            <form className="composer" onSubmit={submit}>
              <div className="composer__field">
                <div className="composer__field-top">
                  <label htmlFor="message-input">Message {companion.name}</label>
                  <div className="composer__meta">
                    <span>{state.draft.length}/{APP_CONFIG.maxMessageCharacters}</span>
                    <span>Enter to send</span>
                    <span>Shift + Enter for a new line</span>
                  </div>
                </div>
                <textarea
                  ref={composerRef}
                  id="message-input"
                  value={state.draft}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value.length <= APP_CONFIG.maxMessageCharacters) {
                      dispatch({ type: "set-draft", draft: value });
                      resizeComposer(event.target);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      if (state.draft.trim() && !isStreaming) {
                        void submit(event as unknown as FormEvent<HTMLFormElement>);
                      }
                    }
                  }}
                  placeholder={`Write something honest to ${companion.name}...`}
                  rows={1}
                />
              </div>

              {isStreaming ? (
                <button
                  className="composer__send composer__send--stop"
                  type="button"
                  onClick={() => stop()}
                  aria-label="Stop generating response"
                >
                  <Square aria-hidden="true" size={18} fill="currentColor" />
                </button>
              ) : (
                <button
                  className="composer__send"
                  type="submit"
                  disabled={!state.draft.trim() || isLoading}
                  aria-label="Send message"
                >
                  <Send aria-hidden="true" size={18} />
                </button>
              )}
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
