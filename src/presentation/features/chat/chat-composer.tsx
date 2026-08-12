import { Mic, MicOff, Send, Square } from "lucide-react";
import { type FormEvent, useCallback, useRef } from "react";

import { COMPANIONS, type CompanionId } from "@/features/persona";
import { APP_CONFIG } from "@/lib/config/app";
import { useVoiceInput } from "@/presentation/hooks/use-voice-input";

interface ChatComposerProps {
  companionId: CompanionId;
  draft: string;
  isStreaming: boolean;
  isLoading: boolean;
  onDraftChange: (draft: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onStop: () => void;
}

const COMPOSER_MAX_HEIGHT = 142;

export function ChatComposer({
  companionId,
  draft,
  isStreaming,
  isLoading,
  onDraftChange,
  onSubmit,
  onStop,
}: ChatComposerProps) {
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const companion = COMPANIONS[companionId];
  const handleFinalTranscript = useCallback(
    (transcript: string) => {
      const nextDraft = `${draft.trim()} ${transcript}`.trim();
      if (nextDraft.length <= APP_CONFIG.maxMessageCharacters) onDraftChange(nextDraft);
    },
    [draft, onDraftChange],
  );
  const {
    error: voiceInputError,
    interimTranscript,
    isListening,
    isSupported: isVoiceInputSupported,
    startListening,
    stopListening,
  } = useVoiceInput({ onFinalTranscript: handleFinalTranscript });

  const resizeComposer = (textarea: HTMLTextAreaElement) => {
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, COMPOSER_MAX_HEIGHT)}px`;
    textarea.style.overflowY = textarea.scrollHeight > COMPOSER_MAX_HEIGHT ? "auto" : "hidden";
  };

  return (
    <form className="composer" onSubmit={onSubmit}>
      <div className="composer__field">
        <div className="composer__field-top">
          <label htmlFor="message-input">Message {companion.name}</label>
          <div className="composer__meta">
            <span>{draft.length}/{APP_CONFIG.maxMessageCharacters}</span>
            {isStreaming ? (
              <span className="composer__thinking" role="status" aria-live="polite">
                <span className="presence-pulse" aria-hidden="true" />
                {companion.name} is thinking
              </span>
            ) : (
              <>
                <span>Enter to send</span>
                <span>Shift + Enter for a new line</span>
              </>
            )}
          </div>
        </div>
        {interimTranscript ? (
          <div className="composer__voice-preview" role="status" aria-live="polite">
            <span className="presence-pulse" aria-hidden="true" />
            {interimTranscript}
          </div>
        ) : null}
        <textarea
          ref={composerRef}
          id="message-input"
          value={draft}
          onChange={(event) => {
            const value = event.target.value;
            if (value.length <= APP_CONFIG.maxMessageCharacters) {
              onDraftChange(value);
              resizeComposer(event.target);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (draft.trim() && !isStreaming) {
                void onSubmit(event as unknown as FormEvent<HTMLFormElement>);
              }
            }
          }}
          placeholder={`Write something honest to ${companion.name}...`}
          rows={1}
          aria-describedby={voiceInputError ? "voice-input-error" : undefined}
        />
        {voiceInputError ? (
          <div id="voice-input-error" className="composer__voice-error" role="alert">
            {voiceInputError}
          </div>
        ) : null}
        {isVoiceInputSupported ? (
          <button
            className={`composer__mic ${isListening ? "composer__mic--active" : ""}`}
            type="button"
            onClick={() => (isListening ? stopListening() : startListening())}
            disabled={isStreaming || isLoading}
            aria-label={isListening ? "Stop voice input" : "Start voice input"}
            title={isListening ? "Stop voice input" : "Talk to your companion"}
          >
            {isListening ? <MicOff aria-hidden="true" size={16} /> : <Mic aria-hidden="true" size={16} />}
          </button>
        ) : null}
      </div>

      {isStreaming ? (
        <button
          className="composer__send composer__send--stop"
          type="button"
          onClick={onStop}
          aria-label="Stop generating response"
        >
          <Square aria-hidden="true" size={18} fill="currentColor" />
        </button>
      ) : (
        <button
          className="composer__send"
          type="submit"
          disabled={!draft.trim() || isLoading}
          aria-label="Send message"
        >
          <Send aria-hidden="true" size={18} />
        </button>
      )}
    </form>
  );
}
