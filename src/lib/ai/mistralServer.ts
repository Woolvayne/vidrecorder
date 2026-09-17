/**
 * Server-side Mistral client (optional provider).
 * Key resolution order: MISTRAL_API_KEY env → per-request header key (user's own).
 * Everything degrades gracefully — callers fall back to the free engine.
 */

export interface MistralMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface MistralResult {
  content?: string;
  error?: string;
  latencyMs?: number;
}

export const MISTRAL_MODELS = [
  { id: "mistral-small-latest", label: "Mistral Small — fast & cheapest" },
  { id: "mistral-medium-latest", label: "Mistral Medium — balanced" },
  { id: "mistral-large-latest", label: "Mistral Large — best quality" },
];

export async function callMistral(opts: {
  messages: MistralMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  userKey?: string;
}): Promise<MistralResult> {
  const key = process.env.MISTRAL_API_KEY || opts.userKey;
  if (!key) return { error: "no_key" };
  const started = Date.now();
  try {
    const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: opts.model || "mistral-small-latest",
        messages: opts.messages,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 4000,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) {
      const text = (await res.text()).slice(0, 300);
      return { error: `mistral_${res.status}: ${text}` };
    }
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) return { error: "empty_response" };
    return { content, latencyMs: Date.now() - started };
  } catch (e) {
    return { error: `network: ${String(e).slice(0, 180)}` };
  }
}

/** Extracts the first valid JSON object from a model response (fence-tolerant). */
export function extractJson<T>(raw: string): T | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}
