"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface SpeechAlternativeLike {
  transcript: string;
}

interface SpeechResultLike {
  isFinal: boolean;
  0: SpeechAlternativeLike;
}

interface SpeechResultListLike {
  length: number;
  [index: number]: SpeechResultLike;
}

interface SpeechRecognitionResultEventLike extends Event {
  resultIndex: number;
  results: SpeechResultListLike;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error?: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

function getSpeechRecognitionConstructor() {
  if (typeof window === "undefined") return undefined;
  const speechWindow = window as SpeechRecognitionWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

function friendlySpeechError(code?: string) {
  switch (code) {
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

interface UseVoiceInputOptions {
  lang?: string;
  onFinalTranscript: (transcript: string) => void;
}

const MAX_RECOVERY_ATTEMPTS = 4;
const BASE_RECOVERY_DELAY_MS = 180;
const TRANSIENT_ERRORS = new Set(["aborted", "no-speech", "network"]);

async function requestMicrophoneAccess() {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch {
    return false;
  }
}

export function useVoiceInput({
  lang = "en-US",
  onFinalTranscript,
}: UseVoiceInputOptions) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wantsListeningRef = useRef(false);
  const recoveryAttemptsRef = useRef(0);
  const scheduleRestartRef = useRef<(() => void) | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string>();
  const isSupported = Boolean(getSpeechRecognitionConstructor());

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const stopListening = useCallback(() => {
    wantsListeningRef.current = false;
    recoveryAttemptsRef.current = 0;
    clearRestartTimer();
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    recognition?.abort();
    setIsListening(false);
    setInterimTranscript("");
  }, [clearRestartTimer]);

  const createRecognition = useCallback(() => {
    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition || !wantsListeningRef.current || recognitionRef.current) return;

    const recognition = new Recognition();
    recognition.lang = lang;
    // Chromium desktop can terminate a continuous recognizer after a short
    // silence. The hook restarts it while the user still wants to listen.
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) {
          const finalTranscript = transcript.trim();
          if (finalTranscript) {
            onFinalTranscript(finalTranscript);
            recoveryAttemptsRef.current = 0;
          }
        } else {
          interim += transcript;
        }
      }
      setInterimTranscript(interim.trim());
    };
    recognition.onerror = (event) => {
      recognitionRef.current = null;
      if (wantsListeningRef.current && TRANSIENT_ERRORS.has(event.error ?? "")) {
        setInterimTranscript("");
        scheduleRestartRef.current?.();
        return;
      }

      wantsListeningRef.current = false;
      setError(friendlySpeechError(event.error));
      setIsListening(false);
      setInterimTranscript("");
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      if (wantsListeningRef.current) {
        scheduleRestartRef.current?.();
        return;
      }
      setIsListening(false);
      setInterimTranscript("");
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      if (wantsListeningRef.current) {
        scheduleRestartRef.current?.();
      } else {
        setIsListening(false);
        setError("Voice input could not start. Please try again.");
      }
    }
  }, [lang, onFinalTranscript]);

  const scheduleRestart = useCallback(() => {
    if (!wantsListeningRef.current || recognitionRef.current || restartTimerRef.current) return;
    if (recoveryAttemptsRef.current >= MAX_RECOVERY_ATTEMPTS) {
      wantsListeningRef.current = false;
      setIsListening(false);
      setInterimTranscript("");
      setError("Voice input paused. Check Chrome microphone permissions and try again.");
      return;
    }

    recoveryAttemptsRef.current += 1;
    const delay = BASE_RECOVERY_DELAY_MS * recoveryAttemptsRef.current;
    restartTimerRef.current = setTimeout(() => {
      restartTimerRef.current = null;
      createRecognition();
    }, delay);
  }, [createRecognition]);

  useEffect(() => {
    scheduleRestartRef.current = scheduleRestart;
    return () => {
      scheduleRestartRef.current = null;
    };
  }, [scheduleRestart]);

  const startListening = useCallback(async () => {
    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) {
      setError("Voice input is not supported in this browser.");
      return;
    }
    if (recognitionRef.current || wantsListeningRef.current) return;

    clearRestartTimer();
    setError(undefined);
    recoveryAttemptsRef.current = 0;
    wantsListeningRef.current = true;
    setIsListening(true);

    const hasMicrophone = await requestMicrophoneAccess();
    if (!wantsListeningRef.current) return;
    if (!hasMicrophone) {
      wantsListeningRef.current = false;
      setIsListening(false);
      setError("Microphone permission is blocked. Allow microphone access for localhost, then try again.");
      return;
    }
    createRecognition();
  }, [clearRestartTimer, createRecognition]);

  useEffect(() => {
    return () => {
      wantsListeningRef.current = false;
      clearRestartTimer();
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, [clearRestartTimer]);

  return {
    error,
    interimTranscript,
    isListening,
    isSupported,
    startListening,
    stopListening,
  };
}
