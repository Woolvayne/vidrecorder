import { clsx, type ClassValue } from "clsx";

export const cn = (...inputs: ClassValue[]) => clsx(inputs);

export const uid = (p = "id") =>
  `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;

export const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

export const formatTime = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
};

export const hashSeed = (str: string) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
};

// seeded PRNG
export const mulberry32 = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const WORDS_PER_MIN: Record<string, number> = {
  documentary: 118, explainer: 135, essay: 125, news: 145, top10: 138,
  story: 122, educational: 128, youtube: 140, shorts: 165, tiktok: 165, reel: 165,
};

const STOPWORDS: Record<string, string[]> = {
  en: "the a an and or but of to in on at for with is are was were be been it its this that these those as by from about into over after before between during without within you your we our they their he she his her not no yes do does did have has had can could will would should may might must what when where which who whom why how".split(" "),
  de: "der die das den dem des ein eine einer einem einen und oder aber von zu in im am an auf für mit ist sind war waren sein seine ihr ihre er sie es wir du nicht kein keine was wer wie wo wann warum welche welcher welches auch als bei nach vor über unter zwischen durch ohne um so dass wenn dann man sich aus vom zum zur mit bei".split(" "),
  es: "el la los las un una unos unas y o pero de a en con por para es son fue fueron ser su sus no que como cuando donde quien cual este esta estos estas".split(" "),
  fr: "le la les un une des et ou mais de à en dans pour avec est sont était étaient être son sa ses ne pas que qui quoi quand où comment ce cette ces".split(" "),
};

export function splitSentences(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const parts = clean.match(/[^.!?…]+[.!?…]+["']?|[^.!?…]+$/g) || [];
  return parts.map((s) => s.trim()).filter((s) => s.length > 1);
}

export function extractKeywords(text: string, lang = "en", max = 5): string[] {
  const stop = new Set([...(STOPWORDS[lang] || []), ...(STOPWORDS.en)]);
  const words = text
    .toLowerCase()
    .replace(/[^a-zà-ÿ0-9\s-]/gi, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stop.has(w));
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, max)
    .map(([w]) => w);
}

export function wordCount(t: string) {
  return t.trim() ? t.trim().split(/\s+/).length : 0;
}

export function secondsForWords(words: number, wordsPerMin: number) {
  return (words / wordsPerMin) * 60;
}

export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...a: A) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

export const prettyBytes = (n: number) => {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${u[i]}`;
};

export const prettyDuration = (sec: number) => {
  if (sec < 60) return `${Math.round(sec)}s`;
  return `${Math.floor(sec / 60)} min ${Math.round(sec % 60) ? Math.round(sec % 60) + "s" : ""}`.trim();
};

// ---------- tiny IndexedDB store for export blobs (offline-first) ----------
const IDB_NAME = "freerush";
const IDB_STORE = "blobs";

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

export async function idbPut(key: string, value: Blob): Promise<void> {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function idbGet(key: string): Promise<Blob | null> {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const req = db.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).get(key);
    req.onsuccess = () => res((req.result as Blob) || null);
    req.onerror = () => rej(req.error);
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const aspectDims = (aspect: string, resolution: "720p" | "1080p") => {
  const h = resolution === "1080p" ? 1080 : 720;
  if (aspect === "9:16") return { w: Math.round((h * 9) / 16), h };
  if (aspect === "1:1") return { w: h, h };
  return { w: Math.round((h * 16) / 9), h };
};
