"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSpeechToText } from "@mazka/react-speech-to-text";

function normalizeSpeechErrorCode(code?: string) {
  return code?.toLowerCase().replaceAll("_", "-");
}

function friendlySpeechError(code?: string) {
  switch (normalizeSpeechErrorCode(code)) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone permission is needed for voice input. Allow it for this site, then try again.";
    case "audio-capture":
      return "No microphone was found. Check your browser and system input settings.";
    case "network":
      return "Voice recognition is unavailable right now. Check your connection and try again.";
    case "no-speech":
      return "I did not catch that. Speak after the microphone becomes active and try again.";
    default:
      return "Voice input paused. Please try again.";
  }
}

export interface VoiceDebugEvent {
  at: string;
  event: string;
  detail?: string;
}

interface UseVoiceInputOptions {
  lang?: string;
  onFinalTranscript: (transcript: string) => void;
}

const DEBUG_EVENT_LIMIT = 24;
const MAX_RECOVERY_ATTEMPTS = 4;
const MAX_NETWORK_RETRIES = 2;
const BASE_RECOVERY_DELAY_MS = 180;
const TRANSIENT_ERRORS = new Set(["aborted", "no-speech", "network"]);

async function requestMicrophoneAccess() {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return { stream: null, error: "getUserMedia unavailable" };
  }
  try {
    return {
      stream: await navigator.mediaDevices.getUserMedia({ audio: true }),
    };
  } catch (cause) {
    const error = cause instanceof DOMException ? `${cause.name}: ${cause.message}` : String(cause);
    return { stream: null, error };
  }
}

async function getMicrophonePermissionState() {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) return "unavailable";
  try {
    const result = await navigator.permissions.query({ name: "microphone" as PermissionName });
    return result.state;
  } catch {
    return "unknown";
  }
}

export function useVoiceInput({
  lang = "en-US",
  onFinalTranscript,
}: UseVoiceInputOptions) {
  const {
    error: recognitionError,
    finalTranscript,
    interimTranscript,
    isSupported,
    isListening,
    results,
    abortListening,
    clearError,
    resetTranscript,
    startListening: startRecognition,
  } = useSpeechToText({
    continuous: true,
    interimResults: true,
    language: lang,
    maxAlternatives: 1,
  });

  const wantsListeningRef = useRef(false);
  const recoveryAttemptsRef = useRef(0);
  const networkErrorCountRef = useRef(0);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const meterFrameRef = useRef<number | null>(null);
  const meterLastUpdateRef = useRef(0);
  const scheduleRestartRef = useRef<(() => void) | null>(null);
  const processedResultsRef = useRef(new Set<string>());
  const handledErrorRef = useRef<string | undefined>(undefined);
  const wasListeningRef = useRef(false);
  const [inputLevel, setInputLevel] = useState(0);
  const [isVoiceRequested, setIsVoiceRequested] = useState(false);
  const [localError, setLocalError] = useState<string>();
  const [debugEvents, setDebugEvents] = useState<VoiceDebugEvent[]>([]);

  const debug = useCallback((event: string, detail?: string) => {
    const entry = { at: new Date().toISOString(), event, detail };
    setDebugEvents((previous) => [...previous, entry].slice(-DEBUG_EVENT_LIMIT));
    console.warn("[PersonaRoom voice]", entry);
  }, []);

  const debugLater = useCallback((event: string, detail?: string) => {
    queueMicrotask(() => debug(event, detail));
  }, [debug]);

  const stopMicrophoneMeter = useCallback(() => {
    if (meterFrameRef.current !== null) {
      cancelAnimationFrame(meterFrameRef.current);
      meterFrameRef.current = null;
    }
    microphoneStreamRef.current?.getTracks().forEach((track) => track.stop());
    microphoneStreamRef.current = null;
    analyserRef.current = null;
    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext) void audioContext.close().catch(() => undefined);
    setInputLevel(0);
  }, []);

  const startMicrophoneMeter = useCallback((stream: MediaStream) => {
    if (typeof window === "undefined") return;
    const audioWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
    const AudioContextConstructor = window.AudioContext ?? audioWindow.webkitAudioContext;
    if (!AudioContextConstructor) {
      debug("meter-unavailable", "AudioContext is unavailable; continuing without waveform");
      return;
    }

    debug("meter-start", `audioContext=${AudioContextConstructor.name || "unknown"}`);
    stopMicrophoneMeter();
    microphoneStreamRef.current = stream;
    const audioContext = new AudioContextConstructor();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.82;
    audioContext.createMediaStreamSource(stream).connect(analyser);
    audioContextRef.current = audioContext;
    analyserRef.current = analyser;
    const samples = new Uint8Array(analyser.fftSize);

    const updateMeter = (now: number) => {
      if (!analyserRef.current) return;
      if (now - meterLastUpdateRef.current >= 50) {
        meterLastUpdateRef.current = now;
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) {
          const normalized = (sample - 128) / 128;
          sum += normalized * normalized;
        }
        setInputLevel(Math.min(1, Math.sqrt(sum / samples.length) * 3.2));
      }
      meterFrameRef.current = requestAnimationFrame(updateMeter);
    };

    meterFrameRef.current = requestAnimationFrame(updateMeter);
  }, [debug, stopMicrophoneMeter]);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const scheduleRestart = useCallback(() => {
    if (!wantsListeningRef.current || restartTimerRef.current) return;

    if (recoveryAttemptsRef.current >= MAX_RECOVERY_ATTEMPTS) {
      wantsListeningRef.current = false;
      abortListening();
      stopMicrophoneMeter();
      clearError();
      const message = "Voice input is having trouble connecting. Please check your microphone settings and try again.";
      debug("recovery-exhausted", message);
      setLocalError(message);
      return;
    }

    const delay = recoveryAttemptsRef.current > 0
      ? BASE_RECOVERY_DELAY_MS * recoveryAttemptsRef.current
      : 50;
    const continuous = networkErrorCountRef.current < MAX_NETWORK_RETRIES;
    debug("recovery-scheduled", `delay=${delay}ms, attempts=${recoveryAttemptsRef.current}, continuous=${continuous}`);
    restartTimerRef.current = setTimeout(() => {
      restartTimerRef.current = null;
      if (!wantsListeningRef.current) return;
      clearError();
      debug("recovery-fired", `continuous=${continuous}`);
      startRecognition({ continuous, interimResults: true, language: lang, maxAlternatives: 1 });
    }, delay);
  }, [abortListening, clearError, debug, lang, startRecognition, stopMicrophoneMeter]);

  useEffect(() => {
    scheduleRestartRef.current = scheduleRestart;
    return () => {
      scheduleRestartRef.current = null;
    };
  }, [scheduleRestart]);

  useEffect(() => {
    for (const result of results) {
      if (!result.isFinal || !result.transcript.trim()) continue;
      const key = `${result.timestamp.getTime()}:${result.transcript}`;
      if (processedResultsRef.current.has(key)) continue;
      processedResultsRef.current.add(key);
      recoveryAttemptsRef.current = 0;
      networkErrorCountRef.current = 0;
      debugLater("final-transcript", result.transcript.trim());
      onFinalTranscript(result.transcript.trim());
    }
  }, [debugLater, onFinalTranscript, results]);

  useEffect(() => {
    if (!recognitionError) return;
    const errorKey = `${recognitionError.code}:${recognitionError.message}`;
    if (handledErrorRef.current === errorKey) return;
    handledErrorRef.current = errorKey;
    const code = normalizeSpeechErrorCode(recognitionError.code);
    debugLater("recognition-error", `code=${recognitionError.code}, normalized=${code}, message=${recognitionError.message || "none"}`);

    if (wantsListeningRef.current && code && TRANSIENT_ERRORS.has(code)) {
      if (code === "network") {
        networkErrorCountRef.current += 1;
        debugLater("network-fallback-increment", `count=${networkErrorCountRef.current}`);
      }
      if (code !== "no-speech") recoveryAttemptsRef.current += 1;
      scheduleRestartRef.current?.();
      return;
    }

    wantsListeningRef.current = false;
    stopMicrophoneMeter();
  }, [debugLater, recognitionError, stopMicrophoneMeter]);

  useEffect(() => {
    if (isListening) {
      wasListeningRef.current = true;
      return;
    }
    if (!wantsListeningRef.current || !wasListeningRef.current || recognitionError) return;
    wasListeningRef.current = false;
    debugLater("recognition-end", "library reported listening=false without an error; recovering");
    recoveryAttemptsRef.current += 1;
    scheduleRestartRef.current?.();
  }, [debugLater, isListening, recognitionError]);

  const startListening = useCallback(async () => {
    debug("start-requested", `supported=${isSupported}, secureContext=${typeof window !== "undefined" ? window.isSecureContext : false}`);
    if (!isSupported) {
      setLocalError("Voice input is not supported in this browser.");
      return;
    }
    if (wantsListeningRef.current) return;

    clearRestartTimer();
    clearError();
    setLocalError(undefined);
    recoveryAttemptsRef.current = 0;
    networkErrorCountRef.current = 0;
    wasListeningRef.current = false;
    processedResultsRef.current.clear();
    handledErrorRef.current = undefined;
    resetTranscript();
    wantsListeningRef.current = true;
    setIsVoiceRequested(true);

    const permissionState = await getMicrophonePermissionState();
    debug("permission-state", permissionState);
    const microphoneAccess = await requestMicrophoneAccess();
    if (!wantsListeningRef.current) {
      microphoneAccess.stream?.getTracks().forEach((track) => track.stop());
      debug("start-cancelled", "user stopped while microphone permission was pending");
      return;
    }
    if (!microphoneAccess.stream) {
      wantsListeningRef.current = false;
      setIsVoiceRequested(false);
      const detail = microphoneAccess.error ? `${permissionState}; ${microphoneAccess.error}` : permissionState;
      debug("microphone-failed", detail);
      setLocalError(`Microphone could not start (${detail}). Check site and system microphone permissions.`);
      return;
    }

    const track = microphoneAccess.stream.getAudioTracks()[0];
    debug("microphone-granted", track ? `label=${track.label || "hidden"}, state=${track.readyState}, enabled=${track.enabled}` : "no-audio-track");
    startMicrophoneMeter(microphoneAccess.stream);
    debug("recognition-config", "continuous=true, interim=true, engine=@mazka/react-speech-to-text");
    startRecognition({ continuous: true, interimResults: true, language: lang, maxAlternatives: 1 });
  }, [clearError, clearRestartTimer, debug, isSupported, lang, resetTranscript, startMicrophoneMeter, startRecognition]);

  const stopListening = useCallback(() => {
    debug("stop-requested");
    wantsListeningRef.current = false;
    setIsVoiceRequested(false);
    recoveryAttemptsRef.current = 0;
    networkErrorCountRef.current = 0;
    wasListeningRef.current = false;
    clearRestartTimer();
    abortListening();
    clearError();
    resetTranscript();
    stopMicrophoneMeter();
  }, [abortListening, clearError, clearRestartTimer, debug, resetTranscript, stopMicrophoneMeter]);

  useEffect(() => {
    return () => {
      wantsListeningRef.current = false;
      clearRestartTimer();
      abortListening();
      stopMicrophoneMeter();
    };
  }, [abortListening, clearRestartTimer, stopMicrophoneMeter]);

  return {
    debugEvents,
    error: localError ?? (recognitionError ? friendlySpeechError(recognitionError.code) : undefined),
    inputLevel,
    interimTranscript,
    isListening: isVoiceRequested && isListening,
    isSupported,
    startListening,
    stopListening,
    finalTranscript,
  };
}
