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
} from "lucide-react";
import { type FormEvent, useState } from "react";

import type { RoomBroadcast } from "@/features/audience/audience.types";
import type { SessionBootstrap } from "@/features/auth/auth.types";
import type { PersonaMood } from "@/features/persona/persona.types";
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

const CHAT_AUTH_STORAGE_KEY = "persona-room-chat-auth";

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

function isAssistantMessage(message: UIMessage) {
  return message.role === "assistant";
}

function listenerLabel(viewerCount: number) {
  if (viewerCount === 0) return "private for now";
  return `${viewerCount} ${viewerCount === 1 ? "listener" : "listeners"}`;
}

export function ChatExperience() {
  const [identity, setIdentity] = useState<IdentityState>();
  const [mood, setMood] = useState<PersonaMood>("neutral");
  const [draft, setDraft] = useState("");
  const [setupError, setSetupError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
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
        const state = { bootstrap, accessToken: session.access_token };
        window.sessionStorage.setItem(
          CHAT_AUTH_STORAGE_KEY,
          JSON.stringify({
            sessionId: bootstrap.session.id,
            accessToken: session.access_token,
          }),
        );
        setIdentity(state);
        setMood(bootstrap.mood);
        setMessages(bootstrap.messages.map(asUiMessage));
      } catch (initializationError) {
        if (!controller.signal.aborted) {
          setSetupError("Rina’s room needs its Supabase settings before she can remember you.");
          console.error(initializationError);
        }
      }
    };
    void initialize();
    return () => controller.abort();
  });

  useRoomRealtime({
    roomId: identity?.bootstrap.session.id,
    onViewerCount: setViewerCount,
    onEvent: (event: RoomBroadcast) => {
      if (event.type === "vote-tally" || event.type === "persona-reaction") {
        setMood("surprised");
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

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !identity || status !== "ready") return;
    play("send");
    setDraft("");
    clearError();
    await sendMessage({ text });
  };

  const shareRoom = async () => {
    if (!identity) return;
    const roomUrl = new URL(
      appRoutes.room(identity.bootstrap.session.id),
      window.location.origin,
    ).toString();
    await navigator.clipboard.writeText(roomUrl);
    play("share");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const isLoading = !identity && !setupError;
  const isStreaming = status === "submitted" || status === "streaming";
  const latestAssistant = [...messages].reverse().find(isAssistantMessage);
  const roomStatus = identity ? listenerLabel(viewerCount) : "opening a private room";

  return (
    <main className="persona-shell">
      <div className="ambient-orb ambient-orb--violet" aria-hidden="true" />
      <div className="ambient-orb ambient-orb--lavender" aria-hidden="true" />
      <section className="chat-stage" aria-label="Chat with Rina">
        <header className="persona-header">
          <div className="persona-header__identity">
            <Sparkles aria-hidden="true" size={18} />
            <span>Persona Room</span>
            <span className="persona-header__slash">/</span>
            <span className="persona-header__channel">private afterglow</span>
          </div>
          <div className="persona-header__actions">
            <button
              className="icon-button"
              type="button"
              onClick={() => setSoundEnabled((current) => !current)}
              aria-label={soundEnabled ? "Turn interface sounds off" : "Turn interface sounds on"}
              aria-pressed={soundEnabled}
            >
              {soundEnabled ? <Volume2 aria-hidden="true" size={17} /> : <VolumeX aria-hidden="true" size={17} />}
            </button>
            <button
              className="share-button"
              type="button"
              onClick={() => void shareRoom()}
              disabled={!identity}
            >
              {copied ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />}
              <span>{copied ? "Link copied" : "Invite the room"}</span>
            </button>
          </div>
        </header>

        <div className="chat-layout">
          <aside className="persona-profile" aria-label="Rina’s live profile">
            <div className="persona-profile__halo" aria-hidden="true" />
            <div className="persona-profile__live"><Radio aria-hidden="true" size={12} /> LIVE NOW</div>
            <RinaAvatar mood={mood} />
            <div className="persona-profile__copy">
              <p className="eyebrow">YOUR VIRTUAL ARTIST</p>
              <h1>Rina</h1>
              <p className="persona-profile__line">Soft voice. Bright little chaos.</p>
            </div>
            <div className="persona-profile__status">
              <span className="presence-pulse" aria-hidden="true" />
              <span>{roomStatus}</span>
            </div>
            <div className="persona-profile__mood">
              <Heart aria-hidden="true" size={15} />
              <span>feeling <strong>{mood}</strong></span>
            </div>
          </aside>

          <section className="chat-card" aria-label="Private conversation">
            <div className="chat-card__topline">
              <div className="conversation-title">
                <span className={cn("connection-dot", identity && "connection-dot--live")}>
                  {identity ? "memory on" : "connecting"}
                </span>
                <span>Private conversation</span>
              </div>
              <span className="chat-card__hint">say it like you mean it</span>
            </div>

            <div className="message-list" aria-live="polite" aria-label="Conversation with Rina">
              {isLoading ? (
                <div className="empty-message">
                  <LoaderCircle className="spin" aria-hidden="true" /> Opening Rina’s room…
                </div>
              ) : null}
              {setupError ? <div className="error-message">{setupError}</div> : null}
              {!isLoading && !setupError && messages.length === 0 ? (
                <div className="conversation-welcome">
                  <span className="conversation-welcome__spark"><Sparkles aria-hidden="true" size={16} /></span>
                  <p>Rina saved you a little corner of the night.</p>
                  <span>Start with a thought you would not send to just anyone.</span>
                </div>
              ) : null}
              {messages.map((message, index) => (
                <MessageBubble
                  key={message.id}
                  role={message.role === "assistant" ? "assistant" : "user"}
                  text={messageText(message)}
                  isStreaming={
                    isStreaming && index === messages.length - 1 && message.role === "assistant"
                  }
                />
              ))}
              {isStreaming && latestAssistant?.role !== "assistant" ? (
                <MessageBubble role="assistant" text="" isStreaming />
              ) : null}
            </div>

            {error ? (
              <div className="error-message error-message--actionable">
                <span>{error.message || "Rina’s brain took a tiny nap."}</span>
                <button type="button" onClick={() => clearError()}>Try again</button>
              </div>
            ) : null}

            <form className="composer" onSubmit={(event) => void submit(event)}>
              <label className="sr-only" htmlFor="rina-message">Message Rina</label>
              <textarea
                id="rina-message"
                value={draft}
                onChange={(event) =>
                  setDraft(event.target.value.slice(0, APP_CONFIG.maxMessageCharacters))
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="Leave Rina a little thought…"
                rows={1}
                disabled={!identity || isStreaming}
              />
              <div className="composer__meta">
                <span>{draft.length}/{APP_CONFIG.maxMessageCharacters}</span>
                {isStreaming ? <span>Rina is replying</span> : <span>enter to send</span>}
              </div>
              {isStreaming ? (
                <button
                  className="composer__send composer__send--stop"
                  type="button"
                  onClick={() => void stop()}
                  aria-label="Stop Rina"
                >
                  <Square aria-hidden="true" size={15} fill="currentColor" />
                </button>
              ) : (
                <button
                  className="composer__send"
                  type="submit"
                  disabled={!draft.trim() || !identity}
                  aria-label="Send message"
                >
                  <Send aria-hidden="true" size={18} />
                </button>
              )}
            </form>
          </section>
        </div>
      </section>
    </main>
  );
}
