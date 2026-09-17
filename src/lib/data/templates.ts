import type { CaptionStyle, TemplateDef } from "@/lib/types";

export const CAPTION_PRESETS: Record<string, CaptionStyle> = {
  modern: { preset: "modern", font: "Inter", size: 54, position: "bottom", color: "#ffffff", highlight: "#7c5cff", outline: "#000000", shadow: true, animation: "pop", mode: "word" },
  youtube: { preset: "youtube", font: "Inter", size: 58, position: "bottom", color: "#ffffff", highlight: "#fde047", outline: "#000000", shadow: false, animation: "none", mode: "word" },
  documentary: { preset: "documentary", font: "Georgia", size: 44, position: "bottom", color: "#f5f0e6", highlight: "#e8c872", outline: "#1a1a1a", shadow: true, animation: "fade", mode: "sentence" },
  tiktok: { preset: "tiktok", font: "Inter", size: 64, position: "center", color: "#ffffff", highlight: "#38f2a8", outline: "#000000", shadow: true, animation: "pop", mode: "word" },
  shorts: { preset: "shorts", font: "Inter", size: 62, position: "center", color: "#ffffff", highlight: "#f472b6", outline: "#000000", shadow: true, animation: "pop", mode: "word" },
  minimal: { preset: "minimal", font: "Inter", size: 42, position: "bottom", color: "#e5e7eb", highlight: "#93c5fd", outline: "transparent", shadow: false, animation: "fade", mode: "sentence" },
  gaming: { preset: "gaming", font: "Courier New", size: 56, position: "bottom", color: "#4ade80", highlight: "#facc15", outline: "#052e16", shadow: true, animation: "rise", mode: "word" },
};

export const TEMPLATES: TemplateDef[] = [
  {
    id: "tpl_documentary", name: "Documentary", description: "Cinematic pacing, serif captions, slow fades and an epic score — built for deep storytelling.",
    format: "documentary", aspect: "16:9", musicMood: "documentary", captionPreset: "documentary",
    transitions: ["fade", "zoom", "fade", "wipe"], pace: "slow", color: "#e8c872",
    structure: [
      { type: "hook", label: "Cold Open" }, { type: "intro", label: "Title Sequence" },
      { type: "chapter", label: "Act I — Origins" }, { type: "chapter", label: "Act II — Rise" },
      { type: "chapter", label: "Act III — Turning Point" }, { type: "chapter", label: "Legacy" },
      { type: "conclusion", label: "Closing Narration" }, { type: "cta", label: "End Card" },
    ],
  },
  {
    id: "tpl_news", name: "News Report", description: "Fast cuts, clean lower-thirds and an urgent pulse for daily briefings and updates.",
    format: "news", aspect: "16:9", musicMood: "news", captionPreset: "modern",
    transitions: ["slide", "cut", "cut", "slide"], pace: "fast", color: "#38bdf8",
    structure: [
      { type: "hook", label: "Headline" }, { type: "intro", label: "Anchor Intro" },
      { type: "chapter", label: "The Facts" }, { type: "chapter", label: "Context" },
      { type: "chapter", label: "Reactions" }, { type: "conclusion", label: "Wrap-Up" }, { type: "cta", label: "Sign-Off" },
    ],
  },
  {
    id: "tpl_top10", name: "Top 10 Listicle", description: "Countdown structure with punchy transitions, bold numbers and high-retention pacing.",
    format: "top10", aspect: "16:9", musicMood: "epic", captionPreset: "youtube",
    transitions: ["wipe", "slide", "zoom", "cut"], pace: "fast", color: "#7c5cff",
    structure: [
      { type: "hook", label: "Teaser" }, { type: "intro", label: "Countdown Intro" },
      { type: "chapter", label: "#10 – #8" }, { type: "chapter", label: "#7 – #5" },
      { type: "chapter", label: "#4 – #2" }, { type: "chapter", label: "#1 — The Winner" },
      { type: "conclusion", label: "Recap" }, { type: "cta", label: "CTA" },
    ],
  },
  {
    id: "tpl_explainer", name: "Explainer", description: "Crystal-clear structure, animated key terms and friendly narration for complex topics.",
    format: "explainer", aspect: "16:9", musicMood: "chill", captionPreset: "modern",
    transitions: ["fade", "slide", "fade", "cut"], pace: "medium", color: "#34d399",
    structure: [
      { type: "hook", label: "The Question" }, { type: "intro", label: "Why It Matters" },
      { type: "chapter", label: "The Basics" }, { type: "chapter", label: "How It Works" },
      { type: "chapter", label: "Real-World Example" }, { type: "conclusion", label: "TL;DR" }, { type: "cta", label: "Next Steps" },
    ],
  },
  {
    id: "tpl_story", name: "Story / True Crime", description: "Suspenseful audio bed, dramatic reveals and slow zooms that keep viewers hooked.",
    format: "story", aspect: "16:9", musicMood: "suspense", captionPreset: "documentary",
    transitions: ["fade", "fade", "zoom", "wipe"], pace: "slow", color: "#f472b6",
    structure: [
      { type: "hook", label: "The Mystery" }, { type: "intro", label: "Setting the Scene" },
      { type: "chapter", label: "The Incident" }, { type: "chapter", label: "The Investigation" },
      { type: "chapter", label: "The Twist" }, { type: "conclusion", label: "The Aftermath" }, { type: "cta", label: "Discussion" },
    ],
  },
  {
    id: "tpl_shorts", name: "YouTube Shorts", description: "Vertical 9:16, word-by-word pop captions, punchy zooms and instant hooks.",
    format: "shorts", aspect: "9:16", musicMood: "happy", captionPreset: "shorts",
    transitions: ["zoom", "cut", "slide", "cut"], pace: "fast", color: "#facc15",
    structure: [
      { type: "hook", label: "Instant Hook" }, { type: "chapter", label: "Point 1" },
      { type: "chapter", label: "Point 2" }, { type: "chapter", label: "Point 3" }, { type: "cta", label: "Follow CTA" },
    ],
  },
  {
    id: "tpl_tiktok", name: "TikTok", description: "Trendy vertical format with centered captions, fast beat cuts and bold overlays.",
    format: "tiktok", aspect: "9:16", musicMood: "chill", captionPreset: "tiktok",
    transitions: ["cut", "zoom", "cut", "slide"], pace: "fast", color: "#38f2a8",
    structure: [
      { type: "hook", label: "Scroll-Stopper" }, { type: "chapter", label: "Beat 1" },
      { type: "chapter", label: "Beat 2" }, { type: "chapter", label: "Payoff" }, { type: "cta", label: "CTA" },
    ],
  },
  {
    id: "tpl_educational", name: "Educational", description: "Structured lessons with calm pacing, highlighted key facts and a warm, trusted tone.",
    format: "educational", aspect: "16:9", musicMood: "documentary", captionPreset: "minimal",
    transitions: ["fade", "cut", "fade", "slide"], pace: "medium", color: "#93c5fd",
    structure: [
      { type: "hook", label: "Learning Goal" }, { type: "intro", label: "Introduction" },
      { type: "chapter", label: "Lesson 1" }, { type: "chapter", label: "Lesson 2" },
      { type: "chapter", label: "Lesson 3" }, { type: "conclusion", label: "Summary" }, { type: "cta", label: "Practice" },
    ],
  },
];

export const MOOD_META: Record<string, { label: string; desc: string }> = {
  none: { label: "No Music", desc: "Voiceover only" },
  dramatic: { label: "Dramatic", desc: "Tense strings, minor swells" },
  cinematic: { label: "Cinematic", desc: "Wide pads, film feel" },
  happy: { label: "Happy", desc: "Bright plucks, upbeat" },
  sad: { label: "Sad", desc: "Soft piano tones, slow" },
  suspense: { label: "Suspense", desc: "Dark pulses, heartbeat" },
  news: { label: "News", desc: "Urgent, driving pulse" },
  documentary: { label: "Documentary", desc: "Warm, thoughtful bed" },
  epic: { label: "Epic", desc: "Big drums, heroic" },
  chill: { label: "Chill", desc: "Laid-back lo-fi groove" },
};

export interface SfxMeta { id: string; name: string; category: string; }
export const SFX_LIBRARY: SfxMeta[] = [
  { id: "whoosh", name: "Whoosh", category: "Whoosh" },
  { id: "swoosh", name: "Swoosh", category: "Whoosh" },
  { id: "riser", name: "Riser", category: "Transition" },
  { id: "sweep", name: "Sweep Down", category: "Transition" },
  { id: "impact", name: "Impact Hit", category: "Impact" },
  { id: "boom", name: "Deep Boom", category: "Impact" },
  { id: "thud", name: "Thud", category: "Impact" },
  { id: "click", name: "Click", category: "Click" },
  { id: "pop", name: "Pop", category: "Click" },
  { id: "tick", name: "Tick", category: "Click" },
  { id: "chime", name: "Notification Chime", category: "Notification" },
  { id: "ding", name: "Bell Ding", category: "Notification" },
  { id: "cinehit", name: "Cinematic Hit", category: "Cinematic" },
  { id: "rain", name: "Rain Ambience", category: "Nature" },
  { id: "wind", name: "Wind", category: "Nature" },
  { id: "cityhum", name: "City Hum", category: "City" },
  { id: "siren", name: "Police Siren", category: "Police" },
  { id: "engine", name: "Traffic Pass", category: "Traffic" },
  { id: "glitch", name: "Digital Glitch", category: "Technology" },
  { id: "beep", name: "Console Beep", category: "Technology" },
];
