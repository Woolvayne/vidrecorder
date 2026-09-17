import type { VoiceSettings } from "@/lib/types";

/**
 * Free voiceover system — 100% browser Speech Synthesis.
 * No API key, no cloud. Works offline with system voices.
 */

export function ttsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

let cached: SpeechSynthesisVoice[] = [];

export function getVoices(): SpeechSynthesisVoice[] {
  if (!ttsSupported()) return [];
  const v = window.speechSynthesis.getVoices();
  if (v.length) cached = v;
  return cached;
}

export function onVoicesReady(cb: () => void): void {
  if (!ttsSupported()) return;
  window.speechSynthesis.onvoiceschanged = () => {
    cached = window.speechSynthesis.getVoices();
    cb();
  };
  getVoices();
}

export interface VoiceOption {
  voiceURI: string;
  name: string;
  lang: string;
  local: boolean;
}

export function voiceOptions(lang?: string): VoiceOption[] {
  const list = getVoices().map((v) => ({ voiceURI: v.voiceURI, name: v.name, lang: v.lang, local: v.localService }));
  if (!lang) return list;
  const prefix = lang.toLowerCase();
  const primary = list.filter((v) => v.lang.toLowerCase().startsWith(prefix));
  return [...primary, ...list.filter((v) => !v.lang.toLowerCase().startsWith(prefix))];
}

export function resolveVoice(voiceURI: string, lang: string): SpeechSynthesisVoice | null {
  const voices = getVoices();
  if (!voices.length) return null;
  return (
    voices.find((v) => v.voiceURI === voiceURI) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(lang)) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(lang.split("-")[0])) ??
    null
  );
}

export interface SpeakCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onBoundary?: (charIndex: number, charLength: number) => void;
}

export function speak(
  text: string,
  settings: Pick<VoiceSettings, "voiceURI" | "lang" | "rate" | "pitch" | "emotion">,
  cb: SpeakCallbacks = {}
): SpeechSynthesisUtterance | null {
  if (!ttsSupported()) return null;
  const utter = new SpeechSynthesisUtterance(text);
  const voice = resolveVoice(settings.voiceURI, settings.lang);
  if (voice) utter.voice = voice;
  utter.lang = voice?.lang ?? settings.lang;
  const emotionRate = settings.emotion === "energetic" ? 1.08 : settings.emotion === "calm" ? 0.92 : 1;
  const emotionPitch = settings.emotion === "energetic" ? 1.1 : settings.emotion === "serious" ? 0.9 : 1;
  utter.rate = Math.max(0.5, Math.min(2, settings.rate * emotionRate));
  utter.pitch = Math.max(0, Math.min(2, settings.pitch * emotionPitch));
  utter.onstart = () => cb.onStart?.();
  utter.onend = () => cb.onEnd?.();
  utter.onerror = () => cb.onEnd?.();
  utter.onboundary = (e) => {
    if (e.name === "word") cb.onBoundary?.(e.charIndex, e.charLength ?? 0);
  };
  window.speechSynthesis.speak(utter);
  return utter;
}

export function stopSpeaking(): void {
  if (ttsSupported()) window.speechSynthesis.cancel();
}

export function pauseSpeaking(): void {
  if (ttsSupported()) window.speechSynthesis.pause();
}

export function resumeSpeaking(): void {
  if (ttsSupported()) window.speechSynthesis.resume();
}

export function previewVoice(settings: VoiceSettings, lang: string): void {
  const samples: Record<string, string> = {
    de: "Hallo! So klingt dein Voiceover. Kostenlos, direkt im Browser erzeugt.",
    en: "Hello! This is what your voiceover sounds like. Generated for free, right in your browser.",
    es: "¡Hola! Así suena tu locución. Generada gratis, directamente en tu navegador.",
    fr: "Bonjour ! Voici le son de votre voix off. Générée gratuitement, directement dans votre navigateur.",
  };
  stopSpeaking();
  speak(samples[lang] ?? samples.en, settings);
}
