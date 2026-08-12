"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { CompanionId } from "@/features/persona";
import { appRoutes } from "@/infrastructure/config/routes";

interface UseCompanionVoiceOptions {
  companionId: CompanionId;
  sessionId?: string;
  accessToken?: string;
}

interface VoiceResponse {
  data?: {
    audioBase64: string;
    mimeType: "audio/mpeg";
  };
  error?: {
    code: string;
    message: string;
  };
}

export function useCompanionVoice({
  companionId,
  sessionId,
  accessToken,
}: UseCompanionVoiceOptions) {
  const hasBrowserFallback =
    typeof window !== "undefined" && typeof window.speechSynthesis?.speak === "function";
  const isSupported =
    typeof window !== "undefined" &&
    (typeof window.Audio === "function" || hasBrowserFallback);
  const [voiceEnabled, setVoiceEnabledState] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const requestControllerRef = useRef<AbortController | null>(null);

  const fallbackSpeak = useCallback(
    (text: string) => {
      if (!hasBrowserFallback) {
        setIsSpeaking(false);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = companionId === "rina" ? "en-US" : "en-US";
      utterance.rate = companionId === "rina" ? 1.02 : 0.96;
      utterance.pitch = companionId === "rina" ? 1.08 : 0.88;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    },
    [companionId, hasBrowserFallback],
  );

  const releaseAudio = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    audioRef.current = null;

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    if (hasBrowserFallback) window.speechSynthesis.cancel();
    releaseAudio();
    setIsSpeaking(false);
  }, [hasBrowserFallback, releaseAudio]);

  const setVoiceEnabled = useCallback(
    (enabled: boolean) => {
      setVoiceEnabledState(enabled);
      if (!enabled) stopSpeaking();
    },
    [stopSpeaking],
  );

  const speak = useCallback(
    async (text: string) => {
      if (!voiceEnabled || !isSupported || !sessionId || !accessToken || !text.trim()) return;

      stopSpeaking();
      const controller = new AbortController();
      requestControllerRef.current = controller;
      setIsSpeaking(true);

      try {
        const response = await fetch(appRoutes.api.voice, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            accessToken,
            sessionId,
            companionId,
            text: text.trim(),
          }),
          signal: controller.signal,
        });
        const payload = (await response.json()) as VoiceResponse;
        if (!response.ok || !payload.data) {
          throw new Error(payload.error?.message ?? "Voice generation failed.");
        }

        const binary = atob(payload.data.audioBase64);
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        const objectUrl = URL.createObjectURL(new Blob([bytes], { type: payload.data.mimeType }));
        const audio = new Audio(objectUrl);
        objectUrlRef.current = objectUrl;
        audioRef.current = audio;
        audio.onended = () => {
          releaseAudio();
          setIsSpeaking(false);
        };
        audio.onerror = () => {
          releaseAudio();
          setIsSpeaking(false);
        };
        await audio.play();
      } catch (error) {
        releaseAudio();
        if (controller.signal.aborted) {
          setIsSpeaking(false);
        } else {
          console.warn("Edge Neural voice playback unavailable; using browser fallback.", error);
          fallbackSpeak(text);
        }
      } finally {
        if (requestControllerRef.current === controller) {
          requestControllerRef.current = null;
        }
      }
    },
    [
      accessToken,
      companionId,
      fallbackSpeak,
      isSupported,
      releaseAudio,
      sessionId,
      stopSpeaking,
      voiceEnabled,
    ],
  );

  useEffect(() => {
    return () => {
      requestControllerRef.current?.abort();
      releaseAudio();
    };
  }, [releaseAudio]);

  return {
    isSupported: isSupported && Boolean(sessionId && accessToken),
    voiceEnabled,
    isSpeaking,
    setVoiceEnabled,
    speak,
    stopSpeaking,
  };
}
