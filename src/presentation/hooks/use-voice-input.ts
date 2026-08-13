"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useSpeechToText } from "@mazka/react-speech-to-text";

/**
 * Normalizes speech recognition error codes to a consistent kebab-case format.
 */
function normalizeErrorCode(code?: string): string | undefined {
  return code?.toLowerCase().replaceAll("_", "-");
}

/**
 * Maps technical error codes to user-friendly messages.
 */
function getFriendlyErrorMessage(code?: string): string {
  switch (normalizeErrorCode(code)) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone permission is needed. Please allow access and try again.";
    case "audio-capture":
      return "No microphone detected. Check your system input settings.";
    case "network":
      return "Voice service is unavailable. Check your internet connection.";
    case "no-speech":
      return "I didn't catch that. Please try speaking again.";
    default:
      return "Voice input paused. Please try again.";
  }
}

export interface VoiceDebugEvent {
  at: string;
  event: string;
  detail?: string;
}

/**
 * Hook to manage audio visualization level (waveform) from a MediaStream.
 */
function useAudioMeter(stream: MediaStream | null, debug: (e: string, d?: string) => void) {
  const [level, setLevel] = useState(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!stream) {
      queueMicrotask(() => setLevel(0));
      return;
    }

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      debug("meter-unavailable", "AudioContext not supported");
      return;
    }

    const context = new AudioContextClass();
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;

    const source = context.createMediaStreamSource(stream);
    source.connect(analyser);

    contextRef.current = context;
    analyserRef.current = analyser;
    debug("meter-started");

    const buffer = new Uint8Array(analyser.fftSize);
    const update = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteTimeDomainData(buffer);
      let sum = 0;
      for (const sample of buffer) {
        const v = (sample - 128) / 128;
        sum += v * v;
      }
      setLevel(Math.min(1, Math.sqrt(sum / buffer.length) * 3.5));
      frameRef.current = requestAnimationFrame(update);
    };

    frameRef.current = requestAnimationFrame(update);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      void context.close();
      debug("meter-stopped");
    };
  }, [stream, debug]);

  return level;
}

interface UseVoiceInputOptions {
  lang?: string;
  onFinalTranscript: (transcript: string) => void;
}

/**
 * Declarative hook for voice input with robust diagnostics and automatic desktop recovery.
 */
export function useVoiceInput({ lang = "en-US", onFinalTranscript }: UseVoiceInputOptions) {
  const [debugEvents, setDebugEvents] = useState<VoiceDebugEvent[]>([]);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [microphoneStream, setMicrophoneStream] = useState<MediaStream | null>(null);
  const [localError, setLocalError] = useState<string>();
  const [isContinuous, setIsContinuous] = useState(true);

  const networkRetriesRef = useRef(0);
  const processedResultsRef = useRef(new Set<string>());

  const debug = useCallback((event: string, detail?: string) => {
    // Defer state updates to avoid React cascading render warnings
    queueMicrotask(() => {
      setDebugEvents((prev) => [...prev, { at: new Date().toISOString(), event, detail }].slice(-24));
    });
    console.warn(`[Voice] ${event}`, detail || "");
  }, []);

  // Library-backed speech recognition
  const {
    error: recognitionError,
    interimTranscript,
    isListening,
    isSupported,
    results,
    startListening: startLibrary,
    stopListening: stopLibrary,
    abortListening,
    clearError,
  } = useSpeechToText({
    continuous: isContinuous,
    interimResults: true,
    language: lang,
  });

  const inputLevel = useAudioMeter(isListening ? microphoneStream : null, debug);

  // Handle results declaratively
  useEffect(() => {
    results.forEach((res) => {
      if (!res.isFinal) return;
      const key = `${res.timestamp.getTime()}-${res.transcript}`;
      if (processedResultsRef.current.has(key)) return;
      processedResultsRef.current.add(key);
      networkRetriesRef.current = 0;
      setIsContinuous(true);
      debug("final-result", res.transcript);
      onFinalTranscript(res.transcript);
    });
  }, [results, onFinalTranscript, debug]);

  // Handle errors and recovery declaratively
  useEffect(() => {
    if (!recognitionError) return;
    const code = normalizeErrorCode(recognitionError.code);
    debug("error", `${code}: ${recognitionError.message}`);

    if (code === "network" && isVoiceActive) {
      networkRetriesRef.current += 1;
      debug("network-retry", `attempt ${networkRetriesRef.current}`);
      
      if (networkRetriesRef.current >= 2) {
        setIsContinuous(false);
        debug("fallback-activated", "switching to single-shot mode");
      }

      const timer = setTimeout(() => {
        if (isVoiceActive) {
          clearError();
          startLibrary();
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [recognitionError, isVoiceActive, startLibrary, clearError, debug]);

  const startListening = useCallback(async () => {
    debug("start-requested");
    if (!isSupported) {
      setLocalError("Speech recognition not supported.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicrophoneStream(stream);
      setIsVoiceActive(true);
      setLocalError(undefined);
      clearError();
      networkRetriesRef.current = 0;
      setIsContinuous(true);
      startLibrary();
    } catch (err) {
      debug("mic-denied", err instanceof Error ? err.message : String(err));
      setLocalError("Microphone access denied.");
    }
  }, [isSupported, startLibrary, clearError, debug]);

  const stopListening = useCallback(() => {
    debug("stop-requested");
    setIsVoiceActive(false);
    stopLibrary();
    abortListening();
    if (microphoneStream) {
      microphoneStream.getTracks().forEach((t) => t.stop());
      setMicrophoneStream(null);
    }
  }, [stopLibrary, abortListening, microphoneStream, debug]);

  const displayError = useMemo(() => {
    if (localError) return localError;
    if (recognitionError) return getFriendlyErrorMessage(recognitionError.code);
    return undefined;
  }, [localError, recognitionError]);

  return {
    debugEvents,
    error: displayError,
    inputLevel,
    interimTranscript,
    isListening: isVoiceActive && isListening,
    isSupported,
    startListening,
    stopListening,
  };
}
