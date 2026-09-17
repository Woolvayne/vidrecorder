"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Mic, MicOff,
  Download, Undo2, Redo2, Save, MessageSquareText, ChevronLeft, Clapperboard,
} from "lucide-react";
import { Button, Badge } from "@/components/ui";
import { useEditor } from "@/lib/store/editorStore";
import { drawFrame, preloadImages, sceneAt } from "@/lib/render/renderer";
import { MusicEngine } from "@/lib/audio/music";
import { speak, stopSpeaking } from "@/lib/voice/tts";
import { projectDuration } from "@/lib/ai/sceneBuilder";
import { formatTime, debounce } from "@/lib/utils";
import Timeline from "./Timeline";
import SidePanels, { PropertiesPanel } from "./SidePanels";
import AssistantPanel from "./AssistantPanel";
import ExportDialog from "./ExportDialog";

export default function EditorClient() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const playing = useEditor((s) => s.playing);
  const project = useEditor((s) => s.project);
  const playhead = useEditor((s) => s.playhead);
  const dirty = useEditor((s) => s.dirty);
  const [voiceOn, setVoiceOn] = useState(true);
  const [musicOn, setMusicOn] = useState(true);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const engineRef = useRef<{ music: MusicEngine | null; lastSceneIdx: number; speaking: boolean }>({ music: null, lastSceneIdx: -1, speaking: false });
  const lastTsRef = useRef<number>(0);

  const voiceOnRef = useRef(voiceOn);
  voiceOnRef.current = voiceOn;
  const musicOnRef = useRef(musicOn);
  musicOnRef.current = musicOn;

  const duration = project ? projectDuration(project.scenes) : 0;

  // ---------- save ----------
  const save = useCallback(async (manual = false) => {
    const st = useEditor.getState();
    if (!st.project || (!st.dirty && !manual)) return;
    setSaving(true);
    const p = st.project;
    // browser-cache (must never block the DB save)
    try {
      if (JSON.stringify(p).length < 3_500_000) localStorage.setItem(`freerush.project.${p.id}`, JSON.stringify(p));
    } catch { /* quota */ }
    try {
      await fetch(`/api/projects/${p.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: p.title, status: p.status, data: p, durationTargetSec: Math.round(projectDuration(p.scenes)) }),
      });
      st.markSaved();
    } catch { /* offline */ }
    setSaving(false);
  }, []);
  const autoSave = useRef(debounce(() => void save(), 1800)).current;
  useEffect(() => { if (dirty) autoSave(); }, [dirty, autoSave]);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const st = useEditor.getState();
      if (e.code === "Space") { e.preventDefault(); st.setPlaying(!st.playing); }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); st.undo(); }
      if ((e.metaKey || e.ctrlKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); st.redo(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); void save(true); }
      if (e.key === "Delete" || e.key === "Backspace") { if (st.selectedClipId) st.removeClip(st.selectedClipId); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  // preload visuals
  useEffect(() => {
    if (project?.scenes) void preloadImages(project.scenes.map((s) => s.visualUrl).filter(Boolean).slice(0, 40));
  }, [project?.scenes]);

  // music engine lifecycle
  useEffect(() => {
    const eng = engineRef.current;
    if (playing && project) {
      if (!eng.music) eng.music = new MusicEngine();
      if (musicOnRef.current && project.musicMood !== "none") eng.music.start(project.musicMood);
    } else {
      eng.music?.stop();
      stopSpeaking();
      eng.lastSceneIdx = -1;
      eng.speaking = false;
    }
    return () => { /* keep engine across renders */ };
  }, [playing, project]);

  useEffect(() => () => { engineRef.current.music?.dispose(); stopSpeaking(); }, []);

  // ---------- main render/playback loop ----------
  useEffect(() => {
    let raf = 0;
    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop);
      const st = useEditor.getState();
      const proj = st.project;
      const canvas = canvasRef.current;
      if (!canvas || !proj) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // advance playhead
      if (st.playing) {
        const dt = lastTsRef.current ? (ts - lastTsRef.current) / 1000 : 0;
        lastTsRef.current = ts;
        const total = projectDuration(proj.scenes);
        let t = st.playhead + dt;
        if (t >= total) {
          t = total;
          st.setPlaying(false);
          stopSpeaking();
        }
        st.setPlayhead(t);

        // voiceover per scene
        const { scene } = sceneAt(proj.scenes, t);
        const eng = engineRef.current;
        if (scene && scene.index !== eng.lastSceneIdx) {
          eng.lastSceneIdx = scene.index;
          if (voiceOnRef.current) {
            speak(scene.narration, proj.voice, {
              onStart: () => { eng.music?.setDucked(true); eng.speaking = true; },
              onEnd: () => { eng.music?.setDucked(false); eng.speaking = false; },
            });
          }
        }
      } else {
        lastTsRef.current = 0;
      }

      const { scene } = sceneAt(proj.scenes, st.playhead);
      drawFrame(ctx, canvas.width, canvas.height, {
        scenes: proj.scenes,
        captionStyle: proj.captionStyle,
        style: proj.style,
        textTrackClips: proj.timeline.find((tr) => tr.type === "text" && !tr.muted)?.clips ?? [],
        subtitlesMuted: proj.timeline.find((tr) => tr.type === "subtitle")?.muted ?? false,
        watermark: proj.mode === "avatar" ? undefined : "FREE RUSH",
        avatarUrl: proj.avatarUrl ?? undefined,
        cinematicBars: proj.style === "cinematic",
        speaking: engineRef.current.speaking,
      }, st.playhead);

      // scene marker overlay (DOM-light)
      const marker = document.getElementById("preview-scene-label");
      if (marker && scene) marker.textContent = `SCENE ${String(scene.index + 1).padStart(2, "0")} · ${scene.section.toUpperCase()}`;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!project) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center text-zinc-500">
        <Clapperboard className="size-10 mb-4 animate-pulse" />
        Loading project…
      </div>
    );
  }

  const canvasDims = project.aspect === "9:16" ? { w: 720, h: 1280 } : project.aspect === "1:1" ? { w: 960, h: 960 } : { w: 1280, h: 720 };
  const seekRel = (d: number) => useEditor.getState().setPlayhead(Math.min(duration, Math.max(0, useEditor.getState().playhead + d)));

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* editor top bar */}
      <div className="flex items-center gap-2 px-4 h-12 border-b border-white/[0.05] bg-[#0a0b10]">
        <button onClick={() => { void save(true); router.push("/projects"); }} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.05] cursor-pointer">
          <ChevronLeft className="size-5" />
        </button>
        <input
          value={project.title}
          onChange={(e) => useEditor.getState().patchProject({ title: e.target.value }, false)}
          className="bg-transparent text-sm font-medium text-zinc-100 outline-none border-b border-transparent focus:border-violet-400/50 px-1 py-0.5 w-56 lg:w-80"
        />
        <Badge tone={dirty ? "amber" : "green"} className="hidden sm:inline-flex">
          {saving ? "Saving…" : dirty ? "Unsaved changes" : "Autosaved"}
        </Badge>
        <div className="flex-1" />
        <Button size="xs" variant="ghost" icon={<Undo2 className="size-3.5" />} onClick={() => useEditor.getState().undo()}>Undo</Button>
        <Button size="xs" variant="ghost" icon={<Redo2 className="size-3.5" />} onClick={() => useEditor.getState().redo()}>Redo</Button>
        <Button size="xs" variant="soft" icon={<Save className="size-3.5" />} onClick={() => void save(true)}>Save</Button>
        <Button
          size="xs" variant={assistantOpen ? "primary" : "soft"} icon={<MessageSquareText className="size-3.5" />}
          onClick={() => setAssistantOpen((v) => !v)}
        >
          AI Assistant
        </Button>
        <Button size="sm" variant="primary" icon={<Download className="size-4" />} onClick={() => setExportOpen(true)}>Export</Button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* left tools */}
        <SidePanels />

        {/* center: preview + timeline */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* preview */}
          <div ref={wrapRef} className="flex-1 min-h-0 bg-grid flex items-center justify-center p-3 lg:p-5 relative">
            <div className="relative" style={{ aspectRatio: `${canvasDims.w}/${canvasDims.h}`, height: project.aspect === "9:16" ? "100%" : "auto", width: project.aspect === "9:16" ? "auto" : "100%", maxWidth: "100%", maxHeight: "100%" }}>
              <canvas
                ref={canvasRef}
                width={canvasDims.w}
                height={canvasDims.h}
                className="w-full h-full rounded-xl border border-white/10 bg-black shadow-2xl shadow-black/60"
              />
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <span id="preview-scene-label" className="text-[10px] font-mono font-semibold tracking-wider text-white/80 bg-black/50 backdrop-blur rounded-md px-2 py-1">
                  SCENE 01
                </span>
                {playing && voiceOn && (
                  <span className="flex items-end gap-[2px] h-4 px-2 bg-black/50 backdrop-blur rounded-md">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="eq-bar w-[3px] rounded bg-emerald-400" style={{ height: "100%", animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* transport */}
          <div className="flex items-center gap-2 px-4 h-12 border-t border-white/[0.05] bg-[#0b0c12]">
            <Button size="xs" variant="ghost" icon={<SkipBack className="size-4" />} onClick={() => seekRel(-5)} aria-label="Back 5s" />
            <Button
              size="sm" variant="primary" className="!rounded-full !px-4"
              icon={playing ? <Pause className="size-4" /> : <Play className="size-4" />}
              onClick={() => useEditor.getState().setPlaying(!playing)}
            >
              {playing ? "Pause" : "Play"}
            </Button>
            <Button size="xs" variant="ghost" icon={<SkipForward className="size-4" />} onClick={() => seekRel(5)} aria-label="Forward 5s" />
            <span className="text-xs font-mono text-zinc-400 tabular-nums ml-2">
              {formatTime(playhead)} <span className="text-zinc-600">/ {formatTime(duration)}</span>
            </span>
            <div className="flex-1" />
            <Button
              size="xs" variant={voiceOn ? "soft" : "ghost"} icon={voiceOn ? <Mic className="size-3.5 text-emerald-300" /> : <MicOff className="size-3.5" />}
              onClick={() => { setVoiceOn(!voiceOn); if (voiceOn) stopSpeaking(); }}
            >
              Voice
            </Button>
            <Button
              size="xs" variant={musicOn ? "soft" : "ghost"} icon={musicOn ? <Volume2 className="size-3.5 text-amber-300" /> : <VolumeX className="size-3.5" />}
              onClick={() => setMusicOn(!musicOn)}
            >
              Music
            </Button>
          </div>

          {/* timeline */}
          <Timeline />
        </div>

        {/* right: properties or assistant */}
        <div className="hidden xl:flex w-80 shrink-0 border-l border-white/[0.05] bg-[#0b0c12] flex-col min-h-0">
          {assistantOpen ? <AssistantPanel /> : <PropertiesPanel />}
        </div>
      </div>

      {/* mobile assistant toggle */}
      <div className="xl:hidden">
        {assistantOpen && (
          <div className="fixed inset-x-0 bottom-0 z-40 h-[60vh] border-t border-white/10 bg-[#0b0c12] rounded-t-2xl overflow-hidden">
            <AssistantPanel onClose={() => setAssistantOpen(false)} />
          </div>
        )}
      </div>

      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}
