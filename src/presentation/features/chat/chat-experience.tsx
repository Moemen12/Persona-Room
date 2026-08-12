"use client";

import { Chat, useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { type FormEvent, useCallback, useReducer, useState } from "react";

import type { RoomBroadcast } from "@/features/audience";
import type { SessionBootstrap } from "@/features/auth";
import { type CompanionId, type PersonaMood } from "@/features/persona";
import { appRoutes } from "@/infrastructure/config/routes";
import { getSupabaseBrowserClient } from "@/infrastructure/supabase/browser";
import { getSafeChatAuth, getSafeCompanionHint, setSafeChatAuth } from "@/lib/storage";
import { LoadingScreen } from "@/presentation/components/shared/loading-screen";
import { useAutoSpeak } from "@/presentation/hooks/use-auto-speak";
import { useCompanionVoice } from "@/presentation/hooks/use-companion-voice";
import { useChatProactivity } from "@/presentation/hooks/use-chat-proactivity";
import { useInterfaceSound } from "@/presentation/hooks/use-interface-sound";
import { useMountEffect } from "@/presentation/hooks/use-mount-effect";
import { useRoomRealtime } from "@/presentation/hooks/use-room-realtime";

import { ChatComposer } from "./chat-composer";
import { ChatHeader } from "./chat-header";
import { ChatTranscript } from "./chat-transcript";
import { CompanionPicker } from "./companion-picker";
import { PersonaSidebar } from "./persona-sidebar";

interface IdentityState {
  bootstrap: SessionBootstrap;
  accessToken: string;
}

interface NarrationState {
  assistantId?: string;
  visibleText: string;
  started: boolean;
  completed: boolean;
}

interface ChatClientState {
  identity?: IdentityState;
  mood: PersonaMood;
  draft: string;
  narration: NarrationState;
  setupError?: string;
  viewerCount: number;
  isSelectorOpen: boolean;
  isChangingCompanion: boolean;
  hintedCompanionId?: CompanionId;
}

type ChatClientAction =
  | { type: "initialized"; identity: IdentityState; mood: PersonaMood; openSelector: boolean }
  | { type: "set-mood"; mood: PersonaMood }
  | { type: "set-draft"; draft: string }
  | { type: "set-setup-error"; error: string }
  | { type: "set-viewer-count"; count: number }
  | { type: "set-selector-open"; open: boolean }
  | { type: "set-changing-companion"; changing: boolean }
  | { type: "assistant-response-started"; assistantId: string }
  | { type: "assistant-segment-playback-started"; assistantId: string; segment: string }
  | { type: "assistant-narration-completed"; assistantId: string }
  | { type: "companion-updated"; bootstrap: SessionBootstrap; mood: PersonaMood };

const CHAT_AUTH_STORAGE_KEY = "persona-room-chat-auth";
const COMPANION_SELECTION_KEY = "persona-room-companion-selected";

function chatClientReducer(state: ChatClientState, action: ChatClientAction): ChatClientState {
  switch (action.type) {
    case "initialized":
      return {
        ...state,
        identity: action.identity,
        narration: emptyNarrationState,
        mood: action.mood,
        isSelectorOpen: action.openSelector,
        setupError: undefined,
        hintedCompanionId: action.identity.bootstrap.session.companionId,
      };
    case "set-mood":
      return { ...state, mood: action.mood };
    case "set-draft":
      return { ...state, draft: action.draft };
    case "set-setup-error":
      return { ...state, setupError: action.error };
    case "set-viewer-count":
      return { ...state, viewerCount: action.count };
    case "set-selector-open":
      return { ...state, isSelectorOpen: action.open };
    case "set-changing-companion":
      return { ...state, isChangingCompanion: action.changing };
    case "assistant-response-started":
      return {
        ...state,
        narration: {
          assistantId: action.assistantId,
          visibleText: "",
          started: false,
          completed: false,
        },
      };
    case "assistant-segment-playback-started": {
      const isNewAssistant = state.narration.assistantId !== action.assistantId;
      return {
        ...state,
        narration: {
          assistantId: action.assistantId,
          visibleText: isNewAssistant
            ? action.segment
            : `${state.narration.visibleText} ${action.segment}`.trim(),
          started: true,
          completed: false,
        },
      };
    }
    case "assistant-narration-completed":
      return state.narration.assistantId === action.assistantId
        ? { ...state, narration: { ...state.narration, completed: true } }
        : state;
    case "companion-updated":
      return {
        ...state,
        identity: state.identity ? { ...state.identity, bootstrap: action.bootstrap } : undefined,
        mood: action.mood,
        narration: emptyNarrationState,
        draft: "",
        isSelectorOpen: false,
        hintedCompanionId: action.bootstrap.session.companionId,
      };
    default:
      return state;
  }
}

const emptyNarrationState: NarrationState = {
  visibleText: "",
  started: false,
  completed: false,
};

const initialChatState: ChatClientState = {
  mood: "neutral",
  narration: emptyNarrationState,
  draft: "",
  viewerCount: 0,
  isSelectorOpen: false,
  isChangingCompanion: false,
  hintedCompanionId: getSafeCompanionHint(CHAT_AUTH_STORAGE_KEY),
};

function chatRequestBody() {
  const auth = getSafeChatAuth(CHAT_AUTH_STORAGE_KEY);
  if (!auth) return {};
  return { sessionId: auth.sessionId, accessToken: auth.accessToken };
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

export function ChatExperience() {
  const [state, dispatch] = useReducer(chatClientReducer, initialChatState);
  const { play } = useInterfaceSound();
  const companionId = state.identity?.bootstrap.session.companionId ?? state.hintedCompanionId ?? "rina";
  const {
    isSupported:     isVoiceSupported,
    voiceEnabled,
    isSpeaking,
    isPreparing: isVoicePreparing,
    setVoiceEnabled,
    speak,
    stopSpeaking,
  } = useCompanionVoice({
    companionId,
    sessionId: state.identity?.bootstrap.session.id,
    accessToken: state.identity?.accessToken,
  });

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
        const jsonResult = (await response.json()) as { data: SessionBootstrap };
        const bootstrap = jsonResult.data;
        if (controller.signal.aborted) return;
        const identity = { bootstrap, accessToken: session.access_token };
        setSafeChatAuth(CHAT_AUTH_STORAGE_KEY, {
          sessionId: bootstrap.session.id,
          accessToken: session.access_token,
          companionId: bootstrap.session.companionId,
        });
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
      stop();
      stopSpeaking();
      const bootstrapResponse = await fetch(appRoutes.api.session, {
        method: "POST",
        headers: { authorization: `Bearer ${state.identity.accessToken}` },
      });
      if (!bootstrapResponse.ok) throw new Error("Companion refresh failed");
      const bootstrapResult = (await bootstrapResponse.json()) as { data: SessionBootstrap };
      const bootstrap = bootstrapResult.data;
      setMessages(bootstrap.messages.map(asUiMessage));
      dispatch({ type: "companion-updated", bootstrap, mood: bootstrap.mood });
      setSafeChatAuth(CHAT_AUTH_STORAGE_KEY, {
        sessionId: bootstrap.session.id,
        accessToken: state.identity.accessToken,
        companionId: bootstrap.session.companionId,
      });
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
    clearError();
    await sendMessage({ text });
  };

  const isLoading = !state.identity && !state.setupError;
  const isStreaming = status === "submitted" || status === "streaming";
  const { proactiveHint } = useChatProactivity({
    messages,
    isStreaming,
    companionId,
    enabled: Boolean(state.identity),
  });

  const handleAssistantResponseStarted = useCallback(
    (assistantId: string) => dispatch({ type: "assistant-response-started", assistantId }),
    [],
  );
  const handleSegmentPlaybackStarted = useCallback(
    (assistantId: string, segment: string) =>
      dispatch({ type: "assistant-segment-playback-started", assistantId, segment }),
    [],
  );
  const handleNarrationCompleted = useCallback(
    (assistantId: string) => dispatch({ type: "assistant-narration-completed", assistantId }),
    [],
  );

  useAutoSpeak({
    messages,
    isStreaming,
    enabled: voiceEnabled,
    resetKey: companionId,
    speak,
    stopSpeaking,
    onAssistantResponseStarted: handleAssistantResponseStarted,
    onSegmentPlaybackStarted: handleSegmentPlaybackStarted,
    onNarrationCompleted: handleNarrationCompleted,
  });

  if (isLoading && !state.setupError) {
    return <LoadingScreen />;
  }

  return (
    <main className="persona-shell stage-enter">
      <div className="ambient-orb ambient-orb--violet" aria-hidden="true" />
      <div className="ambient-orb ambient-orb--lavender" aria-hidden="true" />
      <div className="stage-sweep" aria-hidden="true" />
      <div className="stage-sparkle stage-sparkle--one" aria-hidden="true" />
      <div className="stage-sparkle stage-sparkle--two" aria-hidden="true" />
      
      {state.isSelectorOpen && state.identity ? (
        <CompanionPicker
          currentCompanionId={companionId}
          isChanging={state.isChangingCompanion}
          onSelect={(id) => void chooseCompanion(id)}
          onClose={() => dispatch({ type: "set-selector-open", open: false })}
        />
      ) : null}

      <div className="chat-stage">
        <ChatHeader
          sessionId={state.identity?.bootstrap.session.id}
          isVoiceSupported={isVoiceSupported}
          isVoicePreparing={isVoicePreparing}
          voiceEnabled={voiceEnabled}
          onToggleVoice={() => setVoiceEnabled(!voiceEnabled)}
        />

        <div className="chat-layout">
          <PersonaSidebar
            companionId={companionId}
            mood={state.mood}
            isLive={Boolean(state.identity)}
            viewerCount={state.viewerCount}
            isSpeaking={isSpeaking}
            onOpenSelector={() => dispatch({ type: "set-selector-open", open: true })}
          />

          <section className="chat-card">
            <div className="chat-card__topline">
              <div className="conversation-title">
                <span>memory onPrivate conversation</span>
              </div>
              <span className="chat-card__hint">say it like you mean it</span>
            </div>

            <ChatTranscript
              messages={messages}
              isLoading={isLoading}
              isStreaming={isStreaming}
              setupError={state.setupError}
              companionId={companionId}
              mood={state.mood}
              proactiveHint={proactiveHint}
              narration={state.narration}
              voiceSyncEnabled={voiceEnabled && isVoiceSupported}
            />

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

            <ChatComposer
              companionId={companionId}
              draft={state.draft}
              isStreaming={isStreaming}
              isLoading={isLoading}
              onDraftChange={(draft) => dispatch({ type: "set-draft", draft })}
              onSubmit={submit}
              onStop={() => stop()}
            />
          </section>
        </div>
      </div>
    </main>
  );
}
