"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useEffectEvent,
  useReducer,
  useRef,
  useState,
  useActionState,
} from "react";

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

// ---------------------------------------------------------------------------
// Recording state machine
// ---------------------------------------------------------------------------

type VoiceStatus = "idle" | "recording" | "error";

interface VoiceState {
  status: VoiceStatus;
  error?: string;
  debugEvents: VoiceDebugEvent[];
}

type VoiceAction =
  | { type: "START_RECORDING" }
  | { type: "STOP_RECORDING" }
  | { type: "ERROR"; error: string }
  | { type: "ADD_DEBUG"; entry: VoiceDebugEvent };

const MAX_DEBUG_EVENTS = 24;

const initialState: VoiceState = { status: "idle", debugEvents: [] };

function voiceReducer(state: VoiceState, action: VoiceAction): VoiceState {
  switch (action.type) {
    case "START_RECORDING":
      return { ...state, status: "recording", error: undefined };
    case "STOP_RECORDING":
      return state.status === "recording" ? { ...state, status: "idle" } : state;
    case "ERROR":
      return { ...state, status: "error", error: action.error };
    case "ADD_DEBUG":
      return { ...state, debugEvents: [...state.debugEvents, action.entry].slice(-MAX_DEBUG_EVENTS) };
  }
}

// ---------------------------------------------------------------------------
// Browser capability helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Mic level metering — isolated so the main hook doesn't have to think
// about AnalyserNode/rAF at all. Driven purely by which stream (if any)
// is currently active.
// ---------------------------------------------------------------------------

const FFT_SIZE = 256;
const SMOOTHING_TIME_CONSTANT = 0.82;
const LEVEL_GAIN = 3.2; // scales RMS amplitude (0-1) up to a more readable meter

function useMicLevel(stream: MediaStream | null): number {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    const AudioContextConstructor = getAudioContextConstructor();
    if (!stream || !AudioContextConstructor) {
      setLevel(0);
      return;
    }

    const context = new AudioContextConstructor();
    const analyser = context.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = SMOOTHING_TIME_CONSTANT;
    context.createMediaStreamSource(stream).connect(analyser);

    const samples = new Uint8Array(analyser.fftSize);
    let frame: number;

    const tick = () => {
      analyser.getByteTimeDomainData(samples);
      let sumSquares = 0;
      for (const sample of samples) {
        const normalized = (sample - 128) / 128;
        sumSquares += normalized * normalized;
      }
      setLevel(Math.min(1, Math.sqrt(sumSquares / samples.length) * LEVEL_GAIN));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      setLevel(0);
      void context.close().catch(() => undefined);
    };
  }, [stream]);

  return level;
}

// ---------------------------------------------------------------------------
// Main hook
// ---------------------------------------------------------------------------

const initialTranscriptionState: TranscriptionState = { status: "idle" };

/**
 * Senior-level declarative voice hook using React 19 useActionState, 
 * useEffectEvent, and a clean closure-based recording session.
 */
export function useVoiceInput({
  accessToken,
  companionId,
  onFinalTranscript,
  sessionId,
}: UseVoiceInputOptions) {
  const [voiceState, dispatch] = useReducer(voiceReducer, initialState);

  // The stream that's currently live, if any. Driving the meter off state
  // (rather than a ref peeked at from inside an effect) is what lets
  // useMicLevel stay a small, separately-testable hook.
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const inputLevel = useMicLevel(activeStream);

  // React 19's useActionState already tracks "is this action in flight"
  const [transcription, runTranscription, isTranscribing] = useActionState(
    transcribeAction,
    initialTranscriptionState
  );

  // Only needed so stopListening (called later, from a click) can reach
  // whichever recorder is currently active. Nothing else reads this.
  const recorderRef = useRef<MediaRecorder | null>(null);

  const debug = useCallback((event: string, detail?: string) => {
    const entry: VoiceDebugEvent = { at: new Date().toISOString(), event, detail };
    dispatch({ type: "ADD_DEBUG", entry });
    if (process.env.NODE_ENV !== "production") {
      console.warn("[PersonaRoom voice]", entry);
    }
  }, []);

  // Fires onFinalTranscript once a transcription resolves. useEffectEvent
  // always sees the latest onFinalTranscript/debug without needing them
  // as deps, so this effect only re-runs when `transcription` itself
  // changes — never because the parent re-rendered with a new callback.
  const handleSettledTranscription = useEffectEvent((t: TranscriptionState) => {
    if (t.status === "success" && t.transcript) {
      debug("transcription-completed", t.transcript);
      onFinalTranscript(t.transcript);
    }
  });

  useEffect(() => {
    handleSettledTranscription(transcription);
  }, [transcription]);

  const startListening = useCallback(async () => {
    if (voiceState.status === "recording") return;

    if (!accessToken || !sessionId) {
      dispatch({ type: "ERROR", error: "Voice session unavailable." });
      return;
    }
    if (
      typeof window === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      dispatch({ type: "ERROR", error: "Voice input not supported." });
      return;
    }
    const mimeType = getSupportedMimeType();
    if (!mimeType) {
      dispatch({ type: "ERROR", error: "Recording format not supported." });
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (cause) {
      const message =
        cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "Microphone permission denied."
          : "Could not start microphone.";
      dispatch({ type: "ERROR", error: message });
      debug("capture-start-failed", message);
      return;
    }

    // Everything below is captured in this closure, scoped to *this*
    // recording session. Nothing here is a shared ref, so a rapid
    // stop-then-start can't cross-contaminate two sessions' chunks or
    // tear down the wrong stream.
    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream, { mimeType });
    recorderRef.current = recorder;

    const releaseStream = () => {
      stream.getTracks().forEach((track) => track.stop());
      setActiveStream((current) => (current === stream ? null : current));
    };

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    recorder.onerror = () => {
      dispatch({ type: "ERROR", error: "Recording failed." });
      debug("capture-error");
      releaseStream();
    };

    recorder.onstop = () => {
      releaseStream();
      const audio = new Blob(chunks, { type: mimeType });
      debug("capture-stopped", `bytes=${audio.size}`);

      const formData = new FormData();
      formData.append("audio", audio, "voice.webm");
      formData.append("accessToken", accessToken);
      formData.append("sessionId", sessionId);
      formData.append("companionId", companionId);
      startTransition(() => {
        runTranscription(formData);
      });
    };

    debug("capture-started");
    setActiveStream(stream);
    dispatch({ type: "START_RECORDING" });
    recorder.start();
  }, [accessToken, companionId, debug, runTranscription, sessionId, voiceState.status]);

  const stopListening = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      debug("capture-stop-requested");
      recorder.stop();
    }
    dispatch({ type: "STOP_RECORDING" });
  }, [debug]);

  // Stop any in-flight recording if the component unmounts mid-capture.
  useEffect(() => {
    return () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
    };
  }, []);

  return {
    debugEvents: voiceState.debugEvents,
    error: voiceState.error ?? (transcription.status === "error" ? transcription.error : undefined),
    inputLevel,
    interimTranscript: isTranscribing ? "Transcribing your voice…" : "",
    isListening: voiceState.status === "recording",
    isSupported: typeof window !== "undefined" && "MediaRecorder" in window && "mediaDevices" in navigator,
    isTranscribing,
    startListening,
    stopListening,
  };
}
