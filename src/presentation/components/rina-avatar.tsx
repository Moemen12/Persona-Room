import Image from "next/image";

import type { PersonaMood } from "@/features/persona/persona.types";
import { cn } from "@/lib/utils";

const expressionSource: Record<PersonaMood, string> = {
  neutral: "/rina/rina-neutral.png",
  happy: "/rina/rina-happy.png",
  surprised: "/rina/rina-surprised.png",
  "sad/thoughtful": "/rina/rina-thoughtful.png",
};

interface RinaAvatarProps {
  mood: PersonaMood;
  size?: "hero" | "room" | "message";
  className?: string;
}

export function RinaAvatar({ mood, size = "hero", className }: RinaAvatarProps) {
  return (
    <div className={cn("rina-avatar", `rina-avatar--${size}`, className)} aria-label={`Rina is feeling ${mood}`}>
      <div className="rina-avatar__glow" />
      {Object.entries(expressionSource).map(([expression, source]) => (
        <Image
          key={source}
          className={cn("rina-avatar__image", expression === mood && "rina-avatar__image--visible")}
          src={source}
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
