import type { Clip, Scene, ScriptSection, Track, TransitionType } from "@/lib/types";
import { WORDS_PER_MIN, clamp, extractKeywords, hashSeed, mulberry32, secondsForWords, splitSentences, uid, wordCount } from "@/lib/utils";
import { searchFreeImages } from "./research";

/**
 * Visual Engine — turns a script into timed scenes, then automatically
 * assembles the full timeline (video, voice, subtitles, music).
 */

const TRANSITION_CYCLE: TransitionType[] = ["fade", "slide", "zoom", "fade", "wipe", "cut"];

function pickOverlay(sentence: string, sectionType: ScriptSection["type"], chapter: string, lang: string, fallback: string): string {
  if (sectionType === "chapter" && chapter && chapter !== "CHAPTER") return chapter;
  // pull a striking phrase: prefer numbers / named entities
  const withNumber = sentence.match(/[^.!?]*\b\d{3,4}[a-z]?[^.!?]*/);
  if (withNumber && withNumber[0].split(/\s+/).length <= 12) return withNumber[0].trim();
  const kws = extractKeywords(sentence, lang, 3);
  if (kws.length >= 2) return kws.slice(0, 3).join(" · ");
  return fallback;
}

export function buildScenes(
  sections: ScriptSection[],
  opts: {
    language: string;
    topic: string;
    paceWpm?: number;
    format?: string;
    images?: string[];
    fastPace?: boolean;
  }
): Scene[] {
  const scenes: Scene[] = [];
  const rng = mulberry32(hashSeed(opts.topic));
  const wpm = opts.paceWpm ?? (opts.format ? WORDS_PER_MIN[opts.format] ?? 130 : 130);
  let tIndex = 0;

  for (const section of sections) {
    const sentences = splitSentences(section.text);
    if (!sentences.length) continue;
    // group sentences: 1–2 per scene for normal pace, 1 per scene for shorts
    const groupSize = opts.fastPace ? 1 : 2;
    for (let i = 0; i < sentences.length; i += groupSize) {
      const group = sentences.slice(i, i + groupSize);
      const narration = group.join(" ");
      const words = wordCount(narration);
      let duration = secondsForWords(words, wpm);
      duration = clamp(duration, opts.fastPace ? 1.6 : 2.6, opts.fastPace ? 6 : 15);
      const visualQuery =
        extractKeywords(narration, opts.language, 3).join(" ") || opts.topic;
      const transition =
        section.type === "hook"
          ? "zoom"
          : TRANSITION_CYCLE[tIndex++ % TRANSITION_CYCLE.length];
      const overlay = pickOverlay(narration, section.type, section.title, opts.language, opts.topic);
      const isChapterStart = i === 0 && section.type === "chapter";
      scenes.push({
        id: uid("sc"),
        index: scenes.length,
        section: section.type,
        chapter: section.title,
        narration,
        visualQuery,
        visualUrl: "",
        visualKind: "image",
        start: 0,
        duration: Math.round(duration * 10) / 10,
        transition,
        overlay: section.type === "cta" ? "" : overlay,
        sfx: isChapterStart ? "whoosh" : transition === "zoom" ? "riser" : "",
      });
    }
  }

  // assign sequential start times
  let cursor = 0;
  for (const s of scenes) {
    s.start = Math.round(cursor * 10) / 10;
    cursor += s.duration;
    s.index = scenes.indexOf(s);
  }
  return scenes;
}

/** Assign free imagery to every scene (Openverse → Wikipedia → picsum → gradient). */
export async function assignVisuals(
  scenes: Scene[],
  language: string,
  pool: string[],
  onProgress?: (done: number, total: number) => void
): Promise<Scene[]> {
  const result = [...scenes];
  const cache = new Map<string, string>();
  let poolIdx = 0;

  const resolveOne = async (scene: Scene): Promise<void> => {
    const q = scene.visualQuery.toLowerCase();
    if (cache.has(q)) {
      scene.visualUrl = cache.get(q)!;
      scene.visualKind = "image";
      return;
    }
    let url = "";
    try {
      const imgs = await searchFreeImages(scene.visualQuery, language as never);
      url = imgs.find((u) => ![...cache.values()].includes(u)) || imgs[0] || "";
    } catch { url = ""; }
    if (!url && pool.length) {
      url = pool[poolIdx++ % pool.length];
    }
    if (!url) {
      url = `https://picsum.photos/seed/${encodeURIComponent(scene.visualQuery.replace(/\s+/g, "-"))}/1600/900`;
    }
    cache.set(q, url);
    scene.visualUrl = url;
    scene.visualKind = url.includes("picsum") ? "image" : "image";
  };

  const CONCURRENCY = 4;
  let done = 0;
  const queue = [...result];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const scene = queue.shift()!;
      try { await Promise.race([resolveOne(scene), new Promise<void>((r) => setTimeout(r, 7000))]); }
      catch { scene.visualUrl = `https://picsum.photos/seed/${scene.id}/1600/900`; }
      if (!scene.visualUrl) scene.visualUrl = `https://picsum.photos/seed/${scene.id}/1600/900`;
      done++;
      onProgress?.(done, result.length);
    }
  });
  await Promise.all(workers);
  return result;
}

const TRACK_COLORS: Record<string, string> = {
  video: "#7c5cff", image: "#38bdf8", voice: "#34d399", music: "#f59e0b",
  sfx: "#f472b6", subtitle: "#a3e635", text: "#fb923c",
};

const short = (s: string, n = 26) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

export function buildTimelineFromScenes(scenes: Scene[], musicMood: string, musicVolume = 0.3): Track[] {
  const total = scenes.length ? scenes[scenes.length - 1].start + scenes[scenes.length - 1].duration : 10;

  const mkClip = (trackId: string, type: Clip["type"], label: string, start: number, duration: number, sceneId?: string, payload?: Record<string, unknown>): Clip => ({
    id: uid("clip"), trackId, type, label, start: Math.round(start * 100) / 100,
    duration: Math.round(duration * 100) / 100, offset: 0, sceneId,
    color: TRACK_COLORS[type], payload,
  });

  const videoClips = scenes.map((s) => mkClip("tr_video", "video", `Scene ${s.index + 1} · ${short(s.visualQuery)}`, s.start, s.duration, s.id, { transition: s.transition, visualUrl: s.visualUrl, visualKind: s.visualKind, overlay: s.overlay, sfx: s.sfx }));
  const voiceClips = scenes.map((s) => mkClip("tr_voice", "voice", short(s.narration), s.start, s.duration, s.id, { narration: s.narration }));
  const subClips = scenes.map((s) => mkClip("tr_subs", "subtitle", short(s.narration), s.start, s.duration, s.id, { narration: s.narration }));
  const musicClips = musicMood !== "none"
    ? [mkClip("tr_music", "music", `Music · ${musicMood}`, 0, total, undefined, { mood: musicMood, volume: musicVolume })]
    : [];

  return [
    { id: "tr_text", type: "text", name: "Text Overlay", clips: [], muted: false, locked: false },
    { id: "tr_video", type: "video", name: "Video / Visuals", clips: videoClips, muted: false, locked: false },
    { id: "tr_voice", type: "voice", name: "Voiceover", clips: voiceClips, muted: false, locked: false },
    { id: "tr_music", type: "music", name: "Music", clips: musicClips, muted: false, locked: false },
    { id: "tr_sfx", type: "sfx", name: "Sound FX", clips: [], muted: false, locked: false },
    { id: "tr_subs", type: "subtitle", name: "Subtitles", clips: subClips, muted: false, locked: false },
  ];
}

export function recalcSceneTimes(scenes: Scene[]): Scene[] {
  let cursor = 0;
  return scenes.map((s, i) => {
    const out = { ...s, start: Math.round(cursor * 100) / 100, index: i };
    cursor += s.duration;
    return out;
  });
}

export const projectDuration = (scenes: Scene[]) =>
  scenes.length ? Math.round((scenes[scenes.length - 1].start + scenes[scenes.length - 1].duration) * 10) / 10 : 0;
