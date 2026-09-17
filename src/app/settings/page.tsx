"use client";
import { useEffect, useState } from "react";
import {
  Settings as SettingsIcon, Check, X, Database, Mic2, Clapperboard, Palette,
  Volume2, HardDrive, Zap, Trash2, RefreshCw, ShieldCheck, BrainCircuit, KeyRound, Eye, EyeOff,
} from "lucide-react";
import { Button, Card, Badge, Input, Field, Select, SliderRow } from "@/components/ui";
import { ttsSupported, voiceOptions, onVoicesReady, previewVoice } from "@/lib/voice/tts";
import { prettyBytes } from "@/lib/utils";
import type { Language } from "@/lib/types";
import { getAiSettings, saveAiSettings, MISTRAL_MODELS, type AiSettings } from "@/lib/ai/provider";

interface CheckItem { id: string; label: string; icon: typeof Database; ok: boolean | null; detail: string }

export default function SettingsPage() {
  const [checks, setChecks] = useState<CheckItem[]>([
    { id: "storage", label: "Local storage", icon: HardDrive, ok: null, detail: "Projects & settings persist in your browser" },
    { id: "speech", label: "Browser Speech (TTS)", icon: Mic2, ok: null, detail: "Free voiceover engine" },
    { id: "wasm", label: "FFmpeg WASM / WebAssembly", icon: Zap, ok: null, detail: "Optional MP4 conversion" },
    { id: "canvas", label: "Canvas", icon: Palette, ok: null, detail: "Video rendering engine" },
    { id: "webaudio", label: "Web Audio", icon: Volume2, ok: null, detail: "Music & SFX synthesis" },
    { id: "db", label: "Local project database", icon: Database, ok: null, detail: "PostgreSQL via local API" },
  ]);
  const [name, setName] = useState("Creator");
  const [lang, setLang] = useState("en");
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [voiceURI, setVoiceURI] = useState("");
  const [voices, setVoices] = useState<{ voiceURI: string; name: string; lang: string }[]>([]);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [ai, setAi] = useState<AiSettings>({ provider: "auto", mistralKey: "", mistralModel: "mistral-small-latest" });
  const [showKey, setShowKey] = useState(false);
  const [serverKey, setServerKey] = useState(false);
  const [test, setTest] = useState<{ status: "idle" | "testing" | "ok" | "fail"; msg: string }>({ status: "idle", msg: "" });

  const runChecks = async () => {
    const results: Record<string, boolean> = {};
    try { localStorage.setItem("__t", "1"); localStorage.removeItem("__t"); results.storage = true; } catch { results.storage = false; }
    results.speech = ttsSupported();
    results.wasm = typeof WebAssembly !== "undefined";
    try { results.canvas = Boolean(document.createElement("canvas").getContext("2d")); } catch { results.canvas = false; }
    try { results.webaudio = typeof AudioContext !== "undefined"; } catch { results.webaudio = false; }
    try { const r = await fetch("/api/health"); const j = await r.json(); results.db = Boolean(j.db); } catch { results.db = false; }
    setChecks((c) => c.map((x) => ({ ...x, ok: results[x.id] ?? false })));
  };

  useEffect(() => {
    void runChecks();
    setName(localStorage.getItem("freerush.username") || "Creator");
    setLang(localStorage.getItem("freerush.lang") || "en");
    setRate(Number(localStorage.getItem("freerush.rate") || 1));
    setPitch(Number(localStorage.getItem("freerush.pitch") || 1));
    setVoiceURI(localStorage.getItem("freerush.voiceURI") || "");
    onVoicesReady(() => setVoices(voiceOptions().map((v) => ({ voiceURI: v.voiceURI, name: v.name, lang: v.lang }))));
    setVoices(voiceOptions().map((v) => ({ voiceURI: v.voiceURI, name: v.name, lang: v.lang })));
    navigator.storage?.estimate?.().then((e) => setStorage({ usage: e.usage ?? 0, quota: e.quota ?? 0 })).catch(() => {});
    setAi(getAiSettings());
    fetch("/api/ai/status").then((r) => r.json()).then((j) => setServerKey(Boolean(j.serverKey))).catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem("freerush.username", name);
    localStorage.setItem("freerush.lang", lang);
    localStorage.setItem("freerush.rate", String(rate));
    localStorage.setItem("freerush.pitch", String(pitch));
    localStorage.setItem("freerush.voiceURI", voiceURI);
  }, [name, lang, rate, pitch, voiceURI]);

  useEffect(() => { saveAiSettings(ai); }, [ai]);

  const testMistral = async () => {
    setTest({ status: "testing", msg: "" });
    try {
      const r = await fetch("/api/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(ai.mistralKey ? { "x-mistral-key": ai.mistralKey } : {}) },
        body: JSON.stringify({ model: ai.mistralModel }),
      });
      const j = await r.json();
      if (j.ok) setTest({ status: "ok", msg: `Connected · ${j.model} · ${j.latencyMs}ms` });
      else setTest({ status: "fail", msg: j.error === "no_key" ? "No key — paste your Mistral key or set MISTRAL_API_KEY on the server." : String(j.error).slice(0, 140) });
    } catch {
      setTest({ status: "fail", msg: "Server unreachable." });
    }
  };

  const mistralActive = ai.provider !== "free" && Boolean(ai.mistralKey || serverKey);

  const allOk = checks.every((c) => c.ok);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-white flex items-center gap-3">
          <SettingsIcon className="size-7 text-violet-300" /> Settings
        </h1>
        <p className="text-zinc-500 mt-1.5 text-sm">Everything runs free and locally. No accounts, no keys, no tracking.</p>
      </div>

      {/* setup check */}
      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className={`size-5 ${allOk ? "text-emerald-300" : "text-amber-300"}`} />
            <h2 className="font-semibold text-zinc-100">Setup check</h2>
            <Badge tone="green" className="ml-1">FREE MODE — default</Badge>
          </div>
          <Button size="xs" variant="ghost" icon={<RefreshCw className="size-3.5" />} onClick={() => void runChecks()}>Re-run</Button>
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          {checks.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/[0.05] px-3.5 py-3">
              <span className={`size-6 rounded-full flex items-center justify-center ${c.ok === null ? "bg-white/[0.06]" : c.ok ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>
                {c.ok === null ? <RefreshCw className="size-3 animate-spin text-zinc-500" /> : c.ok ? <Check className="size-3.5" /> : <X className="size-3.5" />}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-zinc-200">{c.label}</p>
                <p className="text-[11px] text-zinc-600 truncate">{c.detail}</p>
              </div>
              <c.icon className="size-4 text-zinc-600" />
            </div>
          ))}
        </div>
        {!checks.every((c) => c.ok) && checks.some((c) => c.ok === false) && (
          <p className="mt-3 text-[12px] text-amber-300/90">
            Some capabilities are limited in this browser — FREE RUSH will automatically fall back to the next free method.
          </p>
        )}
      </Card>

      {/* AI Provider */}
      <Card className="p-5 mb-6 border-violet-400/20 bg-gradient-to-br from-violet-500/[0.05] to-transparent">
        <div className="flex flex-wrap items-center gap-2.5 mb-4">
          <div className="size-9 rounded-xl bg-violet-500/15 flex items-center justify-center">
            <BrainCircuit className="size-4.5 text-violet-300" />
          </div>
          <div>
            <h2 className="font-semibold text-zinc-100 leading-none">AI Provider — Script & Research</h2>
            <p className="text-[11px] text-zinc-500 mt-1">Used for script generation and research refinement. Free engine stays as automatic fallback.</p>
          </div>
          <div className="flex-1" />
          <Badge tone={mistralActive ? "violet" : "green"}>{mistralActive ? "Mistral API active" : "FREE MODE"}</Badge>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Provider">
            <Select value={ai.provider} onChange={(e) => setAi((a) => ({ ...a, provider: e.target.value as AiSettings["provider"] }))}>
              <option value="auto">Automatic — Mistral when a key exists</option>
              <option value="mistral">Mistral API (always prefer)</option>
              <option value="free">Free local engine only</option>
            </Select>
          </Field>
          <Field label="Mistral model">
            <Select value={ai.mistralModel} onChange={(e) => setAi((a) => ({ ...a, mistralModel: e.target.value }))}>
              {MISTRAL_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </Select>
          </Field>
          <Field label="Mistral API key (optional)" className="sm:col-span-2"
            hint="Stored only in this browser. Requests are proxied through this local server — the key is never sent anywhere else. Mistral offers a free tier on La Plateforme.">
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-600" />
              <Input
                type={showKey ? "text" : "password"}
                value={ai.mistralKey}
                onChange={(e) => setAi((a) => ({ ...a, mistralKey: e.target.value.trim() }))}
                placeholder={serverKey ? "Server key active — yours optional" : "Paste your Mistral API key…"}
                className="pl-10 pr-11 font-mono text-[13px]"
                autoComplete="off"
              />
              <button type="button" onClick={() => setShowKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200 cursor-pointer">
                {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-4">
          <Button variant="soft" size="sm" icon={<Zap className="size-3.5" />} loading={test.status === "testing"} onClick={() => void testMistral()}>
            Test connection
          </Button>
          {test.status === "ok" && <span className="text-xs text-emerald-300 flex items-center gap-1.5"><Check className="size-3.5" /> {test.msg}</span>}
          {test.status === "fail" && <span className="text-xs text-rose-300 flex items-center gap-1.5"><X className="size-3.5" /> {test.msg}</span>}
          {serverKey && <span className="text-[11px] text-zinc-500">Server-side MISTRAL_API_KEY detected — Mistral works for all users of this instance.</span>}
          {!mistralActive && <span className="text-[11px] text-zinc-500">No key configured — research &amp; scripts run on the free local engine. Nothing breaks without it.</span>}
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* local profile */}
        <Card className="p-5">
          <h2 className="font-semibold text-zinc-100 mb-4">Local profile</h2>
          <div className="space-y-4">
            <Field label="Display name" hint="Stored only in this browser — no account required.">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Default language">
              <Select value={lang} onChange={(e) => setLang(e.target.value)}>
                <option value="en">English</option><option value="de">Deutsch</option>
                <option value="es">Español</option><option value="fr">Français</option>
              </Select>
            </Field>
          </div>
        </Card>

        {/* voice defaults */}
        <Card className="p-5">
          <h2 className="font-semibold text-zinc-100 mb-4">Voice defaults</h2>
          <div className="space-y-4">
            <Field label={`System voice (${voices.length} available)`}>
              <Select value={voiceURI} onChange={(e) => setVoiceURI(e.target.value)}>
                <option value="">Auto select</option>
                {voices.slice(0, 30).map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
              </Select>
            </Field>
            <SliderRow label="Speed" value={rate} min={0.6} max={1.6} step={0.05} format={(v) => `${v.toFixed(2)}x`} onChange={setRate} />
            <SliderRow label="Pitch" value={pitch} min={0.5} max={1.5} step={0.05} format={(v) => v.toFixed(2)} onChange={setPitch} />
            <Button size="sm" variant="soft" icon={<Volume2 className="size-4" />}
              onClick={() => previewVoice({ voiceURI, lang: lang as Language, rate, pitch, emotion: "neutral" }, lang)}>
              Preview voice
            </Button>
          </div>
        </Card>

        {/* storage */}
        <Card className="p-5">
          <h2 className="font-semibold text-zinc-100 mb-4">Local storage</h2>
          {storage ? (
            <>
              <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
                <span>Used by this browser profile</span>
                <span className="tabular-nums">{prettyBytes(storage.usage)} / {prettyBytes(storage.quota)}</span>
              </div>
              <div className="h-2 rounded-full bg-white/[0.07] overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-400" style={{ width: `${Math.min(100, (storage.usage / Math.max(1, storage.quota)) * 100)}%` }} />
              </div>
            </>
          ) : <p className="text-sm text-zinc-500">Storage estimate unavailable.</p>}
          <div className="flex gap-2 mt-4">
            <Button size="sm" variant="danger" icon={<Trash2 className="size-3.5" />}
              onClick={() => { if (confirm("Clear all FREE RUSH browser data (local cache & settings)? Database projects stay.")) { localStorage.clear(); indexedDB.deleteDatabase("freerush"); location.reload(); } }}>
              Clear browser data
            </Button>
          </div>
        </Card>

        {/* about */}
        <Card className="p-5 border-violet-400/20 bg-gradient-to-br from-violet-500/[0.06] to-transparent">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="size-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Zap className="size-4 text-white fill-white" />
            </div>
            <div>
              <h2 className="font-semibold text-zinc-100 leading-none">FREE RUSH</h2>
              <p className="text-[11px] text-zinc-500 mt-0.5">Your idea in. Your video out.</p>
            </div>
          </div>
          <div className="text-[12.5px] text-zinc-400 space-y-2 leading-relaxed">
            <p><b className="text-zinc-200">AI provider chain:</b> Mistral API (optional, your key) → rule-based local engines → browser speech → free sources (Wikipedia, Openverse) → procedural synthesis. If one layer is unavailable, the next takes over automatically.</p>
            <p><b className="text-zinc-200">Free forever:</b> no OpenAI, no cloud TTS, no paid stock, no render servers. Voices come from your OS, imagery from free archives, music is generated live.</p>
            <p className="text-zinc-500 text-[11.5px]"><Clapperboard className="size-3.5 inline mr-1" />Version 1.0 · local-first architecture · offline-tolerant</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
