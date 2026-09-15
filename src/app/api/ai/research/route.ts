import { NextResponse } from "next/server";
import { callMistral, extractJson } from "@/lib/ai/mistralServer";

const LANG_NAMES: Record<string, string> = {
  de: "German (Deutsch)", en: "English", es: "Spanish (Español)", fr: "French (Français)",
};

/**
 * Mistral-powered research refinement: turns raw Wikipedia material into a
 * structured briefing + clean fact list. Optional — client falls back to
 * pure free research when no key is available.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const userKey = req.headers.get("x-mistral-key") ?? undefined;
    const { topic, language = "en", facts = [], summary = "", model } = body ?? {};
    if (!topic) return NextResponse.json({ briefing: null, error: "missing_topic" });

    const langName = LANG_NAMES[language] ?? "English";
    const material = (facts as string[]).filter((f) => typeof f === "string").slice(0, 44).join("\n- ");

    const system = [
      "You are a meticulous research editor for a documentary YouTube channel.",
      "OUTPUT: strict JSON only:",
      '{"summary":"2–3 sentence editorial briefing","facts":["self-contained factual sentence","…"],"keywords":["visual search terms","…"]}',
      "RULES:",
      `- Write in ${langName}.`,
      "- Return up to 40 facts, ordered from most striking to most detailed.",
      "- Each fact must stand alone (no pronouns like 'it' or 'this' without the subject).",
      "- Remove duplicates, fluff and meta text. Keep dates and numbers exactly.",
      "- keywords: 8 short English visual search terms for stock imagery about the topic.",
      material ? "- Only use facts supported by the SOURCE MATERIAL; you may compress and clarify wording." : "- No source material was available: use only well-established general knowledge and omit anything controversial.",
    ].join("\n");

    const user = [
      `TOPIC: ${topic}`,
      summary ? `EXISTING SUMMARY: ${summary}` : "",
      material ? `\nSOURCE MATERIAL:\n- ${material}` : "",
    ].join("\n");

    const result = await callMistral({
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      model,
      json: true,
      temperature: 0.3,
      maxTokens: 3500,
      userKey,
    });

    if (result.error || !result.content) {
      return NextResponse.json({ briefing: null, error: result.error ?? "empty" });
    }
    const parsed = extractJson<{ summary?: string; facts?: string[]; keywords?: string[] }>(result.content);
    if (!parsed || (!parsed.facts && !parsed.summary)) {
      return NextResponse.json({ briefing: null, error: "bad_structure" });
    }
    return NextResponse.json({
      briefing: {
        summary: String(parsed.summary ?? "").trim(),
        facts: (parsed.facts ?? []).filter((f) => typeof f === "string" && f.length > 25).slice(0, 44),
        keywords: (parsed.keywords ?? []).filter((k) => typeof k === "string").slice(0, 8),
      },
      provider: "mistral",
      latencyMs: result.latencyMs,
    });
  } catch (e) {
    return NextResponse.json({ briefing: null, error: String(e).slice(0, 200) });
  }
}
