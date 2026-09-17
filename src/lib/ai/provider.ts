"use client";
import type { ScriptSection } from "@/lib/types";

/**
 * Client-side AI provider control.
 * Priority: MISTRAL_API_KEY on the server → user's own key (browser only) → free engine.
 * The key never leaves the device except to this app's own local API proxy.
 */

export interface AiSettings {
  provider: "auto" | "mistral" | "free";
  mistralKey: string;
  mistralModel: string;
}

export const MISTRAL_MODELS = [
  { id: "mistral-small-latest", label: "Mistral Small — fast & cheapest" },
  { id: "mistral-medium-latest", label: "Mistral Medium — balanced" },
  { id: "mistral-large-latest", label: "Mistral Large — best quality" },
];

const DEFAULTS: AiSettings = { provider: "auto", mistralKey: "", mistralModel: "mistral-small-latest" };

export function getAiSettings(): AiSettings {
  if (typeof window === "undefined") return DEFAULTS;
  return {
    provider: (localStorage.getItem("freerush.aiProvider") as AiSettings["provider"]) || "auto",
    mistralKey: localStorage.getItem("freerush.mistralKey") || "",
    mistralModel: localStorage.getItem("freerush.mistralModel") || "mistral-small-latest",
  };
}

export function saveAiSettings(s: Partial<AiSettings>): AiSettings {
  const cur = getAiSettings();
  const next = { ...cur, ...s };
  localStorage.setItem("freerush.aiProvider", next.provider);
  localStorage.setItem("freerush.mistralKey", next.mistralKey);
  localStorage.setItem("freerush.mistralModel", next.mistralModel);
  return next;
}

/** True when the user opted into Mistral and provided a key (env key checked via status separately). */
export function wantsMistral(serverKey = false): boolean {
  const s = getAiSettings();
  if (s.provider === "free") return false;
  if (s.provider === "mistral") return Boolean(s.mistralKey) || serverKey;
  return Boolean(s.mistralKey) || serverKey; // auto
}

let cachedServerKey: boolean | null = null;
export async function serverHasMistralKey(): Promise<boolean> {
  if (cachedServerKey !== null) return cachedServerKey;
  try {
    const r = await fetch("/api/ai/status");
    const j = await r.json();
    cachedServerKey = Boolean(j.serverKey);
  } catch {
    cachedServerKey = false;
  }
  return cachedServerKey;
}

export interface ScriptAiResult {
  sections: ScriptSection[] | null;
  provider: "mistral" | "free";
  note?: string;
}

export async function aiGenerateScript(opts: {
  topic: string; format: string; language: string; durationSec: number;
  style: string; tone: string; audience: string; wordsTarget: number;
  facts: string[];
}): Promise<ScriptAiResult> {
  const s = getAiSettings();
  try {
    const res = await fetch("/api/ai/script", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(s.mistralKey ? { "x-mistral-key": s.mistralKey } : {}) },
      body: JSON.stringify({ ...opts, model: s.mistralModel }),
    });
    const j = await res.json();
    if (j.sections?.length) return { sections: j.sections as ScriptSection[], provider: "mistral" };
    const err = String(j.error ?? "unknown");
    return {
      sections: null, provider: "free",
      note: err === "no_key" ? "No Mistral key configured — used the free local engine." : `Mistral unavailable (${err.slice(0, 80)}) — used the free local engine.`,
    };
  } catch (e) {
    return { sections: null, provider: "free", note: `Mistral unreachable — used the free local engine.` };
  }
}

export interface ResearchAiResult {
  summary?: string;
  facts?: string[];
  keywords?: string[];
  note?: string;
}

export async function aiRefineResearch(opts: {
  topic: string; language: string; facts: string[]; summary: string;
}): Promise<ResearchAiResult | null> {
  const s = getAiSettings();
  try {
    const res = await fetch("/api/ai/research", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(s.mistralKey ? { "x-mistral-key": s.mistralKey } : {}) },
      body: JSON.stringify({ ...opts, model: s.mistralModel }),
    });
    const j = await res.json();
    if (j.briefing && (j.briefing.facts?.length || j.briefing.summary)) return j.briefing as ResearchAiResult;
    return null;
  } catch {
    return null;
  }
}
