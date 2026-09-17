import type { Aspect, Language, ParsedPrompt, VideoFormat } from "@/lib/types";
import { WORDS_PER_MIN, clamp } from "@/lib/utils";

const GERMAN_HINTS = /\b(erstelle|erzeuge|mach|ein|eine|einen|über|ueber|und|der|die|das|geschichte|minütiges|video|doku|dokumentation|für|mit|auf|deutsch|deutschen|erkläre|erklär)\b/i;
const SPANISH_HINTS = /\b(crea|crear|haz|un|una|sobre|el|la|los|las|video|vídeo|historia|para|con|español|explica|documental)\b/i;
const FRENCH_HINTS = /\b(crée|créer|fais|un|une|sur|le|la|les|vidéo|histoire|pour|avec|français|explique|documentaire)\b/i;
const ENGLISH_HINTS = /\b(create|make|about|the|history|video|explain|for|with|english|documentary|top|best)\b/i;

export function detectLanguage(text: string): Language {
  const scores: [Language, number][] = [
    ["de", (text.match(new RegExp(GERMAN_HINTS, "gi")) || []).length + (/[äöüß]/i.test(text) ? 3 : 0)],
    ["es", (text.match(new RegExp(SPANISH_HINTS, "gi")) || []).length + (/[ñ¿¡]/i.test(text) ? 3 : 0)],
    ["fr", (text.match(new RegExp(FRENCH_HINTS, "gi")) || []).length + (/[àâçéèêëîïôùû]/i.test(text) ? 3 : 0)],
    ["en", (text.match(new RegExp(ENGLISH_HINTS, "gi")) || []).length],
  ];
  scores.sort((a, b) => b[1] - a[1]);
  return scores[0][1] > 0 ? scores[0][0] : "en";
}

const FORMAT_PATTERNS: [RegExp, VideoFormat][] = [
  [/\b(top\s?\d+|listicle|liste|ranking|bestenliste)\b/i, "top10"],
  [/\b(shorts?|tiktok|reels?|vertical|60[\s-]?second)\b/i, "shorts"],
  [/\b(doku|documentary|dokumentation|dokumentar)\b/i, "documentary"],
  [/\b(news|nachrichten|aktuell|breaking|report)\b/i, "news"],
  [/\b(explain|explainer|erklär|how does|wie funktioniert)\b/i, "explainer"],
  [/\b(essay|analysis|analyse|deep[\s-]?dive)\b/i, "essay"],
  [/\b(story|geschichte erzähl|true crime|mystery)\b/i, "story"],
  [/\b(educational|tutorial|lernen|learn|course|lektion|school|schule)\b/i, "educational"],
  [/\b(youtube)\b/i, "youtube"],
];

const STYLE_PATTERNS: [RegExp, string][] = [
  [/\b(tek?tonisch|cinematic|kinematisch|filmisch|episch|epic)\b/i, "cinematic"],
  [/\b(fast|schnell|dynamic|dynamisch|energetic)\b/i, "fast-paced"],
  [/\b(calm|ruhig|entspannt|chill|relaxing)\b/i, "calm"],
  [/\b(funny|lustig|humor|witzig|comedy)\b/i, "humorous"],
  [/\b(dramatic|dramatisch|dark|düster|thriller)\b/i, "dramatic"],
  [/\b(minimal|clean|simple|schlicht)\b/i, "minimal"],
];

const AUDIENCE_PATTERNS: [RegExp, string][] = [
  [/\b(kids?|children|kinder)\b/i, "children"],
  [/\b(teens?|teenager|jugendliche)\b/i, "teenagers"],
  [/\b(beginners?|anfänger|einsteiger)\b/i, "beginners"],
  [/\b(experts?|profis|experten|advanced|fortgeschrittene)\b/i, "experts"],
  [/\b(business|unternehmen|professionals)\b/i, "professionals"],
];

const COMMAND_FILLERS: RegExp[] = [
  /^(please\s+)?(create|make|generate|produce|write|erstelle|erstell|erzeuge|mach(?:e)?|baue|crea|haz|crée|fais)\s+/i,
  /^(a|an|ein|eine|einen|un|una|une)\s+/i,
  /\b(video|youtube[\s-]?video|youtube|doku|documentary|dokumentation|explainer|vídeo|vidéo)\b/gi,
  /\b(minütiges?|minütigen?|(\d+[\s-])?minuten?( lang(?:es|en|e)?)?|stündiges?)\b/gi,
  /\b(\d+[\s-]?minutes?( long)?|\d+[\s-]?seconds?|\d+[\s-]?sekunden?)\b/gi,
  /^(about|über|on|sobre|sur|zum thema|thema:?)\s+/i,
  /^(the history of|die geschichte (von|der)|historia de|histoire de)\s+/i,
  /\b(für|for|para|pour)\s+(youtube|tiktok|instagram|shorts)\b/gi,
];

export function extractTopic(prompt: string): string {
  let t = prompt.trim();
  // remove duration phrases first
  t = t.replace(/\b(ein|a|an)?\s*\d+([\s-]|\s)*(min(ute)?[s]?|minuten|sekunden?|seconds?)[\s-]?(lang(?:es|en|e|er)?|long)?\b/gi, " ");
  t = t.replace(/\b\d+[\s-]?minütiges?\b/gi, " ");
  for (const re of COMMAND_FILLERS) t = t.replace(re, " ");
  t = t.replace(/\s{2,}/g, " ").replace(/^[\s,.:;!?-]+|[\s,.:;!?-]+$/g, "");
  if (!t) t = prompt.split(/\s+/).slice(-6).join(" ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function parseDuration(prompt: string): number | null {
  const min = prompt.match(/(\d+(?:[.,]\d+)?)[\s-]*(min(ute)?[s]?|minuten|m\b)/i);
  if (min) return clamp(parseFloat(min[1].replace(",", ".")) * 60, 15, 60 * 120);
  const sec = prompt.match(/(\d+)[\s-]*(seconds?|sekunden?|secs?|s\b)/i);
  if (sec) return clamp(parseInt(sec[1], 10), 10, 60 * 120);
  const rel = prompt.match(/(\d+)[\s-]?minüt/i);
  if (rel) return clamp(parseInt(rel[1], 10) * 60, 15, 60 * 120);
  return null;
}

function parseCount(prompt: string): number | null {
  const m = prompt.match(/top\s?(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

export function parsePrompt(prompt: string): ParsedPrompt {
  const language = detectLanguage(prompt);
  let format: VideoFormat = "youtube";
  for (const [re, f] of FORMAT_PATTERNS) {
    if (re.test(prompt)) { format = f; break; }
  }
  const explicitDuration = parseDuration(prompt);
  let durationSec =
    explicitDuration ??
    (format === "shorts" ? 45 : format === "top10" ? 480 : format === "news" ? 180 : format === "documentary" ? 480 : 300);

  let aspect: Aspect = "16:9";
  if (format === "shorts" || /\b(tiktok|reels?|shorts?|vertical|9:16|hochkant)\b/i.test(prompt)) {
    aspect = "9:16";
    if (format === "youtube") format = "shorts";
  }
  if (/\b(1:1|square|quadrat)\b/i.test(prompt)) aspect = "1:1";

  let style = "cinematic";
  for (const [re, s] of STYLE_PATTERNS) if (re.test(prompt)) { style = s; break; }
  let tone = style === "humorous" ? "playful" : style === "dramatic" ? "gripping" : "confident";
  let audience = "general audience";
  for (const [re, a] of AUDIENCE_PATTERNS) if (re.test(prompt)) { audience = a; break; }

  const count = parseCount(prompt);
  const topic = extractTopic(prompt);
  const wpm = WORDS_PER_MIN[format] ?? 130;
  const wordsTarget = Math.round((durationSec / 60) * wpm);

  if (format === "top10" && count) {
    // keep n items feasible
    durationSec = Math.max(durationSec, 60);
  }

  return { topic, format, language, durationSec, style, tone, audience, aspect, wordsTarget };
}
