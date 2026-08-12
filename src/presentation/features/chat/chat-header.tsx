"use client";

import { Check, Copy, Mic2, Radio, Volume2, VolumeX } from "lucide-react";
import { useState } from "react";

import { appRoutes } from "@/infrastructure/config/routes";
import { useInterfaceSound } from "@/presentation/hooks/use-interface-sound";

interface ChatHeaderProps {
  sessionId?: string;
  isVoiceSupported: boolean;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
}

export function ChatHeader({
  sessionId,
  isVoiceSupported,
  voiceEnabled,
  onToggleVoice,
}: ChatHeaderProps) {
  const { play, setSoundEnabled, soundEnabled } = useInterfaceSound();
  const [copied, setCopied] = useState(false);

  const shareRoom = async () => {
    if (!sessionId) return;
    const roomUrl = new URL(
      appRoutes.room(sessionId),
      window.location.origin,
    ).toString();
    await navigator.clipboard.writeText(roomUrl);
    play("share");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <header className="persona-header">
      <div className="persona-header__identity">
        <Radio aria-hidden="true" size={16} />
        <span>Persona Room</span>
        <span className="persona-header__slash" aria-hidden="true">/</span>
        <span className="persona-header__channel">private afterglow</span>
      </div>
      <div className="persona-header__actions">
        <button
          className="icon-button"
          type="button"
          onClick={() => {
            play("share");
            setSoundEnabled(!soundEnabled);
          }}
          aria-label={soundEnabled ? "Mute interface sound" : "Enable interface sound"}
        >
          {soundEnabled ? <Volume2 aria-hidden="true" size={16} /> : <VolumeX aria-hidden="true" size={16} />}
        </button>
        <button
          className="icon-button"
          type="button"
          onClick={onToggleVoice}
          disabled={!isVoiceSupported}
          aria-pressed={voiceEnabled}
          aria-label={
            !isVoiceSupported
              ? "Browser voice is unavailable"
              : voiceEnabled
                ? "Mute Rina's voice"
                : "Enable Rina's voice"
          }
          title={!isVoiceSupported ? "Browser voice unavailable" : undefined}
        >
          {voiceEnabled ? <Mic2 aria-hidden="true" size={16} /> : <VolumeX aria-hidden="true" size={16} />}
        </button>
        <button className="share-button" type="button" onClick={() => void shareRoom()}>
          {copied ? <Check aria-hidden="true" size={15} /> : <Copy aria-hidden="true" size={15} />}
          <span>{copied ? "Link Copied" : "Invite the room"}</span>
        </button>
      </div>
    </header>
  );
}
