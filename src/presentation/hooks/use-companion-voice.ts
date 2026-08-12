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

interface PreparedAudio {
  audioBuffer: ArrayBuffer;
  mimeType: string;
}

export interface VoiceSpeakOptions {
  onPlaybackStarted?: () => void;
  onPlaybackFinished?: () => void;
}

interface VoiceQueueItem extends VoiceSpeakOptions {
  text: string;
  prepared?: Promise<PreparedAudio>;
  preparedController?: AbortController;
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

function decodeAudioBase64(audioBase64: string) {
  const binary = atob(audioBase64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0)).buffer;
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
  const requestControllersRef = useRef(new Set<AbortController>());
  const voiceQueueRef = useRef<VoiceQueueItem[]>([]);
  const queueWorkerActiveRef = useRef(false);
  const queueGenerationRef = useRef(0);
  const hasPlayedItemRef = useRef(false);

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
    queueGenerationRef.current += 1;
    requestControllersRef.current.forEach((controller) => controller.abort());
    requestControllersRef.current.clear();
    voiceQueueRef.current = [];
    hasPlayedItemRef.current = false;
    if (hasBrowserFallback) window.speechSynthesis.cancel();
    releaseAudio();
    setIsPreparing(false);
    setIsSpeaking(false);
  }, [hasBrowserFallback, releaseAudio]);

  const fallbackSpeak = useCallback(
    async (text: string, callbacks: VoiceSpeakOptions = {}) => {
      if (!hasBrowserFallback) {
        setIsSpeaking(false);
        callbacks.onPlaybackStarted?.();
        callbacks.onPlaybackFinished?.();
        return;
      }

      await new Promise<void>((resolve) => {
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          setIsSpeaking(false);
          callbacks.onPlaybackFinished?.();
          resolve();
        };
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "en-US";
        utterance.rate = companionId === "rina" ? 1.02 : 0.96;
        utterance.pitch = companionId === "rina" ? 1.08 : 0.88;
        utterance.onend = finish;
        utterance.onerror = finish;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
        callbacks.onPlaybackStarted?.();
      });
    },
    [companionId, hasBrowserFallback],
  );

  const playAudioBuffer = useCallback(
    async (
      preparedAudio: PreparedAudio,
      signal: AbortSignal,
      callbacks: VoiceSpeakOptions,
    ) => {
      const objectUrl = URL.createObjectURL(
        new Blob([preparedAudio.audioBuffer], { type: preparedAudio.mimeType }),
      );
      const audio = new Audio(objectUrl);
      audio.preload = "auto";
      objectUrlRef.current = objectUrl;
      audioRef.current = audio;

      const playbackEnded = new Promise<void>((resolve, reject) => {
        const handleAbort = () => reject(new DOMException("Playback aborted.", "AbortError"));
        const finish = () => {
          signal.removeEventListener("abort", handleAbort);
          releaseAudio();
          setIsSpeaking(false);
          resolve();
        };
        audio.onended = finish;
        audio.onerror = () => {
          signal.removeEventListener("abort", handleAbort);
          releaseAudio();
          setIsSpeaking(false);
          reject(new Error("Audio playback failed."));
        };
        signal.addEventListener("abort", handleAbort, { once: true });
      });

      try {
        await audio.play();
        if (signal.aborted) throw new DOMException("Playback aborted.", "AbortError");
        callbacks.onPlaybackStarted?.();
        await playbackEnded;
      } finally {
        releaseAudio();
      }
    },
    [releaseAudio],
  );

  const prepareAudio = useCallback(
    async (text: string, controller: AbortController): Promise<PreparedAudio> => {
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

      return {
        audioBuffer: decodeAudioBase64(payload.data.audioBase64),
        mimeType: payload.data.mimeType,
      };
    },
    [accessToken, companionId, sessionId],
  );

  const playProgressiveResponse = useCallback(
    async (
      response: Response,
      signal: AbortSignal,
      callbacks: VoiceSpeakOptions,
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
        const finish = () => {
          signal.removeEventListener("abort", handleAbort);
          releaseAudio();
          setIsSpeaking(false);
          resolve();
        };
        audio.onended = finish;
        audio.onerror = () => {
          signal.removeEventListener("abort", handleAbort);
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
            callbacks.onPlaybackStarted?.();
          }
        }

        if (mediaSource.readyState === "open") mediaSource.endOfStream();
        await playbackEnded;
      } finally {
        reader.releaseLock();
        releaseAudio();
      }
    },
    [releaseAudio],
  );

  const playQueueItem = useCallback(
    async (item: VoiceQueueItem, useProgressiveFirst: boolean) => {
      const controller = new AbortController();
      requestControllersRef.current.add(controller);
      let playbackStarted = false;
      const callbacks: VoiceSpeakOptions = {
        onPlaybackStarted: () => {
          playbackStarted = true;
          setIsPreparing(false);
          setIsSpeaking(true);
          item.onPlaybackStarted?.();
        },
      };

      try {
        if (useProgressiveFirst && supportsAudioStreaming()) {
          if (!sessionId || !accessToken) throw new Error("Voice session is unavailable.");
          const response = await fetch(appRoutes.api.voiceStream, {
            method: "POST",
            headers: { "content-type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({
              accessToken,
              sessionId,
              companionId,
              text: item.text.trim(),
            }),
            signal: controller.signal,
          });
          if (!response.ok) throw new Error(await errorMessageFromResponse(response));
          await playProgressiveResponse(response, controller.signal, callbacks);
        } else {
          const preparedAudio = item.prepared
            ? await item.prepared
            : await prepareAudio(item.text, controller);
          await playAudioBuffer(preparedAudio, controller.signal, callbacks);
        }
      } catch (error) {
        releaseAudio();
        if (controller.signal.aborted) throw error;
        if (!playbackStarted) {
          console.warn("Neural voice unavailable; using browser fallback.", error);
          await fallbackSpeak(item.text, callbacks);
        } else {
          console.warn("Neural voice playback ended unexpectedly.", error);
        }
      } finally {
        requestControllersRef.current.delete(controller);
      }
    },
    [
      accessToken,
      companionId,
      fallbackSpeak,
      playAudioBuffer,
      playProgressiveResponse,
      prepareAudio,
      releaseAudio,
      sessionId,
    ],
  );

  const prefetchQueueItem = useCallback(
    (item: VoiceQueueItem) => {
      if (item.prepared || item.preparedController) return;
      const controller = new AbortController();
      item.preparedController = controller;
      requestControllersRef.current.add(controller);
      item.prepared = prepareAudio(item.text, controller).finally(() => {
        requestControllersRef.current.delete(controller);
        if (item.preparedController === controller) item.preparedController = undefined;
      });
    },
    [prepareAudio],
  );

  const ensurePrefetch = useCallback(() => {
    voiceQueueRef.current.slice(0, 2).forEach(prefetchQueueItem);
  }, [prefetchQueueItem]);

  const processQueue = useCallback(async () => {
    if (queueWorkerActiveRef.current) return;
    queueWorkerActiveRef.current = true;
    const generation = queueGenerationRef.current;

    try {
      while (
        voiceQueueRef.current.length > 0 &&
        generation === queueGenerationRef.current
      ) {
        const item = voiceQueueRef.current.shift();
        if (!item) continue;
        ensurePrefetch();
        await playQueueItem(item, !hasPlayedItemRef.current);
        hasPlayedItemRef.current = true;
        item.onPlaybackFinished?.();
      }
    } finally {
      queueWorkerActiveRef.current = false;
      if (voiceQueueRef.current.length === 0) {
        hasPlayedItemRef.current = false;
        setIsPreparing(false);
        setIsSpeaking(false);
      }
    }
  }, [ensurePrefetch, playQueueItem]);

  const setVoiceEnabled = useCallback(
    (enabled: boolean) => {
      setVoiceEnabledState(enabled);
      if (!enabled) stopSpeaking();
    },
    [stopSpeaking],
  );

  const speak = useCallback(
    (text: string, options: VoiceSpeakOptions = {}) => {
      const trimmedText = text.trim();
      if (!trimmedText) {
        options.onPlaybackStarted?.();
        options.onPlaybackFinished?.();
        return;
      }
      if (!voiceEnabled || !isSupported) {
        options.onPlaybackStarted?.();
        options.onPlaybackFinished?.();
        return;
      }

      const wasActive = queueWorkerActiveRef.current;
      voiceQueueRef.current.push({ text: trimmedText, ...options });
      setIsSpeaking(true);
      if (!wasActive) setIsPreparing(true);
      if (wasActive) ensurePrefetch();
      void processQueue();
    },
    [ensurePrefetch, isSupported, processQueue, voiceEnabled],
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
