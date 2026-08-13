import { Sparkles } from "lucide-react";

import { formatTime } from "@/lib/utils";
import { useTypewriterText } from "@/presentation/hooks/use-typewriter-text";

interface MessageBubbleProps {
  role: "user" | "assistant";
  text: string;
  createdAt?: string;
  isStreaming?: boolean;
  isPreparing?: boolean;
  animateText?: boolean;
  assistantName?: string;
}

export function MessageBubble({
  role,
  text,
  createdAt,
  isStreaming,
  isPreparing = false,
  animateText = false,
  assistantName = "Rina",
}: MessageBubbleProps) {
  const isAssistant = role === "assistant";
  const renderedText = useTypewriterText({
    text,
    enabled: isAssistant && animateText && Boolean(text),
  });
  return (
    <article className={`message-bubble message-bubble--${role} ${isPreparing ? "message-bubble--preparing" : ""}`}>
      {isAssistant && (
        <div className="message-bubble__speaker">
          <Sparkles aria-hidden="true" size={13} strokeWidth={2.5} />
          {assistantName}
        </div>
      )}
      <p>{renderedText || (isStreaming ? "…" : "")}</p>
      <footer>
        {createdAt ? <time dateTime={createdAt}>{formatTime(createdAt)}</time> : null}
        {isStreaming ? <span className="streaming-cursor" aria-label={`${assistantName} is typing`} /> : null}
      </footer>
    </article>
  );
}
