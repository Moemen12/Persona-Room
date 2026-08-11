import { Sparkles } from "lucide-react";

import { formatTime } from "@/lib/utils";

interface MessageBubbleProps {
  role: "user" | "assistant";
  text: string;
  createdAt?: string;
  isStreaming?: boolean;
  assistantName?: string;
}

export function MessageBubble({
  role,
  text,
  createdAt,
  isStreaming,
  assistantName = "Rina",
}: MessageBubbleProps) {
  const isAssistant = role === "assistant";
  return (
    <article className={`message-bubble message-bubble--${role}`}>
      {isAssistant && (
        <div className="message-bubble__speaker">
          <Sparkles aria-hidden="true" size={13} strokeWidth={2.5} />
          {assistantName}
        </div>
      )}
      <p>{text || (isStreaming ? "…" : "")}</p>
      <footer>
        {createdAt ? <time dateTime={createdAt}>{formatTime(createdAt)}</time> : null}
        {isStreaming ? <span className="streaming-cursor" aria-label={`${assistantName} is typing`} /> : null}
      </footer>
    </article>
  );
}
