import { type UIMessage } from "ai";
import { LoaderCircle, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";

import { COMPANIONS, type CompanionId, type PersonaMood } from "@/features/persona";
import { MessageBubble } from "@/presentation/components/message-bubble";

interface ChatTranscriptProps {
  messages: UIMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  setupError?: string;
  companionId: CompanionId;
  mood: PersonaMood;
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
}: ChatTranscriptProps) {
  const messageListRef = useRef<HTMLDivElement>(null);
  const companion = COMPANIONS[companionId];

  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

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
  );
}
