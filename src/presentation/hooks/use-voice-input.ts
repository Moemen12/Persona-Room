"use client";

import { useCallback, useEffect, useReducer, useRef, useActionState, startTransition } from "react";

import { transcribeAction, type TranscriptionState } from "@/actions/voice.actions";

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

type VoiceStateStatus = "idle" | "recording" | "error";

interface VoiceState {
  status: VoiceStateStatus;
  localError?: string;
  inputLevel: number;
  debugEvents: VoiceDebugEvent[];
}

type VoiceAction =
  | { type: "START_RECORDING" }
  | { type: "STOP_RECORDING" }
  | { type: "SET_LOCAL_ERROR"; error: string }
  | { type: "SET_INPUT_LEVEL"; level: number }
  | { type: "ADD_DEBUG"; event: string; detail?: string };

const initialState: VoiceState = {
  status: "idle",
  inputLevel: 0,
  debugEvents: [],
};

function voiceReducer(state: VoiceState, action: VoiceAction): VoiceState {
  switch (action.type) {
    case "START_RECORDING":
      return { ...state, status: "recording", localError: undefined };
    case "STOP_RECORDING":
      return { ...state, status: "idle", inputLevel: 0 };
    case "SET_LOCAL_ERROR":
      return { ...state, status: "error", localError: action.error, inputLevel: 0 };
    case "SET_INPUT_LEVEL":
      return { ...state, inputLevel: action.level };
    case "ADD_DEBUG": {
      const entry = { at: new Date().toISOString(), event: action.event, detail: action.detail };
      return { ...state, debugEvents: [...state.debugEvents, entry].slice(-24) };
    }
    default:
      return state;
  }
}

const AUDIO_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
] as const;

function getSupportedMimeType() {
  if (typeof MediaRecorder === "undefined") return undefined;
  return AUDIO_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

function getAudioContextConstructor() {
  if (typeof window === "undefined") return undefined;
  const audioWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
  return window.AudioContext ?? audioWindow.webkitAudioContext;
}

const initialTranscriptionState: TranscriptionState = { status: "idle" };

/**
 * Senior-level declarative voice hook using React 19 useActionState and a useReducer state machine.
 */
export function useVoiceInput({
  accessToken,
  companionId,
  onFinalTranscript,
  sessionId,
}: UseVoiceInputOptions) {
  const [state, dispatch] = useReducer(voiceReducer, initialState);

  // React 19 Server Action integration
  const [transcription, runTranscription] = useActionState(transcribeAction, initialTranscriptionState);
  const lastProcessedTranscriptionRef = useRef<TranscriptionState>(initialTranscriptionState);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const captureCounterRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const meterFrameRef = useRef<number | null>(null);

  const debug = useCallback((event: string, detail?: string) => {
    dispatch({ type: "ADD_DEBUG", event, detail });
    console.warn("[PersonaRoom voice]", { event, detail });
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
    dispatch({ type: "SET_INPUT_LEVEL", level: 0 });
  }, []);

  const releaseStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  // Handle successful transcription declaratively
  useEffect(() => {
    if (transcription === lastProcessedTranscriptionRef.current) return;
    lastProcessedTranscriptionRef.current = transcription;

    if (transcription.status === "success" && transcription.transcript) {
      debug("transcription-completed", transcription.transcript);
      onFinalTranscript(transcription.transcript);
    }
  }, [transcription, onFinalTranscript, debug]);

  // Audio metering effect
  useEffect(() => {
    if (state.status !== "recording" || !mediaStreamRef.current) {
      stopMeter();
      return;
    }

    const stream = mediaStreamRef.current;
    const AudioContextConstructor = getAudioContextConstructor();
    if (!AudioContextConstructor) {
      debug("meter-unavailable");
      return;
    }

    const context = new AudioContextConstructor();
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.82;
    context.createMediaStreamSource(stream).connect(analyser);
    audioContextRef.current = context;
    analyserRef.current = analyser;
    const samples = new Uint8Array(analyser.fftSize);

    const update = () => {
      if (!analyserRef.current) return;
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) {
        const normalized = (sample - 128) / 128;
        sum += normalized * normalized;
      }
      dispatch({ type: "SET_INPUT_LEVEL", level: Math.min(1, Math.sqrt(sum / samples.length) * 3.2) });
      meterFrameRef.current = requestAnimationFrame(update);
    };
    meterFrameRef.current = requestAnimationFrame(update);

    return () => stopMeter();
  }, [state.status, debug, stopMeter]);

  const startListening = useCallback(async () => {
    if (state.status !== "idle" && state.status !== "error") return;
    if (!accessToken || !sessionId) {
      dispatch({ type: "SET_LOCAL_ERROR", error: "Voice session unavailable." });
      return;
    }
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      dispatch({ type: "SET_LOCAL_ERROR", error: "Voice input not supported." });
      return;
    }

    const mimeType = getSupportedMimeType();
    if (!mimeType) {
      dispatch({ type: "SET_LOCAL_ERROR", error: "Recording format not supported." });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      chunksRef.current = [];

      const captureId = ++captureCounterRef.current;
      debug("capture-started", `capture=${captureId}`);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onerror = () => {
        dispatch({ type: "SET_LOCAL_ERROR", error: "Recording failed." });
        debug("capture-error");
        recorderRef.current = null;
        releaseStream();
      };
      recorder.onstop = () => {
        const audio = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        recorderRef.current = null;
        releaseStream();
        debug("capture-stopped", `bytes=${audio.size}`);

        // Trigger Server Action
        const formData = new FormData();
        formData.append("audio", audio, "voice.webm");
        formData.append("accessToken", accessToken);
        formData.append("sessionId", sessionId);
        formData.append("companionId", companionId);
        startTransition(() => {
          runTranscription(formData);
        });
      };

      dispatch({ type: "START_RECORDING" });
      recorder.start();
    } catch (cause) {
      releaseStream();
      const message = cause instanceof DOMException && cause.name === "NotAllowedError"
        ? "Microphone permission denied."
        : "Could not start microphone.";
      dispatch({ type: "SET_LOCAL_ERROR", error: message });
      debug("capture-start-failed", message);
    }
  }, [accessToken, debug, releaseStream, sessionId, state.status, companionId, runTranscription]);

  const stopListening = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      debug("capture-stop-requested");
      recorder.stop();
    } else {
      releaseStream();
      dispatch({ type: "STOP_RECORDING" });
    }
  }, [debug, releaseStream]);

  useEffect(() => () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    releaseStream();
    stopMeter();
  }, [releaseStream, stopMeter]);

  return {
    debugEvents: state.debugEvents,
    error: state.localError || (transcription.status === "error" ? transcription.error : undefined),
    inputLevel: state.inputLevel,
    interimTranscript: transcription.status === "pending" ? "Transcribing your voice…" : "",
    isListening: state.status === "recording",
    isSupported: typeof window !== "undefined" && "MediaRecorder" in window && "mediaDevices" in navigator,
    isTranscribing: transcription.status === "pending",
    startListening,
    stopListening,
  };
}
