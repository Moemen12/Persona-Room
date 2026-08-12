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

type LocalVoiceWorkerRequest =
  | { type: "prepare"; requestId: number }
  | { type: "synthesize"; requestId: number; text: string; companionId: CompanionId };

type LocalVoiceWorkerResponse =
  | { type: "status"; requestId: number; status: "loading" | "ready"; progress?: number }
  | { type: "audio"; requestId: number; audioBuffer: ArrayBuffer }
  | { type: "error"; requestId: number; message: string };

type PendingWorkerRequest = {
  type: LocalVoiceWorkerRequest["type"];
  resolve: (audioBuffer: ArrayBuffer | null) => void;
  reject: (error: Error) => void;
};

async function errorMessageFromResponse(response: Response) {
  try {
    const payload = (await response.json()) as VoiceResponse;
    return payload.error?.message ?? "Voice generation failed.";
  } catch {
    return "Voice generation failed.";
  }
}

function isEnglishText(text: string) {
  return !/[\uac00-\ud7af\u0600-\u06ff\u4e00-\u9fff]/u.test(text);
}

export function useCompanionVoice({
  companionId,
  sessionId,
  accessToken,
}: UseCompanionVoiceOptions) {
  const hasBrowserFallback =
    typeof window !== "undefined" && typeof window.speechSynthesis?.speak === "function";
  const hasLocalWorker = typeof window !== "undefined" && typeof Worker === "function";
  const connection =
    typeof navigator !== "undefined"
      ? (navigator as Navigator & {
          connection?: { saveData?: boolean; effectiveType?: string };
        }).connection
      : undefined;
  const shouldUseLocalWorker =
    hasLocalWorker &&
    !connection?.saveData &&
    connection?.effectiveType !== "slow-2g" &&
    connection?.effectiveType !== "2g";
  const isSupported =
    typeof window !== "undefined" &&
    (typeof window.Audio === "function" || hasBrowserFallback || hasLocalWorker);
  const [voiceEnabled, setVoiceEnabledState] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const workerPendingRef = useRef<Map<number, PendingWorkerRequest>>(new Map());
  const workerRequestIdRef = useRef(0);
  const activeRequestIdRef = useRef(0);
  const requestControllerRef = useRef<AbortController | null>(null);

  const getWorker = useCallback(() => {
    if (!shouldUseLocalWorker) throw new Error("Local voice workers are unavailable on this connection.");
    if (workerRef.current) return workerRef.current;

    const worker = new Worker(new URL("../workers/kokoro-voice.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.addEventListener("message", (event: MessageEvent<LocalVoiceWorkerResponse>) => {
      const response = event.data;
      if (response.requestId === activeRequestIdRef.current && response.type === "status") {
        setIsPreparing(response.status === "loading");
      }

      const pending = workerPendingRef.current.get(response.requestId);
      if (!pending) return;

      if (response.type === "status" && response.status === "ready" && pending.type === "prepare") {
        workerPendingRef.current.delete(response.requestId);
        pending.resolve(null);
      } else if (response.type === "audio" && pending.type === "synthesize") {
        workerPendingRef.current.delete(response.requestId);
        pending.resolve(response.audioBuffer);
      } else if (response.type === "error") {
        workerPendingRef.current.delete(response.requestId);
        pending.reject(new Error(response.message));
      }
    });
    worker.addEventListener("error", (event) => {
      const error = new Error(event.message || "Local neural voice worker failed.");
      for (const pending of workerPendingRef.current.values()) pending.reject(error);
      workerPendingRef.current.clear();
      workerRef.current = null;
      setIsPreparing(false);
    });
    workerRef.current = worker;
    return worker;
  }, [shouldUseLocalWorker]);

  const requestLocalVoice = useCallback(
    (request: LocalVoiceWorkerRequest) => {
      const worker = getWorker();
      return new Promise<ArrayBuffer | null>((resolve, reject) => {
        workerPendingRef.current.set(request.requestId, {
          type: request.type,
          resolve,
          reject,
        });
        try {
          worker.postMessage(request);
        } catch (error) {
          workerPendingRef.current.delete(request.requestId);
          reject(error instanceof Error ? error : new Error("Local neural voice request failed."));
        }
      });
    },
    [getWorker],
  );

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
    activeRequestIdRef.current = ++workerRequestIdRef.current;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    if (hasBrowserFallback) window.speechSynthesis.cancel();
    releaseAudio();
    setIsPreparing(false);
    setIsSpeaking(false);
  }, [hasBrowserFallback, releaseAudio]);

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

  const warmLocalVoice = useCallback(async () => {
    if (!shouldUseLocalWorker) return;
    const requestId = ++workerRequestIdRef.current;
    activeRequestIdRef.current = requestId;
    setIsPreparing(true);
    try {
      await requestLocalVoice({ type: "prepare", requestId });
    } finally {
      if (activeRequestIdRef.current === requestId) setIsPreparing(false);
    }
  }, [requestLocalVoice, shouldUseLocalWorker]);

  const speakLocally = useCallback(
    async (text: string, requestId: number) => {
      setIsPreparing(true);
      try {
        const audioBuffer = await requestLocalVoice({
          type: "synthesize",
          requestId,
          text,
          companionId,
        });
        if (!audioBuffer || requestId !== activeRequestIdRef.current) return;
        await playAudioBuffer(audioBuffer, "audio/wav");
      } finally {
        if (activeRequestIdRef.current === requestId) setIsPreparing(false);
      }
    },
    [companionId, playAudioBuffer, requestLocalVoice],
  );

  const speakRemotely = useCallback(
    async (text: string, controller: AbortController) => {
      if (!sessionId || !accessToken) throw new Error("Voice session is unavailable.");

      const response = await fetch(appRoutes.api.voice, {
        method: "POST",
        headers: { "content-type": "application/json" },
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

  const scheduleWarmLocalVoice = useCallback(() => {
    if (!shouldUseLocalWorker || typeof window === "undefined") return;

    const run = () => {
      void warmLocalVoice().catch((error) => {
        console.warn("Local neural voice preparation failed; remote fallback remains available.", error);
      });
    };
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    };

    if (idleWindow.requestIdleCallback) {
      idleWindow.requestIdleCallback(run, { timeout: 1500 });
    } else {
      window.setTimeout(run, 120);
    }
  }, [shouldUseLocalWorker, warmLocalVoice]);

  const setVoiceEnabled = useCallback(
    (enabled: boolean) => {
      setVoiceEnabledState(enabled);
      if (!enabled) {
        stopSpeaking();
        return;
      }

      scheduleWarmLocalVoice();
    },
    [scheduleWarmLocalVoice, stopSpeaking],
  );

  const speak = useCallback(
    async (text: string) => {
      if (!voiceEnabled || !isSupported || !text.trim()) return;

      stopSpeaking();
      const requestId = ++workerRequestIdRef.current;
      activeRequestIdRef.current = requestId;
      const controller = new AbortController();
      requestControllerRef.current = controller;
      setIsSpeaking(true);

      try {
        if (isEnglishText(text) && shouldUseLocalWorker) {
          await speakLocally(text.trim(), requestId);
        } else {
          await speakRemotely(text.trim(), controller);
        }
      } catch (error) {
        releaseAudio();
        if (!controller.signal.aborted && requestId === activeRequestIdRef.current) {
          console.warn("Neural voice unavailable; using browser fallback.", error);
          fallbackSpeak(text);
        }
      } finally {
        if (requestControllerRef.current === controller) {
          requestControllerRef.current = null;
        }
      }
    },
    [
      fallbackSpeak,
      shouldUseLocalWorker,
      isSupported,
      releaseAudio,
      speakLocally,
      speakRemotely,
      stopSpeaking,
      voiceEnabled,
    ],
  );

  useEffect(() => {
    const pendingRequests = workerPendingRef.current;
    return () => {
      stopSpeaking();
      workerRef.current?.terminate();
      workerRef.current = null;
      pendingRequests.clear();
    };
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
