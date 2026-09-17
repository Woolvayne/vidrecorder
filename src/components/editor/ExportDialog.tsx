"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Film, Check, AlertTriangle, Rocket, XCircle } from "lucide-react";
import { Button, Modal, Select, Field, ProgressBar } from "@/components/ui";
import { useEditor } from "@/lib/store/editorStore";
import { renderExport } from "@/lib/render/exporter";
import { projectDuration } from "@/lib/ai/sceneBuilder";
import { idbPut, downloadBlob, prettyBytes } from "@/lib/utils";
import type { ExportSettings } from "@/lib/types";

export default function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const project = useEditor((s) => s.project);
  const [settings, setSettings] = useState<ExportSettings | null>(null);
  const [phase, setPhase] = useState<"config" | "rendering" | "done" | "error">("config");
  const [pct, setPct] = useState(0);
  const [stage, setStage] = useState("");
  const [result, setResult] = useState<{ blob: Blob; ext: string; note: string; exportId: string } | null>(null);
  const [error, setError] = useState("");
  const cancelRef = useRef({ cancelled: false });

  const s = settings ?? project?.exportSettings ?? null;
  const set = (patch: Partial<ExportSettings>) => {
    const base = s!;
    const next = { ...base, ...patch };
    setSettings(next);
    useEditor.getState().patchProject({ exportSettings: next }, false);
  };

  const duration = project ? projectDuration(project.scenes) : 0;

  const run = async () => {
    if (!project || !s) return;
    setPhase("rendering");
    setPct(0);
    setError("");
    cancelRef.current = { cancelled: false };
    let exportId = "";
    try {
      const res = await fetch("/api/exports", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, title: project.title, status: "rendering", format: s.format, resolution: s.resolution, aspect: s.aspect, fps: s.fps }),
      });
      const j = await res.json();
      exportId = j.id ?? "";
    } catch { /* offline */ }

    try {
      const out = await renderExport({
        title: project.title,
        scenes: project.scenes,
        captionStyle: project.captionStyle,
        style: project.style,
        timeline: project.timeline,
        watermark: undefined,
        avatarUrl: project.avatarUrl,
        musicMood: project.musicMood,
        settings: s,
        muteMusic: project.timeline.find((t) => t.type === "music")?.muted ?? false,
        signal: cancelRef.current,
        onProgress: (p, st) => { setPct(p); setStage(st); },
      });
      const key = `export-${exportId || Date.now()}`;
      try { await idbPut(key, out.blob); } catch { /* storage full */ }
      if (exportId) {
        await fetch("/api/exports", {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: exportId, status: "done", size: out.blob.size }),
        });
      }
      await fetch(`/api/projects/${project.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      }).catch(() => {});
      setResult({ blob: out.blob, ext: out.ext, note: out.note, exportId: key });
      setPhase("done");
    } catch (e) {
      setError(String(e).includes("cancelled") ? "Export cancelled." : String(e));
      if (exportId) {
        await fetch("/api/exports", {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: exportId, status: "failed", error: String(e) }),
        }).catch(() => {});
      }
      setPhase("error");
    }
  };

  const reset = () => { setPhase("config"); setResult(null); setPct(0); };

  return (
    <Modal open={open} onClose={() => { if (phase !== "rendering") { onClose(); setTimeout(reset, 300); } }} title="Export video">
      {!project || !s ? null : phase === "config" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Format">
              <Select value={s.format} onChange={(e) => set({ format: e.target.value as ExportSettings["format"] })}>
                <option value="webm">WebM (VP9/VP8)</option>
                <option value="mp4">MP4 (H.264)</option>
              </Select>
            </Field>
            <Field label="Resolution">
              <Select value={s.resolution} onChange={(e) => set({ resolution: e.target.value as ExportSettings["resolution"] })}>
                <option value="720p">720p HD</option>
                <option value="1080p">1080p Full HD</option>
              </Select>
            </Field>
            <Field label="Aspect ratio">
              <Select value={s.aspect} onChange={(e) => set({ aspect: e.target.value as ExportSettings["aspect"] })}>
                <option value="16:9">16:9 YouTube</option>
                <option value="9:16">9:16 Shorts (1080×1920)</option>
                <option value="1:1">1:1 Social</option>
              </Select>
            </Field>
            <Field label="Frame rate">
              <Select value={String(s.fps)} onChange={(e) => set({ fps: Number(e.target.value) as ExportSettings["fps"] })}>
                <option value="24">24 fps</option><option value="30">30 fps</option><option value="60">60 fps</option>
              </Select>
            </Field>
          </div>
          <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3.5 flex items-center gap-3 text-sm">
            <Film className="size-4.5 text-violet-300 shrink-0" />
            <div>
              <p className="text-zinc-200 font-medium">{project.title}</p>
              <p className="text-xs text-zinc-500">{project.scenes.length} scenes · {Math.round(duration)}s · renders in real-time, fully local (no render farm, no queue, no cost)</p>
            </div>
          </div>
          <div className="rounded-xl bg-amber-500/[0.07] border border-amber-500/20 p-3.5 flex gap-3">
            <AlertTriangle className="size-4 text-amber-300 shrink-0 mt-0.5" />
            <p className="text-[12px] text-amber-200/85 leading-relaxed">
              Browser note: system voices (speech synthesis) cannot be captured into a recording by any browser —
              the export contains all visuals, captions, transitions, music and SFX. For voiced exports, record the
              preview with your OS screen recorder, or play the voiceover live over the rendered video.
            </p>
          </div>
          <Button variant="primary" size="lg" className="w-full" icon={<Rocket className="size-4" />} onClick={() => void run()}>
            Start local render
          </Button>
        </div>
      )}

      {phase === "rendering" && (
        <div className="py-6 space-y-5 text-center">
          <div className="size-16 mx-auto rounded-2xl bg-violet-500/15 border border-violet-400/30 flex items-center justify-center">
            <Film className="size-7 text-violet-300 animate-pulse" />
          </div>
          <div>
            <p className="font-medium text-zinc-100">{stage || "Rendering…"}</p>
            <p className="text-xs text-zinc-500 mt-1">{Math.round(pct * 100)}% · keep this tab focused</p>
          </div>
          <ProgressBar value={pct} className="max-w-sm mx-auto" />
          <Button variant="ghost" size="sm" icon={<XCircle className="size-4" />} onClick={() => { cancelRef.current.cancelled = true; }}>
            Cancel
          </Button>
        </div>
      )}

      {phase === "done" && result && (
        <div className="py-4 space-y-4 text-center">
          <div className="size-14 mx-auto rounded-full bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center">
            <Check className="size-6 text-emerald-300" />
          </div>
          <div>
            <p className="font-semibold text-zinc-100 text-lg">Export finished</p>
            <p className="text-sm text-zinc-500 mt-1">{result.ext.toUpperCase()} · {prettyBytes(result.blob.size)} · saved to your Exports page</p>
          </div>
          {result.note && (
            <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5">{result.note}</p>
          )}
          <div className="flex gap-2 justify-center">
            <Button variant="primary" icon={<Download className="size-4" />}
              onClick={() => downloadBlob(result.blob, `${(project?.title ?? "video").replace(/[^\w]+/g, "-").toLowerCase()}.${result.ext}`)}>
              Download {result.ext.toUpperCase()}
            </Button>
            <Button variant="outline" onClick={() => { onClose(); router.push("/exports"); setTimeout(reset, 300); }}>Go to Exports</Button>
          </div>
        </div>
      )}

      {phase === "error" && (
        <div className="py-6 text-center space-y-4">
          <div className="size-14 mx-auto rounded-full bg-rose-500/15 border border-rose-400/30 flex items-center justify-center">
            <XCircle className="size-6 text-rose-300" />
          </div>
          <p className="text-sm text-rose-300 max-w-sm mx-auto">{error}</p>
          <p className="text-xs text-zinc-500">This feature may be limited in your browser — try WebM format or a smaller resolution as a fallback.</p>
          <Button variant="outline" onClick={reset}>Try again</Button>
        </div>
      )}
    </Modal>
  );
}
