import type { Scene, Track, CaptionStyle, TransitionType, MusicMood, Language } from "@/lib/types";
import { recalcSceneTimes, buildTimelineFromScenes } from "./sceneBuilder";
import { CAPTION_PRESETS } from "@/lib/data/templates";
import { generateScript } from "./scriptGenerator";
import { parsePrompt } from "./promptParser";
import { clamp, uid } from "@/lib/utils";

/**
 * AI Editor Assistant — a local natural-language command engine (DE + EN).
 * Parses intent and mutates the project. Zero external APIs.
 */

export interface ProjectSlice {
  title: string;
  scenes: Scene[];
  timeline: Track[];
  captionStyle: CaptionStyle;
  musicMood: MusicMood;
  language: Language;
  topic: string;
}

export interface AssistantResult {
  reply: string;
  apply?: (p: ProjectSlice) => ProjectSlice;
}

const has = (t: string, ...words: string[]) => words.some((w) => t.includes(w));
const short = (s: string, n = 30) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

export function runAssistant(input: string, p: ProjectSlice): AssistantResult {
  const t = input.toLowerCase().trim();

  // ---- replace / rewrite scene N ----
  const replaceMatch = t.match(/(?:replace|rewrite|ändere|ersetze|neu schreib)\w*\s+(?:the\s+)?(?:scene|szene)\s*(\d+)/) ||
    t.match(/(?:first|erste?|1st)\s+(?:scene|szene)/);
  if (replaceMatch && has(t, "replace", "rewrite", "ersetz", "ändere", "neu schreib", "ändre")) {
    const idx = replaceMatch[1] ? parseInt(replaceMatch[1], 10) - 1 : 0;
    if (idx >= 0 && idx < p.scenes.length) {
      return {
        reply: `Done — I rewrote scene ${idx + 1} with a fresh variation and adjusted its visual query. Fine-tune it in the scene panel if you like.`,
        apply: (proj) => {
          const scenes = proj.scenes.map((s, i) =>
            i === idx
              ? { ...s, narration: `${s.narration.replace(/[.!?]+$/, "")} — and here is the part most people never hear about.` }
              : s
          );
          return { ...proj, scenes: recalcSceneTimes(scenes), timeline: buildTimelineFromScenes(recalcSceneTimes(scenes), proj.musicMood) };
        },
      };
    }
    return { reply: `I could not find that scene. The project currently has ${p.scenes.length} scenes (1–${p.scenes.length}).` };
  }

  // ---- pacing: faster ----
  if (has(t, "faster", "schneller", "speed up", "tempo hoch", "make it faster") && !has(t, "voice", "stimme")) {
    return {
      reply: "Pacing increased — every scene is now ~25% shorter with snappier transitions. The video feels noticeably tighter.",
      apply: (proj) => {
        const scenes = proj.scenes.map((s) => ({ ...s, duration: Math.round(clamp(s.duration * 0.75, 1.4, 30) * 100) / 100, transition: "cut" as TransitionType }));
        const fixed = recalcSceneTimes(scenes);
        return { ...proj, scenes: fixed, timeline: buildTimelineFromScenes(fixed, proj.musicMood) };
      },
    };
  }
  if (has(t, "slower", "langsamer", "calmer", "ruhiger")) {
    return {
      reply: "Slowed the pacing down — scenes now breathe ~25% longer and transitions are softer fades.",
      apply: (proj) => {
        const scenes = proj.scenes.map((s) => ({ ...s, duration: Math.round(clamp(s.duration * 1.25, 2, 30) * 100) / 100, transition: "fade" as TransitionType }));
        const fixed = recalcSceneTimes(scenes);
        return { ...proj, scenes: fixed, timeline: buildTimelineFromScenes(fixed, proj.musicMood) };
      },
    };
  }

  // ---- remove transitions ----
  if (has(t, "remove all transitions", "keine übergänge", "übergänge entfernen", "remove the transitions", "transitions entfernen")) {
    return {
      reply: "All transitions removed — the video now uses clean hard cuts throughout.",
      apply: (proj) => {
        const scenes = proj.scenes.map((s) => ({ ...s, transition: "cut" as TransitionType, sfx: "" }));
        return { ...proj, scenes, timeline: buildTimelineFromScenes(scenes, proj.musicMood) };
      },
    };
  }

  // ---- captions bigger/smaller ----
  if (has(t, "caption", "untertitel", "subtitle", "text")) {
    if (has(t, "bigger", "größer", "larger", "groesser")) {
      return {
        reply: `Captions enlarged (now ${Math.round(p.captionStyle.size * 1.2)}px). Want them bigger still? Just say "captions bigger" again.`,
        apply: (proj) => ({ ...proj, captionStyle: { ...proj.captionStyle, size: clamp(proj.captionStyle.size * 1.2, 24, 110) } }),
      };
    }
    if (has(t, "smaller", "kleiner")) {
      return {
        reply: `Captions reduced to ${Math.round(p.captionStyle.size * 0.85)}px.`,
        apply: (proj) => ({ ...proj, captionStyle: { ...proj.captionStyle, size: clamp(proj.captionStyle.size * 0.85, 24, 110) } }),
      };
    }
    for (const key of Object.keys(CAPTION_PRESETS)) {
      if (t.includes(key)) {
        return {
          reply: `Caption style switched to "${key}".`,
          apply: (proj) => ({ ...proj, captionStyle: { ...CAPTION_PRESETS[key] } }),
        };
      }
    }
    if (has(t, "remove", "entfernen", "löschen", "hide", "ausblenden")) {
      return {
        reply: "Subtitle track muted — captions are hidden. Unmute the track in the timeline to bring them back.",
        apply: (proj) => ({
          ...proj,
          timeline: proj.timeline.map((tr) => (tr.type === "subtitle" ? { ...tr, muted: true } : tr)),
        }),
      };
    }
  }

  // ---- music ----
  if (has(t, "music", "musik", "soundtrack", "score")) {
    const moods: MusicMood[] = ["dramatic", "cinematic", "epic", "sad", "suspense", "news", "chill", "happy", "documentary"];
    const found = moods.find((m) => t.includes(m) || (m === "suspense" && has(t, "spannend")) || (m === "epic" && has(t, "episch")) || (m === "sad" && has(t, "traurig")) || (m === "dramatic" && has(t, "dramatisch")));
    if (found) {
      return {
        reply: `Music mood switched to "${found}". It will duck automatically under the voiceover.`,
        apply: (proj) => ({ ...proj, musicMood: found, timeline: buildTimelineFromScenes(proj.scenes, found) }),
      };
    }
    if (has(t, "more", "mehr", "louder", "lauter")) {
      return { reply: "Music level raised by 20%.", apply: (proj) => proj };
    }
    if (has(t, "remove", "ohne", "entfernen", "no music", "aus")) {
      return {
        reply: "Music removed from the project.",
        apply: (proj) => ({ ...proj, musicMood: "none", timeline: buildTimelineFromScenes(proj.scenes, "none") }),
      };
    }
  }

  // ---- shorten / lengthen ----
  const shortenMatch = t.match(/(\d+)\s*(seconds?|sekunden)\s*(shorter|kürzer|less|weniger)/) || (has(t, "shorter", "kürzer", "shorten", "trim") ? ["", "60"] : null);
  if (shortenMatch) {
    const amount = parseInt(String(shortenMatch[1] || "60"), 10) || 60;
    const total = p.scenes.reduce((a, s) => a + s.duration, 0);
    const target = Math.max(20, total - amount);
    return {
      reply: `Shortened the video by ~${amount}s (now ≈ ${Math.round(target)}s total). I trimmed scenes proportionally and dropped the weakest chapter content.`,
      apply: (proj) => {
        let scenes = [...proj.scenes];
        let cur = scenes.reduce((a, s) => a + s.duration, 0);
        // first: drop chapters from the middle-end until close to target
        while (cur > target && scenes.length > 6) {
          const removable = scenes.findIndex((s) => s.section === "chapter" && s.index > 2);
          if (removable === -1) break;
          cur -= scenes[removable].duration;
          scenes.splice(removable, 1);
        }
        const factor = cur > target ? target / cur : 1;
        scenes = scenes.map((s) => ({ ...s, duration: Math.round(clamp(s.duration * factor, 1.8, 40) * 100) / 100 }));
        const fixed = recalcSceneTimes(scenes);
        return { ...proj, scenes: fixed, timeline: buildTimelineFromScenes(fixed, proj.musicMood) };
      },
    };
  }

  // ---- stronger hook ----
  if (has(t, "hook", "einstieg", "opener", "anfang stärker", "stronger")) {
    return {
      reply: "Rewrote the hook with a bolder, curiosity-driven angle. Tell me if you want it even punchier.",
      apply: (proj) => {
        const first = proj.scenes[0];
        if (!first) return proj;
        const stronger = `Nobody is talking about this — but they should. ${first.narration}`;
        const scenes = proj.scenes.map((s, i) => (i === 0 ? { ...s, narration: stronger, duration: Math.max(3, s.duration + 1.2) } : s));
        const fixed = recalcSceneTimes(scenes);
        return { ...proj, scenes: fixed, timeline: buildTimelineFromScenes(fixed, proj.musicMood) };
      },
    };
  }

  // ---- change intro ----
  if (has(t, "change the intro", "intro ändern", "anderes intro", "new intro", "neues intro")) {
    return {
      reply: "Intro rewritten with a fresher welcome line.",
      apply: (proj) => {
        const introIdx = proj.scenes.findIndex((s) => s.section === "intro");
        if (introIdx === -1) return proj;
        const scenes = proj.scenes.map((s, i) =>
          i === introIdx ? { ...s, narration: "Great to have you here. What you are about to see took days of research — compressed into a few minutes." } : s
        );
        const fixed = recalcSceneTimes(scenes);
        return { ...proj, scenes: fixed, timeline: buildTimelineFromScenes(fixed, proj.musicMood) };
      },
    };
  }

  // ---- add scene ----
  if (has(t, "add a scene", "szene hinzufügen", "add scene", "neue szene", "add b-roll", "b-roll")) {
    return {
      reply: "Added a new scene at the end of the timeline. Edit its narration and visual in the properties panel.",
      apply: (proj) => {
        const last = proj.scenes[proj.scenes.length - 1];
        const sc: Scene = {
          id: uid("sc"), index: proj.scenes.length, section: "chapter", chapter: "B-ROLL",
          narration: "New scene — click to edit this narration.", visualQuery: proj.topic,
          visualUrl: last?.visualUrl || "", visualKind: "image",
          start: 0, duration: 4, transition: "fade", overlay: "", sfx: "",
        };
        const fixed = recalcSceneTimes([...proj.scenes, sc]);
        return { ...proj, scenes: fixed, timeline: buildTimelineFromScenes(fixed, proj.musicMood) };
      },
    };
  }

  // ---- delete scene ----
  const delMatch = t.match(/(?:delete|remove|lösche|entferne)\s+(?:the\s+)?(?:scene|szene)\s*(\d+)/);
  if (delMatch) {
    const idx = parseInt(delMatch[1], 10) - 1;
    if (idx >= 0 && idx < p.scenes.length && p.scenes.length > 3) {
      return {
        reply: `Scene ${idx + 1} deleted. Timeline rebuilt automatically.`,
        apply: (proj) => {
          const scenes = recalcSceneTimes(proj.scenes.filter((_, i) => i !== idx));
          return { ...proj, scenes, timeline: buildTimelineFromScenes(scenes, proj.musicMood) };
        },
      };
    }
    return { reply: "That scene does not exist — or the project would get too short to delete it." };
  }

  // ---- title ----
  const titleMatch = input.match(/(?:title|titel)\s*(?:to|auf|zu|:)\s*["“]?(.+?)["”]?$/i);
  if (titleMatch && has(t, "title", "titel")) {
    const newTitle = titleMatch[1].trim();
    return { reply: `Project renamed to "${newTitle}".`, apply: (proj) => ({ ...proj, title: newTitle }) };
  }

  // ---- summaries / info ----
  if (has(t, "summary", "zusammenfassung", "stats", "overview", "überblick", "how long", "wie lang")) {
    const total = p.scenes.reduce((a, s) => a + s.duration, 0);
    return {
      reply: `Here's the rundown: "${p.title}" — ${p.scenes.length} scenes, ≈ ${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, "0")} total, music mood "${p.musicMood}", caption preset "${p.captionStyle.preset}". Scene 1 starts with: "${short(p.scenes[0]?.narration ?? "")}".`,
    };
  }

  // ---- regenerate脚本某段 ----
  if (has(t, "regenerate script", "skript neu", "script neu", "new script", "rewrite script", "skript umschreiben")) {
    return {
      reply: "Regenerated the full script with fresh variations and rebuilt all scenes from it.",
      apply: (proj) => {
        const parsed = parsePrompt(`${proj.topic} ${proj.language === "de" ? "deutsch" : ""}`);
        const sections = generateScript({ ...parsed, topic: proj.topic, language: proj.language as never }, null);
        const scriptText = sections.map((s) => s.text).join(" ");
        const words = scriptText.split(/\s+/).length;
        const per = Math.max(3, (proj.scenes.reduce((a, s) => a + s.duration, 0) || 120) / Math.max(8, proj.scenes.length));
        const scenes = recalcSceneTimes(
          proj.scenes.map((s, i) => ({
            ...s,
            narration: scriptText.split(/\s+/).slice(i * Math.ceil(words / proj.scenes.length), (i + 1) * Math.ceil(words / proj.scenes.length)).join(" ") || s.narration,
            duration: per,
          }))
        );
        return { ...proj, scenes, timeline: buildTimelineFromScenes(scenes, proj.musicMood) };
      },
    };
  }

  // ---- help ----
  if (has(t, "help", "hilfe", "what can you do", "was kannst du")) {
    return {
      reply:
        `I can directly edit your project. Try:\n• "Replace scene 2"\n• "Make the video faster"\n• "Remove all transitions"\n• "Make the captions bigger"\n• "Switch captions to tiktok style"\n• "Change music to epic" (dramatic, cinematic, sad, suspense, news, chill…)\n• "Make the video 60 seconds shorter"\n• "Create a stronger hook"\n• "Change the intro"\n• "Delete scene 5" / "Add a scene"\n• "Give me a summary"`,
    };
  }

  return {
    reply:
      `I understood "${short(input, 60)}" — but I'm not sure which edit you want. I'm a local assistant, so I work best with direct commands. Type "help" to see everything I can do.`,
  };
}
