"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Sparkles, FileText, Mic, Video, Bot, ArrowRight, Clock, Film,
  FolderKanban, Rocket, LayoutTemplate, TrendingUp, Zap, CornerDownLeft,
} from "lucide-react";
import { Button, Card, Badge } from "@/components/ui";
import type { CreateMode } from "@/lib/types";
import { prettyDuration, formatTime } from "@/lib/utils";

const MODES: { id: CreateMode; label: string; icon: typeof Sparkles; desc: string }[] = [
  { id: "prompt", label: "AI Prompt", icon: Sparkles, desc: "One idea in, full video out" },
  { id: "script", label: "Custom Script", icon: FileText, desc: "Bring your own text" },
  { id: "voiceover", label: "Voiceover", icon: Mic, desc: "Text to narration track" },
  { id: "talking-head", label: "Talking Head", icon: Video, desc: "Upload & auto-cut footage" },
  { id: "avatar", label: "AI Avatar", icon: Bot, desc: "Presenter-style avatar video" },
];

const EXAMPLES = [
  "Create a 10 minute documentary about the history of Hamburg.",
  "Create a Top 10 video about the most dangerous animals.",
  "Create a YouTube video explaining quantum physics.",
  "Erstelle ein 8-minütiges Doku-Video über die Geschichte Hamburgs.",
  "Make a 60 second Short about why the Roman Empire fell.",
];

interface ProjectRow {
  id: string; title: string; status: string; format: string; aspect: string;
  durationTargetSec: number; updatedAt: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<CreateMode>("prompt");
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((j) => setProjects(j.projects ?? []))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(220, Math.max(84, ta.scrollHeight)) + "px";
  }, [prompt]);

  const go = () => {
    const params = new URLSearchParams();
    if (prompt.trim()) params.set("prompt", prompt.trim());
    params.set("mode", mode);
    router.push(`/create?${params.toString()}`);
  };

  const totalMinutes = Math.round(projects.reduce((a, p) => a + (p.durationTargetSec || 0), 0) / 60);

  return (
    <div className="max-w-6xl mx-auto">
      {/* HERO */}
      <div className="relative pt-6 lg:pt-12 pb-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        >
          <Badge tone="violet" className="mx-auto mb-5">
            <Zap className="size-3" /> Free Engine active — no API keys required
          </Badge>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white">
            What would you like to{" "}
            <span className="bg-gradient-to-r from-violet-400 via-indigo-400 to-sky-400 bg-clip-text text-transparent">
              create today?
            </span>
          </h1>
          <p className="mt-4 text-zinc-400 text-base lg:text-lg max-w-xl mx-auto">
            Describe your video, paste a script, or upload your own media.
            Research, script, voice, visuals, music and editing — fully automatic.
          </p>
        </motion.div>

        {/* prompt editor */}
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.12 }}
          className="mt-8 max-w-3xl mx-auto"
        >
          <div className="prompt-glow rounded-2xl border border-white/[0.08] bg-[#10121a]/95 backdrop-blur shadow-2xl shadow-black/40 transition-shadow">
            <div className="flex items-center gap-1.5 px-3 pt-3 overflow-x-auto">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  title={m.desc}
                  className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                    mode === m.id
                      ? "bg-violet-500/20 text-violet-200 border border-violet-400/30"
                      : "text-zinc-500 hover:text-zinc-300 border border-transparent hover:bg-white/[0.04]"
                  }`}
                >
                  <m.icon className="size-3.5" />
                  {m.label}
                </button>
              ))}
            </div>
            <textarea
              ref={taRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) go(); }}
              placeholder={
                mode === "prompt" ? "e.g. Create a 10 minute documentary about the history of Hamburg…"
                : mode === "script" ? "Paste your full script here…"
                : mode === "voiceover" ? "Paste the text you want narrated…"
                : mode === "talking-head" ? "Describe the video you're about to upload…"
                : "Describe your avatar video…"
              }
              className="w-full bg-transparent px-4 pt-3 pb-2 text-[15px] leading-relaxed text-zinc-100 placeholder:text-zinc-600 outline-none resize-none min-h-[84px]"
              rows={3}
            />
            <div className="flex items-center justify-between px-3 pb-3">
              <div className="flex items-center gap-2 text-[11px] text-zinc-600">
                <span className="hidden sm:inline-flex items-center gap-1"><CornerDownLeft className="size-3" /> Ctrl+Enter to generate</span>
                <span>·</span>
                <span className="capitalize">{MODES.find((m) => m.id === mode)?.label}</span>
              </div>
              <Button variant="primary" onClick={go} icon={<Sparkles className="size-4" />}>
                Generate Video
              </Button>
            </div>
          </div>

          {/* examples */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => { setPrompt(ex); setMode("prompt"); taRef.current?.focus(); }}
                className="text-xs text-zinc-500 hover:text-violet-300 border border-white/[0.06] hover:border-violet-400/30 bg-white/[0.02] hover:bg-violet-500/[0.06] rounded-full px-3 py-1.5 transition-all cursor-pointer"
              >
                {ex}
              </button>
            ))}
          </div>
        </motion.div>
      </div>

      {/* STATS */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.22 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6"
      >
        {[
          { label: "Projects", value: loading ? "–" : String(projects.length), icon: FolderKanban, tone: "text-violet-300 bg-violet-500/10" },
          { label: "Minutes produced", value: loading ? "–" : String(totalMinutes), icon: Clock, tone: "text-sky-300 bg-sky-500/10" },
          { label: "Exports ready", value: loading ? "–" : String(projects.filter((p) => p.status === "completed").length), icon: Rocket, tone: "text-emerald-300 bg-emerald-500/10" },
          { label: "Cost so far", value: "$0.00", icon: TrendingUp, tone: "text-amber-300 bg-amber-500/10" },
        ].map((s) => (
          <Card key={s.label} className="p-4 flex items-center gap-3.5">
            <div className={`size-10 rounded-xl flex items-center justify-center ${s.tone}`}>
              <s.icon className="size-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-white font-display">{s.value}</div>
              <div className="text-xs text-zinc-500">{s.label}</div>
            </div>
          </Card>
        ))}
      </motion.div>

      {/* RECENT PROJECTS + TEMPLATES */}
      <div className="grid lg:grid-cols-3 gap-6 mt-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
          className="lg:col-span-2"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-lg text-zinc-100">Recent projects</h2>
            <Button variant="ghost" size="sm" onClick={() => router.push("/projects")}>
              View all <ArrowRight className="size-3.5" />
            </Button>
          </div>
          {loading ? (
            <div className="grid sm:grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => <div key={i} className="h-32 rounded-2xl bg-white/[0.04] animate-pulse" />)}
            </div>
          ) : projects.length === 0 ? (
            <Card className="py-12 flex flex-col items-center text-center">
              <div className="size-14 rounded-2xl bg-violet-500/10 flex items-center justify-center text-violet-300 mb-4">
                <Film className="size-7" />
              </div>
              <h3 className="font-semibold text-zinc-200">No projects yet</h3>
              <p className="text-sm text-zinc-500 mt-1.5 max-w-xs">
                Type an idea above and hit Generate — your first video is one prompt away.
              </p>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {projects.slice(0, 4).map((p) => (
                <Card
                  key={p.id}
                  interactive
                  className="p-4 cursor-pointer"
                  onClick={() => router.push(`/editor/${p.id}`)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="size-9 rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-500/10 border border-violet-400/20 flex items-center justify-center">
                      <Film className="size-4 text-violet-300" />
                    </div>
                    <Badge tone={p.status === "completed" ? "green" : p.status === "ready" ? "blue" : "zinc"}>{p.status}</Badge>
                  </div>
                  <h3 className="mt-3 font-medium text-[14px] text-zinc-100 leading-snug line-clamp-2">{p.title}</h3>
                  <p className="mt-1.5 text-[11px] text-zinc-500 capitalize">
                    {p.format.replace("top10", "Top 10")} · {p.aspect} · {prettyDuration(p.durationTargetSec)}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.38 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-lg text-zinc-100">Start from a template</h2>
            <Button variant="ghost" size="sm" onClick={() => router.push("/templates")}>
              All <ArrowRight className="size-3.5" />
            </Button>
          </div>
          <div className="space-y-2.5">
            {[
              { name: "Documentary", tpl: "tpl_documentary", color: "#e8c872", time: "~8 min", icon: Film },
              { name: "Top 10 Countdown", tpl: "tpl_top10", color: "#7c5cff", time: "~6 min", icon: TrendingUp },
              { name: "Shorts / Reels", tpl: "tpl_shorts", color: "#facc15", time: "~45 sec", icon: Zap },
              { name: "Explainer", tpl: "tpl_explainer", color: "#34d399", time: "~3 min", icon: LayoutTemplate },
            ].map((t) => (
              <Card
                key={t.name}
                interactive
                className="p-3.5 cursor-pointer flex items-center gap-3"
                onClick={() => router.push(`/create?template=${t.tpl}`)}
              >
                <span className="size-2.5 rounded-full shrink-0" style={{ background: t.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-100 truncate">{t.name}</p>
                  <p className="text-[11px] text-zinc-500">{t.time} · auto-structure</p>
                </div>
                <ArrowRight className="size-4 text-zinc-600" />
              </Card>
            ))}
          </div>
          <div className="hidden xl:flex items-center gap-3 mt-4 text-zinc-600 text-[11px]">
            <span className="tabular-nums text-2xl font-display text-zinc-500">{formatTime(0)}</span>
            <div className="flex-1 h-px bg-white/[0.06]" />
            <span>Zero subscriptions. Zero keys. Yours.</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
