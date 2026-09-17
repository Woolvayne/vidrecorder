import { NextResponse } from "next/server";
import { callMistral } from "@/lib/ai/mistralServer";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const userKey = req.headers.get("x-mistral-key") ?? undefined;
  const model = (body as { model?: string }).model || "mistral-small-latest";
  const result = await callMistral({
    messages: [{ role: "user", content: "Reply with exactly: OK" }],
    model,
    maxTokens: 6,
    temperature: 0,
    userKey,
  });
  if (result.error) return NextResponse.json({ ok: false, error: result.error });
  return NextResponse.json({ ok: true, latencyMs: result.latencyMs, model, reply: result.content?.slice(0, 20) });
}
