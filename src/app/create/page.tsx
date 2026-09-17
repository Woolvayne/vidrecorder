"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Sparkles, FileText, Mic, Video, Bot, ArrowRight, ArrowLeft, Globe, Check,
  BookOpen, ListChecks, Gauge, ExternalLink, Trash2, RefreshCw, Play, Upload,
  Scissors, Palette, Volume2, Captions, Clapperboard, Image as ImageIcon, Music4, Timer, BrainCircuit,
} from "lucide-react";
import { Button, Card, Badge, Select, Field, ProgressBar, Switch, Textarea, Input } from "@/components/ui";
import type { CreateMode, Language, ParsedPrompt, ProjectData, ResearchBrief, ScriptSection, VoiceSettings, BrandProfile, Scene } from "@/lib/types";
import { parsePrompt } from "@/lib/ai/promptParser";
import { researchTopic } from "@/lib/ai/research";
import { generateScript, textToSections } from "@/lib/ai/scriptGenerator";
import { buildScenes, assignVisuals, buildTimelineFromScenes, recalcSceneTimes, projectDuration } from "@/lib/ai/sceneBuilder";
import { preloadImages } from "@/lib/render/renderer";
import { generateThumbnails } from "@/lib/render/thumbnails";
import { voiceOptions, onVoicesReady, previewVoice } from "@/lib/voice/tts";
import { TEMPLATES, CAPTION_PRESETS, MOOD_META } from "@/lib/data/templates";
import { uid, wordCount, secondsForWords, WORDS_PER_MIN, prettyDuration } from "@/lib/utils";
import { wantsMistral, serverHasMistralKey, aiGenerateScript, aiRefineResearch } from "@/lib/ai/provider";

type WizardStep = "input" | "research" | "script" | "summary" | "generating";

const MODE_META: { id: CreateMode; label: string; icon: typeof Sparkles; desc: string }[] = [
  { id: "prompt", label: "AI Prompt", icon: Sparkles, desc: "Describe an idea — FREE RUSH researches, writes and builds the entire video." },
  { id: "script", label: "Custom Script", icon: FileText, desc: "Paste your own script. We build scenes, visuals, voice and music around it." },
  { id: "voiceover", label: "Voiceover", icon: Mic, desc: "Turn any text into a synced narration track with captions and visuals." },
  { id: "talking-head", label: "Talking Head", icon: Video, desc: "Upload your footage — auto remove silences, add captions, music and B-Roll." },
  { id: "avatar", label: "AI Avatar", icon: Bot, desc: "Local avatar mode: your photo + browser voice, simulated lip-sync. Free." },
];

const LANGS: { id: Language; label: string }[] = [
  { id: "de", label: "Deutsch" }, { id: "en", label: "English" },
  { id: "es", label: "Español" }, { id: "fr", label: "Français" },
];

interface GenLog { stage: string; detail?: string; pct: number }

async function analyzeSilence(file: File): Promise<{ duration: number; silences: { start: number; end: number }[] }> {
  const buf = await file.arrayBuffer();
  const actx = new AudioContext();
  const decoded = await actx.decodeAudioData(buf.slice(0));
  const data = decoded.getChannelData(0);
  const sr = decoded.sampleRate;
  const winSize = Math.floor(sr * 0.05);
  const silences: { start: number; end: number }[] = [];
  let silentStart: number | null = null;
  for (let i = 0; i < data.length; i += winSize) {
    let sum = 0;
    for (let j = i; j < Math.min(i + winSize, data.length); j++) sum += data[j] * data[j];
    const rms = Math.sqrt(sum / winSize);
    const t = i / sr;
    if (rms < 0.012 && silentStart === null) silentStart = t;
    if (rms >= 0.012 && silentStart !== null) {
      if (t - silentStart > 0.6) silences.push({ start: silentStart, end: t });
      silentStart = null;
    }
  }
  void actx.close();
  return { duration: decoded.duration, silences };
}

function CreateWizardInner() {
  const router = useRouter();
  const params = useSearchParams();

  const [step, setStep] = useState<WizardStep>("input");
  const [mode, setMode] = useState<CreateMode>((params.get("mode") as CreateMode) || "prompt");
  const [input, setInput] = useState(params.get("prompt") || "");
  const [language, setLanguage] = useState<Language>("en");
  const [aspect, setAspect] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [durationMin, setDurationMin] = useState<number>(5);
  const [musicMood, setMusicMood] = useState<string>("cinematic");
  const [captionPreset, setCaptionPreset] = useState("modern");
  const [style, setStyle] = useState("cinematic");
  const [voice, setVoice] = useState<VoiceSettings>({ voiceURI: "", lang: "en", rate: 1, pitch: 1, emotion: "neutral" });
  const [voices, setVoices] = useState<{ voiceURI: string; name: string; lang: string }[]>([]);
  const [brands, setBrands] = useState<BrandProfile[]>([]);
  const [brandId, setBrandId] = useState<string>("");
  const [shortsMode, setShortsMode] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; url: string; kind: "video" | "image" } | null>(null);
  const [silenceInfo, setSilenceInfo] = useState<{ duration: number; silences: { start: number; end: number }[] } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [removeSilences, setRemoveSilences] = useState(true);

  const [parsed, setParsed] = useState<ParsedPrompt | null>(null);
  const [research, setResearch] = useState<ResearchBrief | null>(null);
  const [researching, setResearching] = useState(false);
  const [script, setScript] = useState<ScriptSection[]>([]);
  const [scriptBusy, setScriptBusy] = useState(false);
  const [providerNote, setProviderNote] = useState("");
  const [serverKey, setServerKey] = useState(false);
  const [mistralOn, setMistralOn] = useState(false);
  const [genLog, setGenLog] = useState<GenLog[]>([]);
  const [genPct, setGenPct] = useState(0);
  const [genError, setGenError] = useState("");
  const [researchStage, setResearchStage] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelGen = useRef(false);

  useEffect(() => {
    onVoicesReady(() => setVoices(voiceOptions().map((v) => ({ voiceURI: v.voiceURI, name: v.name, lang: v.lang }))));
    setVoices(voiceOptions().map((v) => ({ voiceURI: v.voiceURI, name: v.name, lang: v.lang })));
    fetch("/api/brands").then((r) => r.json()).then((j) => setBrands(j.brands ?? [])).catch(() => {});
    serverHasMistralKey().then((k) => { setServerKey(k); setMistralOn(wantsMistral(k)); });
  }, []);

  // template preselect
  useEffect(() => {
    const tpl = params.get("template");
    if (tpl) {
      const def = TEMPLATES.find((t) => t.id === tpl);
      if (def) {
        setAspect(def.aspect);
        setMusicMood(def.musicMood);
        setCaptionPreset(def.captionPreset);
        setStyle(def.pace === "slow" ? "cinematic" : "fast-paced");
        if (def.aspect === "9:16") setShortsMode(true);
      }
    }
  }, [params]);

  const applyBrand = (id: string) => {
    setBrandId(id);
    const b = brands.find((x) => x.id === id);
    if (!b) return;
    const s = b as unknown as BrandProfile & { settings?: Record<string, unknown> };
    const st = (s.settings ?? s) as Partial<BrandProfile>;
    if (st.language) setLanguage(st.language as Language);
    if (st.musicMood) setMusicMood(st.musicMood);
    if (st.captionPreset) setCaptionPreset(st.captionPreset);
    if (st.voiceURI) setVoice((v) => ({ ...v, voiceURI: st.voiceURI! }));
    if (st.defaultDurationSec) setDurationMin(Math.round(st.defaultDurationSec / 60));
  };

  const handleFile = async (file: File) => {
    if (file.size > 8 * 1024 * 1024) { alert("In free local mode, uploads are limited to ~8 MB (stored in the local database). Trim longer footage first or use short clips."); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      const url = String(reader.result);
      const isVideo = file.type.startsWith("video") || file.type.startsWith("audio");
      setUploadedFile({ name: file.name, url, kind: isVideo ? "video" : "image" });
      if (isVideo && mode === "talking-head") {
        setAnalyzing(true);
        try {
          const info = await analyzeSilence(file);
          setSilenceInfo(info);
        } catch { setSilenceInfo(null); }
        setAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const log = (stage: string, pct: number, detail?: string) => {
    setGenLog((l) => [...l.filter((x) => x.stage !== stage), { stage, pct, detail }]);
    setGenPct(pct);
  };

  // ---------- flow ----------
  const runAnalysis = () => {
    const promptText = input.trim() || "Amazing facts about our world";
    const p = parsePrompt(promptText);
    if (language) p.language = language;
    if (aspect) p.aspect = aspect;
    p.durationSec = Math.round(durationMin * 60);
    p.wordsTarget = Math.round((p.durationSec / 60) * (WORDS_PER_MIN[p.format] ?? 130));
    setParsed(p);
    setVoice((v) => ({ ...v, lang: p.language }));
    return p;
  };

  const startResearch = async () => {
    const p = parsed ?? runAnalysis();
    setStep("research");
    setResearching(true);
    setResearchStage("Searching Wikipedia & free sources…");
    let brief: ResearchBrief;
    try {
      brief = await researchTopic(p.topic, p.language);
    } catch {
      brief = { topic: p.topic, summary: "", facts: [], sources: [], confidence: "low", images: [], language: p.language };
    }
    // optional Mistral refinement layer
    if (wantsMistral(serverKey)) {
      setResearchStage("Refining briefing with Mistral…");
      const refined = await aiRefineResearch({ topic: p.topic, language: p.language, facts: brief.facts, summary: brief.summary });
      if (refined && (refined.facts?.length || refined.summary)) {
        brief = {
          ...brief,
          summary: refined.summary || brief.summary,
          facts: refined.facts?.length ? refined.facts : brief.facts,
          confidence: brief.confidence === "low" ? "medium" : brief.confidence,
        };
        setProviderNote("");
      } else if (brief.facts.length) {
        setProviderNote("Mistral research unavailable — continuing with free Wikipedia research.");
      }
    }
    setResearch(brief);
    setResearching(false);
    setResearchStage("");
  };

  const buildScript = useCallback(() => {
    const p = parsed ?? parsePrompt(input || "video");
    if (mode === "script" || mode === "voiceover") {
      return textToSections(input, p.language);
    }
    return generateScript(p, research);
  }, [mode, input, parsed, research]);

  /** Provider-aware script generation: Mistral first, free engine as automatic fallback. */
  const buildScriptSmart = useCallback(async (): Promise<ScriptSection[]> => {
    if (mode === "script" || mode === "voiceover") {
      const p = parsed ?? parsePrompt(input || "video");
      return textToSections(input, p.language);
    }
    const p = parsed ?? parsePrompt(input || "video");
    if (wantsMistral(serverKey)) {
      const r = await aiGenerateScript({
        topic: p.topic, format: p.format, language: p.language, durationSec: p.durationSec,
        style, tone: p.tone, audience: p.audience, wordsTarget: p.wordsTarget,
        facts: research?.facts ?? [],
      });
      if (r.sections) {
        setProviderNote("");
        return r.sections;
      }
      if (r.note) setProviderNote(r.note);
    }
    return generateScript(p, research);
  }, [mode, input, parsed, research, style, serverKey]);

  const goScript = () => {
    if (mode === "prompt") {
      startResearch();
    } else {
      setParsed(runAnalysis());
      setScript(buildScript());
      setStep("script");
    }
  };

  const researchDone = async () => {
    setScriptBusy(true);
    const secs = await buildScriptSmart();
    setScript(secs);
    setScriptBusy(false);
    setStep("script");
  };

  const scriptWords = script.reduce((a, s) => a + wordCount(s.text), 0);
  const estDuration = parsed ? secondsForWords(scriptWords, WORDS_PER_MIN[parsed.format] ?? 130) : 0;
  const estScenes = Math.max(4, Math.ceil(scriptWords / 22));

  const removeSource = (id: string) => {
    setResearch((r) => (r ? { ...r, sources: r.sources.filter((s) => s.id !== id) } : r));
  };

  // ---------- generation pipeline ----------
  const generate = async () => {
    cancelGen.current = false;
    setStep("generating");
    setGenLog([]);
    setGenError("");
    try {
      const p = parsed ?? runAnalysis();
      log("Researching", 0.06, research ? `${research.sources.length} sources cached` : "using cached brief");
      await new Promise((r) => setTimeout(r, 400));

      log("Writing Script", 0.16, `${scriptWords} words · ${script.length} sections`);
      await new Promise((r) => setTimeout(r, 500));
      if (cancelGen.current) return;

      log("Creating Scenes", 0.28, `estimating ${estScenes} scenes`);
      let scenes = buildScenes(script, {
        language: p.language, topic: p.topic, format: p.format,
        images: research?.images, fastPace: p.aspect === "9:16" || p.format === "shorts",
      });
      await new Promise((r) => setTimeout(r, 400));

      log("Generating Voice", 0.38, `browser voice · ${p.language.toUpperCase()} · rate ${voice.rate}x`);
      onVoicesReady(() => {});
      await new Promise((r) => setTimeout(r, 450));

      if (uploadedFile && mode === "talking-head") {
        scenes = scenes.map((s) => ({ ...s, visualUrl: uploadedFile.url, visualKind: "upload" as const }));
        log("Analyzing Footage", 0.5, silenceInfo ? `${silenceInfo.silences.length} silences detected · ${removeSilences ? "auto-cut enabled" : "kept"}` : "done");
        await new Promise((r) => setTimeout(r, 500));
      } else if (uploadedFile && mode === "avatar") {
        log("Compositing Avatar", 0.5, "image + simulated lip-sync ready");
        await new Promise((r) => setTimeout(r, 400));
      } else {
        log("Preparing Visuals", 0.42, "searching free imagery (Openverse / Wikipedia)…");
        scenes = await assignVisuals(scenes, p.language, research?.images ?? [], (done, total) => {
          log("Preparing Visuals", 0.42 + (0.3 * done) / Math.max(1, total), `${done}/${total} scenes matched`);
          if (cancelGen.current) throw new Error("cancelled");
        });
      }
      scenes = recalcSceneTimes(scenes);
      await preloadImages(scenes.slice(0, 8).map((s) => s.visualUrl));
      if (cancelGen.current) return;

      log("Composing Music", 0.76, `procedural score · mood "${musicMood}" · auto-ducking on`);
      await new Promise((r) => setTimeout(r, 400));

      log("Building Timeline", 0.82, `${scenes.length} scenes · captions on`);
      const timeline = buildTimelineFromScenes(scenes, musicMood);
      await new Promise((r) => setTimeout(r, 350));

      log("Creating Thumbnails", 0.9, "4 concepts");
      const title = makeTitle(p);
      const thumbs = await generateThumbnails({
        title, subtitle: p.format.toUpperCase(),
        images: scenes.filter((s) => s.visualKind === "image").slice(0, 3).map((s) => s.visualUrl),
        accent: "#7c5cff", aspect: "16:9",
      });

      log("Saving Project", 0.96, "local database");
      const project: ProjectData = {
        id: "", title,
        prompt: input, mode, status: "ready",
        format: p.format, language: p.language,
        durationTargetSec: p.durationSec, aspect: p.aspect,
        style, tone: p.tone, audience: p.audience,
        script, research, scenes, timeline,
        captionStyle: { ...CAPTION_PRESETS[captionPreset] },
        musicMood: musicMood as ProjectData["musicMood"],
        voice: { ...voice, lang: p.language },
        brandId: brandId || null,
        thumbnails: thumbs,
        exportSettings: { format: "webm", resolution: "1080p", aspect: p.aspect, fps: 30, audio: "aac" },
        mediaUrl: mode === "talking-head" ? uploadedFile?.url ?? null : null,
        avatarUrl: mode === "avatar" ? uploadedFile?.url ?? null : null,
      };
      const res = await fetch("/api/projects", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: project.title, prompt: project.prompt, mode: project.mode, status: "ready",
          format: project.format, language: project.language, aspect: project.aspect,
          durationTargetSec: project.durationTargetSec, brandId: project.brandId, data: project,
        }),
      });
      const j = await res.json();
      log("Finished", 1, "opening editor…");
      setGenPct(1);
      await new Promise((r) => setTimeout(r, 500));
      if (j.id) router.push(`/editor/${j.id}`);
      else setGenError("Could not save the project — local database unavailable. " + (j.error ?? ""));
    } catch (e) {
      if (String(e).includes("cancelled")) { setStep("summary"); return; }
      setGenError(String(e));
    }
  };

  function makeTitle(p: ParsedPrompt): string {
    const topic = p.topic.replace(/\.$/, "");
    switch (p.format) {
      case "documentary": return `${topic} — The Full Story`;
      case "top10": return `Top 10 ${topic}`;
      case "explainer": return `${topic} — Explained`;
      case "news": return `${topic} — Latest Update`;
      case "shorts": case "tiktok": case "reel": return `${topic} in 60 Seconds`;
      default: return topic;
    }
  }

  const STEPS: { id: WizardStep; label: string }[] = [
    { id: "input", label: "Input" }, { id: "research", label: "Research" },
    { id: "script", label: "Script" }, { id: "summary", label: "Summary" }, { id: "generating", label: "Generate" },
  ];
  const stepIdx = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="max-w-4xl mx-auto pb-20">
      {/* stepper */}
      <div className="flex items-center gap-1.5 mb-8 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-1.5 shrink-0">
            <div className={`flex items-center gap-2 h-8 px-3 rounded-full text-xs font-medium transition-colors ${
              i < stepIdx ? "text-emerald-300 bg-emerald-500/10 border border-emerald-500/20"
              : i === stepIdx ? "text-violet-200 bg-violet-500/15 border border-violet-400/30"
              : "text-zinc-600 border border-white/[0.06]"
            }`}>
              {i < stepIdx ? <Check className="size-3.5" /> : <span className="tabular-nums">{i + 1}</span>}
              {s.label}
            </div>
            {i < STEPS.length - 1 && <div className="w-4 h-px bg-white/[0.08]" />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ============ STEP: INPUT ============ */}
        {step === "input" && (
          <motion.div key="input" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }} transition={{ duration: 0.25 }}>
            <h1 className="font-display text-3xl font-bold text-white">Create a new video</h1>
            <p className="text-zinc-500 mt-2">Pick how you want to start. Everything runs free and local.</p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-6">
              {MODE_META.map((m) => (
                <Card key={m.id} interactive
                  className={`p-4 cursor-pointer ${mode === m.id ? "!border-violet-400/50 !bg-violet-500/[0.07]" : ""}`}
                  onClick={() => setMode(m.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className={`size-9 rounded-xl flex items-center justify-center ${mode === m.id ? "bg-violet-500/20 text-violet-300" : "bg-white/[0.05] text-zinc-400"}`}>
                      <m.icon className="size-4.5" />
                    </div>
                    {mode === m.id && <Check className="size-4 text-violet-300" />}
                  </div>
                  <h3 className="mt-3 font-medium text-sm text-zinc-100">{m.label}</h3>
                  <p className="mt-1 text-xs text-zinc-500 leading-relaxed">{m.desc}</p>
                </Card>
              ))}
              <Card className="p-4 border-dashed">
                <div className="flex items-center justify-between">
                  <div className="size-9 rounded-xl bg-white/[0.04] flex items-center justify-center text-zinc-500"><Clapperboard className="size-4.5" /></div>
                  <Badge tone={shortsMode ? "amber" : "zinc"}>{shortsMode ? "ON" : "OFF"}</Badge>
                </div>
                <h3 className="mt-3 font-medium text-sm text-zinc-100">Shorts Mode</h3>
                <p className="mt-1 text-xs text-zinc-500 leading-relaxed">Vertical 9:16, fast cuts, big centered captions.</p>
                <div className="mt-3"><Switch checked={shortsMode} onChange={(v) => { setShortsMode(v); setAspect(v ? "9:16" : "16:9"); }} label="Enable vertical output" /></div>
              </Card>
            </div>

            <Card className="mt-5 p-5">
              {(mode === "prompt" || mode === "script" || mode === "voiceover") && (
                <Field label={mode === "prompt" ? "Your video idea" : mode === "script" ? "Your script" : "Narration text"}>
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    rows={mode === "prompt" ? 4 : 10}
                    placeholder={
                      mode === "prompt" ? "Create a 10 minute documentary about the history of Hamburg…"
                      : mode === "script" ? "Paste HOOK / INTRO / CHAPTERS — or just plain text, we structure it automatically…"
                      : "Paste the text you want as a voiceover…"
                    }
                    className="font-mono text-[13px]"
                  />
                </Field>
              )}

              {(mode === "talking-head" || mode === "avatar") && (
                <div className="space-y-4">
                  <Field label={mode === "talking-head" ? "Upload your footage" : "Upload a face photo (optional)"}>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) void handleFile(f); }}
                      className="rounded-xl border border-dashed border-white/[0.15] hover:border-violet-400/40 bg-white/[0.02] hover:bg-violet-500/[0.04] transition-colors p-8 text-center cursor-pointer"
                    >
                      <Upload className="size-6 text-zinc-500 mx-auto mb-2" />
                      {uploadedFile ? (
                        <p className="text-sm text-emerald-300 flex items-center justify-center gap-2"><Check className="size-4" /> {uploadedFile.name}</p>
                      ) : (
                        <>
                          <p className="text-sm text-zinc-300">Drop your {mode === "talking-head" ? "video/audio" : "photo"} here or click to browse</p>
                          <p className="text-xs text-zinc-600 mt-1">Processed 100% locally — nothing leaves your device</p>
                        </>
                      )}
                    </div>
                    <input ref={fileInputRef} type="file" accept={mode === "talking-head" ? "video/*,audio/*" : "image/*"} className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }} />
                  </Field>
                  {analyzing && <p className="text-xs text-violet-300 flex items-center gap-2"><Scissors className="size-3.5 animate-pulse" /> Analyzing audio for silences…</p>}
                  {silenceInfo && mode === "talking-head" && (
                    <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-3.5 text-sm flex flex-wrap items-center gap-x-6 gap-y-2">
                      <span className="text-zinc-300">Duration: <b className="text-white">{prettyDuration(silenceInfo.duration)}</b></span>
                      <span className="text-zinc-300">Silences found: <b className="text-amber-300">{silenceInfo.silences.length}</b></span>
                      <span className="text-zinc-300">Recoverable: <b className="text-emerald-300">{prettyDuration(silenceInfo.silences.reduce((a, s) => a + (s.end - s.start), 0))}</b></span>
                      <Switch checked={removeSilences} onChange={setRemoveSilences} label="Auto-cut silences" />
                    </div>
                  )}
                  <Field label="Describe the video (used for captions & structure)">
                    <Textarea value={input} onChange={(e) => setInput(e.target.value)} rows={4} placeholder="What is this video about? Paste your talking points for auto-captions…" />
                  </Field>
                </div>
              )}
            </Card>

            {/* options */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
              <Card className="p-4">
                <Field label="Language">
                  <Select value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
                    {LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                  </Select>
                </Field>
              </Card>
              <Card className="p-4">
                <Field label="Target length">
                  <Select value={String(durationMin)} onChange={(e) => setDurationMin(Number(e.target.value))}>
                    {[1, 2, 3, 5, 8, 10, 15, 20].map((m) => <option key={m} value={m}>{m} min</option>)}
                  </Select>
                </Field>
              </Card>
              <Card className="p-4">
                <Field label="Aspect ratio">
                  <Select value={aspect} onChange={(e) => setAspect(e.target.value as typeof aspect)}>
                    <option value="16:9">16:9 YouTube</option>
                    <option value="9:16">9:16 Shorts</option>
                    <option value="1:1">1:1 Social</option>
                  </Select>
                </Field>
              </Card>
              <Card className="p-4">
                <Field label="Brand profile">
                  <Select value={brandId} onChange={(e) => applyBrand(e.target.value)}>
                    <option value="">No brand</option>
                    {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </Select>
                </Field>
              </Card>
              <Card className="p-4">
                <Field label="Voice">
                  <Select value={voice.voiceURI} onChange={(e) => setVoice((v) => ({ ...v, voiceURI: e.target.value }))}>
                    <option value="">Auto ({language.toUpperCase()} system voice)</option>
                    {voices.filter((v) => v.lang.toLowerCase().startsWith(language)).map((v) => (
                      <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>
                    ))}
                  </Select>
                </Field>
              </Card>
              <Card className="p-4">
                <Field label="Music mood">
                  <Select value={musicMood} onChange={(e) => setMusicMood(e.target.value)}>
                    {Object.entries(MOOD_META).map(([id, m]) => <option key={id} value={id}>{m.label}</option>)}
                  </Select>
                </Field>
              </Card>
              <Card className="p-4">
                <Field label="Caption style">
                  <Select value={captionPreset} onChange={(e) => setCaptionPreset(e.target.value)}>
                    {Object.keys(CAPTION_PRESETS).map((k) => <option key={k} value={k} className="capitalize">{k}</option>)}
                  </Select>
                </Field>
              </Card>
              <Card className="p-4 flex items-center justify-between">
                <span className="text-xs text-zinc-400">Preview voice</span>
                <Button size="sm" variant="soft" icon={<Play className="size-3.5" />}
                  onClick={() => previewVoice({ ...voice, lang: language }, language)}>Test</Button>
              </Card>
            </div>

            <div className="flex justify-end mt-6">
              <Button variant="primary" size="lg" onClick={goScript} disabled={mode !== "talking-head" && mode !== "avatar" && !input.trim() && mode !== "prompt"} icon={<ArrowRight className="size-4" />}>
                {mode === "prompt" ? "Start Research" : "Continue"}
              </Button>
            </div>
          </motion.div>
        )}

        {/* ============ STEP: RESEARCH ============ */}
        {step === "research" && (
          <motion.div key="research" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }}>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" icon={<ArrowLeft className="size-4" />} onClick={() => setStep("input")}>Back</Button>
              <h1 className="font-display text-2xl font-bold text-white">Research</h1>
              <Badge tone={mistralOn ? "violet" : "green"} className="ml-1">
                <BrainCircuit className="size-3" /> {mistralOn ? "Mistral API" : "Free Engine"}
              </Badge>
            </div>
            {providerNote && (
              <p className="mt-3 text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5">{providerNote}</p>
            )}
            {researching ? (
              <Card className="mt-6 p-10 flex flex-col items-center text-center">
                <div className="size-12 rounded-full border-2 border-violet-400/30 border-t-violet-400 animate-spin mb-4" />
                <p className="text-zinc-200 font-medium">{researchStage || "Working…"}</p>
                <p className="text-xs text-zinc-500 mt-1">Wikipedia · free sources · no paid APIs</p>
              </Card>
            ) : research && (
              <>
                <div className="grid grid-cols-3 gap-3 mt-6">
                  <Card className="p-4 text-center">
                    <BookOpen className="size-5 text-violet-300 mx-auto mb-2" />
                    <div className="text-2xl font-bold font-display text-white">{research.sources.length}</div>
                    <div className="text-xs text-zinc-500">Sources found</div>
                  </Card>
                  <Card className="p-4 text-center">
                    <ListChecks className="size-5 text-sky-300 mx-auto mb-2" />
                    <div className="text-2xl font-bold font-display text-white">{research.facts.length}</div>
                    <div className="text-xs text-zinc-500">Facts extracted</div>
                  </Card>
                  <Card className="p-4 text-center">
                    <Gauge className="size-5 text-emerald-300 mx-auto mb-2" />
                    <div className="text-2xl font-bold font-display text-white capitalize">{research.confidence}</div>
                    <div className="text-xs text-zinc-500">Confidence</div>
                  </Card>
                </div>
                {research.confidence === "low" && (
                  <p className="mt-4 text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                    Limited online sources right now — the script engine will use a structured template instead. You can improve results by editing the script manually in the next step.
                  </p>
                )}
                {research.summary && (
                  <Card className="mt-4 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">Briefing</p>
                    <p className="text-sm text-zinc-300 leading-relaxed">{research.summary}</p>
                  </Card>
                )}
                <Card className="mt-4 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">Sources</p>
                  <div className="space-y-2">
                    {research.sources.map((s) => (
                      <div key={s.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/[0.06] px-3.5 py-2.5">
                        <Globe className="size-4 text-sky-300 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-zinc-200 truncate">{s.title}</p>
                          <p className="text-xs text-zinc-500 truncate">{s.snippet}</p>
                        </div>
                        <a href={s.url} target="_blank" rel="noreferrer" className="p-1.5 text-zinc-500 hover:text-sky-300"><ExternalLink className="size-4" /></a>
                        <button onClick={() => removeSource(s.id)} className="p-1.5 text-zinc-500 hover:text-rose-300 cursor-pointer"><Trash2 className="size-4" /></button>
                      </div>
                    ))}
                    {!research.sources.length && <p className="text-sm text-zinc-500">All sources removed — the generator will use a generic structure.</p>}
                  </div>
                </Card>
                <div className="flex justify-end gap-2 mt-6">
                  <Button variant="outline" icon={<RefreshCw className="size-4" />} onClick={startResearch}>Re-run research</Button>
                  <Button variant="primary" size="lg" onClick={() => void researchDone()} loading={scriptBusy} icon={<ArrowRight className="size-4" />}>
                    {mistralOn ? "Generate Script with Mistral" : "Generate Script"}
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* ============ STEP: SCRIPT ============ */}
        {step === "script" && (
          <motion.div key="script" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }}>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="ghost" size="sm" icon={<ArrowLeft className="size-4" />} onClick={() => setStep(mode === "prompt" ? "research" : "input")}>Back</Button>
              <h1 className="font-display text-2xl font-bold text-white">Script</h1>
              <Badge tone={mistralOn ? "violet" : "green"}>
                <BrainCircuit className="size-3" /> {mistralOn ? "Mistral API" : "Free Engine"}
              </Badge>
              <div className="flex-1" />
              <Badge tone="blue">{scriptWords} words</Badge>
              <Badge tone="violet">≈ {prettyDuration(estDuration)}</Badge>
              <Button variant="outline" size="sm" icon={<RefreshCw className="size-3.5" />} loading={scriptBusy}
                onClick={async () => { setScriptBusy(true); setScript(await buildScriptSmart()); setScriptBusy(false); }}>
                Regenerate
              </Button>
            </div>
            <p className="text-zinc-500 text-sm mt-2">Fully editable — changes flow straight into scenes, voiceover and captions.</p>
            {providerNote && (
              <p className="mt-3 text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5">{providerNote}</p>
            )}
            <div className="space-y-3 mt-5">
              {script.map((sec, i) => (
                <Card key={sec.id} className="p-4">
                  <div className="flex items-center gap-2 mb-2.5">
                    <Badge tone={sec.type === "hook" ? "amber" : sec.type === "cta" ? "green" : sec.type === "chapter" ? "violet" : "blue"}>{sec.title}</Badge>
                    <span className="text-[11px] text-zinc-600">{wordCount(sec.text)} words · ≈ {Math.round(secondsForWords(wordCount(sec.text), 130))}s</span>
                  </div>
                  <Textarea
                    value={sec.text}
                    rows={Math.max(2, Math.min(8, Math.ceil(wordCount(sec.text) / 26)))}
                    onChange={(e) => setScript((s) => s.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                    className="!bg-transparent !border-transparent focus:!border-violet-400/40 !px-0 text-[14px] leading-relaxed"
                  />
                </Card>
              ))}
            </div>
            <div className="flex justify-end mt-6">
              <Button variant="primary" size="lg" onClick={() => setStep("summary")} icon={<ArrowRight className="size-4" />}>Review Project</Button>
            </div>
          </motion.div>
        )}

        {/* ============ STEP: SUMMARY ============ */}
        {step === "summary" && (
          <motion.div key="summary" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }}>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" icon={<ArrowLeft className="size-4" />} onClick={() => setStep("script")}>Back</Button>
              <h1 className="font-display text-2xl font-bold text-white">Project summary</h1>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-6">
              {[
                { icon: Clapperboard, label: "Format", value: (parsed?.format ?? "youtube").replace("top10", "Top 10").replace(/^\w/, (c) => c.toUpperCase()) },
                { icon: Timer, label: "Est. duration", value: prettyDuration(estDuration) },
                { icon: Globe, label: "Language", value: LANGS.find((l) => l.id === (parsed?.language ?? language))?.label ?? "English" },
                { icon: Mic, label: "Voice", value: `${(parsed?.language ?? language).toUpperCase()} · browser TTS · ${voice.rate}x` },
                { icon: Palette, label: "Visual style", value: `${style} · ${aspect}` },
                { icon: ListChecks, label: "Estimated scenes", value: String(estScenes) },
                { icon: Music4, label: "Music", value: MOOD_META[musicMood]?.label ?? musicMood },
                { icon: Captions, label: "Captions", value: captionPreset },
                { icon: Volume2, label: "SFX", value: "Auto on transitions" },
                { icon: BrainCircuit, label: "Engine", value: mistralOn ? "Mistral API + free fallback" : "Free local engine" },
              ].map((it) => (
                <Card key={it.label} className="p-4 flex items-center gap-3">
                  <div className="size-9 rounded-xl bg-white/[0.05] flex items-center justify-center text-violet-300"><it.icon className="size-4" /></div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-zinc-500">{it.label}</p>
                    <p className="text-sm font-medium text-zinc-100 truncate">{it.value}</p>
                  </div>
                </Card>
              ))}
            </div>
            <Card className="mt-4 p-4 flex items-center gap-3 border-violet-400/20 bg-violet-500/[0.05]">
              <ImageIcon className="size-5 text-violet-300 shrink-0" />
              <p className="text-sm text-zinc-300">
                FREE RUSH will now build scenes, fetch free visuals, compose the music bed, sync the voiceover, generate captions and 4 thumbnails — then open the full editor.
              </p>
            </Card>
            <div className="flex justify-end mt-6">
              <Button variant="primary" size="lg" onClick={generate} icon={<Sparkles className="size-4" />} className="h-13 px-8 text-base">
                CREATE VIDEO
              </Button>
            </div>
          </motion.div>
        )}

        {/* ============ STEP: GENERATING ============ */}
        {step === "generating" && (
          <motion.div key="generating" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <h1 className="font-display text-2xl font-bold text-white">{genPct >= 1 ? "Your video is ready" : "Building your video…"}</h1>
            <p className="text-zinc-500 text-sm mt-1">{genPct >= 1 ? "Opening the editor." : "Everything below runs locally and free — sit back."}</p>
            <Card className="mt-6 p-6">
              <ProgressBar value={genPct} className="h-2" />
              <div className="mt-6 space-y-1">
                {["Researching", "Writing Script", "Creating Scenes", "Generating Voice", "Preparing Visuals", "Composing Music", "Building Timeline", "Creating Thumbnails"].map((stage) => {
                  const entry = genLog.find((l) => l.stage === stage);
                  const done = genLog.some((l) => l.stage === stage) && genLog.indexOf(entry!) < genLog.length - 1 || genPct >= 1;
                  const active = entry && genLog[genLog.length - 1].stage === stage && genPct < 1;
                  return (
                    <div key={stage} className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition-colors ${active ? "bg-violet-500/[0.08]" : ""}`}>
                      <span className={`size-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        done ? "bg-emerald-500/20 text-emerald-300" : active ? "bg-violet-500/25 text-violet-200 animate-pulse" : "bg-white/[0.05] text-zinc-600"
                      }`}>{done ? <Check className="size-3" /> : "·"}</span>
                      <span className={`text-sm flex-1 ${active ? "text-zinc-100" : done ? "text-zinc-400" : "text-zinc-600"}`}>{stage}…</span>
                      {entry?.detail && <span className="text-[11px] text-zinc-500 tabular-nums">{entry.detail}</span>}
                    </div>
                  );
                })}
              </div>
              {genError && (
                <div className="mt-4 rounded-xl bg-rose-500/10 border border-rose-500/25 px-4 py-3 text-sm text-rose-300">
                  {genError}
                  <Button variant="outline" size="sm" className="ml-3" onClick={() => setStep("summary")}>Back</Button>
                </div>
              )}
              {genPct < 1 && !genError && (
                <div className="mt-4 flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => { cancelGen.current = true; setStep("summary"); }}>Cancel</Button>
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function CreatePage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto py-20 text-center text-zinc-500">Loading studio…</div>}>
      <CreateWizardInner />
    </Suspense>
  );
}
