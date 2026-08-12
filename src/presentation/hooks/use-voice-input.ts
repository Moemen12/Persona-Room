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
      return "Microphone permission is needed for voice input.";
    case "no-speech":
      return "I did not catch that. Hold the mic and try again.";
    case "audio-capture":
      return "No microphone was found. Check your browser settings.";
    default:
      return "Voice input paused. Please try again.";
  }
}

interface UseVoiceInputOptions {
  lang?: string;
  onFinalTranscript: (transcript: string) => void;
}

export function useVoiceInput({
  lang = "en-US",
  onFinalTranscript,
}: UseVoiceInputOptions) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string>();
  const isSupported = Boolean(getSpeechRecognitionConstructor());

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setInterimTranscript("");
  }, []);

  const startListening = useCallback(() => {
    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) {
      setError("Voice input is not supported in this browser.");
      return;
    }
    if (recognitionRef.current || isListening) return;

    setError(undefined);
    const recognition = new Recognition();
    recognition.lang = lang;
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
          if (finalTranscript) onFinalTranscript(finalTranscript);
        } else {
          interim += transcript;
        }
      }
      setInterimTranscript(interim.trim());
    };
    recognition.onerror = (event) => {
      setError(friendlySpeechError(event.error));
      setIsListening(false);
      setInterimTranscript("");
      recognitionRef.current = null;
    };
    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript("");
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
      setError("Voice input could not start. Please try again.");
    }
  }, [isListening, lang, onFinalTranscript]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  return {
    error,
    interimTranscript,
    isListening,
    isSupported,
    startListening,
    stopListening,
  };
}
