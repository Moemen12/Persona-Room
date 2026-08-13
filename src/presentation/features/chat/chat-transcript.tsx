import { type UIMessage } from "ai";
import { LoaderCircle, Sparkles } from "lucide-react";

import { COMPANIONS, type CompanionId, type PersonaMood } from "@/features/persona";
import { MessageBubble } from "@/presentation/components/message-bubble";
import { useTranscriptAutoScroll } from "@/presentation/hooks/use-transcript-auto-scroll";

interface NarrationSnapshot {
  assistantId?: string;
  started: boolean;
  completed: boolean;
  waiting: boolean;
}

interface ChatTranscriptProps {
  messages: UIMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  setupError?: string;
  companionId: CompanionId;
  mood: PersonaMood;
  proactiveHint?: string;
  narration: NarrationSnapshot;
  voiceSyncEnabled: boolean;
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

export function ChatTranscript({
  messages,
  isLoading,
  isStreaming,
  setupError,
  companionId,
  mood: _mood,
  proactiveHint,
  narration,
  voiceSyncEnabled,
}: ChatTranscriptProps) {
  const companion = COMPANIONS[companionId];
  const latestMessage = messages.at(-1);
  const latestMessageText = latestMessage ? messageText(latestMessage) : "";
  const messageListRef = useTranscriptAutoScroll({
    messageCount: messages.length,
    lastMessageId: latestMessage?.id,
    resetKey: companionId,
    contentKey: `${isStreaming ? "streaming" : "idle"}:${latestMessageText}:${proactiveHint ?? ""}`,
  });

  return (
    <div className="message-list" ref={messageListRef} tabIndex={0} aria-label="Conversation transcript">
      {isLoading ? (
        <div className="waiting-state" role="status">
          <LoaderCircle aria-hidden="true" size={20} className="spin" />
          <span>Opening {companion.name}’s room...</span>
        </div>
      ) : setupError ? (
        <div className="error-message">
          <p>{setupError}</p>
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
        <>
          {messages.map((message) => {
            const rawContent = messageText(message);
            const isLatestMessage = message === messages[messages.length - 1];
            const isAssistant = message.role === "assistant";
            
            // Atomic reveal: If voice is enabled and this is a fresh assistant response,
            // keep it in a "preparing" state (visible but subtle) until playback starts.
            const isFreshAssistantResponse = 
              isAssistant && 
              isLatestMessage && 
              !isStreaming && 
              narration.assistantId === message.id;

            const isWaitingForVoice = 
              voiceSyncEnabled && 
              isFreshAssistantResponse && 
              !narration.started && 
              !narration.completed;

            const shouldAnimateFreshReply = 
              isFreshAssistantResponse && 
              narration.started && 
              !narration.completed;

            return (
              <MessageBubble
                key={message.id}
                role={isAssistant ? "assistant" : "user"}
                text={rawContent}
                assistantName={companion.name}
                animateText={shouldAnimateFreshReply}
                isStreaming={isLatestMessage && isAssistant && isStreaming}
                isPreparing={isWaitingForVoice}
              />
            );
          })}
          {isStreaming && latestMessage?.role === "user" ? (
            <div className="assistant-typing" role="status" aria-live="polite">
              <span className="assistant-typing__spark" aria-hidden="true">
                <Sparkles size={14} />
              </span>
              <span>{companion.name} is gathering a thought</span>
              <span className="assistant-typing__dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </div>
          ) : null}
          {proactiveHint && !isStreaming ? (
            <div className="proactive-nudge" role="status">
              <span className="proactive-nudge__spark" aria-hidden="true"><Sparkles size={13} /></span>
              <span>{proactiveHint}</span>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
