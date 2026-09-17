import { NextResponse } from "next/server";
import { callMistral, extractJson } from "@/lib/ai/mistralServer";

const LANG_NAMES: Record<string, string> = {
  de: "German (Deutsch)", en: "English", es: "Spanish (Español)", fr: "French (Français)",
};

const SECTION_TYPES = ["hook", "intro", "chapter", "conclusion", "cta"];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const userKey = req.headers.get("x-mistral-key") ?? undefined;
    const {
      topic, format = "youtube", language = "en", durationSec = 300,
      style = "cinematic", tone = "confident", audience = "general audience",
      wordsTarget = 600, facts = [], model,
    } = body ?? {};

    if (!topic || typeof topic !== "string") {
      return NextResponse.json({ sections: null, error: "missing_topic" });
    }

    const langName = LANG_NAMES[language] ?? "English";
    const factList = (facts as string[])
      .filter((f) => typeof f === "string")
      .slice(0, 36)
      .map((f, i) => `${i + 1}. ${f}`)
      .join("\n");

    const system = [
      "You are an elite YouTube scriptwriter. You write scripts that sound human, confident and impossible to click away from.",
      "OUTPUT: strict JSON only, matching exactly:",
      '{"sections":[{"type":"hook"|"intro"|"chapter"|"conclusion"|"cta","title":"SHORT UPPERCASE TITLE","text":"spoken narration text"}]}',
      "RULES:",
      `- Write 100% in ${langName}.`,
      `- Total narration ≈ ${Math.round(wordsTarget)} words (fits ~${Math.round(durationSec / 60)} min at normal speaking pace).`,
      "- Structure: exactly one hook, one intro, 4–10 chapters sized to fill the length, one conclusion, one CTA.",
      "- Short, natural spoken sentences. Strong hooks. Smooth transitions between chapters. Zero filler, zero repetition.",
      "- Adapt to the target audience. No markdown, no stage directions, no speaker labels — pure narration.",
      factList ? "- Ground every chapter in the RESEARCH FACTS below; never contradict them; do not invent numbers beyond them." : "- Use well-established general knowledge; avoid specific unverifiable claims.",
    ].join("\n");

    const user = [
      `TOPIC: ${topic}`,
      `FORMAT: ${format}`,
      `STYLE: ${style} · TONE: ${tone} · AUDIENCE: ${audience}`,
      factList ? `\nRESEARCH FACTS:\n${factList}` : "",
    ].join("\n");

    const result = await callMistral({
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      model,
      json: true,
      temperature: 0.75,
      maxTokens: Math.min(6000, 1200 + wordsTarget * 3),
      userKey,
    });

    if (result.error || !result.content) {
      return NextResponse.json({ sections: null, error: result.error ?? "empty" });
    }

    const parsed = extractJson<{ sections?: { type?: string; title?: string; text?: string }[] }>(result.content);
    const raw = parsed?.sections;
    if (!Array.isArray(raw) || raw.length < 3) {
      return NextResponse.json({ sections: null, error: "bad_structure" });
    }

    const sections = raw
      .filter((s) => s && typeof s.text === "string" && s.text.trim().length > 20)
      .map((s, i) => ({
        id: `sec_m_${Date.now().toString(36)}_${i}`,
        type: (SECTION_TYPES.includes(String(s.type)) ? s.type : i === 0 ? "hook" : i === raw.length - 1 ? "cta" : i === raw.length - 2 ? "conclusion" : "chapter") as string,
        title: String(s.title || `SECTION ${i + 1}`).toUpperCase().slice(0, 48),
        text: String(s.text).replace(/\s+/g, " ").trim(),
      }));

    if (sections.length < 3) return NextResponse.json({ sections: null, error: "bad_structure" });
    return NextResponse.json({ sections, provider: "mistral", latencyMs: result.latencyMs });
  } catch (e) {
    return NextResponse.json({ sections: null, error: String(e).slice(0, 200) });
  }
}
