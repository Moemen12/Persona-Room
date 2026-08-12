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

interface LocalTts {
  generate: (
    text: string,
    options: { voice: "af_bella" | "am_michael"; speed: number },
  ) => Promise<{ toWav: () => ArrayBuffer }>;
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
  const isSupported =
    typeof window !== "undefined" &&
    (typeof window.Audio === "function" || hasBrowserFallback);
  const [voiceEnabled, setVoiceEnabledState] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const localTtsRef = useRef<LocalTts | null>(null);
  const localTtsPromiseRef = useRef<Promise<LocalTts> | null>(null);
  const speechRequestIdRef = useRef(0);
  const requestControllerRef = useRef<AbortController | null>(null);

  const getLocalTts = useCallback(async () => {
    if (localTtsRef.current) return localTtsRef.current;
    if (localTtsPromiseRef.current) return localTtsPromiseRef.current;

    const hasWebGpu = typeof navigator !== "undefined" && "gpu" in navigator;
    const promise = import("kokoro-js")
      .then(({ KokoroTTS }) =>
        KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
          dtype: hasWebGpu ? "fp32" : "q8",
          device: hasWebGpu ? "webgpu" : "wasm",
        }),
      )
      .then((tts) => {
        localTtsRef.current = tts as unknown as LocalTts;
        return localTtsRef.current;
      });

    localTtsPromiseRef.current = promise;
    try {
      return await promise;
    } finally {
      localTtsPromiseRef.current = null;
    }
  }, []);

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
    speechRequestIdRef.current += 1;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    if (hasBrowserFallback) window.speechSynthesis.cancel();
    releaseAudio();
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

  const speakLocally = useCallback(
    async (text: string, requestId: number) => {
      setIsPreparing(true);
      try {
        const tts = await getLocalTts();
        if (requestId !== speechRequestIdRef.current) return;

        const audio = await tts.generate(text, {
          voice: companionId === "rina" ? "af_bella" : "am_michael",
          speed: companionId === "rina" ? 1.03 : 0.97,
        });
        if (requestId !== speechRequestIdRef.current) return;
        await playAudioBuffer(audio.toWav(), "audio/wav");
      } finally {
        setIsPreparing(false);
      }
    },
    [companionId, getLocalTts, playAudioBuffer],
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
      const payload = (await response.json()) as VoiceResponse;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Voice generation failed.");
      }

      const binary = atob(payload.data.audioBase64);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      await playAudioBuffer(bytes.buffer, payload.data.mimeType);
    },
    [accessToken, companionId, playAudioBuffer, sessionId],
  );

  const warmLocalVoice = useCallback(async () => {
    setIsPreparing(true);
    try {
      await getLocalTts();
    } finally {
      setIsPreparing(false);
    }
  }, [getLocalTts]);

  const setVoiceEnabled = useCallback(
    (enabled: boolean) => {
      setVoiceEnabledState(enabled);
      if (!enabled) {
        stopSpeaking();
        return;
      }

      if (typeof window !== "undefined") {
        void warmLocalVoice().catch((error) => {
          console.warn("Local neural voice preparation failed; remote fallback remains available.", error);
        });
      }
    },
    [stopSpeaking, warmLocalVoice],
  );

  const speak = useCallback(
    async (text: string) => {
      if (!voiceEnabled || !isSupported || !text.trim()) return;

      stopSpeaking();
      const requestId = speechRequestIdRef.current;
      const controller = new AbortController();
      requestControllerRef.current = controller;
      setIsSpeaking(true);

      try {
        if (isEnglishText(text)) {
          await speakLocally(text.trim(), requestId);
        } else {
          await speakRemotely(text.trim(), controller);
        }
      } catch (error) {
        releaseAudio();
        if (!controller.signal.aborted && requestId === speechRequestIdRef.current) {
          console.warn("Neural voice unavailable; using browser fallback.", error);
          fallbackSpeak(text);
        }
      } finally {
        if (requestControllerRef.current === controller) {
          requestControllerRef.current = null;
        }
      }
    },
    [fallbackSpeak, isSupported, releaseAudio, speakLocally, speakRemotely, stopSpeaking, voiceEnabled],
  );

  useEffect(() => stopSpeaking, [stopSpeaking]);

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
