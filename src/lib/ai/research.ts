import type { Language, ResearchBrief, SourceItem } from "@/lib/types";
import { extractKeywords, splitSentences, uid } from "@/lib/utils";

/**
 * 100% free research engine. No API keys, no paid services.
 * Sources: Wikipedia (CORS-open REST API) + Openverse images.
 * Falls back gracefully when offline.
 */

const wikiBase = (lang: Language) => `https://${lang}.wikipedia.org/w/api.php`;

async function wikiSearch(query: string, lang: Language, limit = 6) {
  const url =
    `${wikiBase(lang)}?action=query&list=search&format=json&origin=*` +
    `&srlimit=${limit}&srsearch=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("wiki search failed");
  const json = await res.json();
  return (json?.query?.search ?? []) as { title: string; snippet: string; pageid: number }[];
}

async function wikiExtract(title: string, lang: Language) {
  const url =
    `${wikiBase(lang)}?action=query&format=json&origin=*&prop=extracts&explaintext=1` +
    `&redirects=1&exsectionformat=plain&titles=${encodeURIComponent(title)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("wiki extract failed");
  const json = await res.json();
  const pages = json?.query?.pages ?? {};
  const page = Object.values(pages)[0] as { extract?: string; title?: string } | undefined;
  return { title: page?.title ?? title, text: page?.extract ?? "" };
}

async function wikiImages(query: string, lang: Language, limit = 8): Promise<string[]> {
  const url =
    `${wikiBase(lang)}?action=query&format=json&origin=*&generator=search` +
    `&gsrsearch=${encodeURIComponent(query)}&gsrlimit=${limit}&prop=pageimages` +
    `&piprop=thumbnail&pithumbsize=1200`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    const pages = Object.values(json?.query?.pages ?? {}) as {
      thumbnail?: { source: string };
    }[];
    return pages.map((p) => p.thumbnail?.source).filter(Boolean) as string[];
  } catch {
    return [];
  }
}

export async function searchFreeImages(query: string, lang: Language): Promise<string[]> {
  // Openverse: free stock/CC aggregator, CORS open, no key required
  try {
    const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=6&license_type=all`;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(t);
    if (res.ok) {
      const json = await res.json();
      const urls = (json?.results ?? [])
        .map((r: { url?: string; thumbnail?: string }) => r.url || r.thumbnail)
        .filter(Boolean) as string[];
      if (urls.length) return urls;
    }
  } catch {
    /* fall through */
  }
  const wikiImgs = await wikiImages(query, lang, 4);
  if (wikiImgs.length) return wikiImgs;
  return [];
}

const stripHtml = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#039;/g, "'");

export async function researchTopic(topic: string, lang: Language): Promise<ResearchBrief> {
  const facts: string[] = [];
  const sources: SourceItem[] = [];
  let summary = "";
  let images: string[] = [];

  const keywords = extractKeywords(topic, lang, 3);
  const queries = [topic, keywords.join(" ")].filter(Boolean);

  try {
    let hits: Awaited<ReturnType<typeof wikiSearch>> = [];
    for (const q of queries) {
      try {
        hits = await wikiSearch(q, lang, 6);
        if (hits.length) break;
      } catch {
        /* try next */
      }
    }
    // Fallback to English Wikipedia if local language has nothing
    if (!hits.length && lang !== "en") {
      try { hits = await wikiSearch(topic, "en", 6); } catch { /* offline */ }
    }

    const extractLang = lang;
    let primaryText = "";
    for (const hit of hits.slice(0, 4)) {
      const snippet = stripHtml(hit.snippet);
      sources.push({
        id: uid("src"),
        title: hit.title,
        url: `https://${extractLang}.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/\s/g, "_"))}`,
        snippet,
        kind: "wikipedia",
      });
    }

    if (hits[0]) {
      try {
        const ex = await wikiExtract(hits[0].title, extractLang);
        primaryText = ex.text;
        summary = splitSentences(ex.text).slice(0, 3).join(" ");
      } catch { /* skip */ }
    }

    const allSentences: string[] = [];
    const seen = new Set<string>();
    if (primaryText) allSentences.push(...splitSentences(primaryText.slice(0, 24000)));
    for (const hit of hits.slice(1, 3)) {
      try {
        const ex = await wikiExtract(hit.title, extractLang);
        allSentences.push(...splitSentences(ex.text.slice(0, 9000)));
      } catch { /* skip */ }
    }

    const kw = new Set(extractKeywords(topic, lang, 8));
    const scored = allSentences
      .map((s) => s.replace(/\[\d+\]/g, "").trim())
      .filter((s) => {
        const wc = s.split(/\s+/).length;
        if (wc < 7 || wc > 42) return false;
        if (/^(see also|references|external links|siehe auch|literatur|Einzelnachweise)/i.test(s)) return false;
        const key = s.toLowerCase().slice(0, 60);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((s) => {
        let score = 0;
        const lower = s.toLowerCase();
        for (const k of kw) if (lower.includes(k)) score += 2;
        if (/\d{3,4}/.test(s)) score += 1.2; // years / numbers = factual
        if (/\b(first|largest|biggest|oldest|most|erste|größte|älteste|meisten|bekannteste)\b/i.test(s)) score += 1;
        score += Math.min(2, s.length / 160);
        return { s, score };
      })
      .sort((a, b) => b.score - a.score);

    facts.push(...scored.slice(0, 44).map((x) => (x.s.endsWith(".") ? x.s : x.s + ".")));

    images = await wikiImages(topic, extractLang, 8);
    if (images.length < 4) {
      const extra = await searchFreeImages(topic, extractLang);
      images = [...images, ...extra];
    }
    images = [...new Set(images)].slice(0, 12);
  } catch {
    /* offline mode below */
  }

  const confidence: ResearchBrief["confidence"] =
    sources.length >= 4 && facts.length >= 20 ? "high" : sources.length >= 2 && facts.length >= 10 ? "medium" : "low";

  return { topic, summary, facts, sources, confidence, images, language: lang };
}
