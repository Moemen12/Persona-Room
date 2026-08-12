"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { CompanionId } from "@/features/persona";

interface UseBrowserVoiceOptions {
  companionId: CompanionId;
}

function speechLanguage(text: string) {
  if (/[\uac00-\ud7af]/u.test(text)) return "ko-KR";
  if (/[\u0600-\u06ff]/u.test(text)) return "ar-SA";
  return "en-US";
}

function pickVoice(voices: SpeechSynthesisVoice[], language: string) {
  const exact = voices.find((voice) => voice.lang.toLowerCase() === language.toLowerCase());
  if (exact) return exact;

  const family = language.split("-")[0].toLowerCase();
  return voices.find((voice) => voice.lang.toLowerCase().startsWith(family)) ?? voices[0];
}

export function useBrowserVoice({ companionId }: UseBrowserVoiceOptions) {
  const [isSupported, setIsSupported] = useState(false);
  const [voiceEnabled, setVoiceEnabledState] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const synthesis = window.speechSynthesis;
    const loadVoices = () => {
      voicesRef.current = synthesis.getVoices();
      setIsSupported(true);
    };

    loadVoices();
    synthesis.addEventListener("voiceschanged", loadVoices);

    return () => {
      synthesis.removeEventListener("voiceschanged", loadVoices);
      synthesis.cancel();
      utteranceRef.current = null;
      setIsSpeaking(false);
    };
  }, []);

  const stopSpeaking = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setIsSpeaking(false);
  }, []);

  const setVoiceEnabled = useCallback(
    (enabled: boolean) => {
      setVoiceEnabledState(enabled);
      if (!enabled) stopSpeaking();
    },
    [stopSpeaking],
  );

  const speak = useCallback(
    (text: string) => {
      if (!voiceEnabled || !isSupported || !text.trim()) return;
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

      const synthesis = window.speechSynthesis;
      synthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text.trim());
      const language = speechLanguage(text);
      const voice = pickVoice(voicesRef.current, language);
      const isJoon = companionId === "joon";

      utterance.lang = language;
      utterance.rate = isJoon ? 0.92 : 1.02;
      utterance.pitch = isJoon ? 0.84 : 1.08;
      if (voice) utterance.voice = voice;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        utteranceRef.current = null;
        setIsSpeaking(false);
      };
      utterance.onerror = () => {
        utteranceRef.current = null;
        setIsSpeaking(false);
      };

      utteranceRef.current = utterance;
      synthesis.speak(utterance);
    },
    [companionId, isSupported, voiceEnabled],
  );

  return {
    isSupported,
    voiceEnabled,
    isSpeaking,
    setVoiceEnabled,
    speak,
    stopSpeaking,
  };
}
