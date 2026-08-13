"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useSpeechToText } from "@mazka/react-speech-to-text";

function normalizeErrorCode(code?: string): string | undefined {
  return code?.toLowerCase().replaceAll("_", "-");
}

function getFriendlyErrorMessage(code?: string): string {
  switch (normalizeErrorCode(code)) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone permission is needed. Please allow access and try again.";
    case "audio-capture":
      return "No microphone detected. Check your system input settings.";
    case "network":
      return "Voice service is unavailable. Check your internet connection or browser settings.";
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

interface UseVoiceInputOptions {
  lang?: string;
  onFinalTranscript: (transcript: string) => void;
}

/**
 * Clean, declarative voice hook that relies strictly on the speech recognition library
 * without manual getUserMedia contention that triggers desktop Chromium network errors.
 */
export function useVoiceInput({ lang = "en-US", onFinalTranscript }: UseVoiceInputOptions) {
  const [debugEvents, setDebugEvents] = useState<VoiceDebugEvent[]>([]);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [localError, setLocalError] = useState<string>();
  const [inputLevel, setInputLevel] = useState(0);

  const processedResultsRef = useRef(new Set<string>());
  const mockMeterIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const debug = useCallback((event: string, detail?: string) => {
    queueMicrotask(() => {
      setDebugEvents((prev) => [...prev, { at: new Date().toISOString(), event, detail }].slice(-24));
    });
    console.warn(`[Voice] ${event}`, detail || "");
  }, []);

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
    continuous: false, // Single-shot mode on desktop eliminates network streaming socket drops
    interimResults: true,
    language: lang,
  });

  const stopListening = useCallback(() => {
    debug("stop-requested");
    setIsVoiceActive(false);
    stopLibrary();
    abortListening();
  }, [stopLibrary, abortListening, debug]);

  // Safe mock/active meter animation when listening
  useEffect(() => {
    if (isVoiceActive && isListening) {
      mockMeterIntervalRef.current = setInterval(() => {
        setInputLevel(0.2 + Math.random() * 0.6);
      }, 100);
    } else {
      if (mockMeterIntervalRef.current) {
        clearInterval(mockMeterIntervalRef.current);
        mockMeterIntervalRef.current = null;
      }
      queueMicrotask(() => setInputLevel(0));
    }
    return () => {
      if (mockMeterIntervalRef.current) clearInterval(mockMeterIntervalRef.current);
    };
  }, [isVoiceActive, isListening]);

  // Handle final transcription results declaratively
  useEffect(() => {
    results.forEach((res) => {
      if (!res.isFinal) return;
      const key = `${res.timestamp.getTime()}-${res.transcript}`;
      if (processedResultsRef.current.has(key)) return;
      processedResultsRef.current.add(key);
      debug("final-result", res.transcript);
      onFinalTranscript(res.transcript);
      stopListening();
    });
  }, [results, onFinalTranscript, debug, stopListening]);

  // Handle errors declaratively
  useEffect(() => {
    if (!recognitionError) return;
    const code = normalizeErrorCode(recognitionError.code);
    debug("error", `${code}: ${recognitionError.message}`);
  }, [recognitionError, debug]);

  const startListening = useCallback(() => {
    debug("start-requested");
    if (!isSupported) {
      setLocalError("Speech recognition not supported in this browser.");
      return;
    }

    setLocalError(undefined);
    clearError();
    processedResultsRef.current.clear();
    setIsVoiceActive(true);
    
    try {
      startLibrary();
    } catch (err) {
      debug("start-throw", err instanceof Error ? err.message : String(err));
      setLocalError("Voice input could not start. Please try again.");
      setIsVoiceActive(false);
    }
  }, [isSupported, startLibrary, clearError, debug]);

  const displayError = useMemo(() => {
    if (localError) return localError;
    if (recognitionError && normalizeErrorCode(recognitionError.code) !== "no-speech") {
      return getFriendlyErrorMessage(recognitionError.code);
    }
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
