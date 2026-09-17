import { NextResponse } from "next/server";

/**
 * Server-side research fallback: Wikipedia REST (free, no key).
 * Used when the browser cannot reach Wikipedia directly.
 */
export async function POST(req: Request) {
  try {
    const { topic, lang = "en" } = await req.json();
    const base = `https://${lang}.wikipedia.org/w/api.php`;
    const searchUrl = `${base}?action=query&list=search&format=json&srlimit=5&srsearch=${encodeURIComponent(topic)}`;
    const sres = await fetch(searchUrl, { headers: { "User-Agent": "FreeRush/1.0 (local research)" } });
    const sjson = await sres.json();
    const hits = sjson?.query?.search ?? [];
    const sources = hits.map((h: { title: string; snippet: string }) => ({
      title: h.title,
      url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(h.title.replace(/\s/g, "_"))}`,
      snippet: String(h.snippet).replace(/<[^>]+>/g, ""),
    }));
    let extract = "";
    if (hits[0]) {
      const eurl = `${base}?action=query&format=json&prop=extracts&explaintext=1&redirects=1&titles=${encodeURIComponent(hits[0].title)}`;
      const eres = await fetch(eurl, { headers: { "User-Agent": "FreeRush/1.0 (local research)" } });
      const ejson = await eres.json();
      const pages = ejson?.query?.pages ?? {};
      extract = (Object.values(pages)[0] as { extract?: string })?.extract?.slice(0, 16000) ?? "";
    }
    return NextResponse.json({ sources, extract });
  } catch (e) {
    return NextResponse.json({ sources: [], extract: "", error: String(e) });
  }
}
