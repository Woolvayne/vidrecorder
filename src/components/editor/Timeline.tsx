"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ZoomIn, ZoomOut, Magnet, Scissors, Copy, Trash2, Type, Volume2, VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui";
import { useEditor } from "@/lib/store/editorStore";
import { formatTime, clamp } from "@/lib/utils";
import type { Clip } from "@/lib/types";

const HEADER_W = 144;

export default function Timeline() {
  const project = useEditor((s) => s.project);
  const zoom = useEditor((s) => s.zoom);
  const playhead = useEditor((s) => s.playhead);
  const snap = useEditor((s) => s.snap);
  const selectedClipId = useEditor((s) => s.selectedClipId);
  const selectedSceneId = useEditor((s) => s.selectedSceneId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ id: string; mode: "move" | "trim-l" | "trim-r"; startX: number; origStart: number; origDur: number; origOffset: number } | null>(null);

  const duration = project ? Math.max(30, useEditor.getState().projectDuration() + 6) : 60;
  const contentW = duration * zoom;

  const timeFromClientX = useCallback(
    (clientX: number) => {
      const el = scrollRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      return clamp((clientX - rect.left + el.scrollLeft - HEADER_W) / zoom, 0, duration);
    },
    [zoom, duration]
  );

  const rulerDown = (e: React.PointerEvent) => {
    const t = timeFromClientX(e.clientX);
    useEditor.getState().setPlayhead(t);
    const move = (ev: PointerEvent) => useEditor.getState().setPlayhead(timeFromClientX(ev.clientX));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const snapTime = useCallback((t: number) => {
    if (!useEditor.getState().snap) return Math.round(t * 100) / 100;
    const targets: number[] = [0, useEditor.getState().playhead];
    const proj = useEditor.getState().project;
    proj?.timeline.forEach((tr) => tr.clips.forEach((c) => { targets.push(c.start, c.start + c.duration); }));
    proj?.scenes.forEach((s) => { targets.push(s.start, s.start + s.duration); });
    let best = Math.round(t * 2) / 2;
    for (const target of targets) {
      if (Math.abs(t - target) < 8 / useEditor.getState().zoom) best = target;
    }
    return Math.max(0, Math.round(best * 1000) / 1000);
  }, []);

  const onClipPointerDown = (e: React.PointerEvent, clip: Clip, mode: "move" | "trim-l" | "trim-r") => {
    e.stopPropagation();
    e.preventDefault();
    const st = useEditor.getState();
    if (clip.sceneId) st.selectScene(clip.sceneId); else st.selectClip(clip.id);
    // push history once before drag
    st.updateClip(clip.id, {}, true);
    setDrag({ id: clip.id, mode, startX: e.clientX, origStart: clip.start, origDur: clip.duration, origOffset: clip.offset });
  };

  useEffect(() => {
    if (!drag) return;
    document.body.classList.add("cursor-grabbing-imp");
    const move = (e: PointerEvent) => {
      const st = useEditor.getState();
      const dx = (e.clientX - drag.startX) / st.zoom;
      if (drag.mode === "move") {
        const ns = snapTime(drag.origStart + dx);
        st.updateClip(drag.id, { start: Math.max(0, ns) }, false);
      } else if (drag.mode === "trim-l") {
        let ns = snapTime(drag.origStart + dx);
        ns = clamp(ns, 0, drag.origStart + drag.origDur - 0.25);
        const delta = ns - drag.origStart;
        st.updateClip(drag.id, { start: ns, duration: drag.origDur - delta, offset: drag.origOffset + delta }, false);
      } else {
        let nd = drag.origDur + dx;
        nd = clamp(nd, 0.25, 600);
        const endTarget = snapTime(drag.origStart + nd);
        nd = Math.max(0.25, endTarget - drag.origStart);
        st.updateClip(drag.id, { duration: nd }, false);
      }
    };
    const up = () => {
      setDrag(null);
      document.body.classList.remove("cursor-grabbing-imp");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      document.body.classList.remove("cursor-grabbing-imp");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [drag, snapTime]);

  if (!project) return null;
  const st = useEditor.getState();

  const selectedClip = selectedClipId
    ? project.timeline.flatMap((t) => t.clips).find((c) => c.id === selectedClipId)
    : null;

  // ruler ticks
  const tickEvery = zoom > 30 ? 1 : zoom > 12 ? 2 : zoom > 7 ? 5 : 10;
  const ticks: number[] = [];
  for (let t = 0; t <= duration; t += tickEvery) ticks.push(t);

  return (
    <div className="border-t border-white/[0.05] bg-[#090a0f] flex flex-col select-none" style={{ height: 258 }}>
      {/* timeline toolbar */}
      <div className="flex items-center gap-1.5 px-3 h-9 border-b border-white/[0.05]">
        <Button size="xs" variant={selectedClip ? "soft" : "ghost"} disabled={!selectedClip}
          icon={<Scissors className="size-3.5" />}
          onClick={() => selectedClip && st.splitClipAt(selectedClip.id, st.playhead)}>
          Split
        </Button>
        <Button size="xs" variant="ghost" disabled={!selectedClip} icon={<Copy className="size-3.5" />}
          onClick={() => selectedClip && st.duplicateClip(selectedClip.id)}>Duplicate</Button>
        <Button size="xs" variant="ghost" disabled={!selectedClip} icon={<Trash2 className="size-3.5" />}
          onClick={() => selectedClip && st.removeClip(selectedClip.id)}>Delete</Button>
        <Button size="xs" variant="ghost" icon={<Type className="size-3.5" />}
          onClick={() => st.addClip("tr_text", { label: "Text", start: st.playhead, duration: 3, payload: { text: "New text", size: 64, color: "#ffffff", position: "center" } })}>
          Text
        </Button>
        <div className="flex-1" />
        <Button size="xs" variant={snap ? "soft" : "ghost"} icon={<Magnet className="size-3.5" />} onClick={() => useEditor.getState().toggleSnap()}>
          Snap
        </Button>
        <ZoomOut className="size-3.5 text-zinc-500 cursor-pointer hover:text-zinc-200" onClick={() => useEditor.getState().setZoom(zoom - 4)} />
        <input type="range" min={4} max={60} value={zoom} onChange={(e) => useEditor.getState().setZoom(Number(e.target.value))} className="w-24 accent-violet-500 h-1" />
        <ZoomIn className="size-3.5 text-zinc-500 cursor-pointer hover:text-zinc-200" onClick={() => useEditor.getState().setZoom(zoom + 4)} />
      </div>

      {/* scrollable area */}
      <div ref={scrollRef} className="flex-1 overflow-auto relative" onClick={() => { st.selectClip(null); st.selectScene(null); }}>
        <div style={{ width: contentW + HEADER_W, minWidth: "100%" }} className="relative">
          {/* ruler */}
          <div className="sticky top-0 z-20 h-6 bg-[#0c0d13] border-b border-white/[0.06] flex" onPointerDown={rulerDown}>
            <div style={{ width: HEADER_W }} className="shrink-0 sticky left-0 bg-[#0c0d13] z-10 border-r border-white/[0.06]" />
            <div className="relative flex-1 cursor-ew-resize" style={{ width: contentW }}>
              {ticks.map((t) => (
                <div key={t} className="absolute top-0 h-full flex flex-col items-center" style={{ left: t * zoom }}>
                  <span className="text-[9px] font-mono text-zinc-600 leading-none mt-0.5 -translate-x-1/2">{formatTime(t)}</span>
                  <span className="w-px flex-1 bg-white/[0.09]" />
                </div>
              ))}
            </div>
          </div>

          {/* tracks */}
          {project.timeline.map((track) => (
            <div key={track.id} className="flex h-10.5 border-b border-white/[0.04] relative"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const sfx = e.dataTransfer.getData("freerush/sfx");
                if (sfx && track.type === "sfx") {
                  const t = snapTime(timeFromClientX(e.clientX));
                  st.addClip(track.id, { label: sfx, start: t, duration: 1.2, payload: { sfx } });
                }
              }}
            >
              <div style={{ width: HEADER_W }} className="shrink-0 sticky left-0 z-10 bg-[#0b0c11] border-r border-white/[0.06] flex items-center gap-1.5 px-3">
                <span className={`size-1.5 rounded-full ${track.muted ? "bg-zinc-700" : ""}`} style={track.muted ? {} : { background: track.clips[0]?.color ?? "#666" }} />
                <span className="text-[11px] text-zinc-400 truncate flex-1">{track.name}</span>
                <button
                  className="text-zinc-600 hover:text-zinc-300 cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); st.setTrackMuted(track.id, !track.muted); }}
                  title={track.muted ? "Unmute" : "Mute"}
                >
                  {track.muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
                </button>
              </div>
              <div className="relative flex-1" style={{ width: contentW, opacity: track.muted ? 0.45 : 1 }}
                onDoubleClick={(e) => {
                  if (track.type === "text" || track.type === "sfx") {
                    const t = snapTime(timeFromClientX(e.clientX));
                    st.addClip(track.id, track.type === "text"
                      ? { label: "Text", start: t, duration: 3, payload: { text: "New text", size: 64, color: "#ffffff", position: "center" } }
                      : { label: "whoosh", start: t, duration: 1.2, payload: { sfx: "whoosh" } });
                  }
                }}
              >
                {track.clips.map((clip) => {
                  const isSel = clip.id === selectedClipId || (clip.sceneId && clip.sceneId === selectedSceneId);
                  return (
                    <div
                      key={clip.id}
                      onPointerDown={(e) => onClipPointerDown(e, clip, "move")}
                      onClick={(e) => e.stopPropagation()}
                      className={`absolute top-1 bottom-1 rounded-md overflow-hidden cursor-grab active:cursor-grabbing group transition-shadow ${
                        isSel ? "ring-2 ring-white/80 z-10" : "ring-1 ring-black/40"
                      }`}
                      style={{
                        left: clip.start * zoom,
                        width: Math.max(10, clip.duration * zoom),
                        background: `linear-gradient(180deg, ${clip.color ?? "#7c5cff"}33, ${clip.color ?? "#7c5cff"}1f)`,
                        borderLeft: `3px solid ${clip.color ?? "#7c5cff"}`,
                      }}
                    >
                      <div className="px-1.5 py-0.5 text-[9.5px] leading-tight font-medium text-white/85 truncate pointer-events-none">
                        {clip.label}
                      </div>
                      {/* trim handles */}
                      <div
                        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-white/25"
                        onPointerDown={(e) => onClipPointerDown(e, clip, "trim-l")}
                      />
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-white/25"
                        onPointerDown={(e) => onClipPointerDown(e, clip, "trim-r")}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* playhead */}
          <div className="absolute top-0 bottom-0 z-30 pointer-events-none" style={{ left: HEADER_W + playhead * zoom }}>
            <div className="absolute top-0 bottom-0 w-px bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]" />
            <div className="absolute -top-0 -translate-x-1/2 w-2.5 h-2.5 rotate-45 bg-rose-400" />
          </div>
        </div>
      </div>
    </div>
  );
}
