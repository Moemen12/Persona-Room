import Image from "next/image";

import { COMPANIONS, type CompanionId, type PersonaMood } from "@/features/persona/persona.types";
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
}

export function RinaAvatar({
  mood,
  companionId = "rina",
  size = "hero",
  className,
}: RinaAvatarProps) {
  const companion = COMPANIONS[companionId];
  return (
    <div
      className={cn("rina-avatar", `rina-avatar--${size}`, className)}
      aria-label={`${companion.name} is feeling ${mood}`}
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
