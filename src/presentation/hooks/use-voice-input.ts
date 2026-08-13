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
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return null;
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    return null;
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
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const meterFrameRef = useRef<number | null>(null);
  const meterLastUpdateRef = useRef(0);
  const scheduleRestartRef = useRef<(() => void) | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [inputLevel, setInputLevel] = useState(0);
  const [error, setError] = useState<string>();
  const isSupported = Boolean(getSpeechRecognitionConstructor());

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

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
    if (!AudioContextConstructor) return;

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
  }, [stopMicrophoneMeter]);

  const stopListening = useCallback(() => {
    wantsListeningRef.current = false;
    recoveryAttemptsRef.current = 0;
    clearRestartTimer();
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    recognition?.abort();
    stopMicrophoneMeter();
    setIsListening(false);
    setInterimTranscript("");
  }, [clearRestartTimer, stopMicrophoneMeter]);

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
      const error = event.error ?? "";
      if (wantsListeningRef.current && TRANSIENT_ERRORS.has(error)) {
        // Only increment recovery attempts for actual errors, not for simple silences
        if (error !== "no-speech") {
          recoveryAttemptsRef.current += 1;
        }
        setInterimTranscript("");
        scheduleRestartRef.current?.();
        return;
      }

      wantsListeningRef.current = false;
      stopMicrophoneMeter();
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
      stopMicrophoneMeter();
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
  }, [lang, onFinalTranscript, stopMicrophoneMeter]);

  const scheduleRestart = useCallback(() => {
    if (!wantsListeningRef.current || recognitionRef.current || restartTimerRef.current) return;
    
    // Check limit only for non-silent recovery attempts
    if (recoveryAttemptsRef.current >= MAX_RECOVERY_ATTEMPTS) {
      wantsListeningRef.current = false;
      stopMicrophoneMeter();
      setIsListening(false);
      setInterimTranscript("");
      setError("Voice input is having trouble connecting. Please check your microphone settings and try again.");
      return;
    }

    const delay = recoveryAttemptsRef.current > 0 
      ? BASE_RECOVERY_DELAY_MS * recoveryAttemptsRef.current 
      : 50; // Near-instant restart for simple silences

    restartTimerRef.current = setTimeout(() => {
      restartTimerRef.current = null;
      createRecognition();
    }, delay);
  }, [createRecognition, stopMicrophoneMeter]);

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

    const microphoneStream = await requestMicrophoneAccess();
    if (!wantsListeningRef.current) {
      microphoneStream?.getTracks().forEach((track) => track.stop());
      return;
    }
    if (!microphoneStream) {
      wantsListeningRef.current = false;
      setIsListening(false);
      setError("Microphone permission is blocked. Allow microphone access for localhost, then try again.");
      return;
    }
    startMicrophoneMeter(microphoneStream);
    createRecognition();
  }, [clearRestartTimer, createRecognition, startMicrophoneMeter]);

  useEffect(() => {
    return () => {
      wantsListeningRef.current = false;
      clearRestartTimer();
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      stopMicrophoneMeter();
    };
  }, [clearRestartTimer, stopMicrophoneMeter]);

  return {
    error,
    inputLevel,
    interimTranscript,
    isListening,
    isSupported,
    startListening,
    stopListening,
  };
}
