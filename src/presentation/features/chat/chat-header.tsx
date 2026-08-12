"use client";

import { Check, Copy, Mic2, Radio, Volume2, VolumeX } from "lucide-react";
import { useState } from "react";

import { appRoutes } from "@/infrastructure/config/routes";
import { useInterfaceSound } from "@/presentation/hooks/use-interface-sound";

interface ChatHeaderProps {
  sessionId?: string;
  isVoiceSupported: boolean;
  isVoicePreparing: boolean;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
}

export function ChatHeader({
  sessionId,
  isVoiceSupported,
  isVoicePreparing,
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
        {isVoicePreparing ? (
          <span className="persona-header__voice-status" role="status" aria-live="polite">
            Warming voice…
          </span>
        ) : null}
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
          aria-busy={isVoicePreparing}
          aria-label={
            !isVoiceSupported
              ? "Neural voice is unavailable"
              : isVoicePreparing
                ? "Preparing local neural voice"
                : voiceEnabled
                  ? "Mute companion voice"
                  : "Enable companion voice"
          }
          title={
            !isVoiceSupported
              ? "Neural voice unavailable"
              : isVoicePreparing
                ? "Preparing local neural voice"
                : "Free local neural voice"
          }
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
