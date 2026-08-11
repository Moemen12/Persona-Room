"use client";

import { DefaultChatTransport, type UIMessage } from "ai";
import { Chat, useChat } from "@ai-sdk/react";
import { Check, Copy, LoaderCircle, Send, Sparkles, Square } from "lucide-react";
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
    .filter((part): part is Extract<(typeof message.parts)[number], { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function isAssistantMessage(message: UIMessage) {
  return message.role === "assistant";
}

export function ChatExperience() {
  const [identity, setIdentity] = useState<IdentityState>();
  const [mood, setMood] = useState<PersonaMood>("neutral");
  const [draft, setDraft] = useState("");
  const [setupError, setSetupError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);

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
          JSON.stringify({ sessionId: bootstrap.session.id, accessToken: session.access_token }),
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
          if (current.some((message) => messageText(message) === roomMessage.content)) return current;
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
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const isLoading = !identity && !setupError;
  const isStreaming = status === "submitted" || status === "streaming";
  const latestAssistant = [...messages].reverse().find(isAssistantMessage);

  return (
    <main className="persona-shell">
      <section className="chat-stage" aria-label="Chat with Rina">
        <header className="persona-header">
          <div className="persona-header__identity">
            <Sparkles aria-hidden="true" size={18} />
            <span>Persona Room</span>
          </div>
          <button className="share-button" type="button" onClick={() => void shareRoom()} disabled={!identity}>
            {copied ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />}
            <span>{copied ? "Link copied" : "Share audience link"}</span>
          </button>
        </header>

        <div className="persona-hero">
          <RinaAvatar mood={mood} />
          <div className="persona-hero__copy">
            <p className="eyebrow">LIVE VIRTUAL ARTIST</p>
            <h1>Rina</h1>
            <p className="mood-label">mood: <strong>{mood}</strong></p>
            {identity ? <p className="viewer-count">{viewerCount} watching your room</p> : null}
          </div>
        </div>

        <div className="chat-card">
          <div className="chat-card__topline">
            <span>Private conversation</span>
            <span className={cn("connection-dot", identity ? "connection-dot--live" : "")}>
              {identity ? "memory on" : "connecting"}
            </span>
          </div>

          <div className="message-list" aria-live="polite">
            {isLoading ? (
              <div className="empty-message"><LoaderCircle className="spin" aria-hidden="true" /> Opening Rina’s room…</div>
            ) : null}
            {setupError ? <div className="error-message">{setupError}</div> : null}
            {!isLoading && !setupError && messages.length === 0 ? (
              <MessageBubble
                role="assistant"
                text="Hey — you found me. Tell me one thing about yourself, and I promise I’ll remember it."
              />
            ) : null}
            {messages.map((message, index) => (
              <MessageBubble
                key={message.id}
                role={message.role === "assistant" ? "assistant" : "user"}
                text={messageText(message)}
                isStreaming={isStreaming && index === messages.length - 1 && message.role === "assistant"}
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
              onChange={(event) => setDraft(event.target.value.slice(0, APP_CONFIG.maxMessageCharacters))}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Tell Rina something real…"
              rows={1}
              disabled={!identity || isStreaming}
            />
            {isStreaming ? (
              <button className="composer__send composer__send--stop" type="button" onClick={() => void stop()} aria-label="Stop Rina">
                <Square aria-hidden="true" size={15} fill="currentColor" />
              </button>
            ) : (
              <button className="composer__send" type="submit" disabled={!draft.trim() || !identity} aria-label="Send message">
                <Send aria-hidden="true" size={18} />
              </button>
            )}
          </form>
        </div>
      </section>
    </main>
  );
}
