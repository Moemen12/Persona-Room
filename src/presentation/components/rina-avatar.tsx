import Image from "next/image";

import { COMPANIONS, type CompanionId, type PersonaMood } from "@/features/persona";
import { cn } from "@/lib/utils";

const expressionFile: Record<PersonaMood, string> = {
  neutral: "neutral",
  happy: "happy",
  surprised: "surprised",
  "sad/thoughtful": "thoughtful",
};

interface RinaAvatarProps {
  mood: PersonaMood;
  companionId?: CompanionId;
  size?: "hero" | "room" | "message";
  className?: string;
  isSpeaking?: boolean;
  isListening?: boolean;
  isPerforming?: boolean;
}

export function RinaAvatar({
  mood,
  companionId = "rina",
  size = "hero",
  className,
  isSpeaking = false,
  isListening = false,
  isPerforming = false,
}: RinaAvatarProps) {
  const companion = COMPANIONS[companionId];
  return (
    <div
      className={cn(
        "rina-avatar",
        `rina-avatar--${size}`,
        !isSpeaking && !isListening && !isPerforming && "rina-avatar--idle",
        isSpeaking && "rina-avatar--speaking",
        isListening && "rina-avatar--listening",
        isPerforming && "rina-avatar--performing",
        className,
      )}
      aria-label={`${companion.name} is feeling ${mood}${isSpeaking ? " and speaking" : isListening ? " and listening" : ""}`}
    >
      <div className="rina-avatar__glow" />
      {Object.entries(expressionFile).map(([expression, file]) => (
        <Image
          key={file}
          className={cn("rina-avatar__image", expression === mood && "rina-avatar__image--visible")}
          src={`/${companion.avatarDirectory}/${companion.id}-${file}.png`}
          alt=""
          aria-hidden={expression !== mood}
          fill
          sizes={size === "hero" ? "190px" : size === "room" ? "108px" : "40px"}
          priority={expression === mood}
        />
      ))}
    </div>
  );
}
