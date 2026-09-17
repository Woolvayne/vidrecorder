// ===== FREE RUSH — central shared types =====
export type Language = "de" | "en" | "es" | "fr";
export type Aspect = "16:9" | "9:16" | "1:1";
export type VideoFormat =
  | "documentary" | "explainer" | "essay" | "news" | "top10" | "story"
  | "educational" | "youtube" | "shorts" | "tiktok" | "reel";
export type ProjectStatus = "draft" | "generating" | "ready" | "exporting" | "completed";
export type CreateMode = "prompt" | "script" | "voiceover" | "talking-head" | "avatar";
export type TransitionType = "cut" | "fade" | "slide" | "zoom" | "wipe";
export type TrackType = "video" | "image" | "voice" | "music" | "sfx" | "subtitle" | "text";
export type MusicMood =
  | "none" | "dramatic" | "cinematic" | "happy" | "sad" | "suspense"
  | "news" | "documentary" | "epic" | "chill";
export type CaptionAnimation = "none" | "fade" | "pop" | "rise";

export interface ParsedPrompt {
  topic: string;
  format: VideoFormat;
  language: Language;
  durationSec: number;
  style: string;
  tone: string;
  audience: string;
  aspect: Aspect;
  wordsTarget: number;
}

export interface SourceItem {
  id: string;
  title: string;
  url: string;
  snippet: string;
  kind: "wikipedia" | "web" | "rss";
}

export interface ResearchBrief {
  topic: string;
  summary: string;
  facts: string[];
  sources: SourceItem[];
  confidence: "high" | "medium" | "low";
  images: string[];
  language: Language;
}

export interface ScriptSection {
  id: string;
  type: "hook" | "intro" | "chapter" | "conclusion" | "cta";
  title: string;
  text: string;
}

export interface VoiceSettings {
  voiceURI: string;
  lang: Language;
  rate: number;
  pitch: number;
  emotion: "neutral" | "energetic" | "calm" | "serious";
}

export interface CaptionStyle {
  preset: string;
  font: string;
  size: number; // px at 1080 reference height
  position: "top" | "center" | "bottom";
  color: string;
  highlight: string;
  outline: string;
  shadow: boolean;
  animation: CaptionAnimation;
  mode: "word" | "sentence";
}

export interface Scene {
  id: string;
  index: number;
  section: ScriptSection["type"];
  chapter: string;
  narration: string;
  visualQuery: string;
  visualUrl: string;
  visualKind: "image" | "upload" | "generated" | "color" | "avatar";
  visualFit?: "cover" | "contain";
  start: number;
  duration: number;
  transition: TransitionType;
  overlay: string;
  sfx: string;
}

export interface Clip {
  id: string;
  trackId: string;
  type: TrackType;
  label: string;
  start: number;
  duration: number;
  offset: number; // trim offset into source
  color?: string;
  sceneId?: string;
  payload?: Record<string, unknown>;
}

export interface Track {
  id: string;
  type: TrackType;
  name: string;
  clips: Clip[];
  muted: boolean;
  locked: boolean;
}

export interface ExportSettings {
  format: "webm" | "mp4";
  resolution: "720p" | "1080p";
  aspect: Aspect;
  fps: 24 | 30 | 60;
  audio: "aac" | "wav";
}

export interface ProjectData {
  id: string;
  title: string;
  prompt: string;
  mode: CreateMode;
  status: ProjectStatus;
  format: VideoFormat;
  language: Language;
  durationTargetSec: number;
  aspect: Aspect;
  style: string;
  tone: string;
  audience: string;
  script: ScriptSection[];
  research: ResearchBrief | null;
  scenes: Scene[];
  timeline: Track[];
  captionStyle: CaptionStyle;
  musicMood: MusicMood;
  voice: VoiceSettings;
  brandId: string | null;
  thumbnails: string[];
  exportSettings: ExportSettings;
  mediaUrl?: string | null; // user uploaded footage (talking head)
  avatarUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface BrandProfile {
  id: string;
  name: string;
  language: Language;
  voiceURI: string;
  font: string;
  colorPrimary: string;
  colorAccent: string;
  colorText: string;
  colorBg: string;
  captionPreset: string;
  musicMood: MusicMood;
  intro: string;
  outro: string;
  logoUrl: string;
  watermark: string;
  defaultFormat: VideoFormat;
  defaultDurationSec: number;
  writingStyle: string;
  editingStyle: string;
  createdAt?: string;
}

export interface MediaItem {
  id: string;
  name: string;
  type: "video" | "image" | "audio" | "music" | "sfx" | "font" | "logo";
  category: string;
  url: string; // dataURL or remote URL
  size: number;
  duration: number;
  tags: string[];
  createdAt?: string;
}

export interface ExportRecord {
  id: string;
  projectId: string;
  title: string;
  status: "rendering" | "done" | "failed";
  format: string;
  resolution: string;
  aspect: Aspect;
  fps: number;
  size: number;
  error: string;
  createdAt?: string;
}

export interface TemplateDef {
  id: string;
  name: string;
  description: string;
  format: VideoFormat;
  aspect: Aspect;
  musicMood: MusicMood;
  captionPreset: string;
  transitions: TransitionType[];
  structure: { type: ScriptSection["type"]; label: string }[];
  pace: "slow" | "medium" | "fast";
  color: string;
}
