"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { appRoutes } from "@/infrastructure/config/routes";

export interface VoiceDebugEvent {
  at: string;
  event: string;
  detail?: string;
}

interface UseVoiceInputOptions {
  accessToken?: string;
  companionId: string;
  onFinalTranscript: (transcript: string) => void;
  sessionId?: string;
}

interface VoiceTranscriptionResponse {
  data?: { transcript?: string };
  error?: { message?: string };
}

const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
const AUDIO_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
] as const;

function getSupportedMimeType() {
  if (typeof MediaRecorder === "undefined") return undefined;
  return AUDIO_MIME_TYPES.find(type => MediaRecorder.isTypeSupported(type));
}

function getAudioContextConstructor() {
  if (typeof window === "undefined") return undefined;
  const audioWindow = window as Window & {
    webkitAudioContext?: typeof AudioContext;
  };
  return window.AudioContext ?? audioWindow.webkitAudioContext;
}

export function useVoiceInput({
  accessToken,
  companionId,
  onFinalTranscript,
  sessionId,
}: UseVoiceInputOptions) {
  const [debugEvents, setDebugEvents] = useState<VoiceDebugEvent[]>([]);
  const [error, setError] = useState<string>();
  const [inputLevel, setInputLevel] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const uploadControllerRef = useRef<AbortController | null>(null);
  const processedCaptureRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const meterFrameRef = useRef<number | null>(null);

  const debug = useCallback((event: string, detail?: string) => {
    const entry = { at: new Date().toISOString(), event, detail };
    queueMicrotask(() =>
      setDebugEvents(previous => [...previous, entry].slice(-24))
    );
    console.warn("[PersonaRoom voice]", entry);
  }, []);

  const stopMeter = useCallback(() => {
    if (meterFrameRef.current !== null) {
      cancelAnimationFrame(meterFrameRef.current);
      meterFrameRef.current = null;
    }
    analyserRef.current = null;
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context) void context.close().catch(() => undefined);
    queueMicrotask(() => setInputLevel(0));
  }, []);

  useEffect(() => {
    if (!mediaStream) {
      queueMicrotask(() => setInputLevel(0));
      return;
    }

    const AudioContextConstructor = getAudioContextConstructor();
    if (!AudioContextConstructor) {
      debug(
        "meter-unavailable",
        "AudioContext is unavailable; recording continues without waveform"
      );
      return;
    }

    const context = new AudioContextConstructor();
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.82;
    context.createMediaStreamSource(mediaStream).connect(analyser);
    audioContextRef.current = context;
    analyserRef.current = analyser;
    const samples = new Uint8Array(analyser.fftSize);
    debug("meter-started", `sampleRate=${context.sampleRate}`);

    const update = () => {
      if (!analyserRef.current) return;
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) {
        const normalized = (sample - 128) / 128;
        sum += normalized * normalized;
      }
      setInputLevel(Math.min(1, Math.sqrt(sum / samples.length) * 3.2));
      meterFrameRef.current = requestAnimationFrame(update);
    };
    meterFrameRef.current = requestAnimationFrame(update);

    return () => stopMeter();
  }, [debug, mediaStream, stopMeter]);

  const releaseStream = useCallback(() => {
    setMediaStream(stream => {
      stream?.getTracks().forEach(track => track.stop());
      return null;
    });
  }, []);

  const transcribeCapture = useCallback(
    async (audio: Blob, captureId: number) => {
      if (!accessToken || !sessionId) {
        setError(
          "Voice session is unavailable. Please refresh the room and try again."
        );
        debug("transcription-skipped", "missing session credentials");
        return;
      }

      if (audio.size === 0 || audio.size > MAX_AUDIO_BYTES) {
        setError(
          audio.size === 0
            ? "No audio was captured. Please try again."
            : "That voice clip is too large. Please speak for less time."
        );
        debug("transcription-skipped", `invalidAudioBytes=${audio.size}`);
        return;
      }

      const controller = new AbortController();
      uploadControllerRef.current = controller;
      setIsTranscribing(true);
      setError(undefined);
      debug(
        "transcription-started",
        `capture=${captureId}, bytes=${audio.size}, mime=${audio.type || "unknown"}`
      );

      try {
        const formData = new FormData();
        formData.append(
          "audio",
          audio,
          `persona-room-${captureId}.${audio.type.includes("mp4") ? "mp4" : "webm"}`
        );
        formData.append("accessToken", accessToken);
        formData.append("sessionId", sessionId);
        formData.append("companionId", companionId);

        const response = await fetch(appRoutes.api.voiceTranscribe, {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => undefined)) as
          VoiceTranscriptionResponse | undefined;
        if (!response.ok)
          throw new Error(
            payload?.error?.message ??
              `Voice transcription failed (${response.status}).`
          );
        if (controller.signal.aborted) return;

        const transcript = payload?.data?.transcript?.trim() ?? "";
        if (!transcript) {
          setError("I didn't catch that. Please try speaking again.");
          debug("transcription-empty");
          return;
        }
        debug("transcription-completed", transcript);
        onFinalTranscript(transcript);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError")
          return;
        const message =
          cause instanceof Error
            ? cause.message
            : "Voice transcription failed. Please try again.";
        setError(message);
        debug("transcription-failed", message);
      } finally {
        if (uploadControllerRef.current === controller)
          uploadControllerRef.current = null;
        setIsTranscribing(false);
      }
    },
    [accessToken, companionId, debug, onFinalTranscript, sessionId]
  );

  const stopListening = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      releaseStream();
      return;
    }
    debug("capture-stop-requested");
    recorder.stop();
  }, [debug, releaseStream]);

  const startListening = useCallback(async () => {
    if (isListening || isTranscribing) return;
    if (!accessToken || !sessionId) {
      setError(
        "Voice session is unavailable. Please refresh the room and try again."
      );
      return;
    }
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError(
        "Voice input is not supported in this browser. Try a recent Chrome, Edge, Safari, or Firefox release."
      );
      return;
    }

    const mimeType = getSupportedMimeType();
    if (!mimeType) {
      setError("This browser cannot record a compatible audio format.");
      return;
    }

    try {
      setError(undefined);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType });
      const captureId = processedCaptureRef.current + 1;
      processedCaptureRef.current = captureId;
      chunksRef.current = [];
      recorderRef.current = recorder;
      setMediaStream(stream);
      setIsListening(true);
      debug("capture-started", `capture=${captureId}, mime=${mimeType}`);

      recorder.ondataavailable = event => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setError("Microphone recording failed. Please try again.");
        debug("capture-error", "MediaRecorder emitted an error");
        recorderRef.current = null;
        setIsListening(false);
        releaseStream();
      };
      recorder.onstop = () => {
        const audio = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        recorderRef.current = null;
        setIsListening(false);
        releaseStream();
        debug("capture-stopped", `capture=${captureId}, bytes=${audio.size}`);
        void transcribeCapture(audio, captureId);
      };
      recorder.start();
    } catch (cause) {
      releaseStream();
      const message =
        cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "Microphone permission is blocked. Allow microphone access for this site, then try again."
          : cause instanceof Error
            ? cause.message
            : "Microphone could not start. Please try again.";
      setError(message);
      debug("capture-start-failed", message);
    }
  }, [
    accessToken,
    isListening,
    isTranscribing,
    releaseStream,
    sessionId,
    transcribeCapture,
    debug,
  ]);

  useEffect(
    () => () => {
      uploadControllerRef.current?.abort();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      releaseStream();
      stopMeter();
    },
    [releaseStream, stopMeter]
  );

  return {
    debugEvents,
    error,
    inputLevel,
    interimTranscript: isTranscribing ? "Transcribing your voice…" : "",
    isListening,
    isSupported:
      typeof window !== "undefined" &&
      "MediaRecorder" in window &&
      "mediaDevices" in navigator,
    isTranscribing,
    startListening,
    stopListening,
  };
}
