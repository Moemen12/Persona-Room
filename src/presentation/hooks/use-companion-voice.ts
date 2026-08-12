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

async function errorMessageFromResponse(response: Response) {
  try {
    const payload = (await response.json()) as VoiceResponse;
    return payload.error?.message ?? "Voice generation failed.";
  } catch {
    return "Voice generation failed.";
  }
}

function supportsAudioStreaming() {
  return (
    typeof window !== "undefined" &&
    typeof MediaSource !== "undefined" &&
    MediaSource.isTypeSupported("audio/mpeg")
  );
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
  const [isPreparing, setIsPreparing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const requestControllerRef = useRef<AbortController | null>(null);

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
    setIsPreparing(false);
    setIsSpeaking(false);
  }, [hasBrowserFallback, releaseAudio]);

  const fallbackSpeak = useCallback(
    (text: string) => {
      if (!hasBrowserFallback) {
        setIsSpeaking(false);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = companionId === "rina" ? 1.02 : 0.96;
      utterance.pitch = companionId === "rina" ? 1.08 : 0.88;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    },
    [companionId, hasBrowserFallback],
  );

  const playAudioBuffer = useCallback(
    async (audioBuffer: ArrayBuffer, mimeType: string) => {
      const objectUrl = URL.createObjectURL(new Blob([audioBuffer], { type: mimeType }));
      const audio = new Audio(objectUrl);
      audio.preload = "auto";
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
    },
    [releaseAudio],
  );

  const speakRemotely = useCallback(
    async (text: string, controller: AbortController) => {
      if (!sessionId || !accessToken) throw new Error("Voice session is unavailable.");

      const response = await fetch(appRoutes.api.voice, {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ accessToken, sessionId, companionId, text: text.trim() }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(await errorMessageFromResponse(response));
      const payload = (await response.json()) as VoiceResponse;
      if (!payload.data) throw new Error("Voice generation failed.");

      const binary = atob(payload.data.audioBase64);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      await playAudioBuffer(bytes.buffer, payload.data.mimeType);
    },
    [accessToken, companionId, playAudioBuffer, sessionId],
  );

  const playProgressiveResponse = useCallback(
    async (
      response: Response,
      signal: AbortSignal,
      onPlaybackStarted: () => void,
    ) => {
      if (!response.body || !supportsAudioStreaming()) {
        throw new Error("Progressive audio is unavailable.");
      }

      if (signal.aborted) {
        throw new DOMException("Playback aborted.", "AbortError");
      }

      const mediaSource = new MediaSource();
      const objectUrl = URL.createObjectURL(mediaSource);
      const audio = new Audio();
      audio.preload = "auto";
      audio.src = objectUrl;
      objectUrlRef.current = objectUrl;
      audioRef.current = audio;

      const playbackEnded = new Promise<void>((resolve, reject) => {
        const handleAbort = () => reject(new DOMException("Playback aborted.", "AbortError"));
        audio.onended = () => {
          releaseAudio();
          setIsSpeaking(false);
          resolve();
        };
        audio.onerror = () => {
          releaseAudio();
          setIsSpeaking(false);
          reject(new Error("Progressive audio playback failed."));
        };
        signal.addEventListener("abort", handleAbort, { once: true });
      });
      void playbackEnded.catch(() => undefined);

      await new Promise<void>((resolve, reject) => {
        const handleOpen = () => resolve();
        const handleAbort = () => reject(new DOMException("Playback aborted.", "AbortError"));
        if (signal.aborted) {
          handleAbort();
          return;
        }
        mediaSource.addEventListener("sourceopen", handleOpen, { once: true });
        signal.addEventListener("abort", handleAbort, { once: true });
        mediaSource.addEventListener(
          "error",
          () => reject(new Error("Progressive audio source failed.")),
          { once: true },
        );
      });

      const sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");
      const reader = response.body.getReader();
      let started = false;

      const appendChunk = (chunk: Uint8Array) =>
        new Promise<void>((resolve, reject) => {
          const appendable = chunk.slice().buffer;
          const handleUpdateEnd = () => {
            signal.removeEventListener("abort", handleAbort);
            resolve();
          };
          const handleAbort = () => {
            sourceBuffer.removeEventListener("updateend", handleUpdateEnd);
            reject(new DOMException("Playback aborted.", "AbortError"));
          };
          sourceBuffer.addEventListener("updateend", handleUpdateEnd, { once: true });
          signal.addEventListener("abort", handleAbort, { once: true });
          try {
            sourceBuffer.appendBuffer(appendable);
          } catch (error) {
            signal.removeEventListener("abort", handleAbort);
            sourceBuffer.removeEventListener("updateend", handleUpdateEnd);
            reject(error instanceof Error ? error : new Error("Audio append failed."));
          }
        });

      try {
        while (true) {
          const next = await reader.read();
          if (next.done) break;
          await appendChunk(next.value);
          if (!started) {
            await audio.play();
            started = true;
            onPlaybackStarted();
          }
        }

        if (mediaSource.readyState === "open") {
          mediaSource.endOfStream();
        }
        await playbackEnded;
      } finally {
        reader.releaseLock();
        releaseAudio();
      }
    },
    [releaseAudio],
  );

  const speakStream = useCallback(
    async (text: string, controller: AbortController) => {
      if (!sessionId || !accessToken) throw new Error("Voice session is unavailable.");
      if (!supportsAudioStreaming()) return speakRemotely(text, controller);

      const response = await fetch(appRoutes.api.voiceStream, {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ accessToken, sessionId, companionId, text: text.trim() }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(await errorMessageFromResponse(response));

      let started = false;
      try {
        await playProgressiveResponse(response, controller.signal, () => {
          started = true;
          setIsPreparing(false);
        });
      } catch (error) {
        releaseAudio();
        if (!started && !controller.signal.aborted) {
          await speakRemotely(text, controller);
          return;
        }
        throw error;
      }
    },
    [
      accessToken,
      companionId,
      playProgressiveResponse,
      releaseAudio,
      sessionId,
      speakRemotely,
    ],
  );

  const setVoiceEnabled = useCallback(
    (enabled: boolean) => {
      setVoiceEnabledState(enabled);
      if (!enabled) stopSpeaking();
    },
    [stopSpeaking],
  );

  const speak = useCallback(
    async (text: string) => {
      if (!voiceEnabled || !isSupported || !text.trim()) return;

      stopSpeaking();
      const controller = new AbortController();
      requestControllerRef.current = controller;
      setIsPreparing(true);
      setIsSpeaking(true);

      try {
        await speakStream(text.trim(), controller);
      } catch (error) {
        releaseAudio();
        if (!controller.signal.aborted) {
          console.warn("Neural voice unavailable; using browser fallback.", error);
          setIsPreparing(false);
          fallbackSpeak(text);
        }
      } finally {
        if (requestControllerRef.current === controller) {
          requestControllerRef.current = null;
        }
        if (!controller.signal.aborted) setIsPreparing(false);
      }
    },
    [fallbackSpeak, isSupported, releaseAudio, speakStream, stopSpeaking, voiceEnabled],
  );

  useEffect(() => {
    return () => stopSpeaking();
  }, [stopSpeaking]);

  return {
    isSupported,
    voiceEnabled,
    isSpeaking,
    isPreparing,
    setVoiceEnabled,
    speak,
    stopSpeaking,
  };
}
