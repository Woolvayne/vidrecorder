"use client";
import { useEffect, useRef, useState } from "react";
import {
  Image as ImageIcon, Type, AudioLines, Blend, Sparkles, LayoutTemplate,
  FolderOpen, Play, Plus, RefreshCw, Trash2, Wand2, Search, Upload, Layers,
} from "lucide-react";
import { Button, Badge, Input, Select, Field, SliderRow, Textarea } from "@/components/ui";
import { useEditor } from "@/lib/store/editorStore";
import { searchFreeImages } from "@/lib/ai/research";
import { playSfx } from "@/lib/audio/sfx";
import { previewVoice, voiceOptions } from "@/lib/voice/tts";
import { CAPTION_PRESETS, MOOD_META, SFX_LIBRARY, TEMPLATES } from "@/lib/data/templates";
import { sceneAt } from "@/lib/render/renderer";
import type { MediaItem, TransitionType, MusicMood } from "@/lib/types";
import { uid } from "@/lib/utils";

const TABS = [
  { id: "media", label: "Media", icon: ImageIcon },
  { id: "text", label: "Text", icon: Type },
  { id: "audio", label: "Audio", icon: AudioLines },
  { id: "transitions", label: "Transitions", icon: Blend },
  { id: "animations", label: "Animations", icon: Sparkles },
  { id: "templates", label: "Templates", icon: LayoutTemplate },
  { id: "files", label: "Files", icon: FolderOpen },
] as const;
type TabId = (typeof TABS)[number]["id"];

function sceneAtPlayhead() {
  const st = useEditor.getState();
  const proj = st.project;
  if (!proj || !proj.scenes.length) return null;
  return sceneAt(proj.scenes, st.playhead).scene;
}

function MediaTab() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => fetch("/api/media").then((r) => r.json()).then((j) => setItems(j.media ?? [])).catch(() => {});
  useEffect(() => { load(); }, []);

  const assign = (url: string, kind: "image" | "upload" = "image") => {
    const st = useEditor.getState();
    const scene = st.selectedSceneId ? proj().scenes.find((s) => s.id === st.selectedSceneId) : sceneAtPlayhead();
    if (scene) st.updateScene(scene.id, { visualUrl: url, visualKind: kind });
  };
  const proj = () => useEditor.getState().project!;

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    const lang = proj()?.language ?? "en";
    setResults(await searchFreeImages(query, lang));
    setSearching(false);
  };

  const upload = (file: File) => {
    if (file.size > 6 * 1024 * 1024) { alert("Keep uploads under ~6 MB in free local mode."); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      const url = String(reader.result);
      await fetch("/api/media", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, type: file.type.startsWith("video") ? "video" : file.type.startsWith("audio") ? "audio" : "image", category: "uploads", url, size: file.size, duration: 0, tags: [] }),
      });
      load();
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-600" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void search()}
            placeholder="Free image search…" className="!h-8 pl-8 text-xs" />
        </div>
        <Button size="sm" variant="soft" onClick={() => void search()} loading={searching}>Find</Button>
      </div>
      {results.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1.5">Free results · click to assign</p>
          <div className="grid grid-cols-3 gap-1.5">
            {results.slice(0, 9).map((url) => (
              <button key={url} onClick={() => assign(url)} className="aspect-video rounded-lg overflow-hidden border border-white/10 hover:border-violet-400/60 cursor-pointer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        </div>
      )}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] uppercase tracking-widest text-zinc-600">Your library</p>
          <button onClick={() => fileRef.current?.click()} className="text-[10px] text-violet-300 hover:text-violet-200 flex items-center gap-1 cursor-pointer">
            <Upload className="size-3" /> Upload
          </button>
          <input ref={fileRef} type="file" className="hidden" accept="image/*,video/*,audio/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
        </div>
        {items.length === 0 ? (
          <p className="text-[11px] text-zinc-600 bg-white/[0.03] rounded-lg p-3">No uploads yet. Add files or use free search above.</p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {items.slice(0, 12).map((it) => (
              <button key={it.id} onClick={() => assign(it.url, "upload")} title={it.name}
                className="aspect-video rounded-lg overflow-hidden border border-white/10 hover:border-violet-400/60 cursor-pointer bg-white/[0.04] flex items-center justify-center">
                {it.type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.url} alt={it.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <Layers className="size-4 text-zinc-500" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TextTab() {
  const add = (preset: string) => {
    const st = useEditor.getState();
    const map: Record<string, { text: string; size: number; color: string; position: string }> = {
      title: { text: "BIG TITLE", size: 84, color: "#ffffff", position: "center" },
      lower: { text: "Lower third caption", size: 44, color: "#ffffff", position: "bottom" },
      top: { text: "Top banner", size: 48, color: "#fde047", position: "top" },
    };
    const p = map[preset];
    st.addClip("tr_text", { label: p.text, start: st.playhead, duration: 3.5, payload: { ...p } });
  };
  return (
    <div className="space-y-2">
      {[
        { id: "title", name: "Big Title", desc: "Centered, huge, bold" },
        { id: "lower", name: "Lower Third", desc: "Bottom banner caption" },
        { id: "top", name: "Top Banner", desc: "Accent headline on top" },
      ].map((p) => (
        <button key={p.id} onClick={() => add(p.id)}
          className="w-full text-left rounded-xl border border-white/[0.07] hover:border-violet-400/40 bg-white/[0.03] hover:bg-violet-500/[0.06] px-3.5 py-3 transition-colors cursor-pointer">
          <p className="text-[13px] font-medium text-zinc-100">{p.name}</p>
          <p className="text-[11px] text-zinc-500">{p.desc}</p>
        </button>
      ))}
      <p className="text-[11px] text-zinc-600 pt-1">Text is placed at the playhead — move or trim it on the Text Overlay track.</p>
    </div>
  );
}

function AudioTab() {
  const project = useEditor((s) => s.project);
  const st = useEditor.getState;
  const setMood = (mood: MusicMood) => {
    const proj = st().project;
    if (!proj) return;
    const total = proj.scenes.length ? proj.scenes[proj.scenes.length - 1].start + proj.scenes[proj.scenes.length - 1].duration : 10;
    const timeline = proj.timeline.map((tr) =>
      tr.type === "music"
        ? { ...tr, clips: mood === "none" ? [] : [{ id: uid("clip"), trackId: tr.id, type: "music" as const, label: `Music · ${mood}`, start: 0, duration: total, offset: 0, color: "#f59e0b", payload: { mood } }] }
        : tr
    );
    st().patchProject({ musicMood: mood, timeline });
  };
  const cats = [...new Set(SFX_LIBRARY.map((s) => s.category))];
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1.5">Procedural music · auto-ducked</p>
        <div className="space-y-1">
          {Object.entries(MOOD_META).map(([id, m]) => (
            <button key={id} onClick={() => setMood(id as MusicMood)}
              className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors cursor-pointer ${
                project?.musicMood === id ? "bg-amber-500/15 border border-amber-500/30" : "hover:bg-white/[0.04] border border-transparent"
              }`}>
              <span className={`size-1.5 rounded-full ${project?.musicMood === id ? "bg-amber-300" : "bg-zinc-700"}`} />
              <span className="text-[12.5px] text-zinc-200 flex-1">{m.label}</span>
              <span className="text-[10px] text-zinc-600">{m.desc}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1.5">SFX library · synthesized</p>
        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
          {cats.map((cat) => (
            <div key={cat}>
              <p className="text-[10px] text-zinc-500 mb-1">{cat}</p>
              <div className="flex flex-wrap gap-1.5">
                {SFX_LIBRARY.filter((s) => s.category === cat).map((sfx) => (
                  <div key={sfx.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("freerush/sfx", sfx.id)}
                    className="flex items-center gap-1 rounded-lg bg-white/[0.04] border border-white/[0.07] hover:border-pink-400/40 pl-1 pr-2 py-1 cursor-grab">
                    <button onClick={() => playSfx(sfx.id)} className="p-1 text-zinc-400 hover:text-pink-300 cursor-pointer" title="Preview">
                      <Play className="size-3" />
                    </button>
                    <button className="text-[11px] text-zinc-300 hover:text-white cursor-pointer"
                      onClick={() => { const s = st(); s.addClip("tr_sfx", { label: sfx.id, start: s.playhead, duration: 1.2, payload: { sfx: sfx.id } }); }}
                      title="Add at playhead">
                      {sfx.name}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-zinc-600 mt-2">Drag SFX onto the Sound FX track or click the name to drop at playhead.</p>
      </div>
    </div>
  );
}

const TRANSITIONS: { id: TransitionType; name: string; desc: string }[] = [
  { id: "cut", name: "Hard Cut", desc: "Instant switch" },
  { id: "fade", name: "Crossfade", desc: "Smooth blend" },
  { id: "slide", name: "Slide", desc: "Pushes in from the right" },
  { id: "zoom", name: "Zoom In", desc: "Scales into frame" },
  { id: "wipe", name: "Wipe", desc: "Reveals left to right" },
];

function TransitionsTab() {
  const selectedSceneId = useEditor((s) => s.selectedSceneId);
  const apply = (t: TransitionType) => {
    const st = useEditor.getState();
    const scene = selectedSceneId ? st.project?.scenes.find((s) => s.id === selectedSceneId) : sceneAtPlayhead();
    if (scene) st.updateScene(scene.id, { transition: t });
  };
  return (
    <div className="space-y-2">
      {TRANSITIONS.map((t) => (
        <button key={t.id} onClick={() => apply(t.id)}
          className="w-full text-left rounded-xl border border-white/[0.07] hover:border-sky-400/40 bg-white/[0.03] hover:bg-sky-500/[0.06] px-3.5 py-3 transition-colors cursor-pointer">
          <p className="text-[13px] font-medium text-zinc-100">{t.name}</p>
          <p className="text-[11px] text-zinc-500">{t.desc}</p>
        </button>
      ))}
      <p className="text-[11px] text-zinc-600">Applies to the selected scene (or scene at playhead).</p>
    </div>
  );
}

function AnimationsTab() {
  const project = useEditor((s) => s.project);
  const set = (patch: Partial<NonNullable<typeof project>["captionStyle"]>) => {
    const st = useEditor.getState();
    if (st.project) st.patchProject({ captionStyle: { ...st.project.captionStyle, ...patch } });
  };
  if (!project) return null;
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1.5">Caption entrance</p>
        <div className="grid grid-cols-2 gap-1.5">
          {(["none", "fade", "pop", "rise"] as const).map((a) => (
            <button key={a} onClick={() => set({ animation: a })}
              className={`rounded-lg px-3 py-2 text-[12.5px] capitalize cursor-pointer transition-colors ${
                project.captionStyle.animation === a ? "bg-violet-500/20 border border-violet-400/40 text-violet-200" : "bg-white/[0.03] border border-white/[0.07] text-zinc-300 hover:border-white/20"
              }`}>{a}</button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1.5">Caption timing</p>
        <div className="grid grid-cols-2 gap-1.5">
          {(["word", "sentence"] as const).map((m) => (
            <button key={m} onClick={() => set({ mode: m })}
              className={`rounded-lg px-3 py-2 text-[12.5px] cursor-pointer transition-colors ${
                project.captionStyle.mode === m ? "bg-violet-500/20 border border-violet-400/40 text-violet-200" : "bg-white/[0.03] border border-white/[0.07] text-zinc-300 hover:border-white/20"
              }`}>{m === "word" ? "Word-by-word" : "Sentence"}</button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1.5">Position</p>
        <div className="grid grid-cols-3 gap-1.5">
          {(["top", "center", "bottom"] as const).map((p) => (
            <button key={p} onClick={() => set({ position: p })}
              className={`rounded-lg px-2 py-2 text-[12px] capitalize cursor-pointer transition-colors ${
                project.captionStyle.position === p ? "bg-violet-500/20 border border-violet-400/40 text-violet-200" : "bg-white/[0.03] border border-white/[0.07] text-zinc-300 hover:border-white/20"
              }`}>{p}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TemplatesTab() {
  const applyTemplate = (tplId: string) => {
    const tpl = TEMPLATES.find((t) => t.id === tplId);
    const st = useEditor.getState();
    const proj = st.project;
    if (!tpl || !proj) return;
    const scenes = proj.scenes.map((s, i) => ({ ...s, transition: tpl.transitions[i % tpl.transitions.length] }));
    const total = scenes.length ? scenes[scenes.length - 1].start + scenes[scenes.length - 1].duration : 10;
    const timeline = proj.timeline.map((tr) => {
      if (tr.type === "music") return { ...tr, clips: [{ id: uid("clip"), trackId: tr.id, type: "music" as const, label: `Music · ${tpl.musicMood}`, start: 0, duration: total, offset: 0, color: "#f59e0b", payload: { mood: tpl.musicMood } }] };
      return tr;
    });
    st.patchProject({
      scenes, timeline, musicMood: tpl.musicMood,
      captionStyle: { ...CAPTION_PRESETS[tpl.captionPreset] },
      style: tpl.pace === "slow" ? "cinematic" : proj.style,
    });
  };
  return (
    <div className="space-y-2">
      {TEMPLATES.map((t) => (
        <button key={t.id} onClick={() => applyTemplate(t.id)}
          className="w-full text-left rounded-xl border border-white/[0.07] hover:border-violet-400/40 bg-white/[0.03] hover:bg-violet-500/[0.06] px-3.5 py-3 transition-colors cursor-pointer">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full" style={{ background: t.color }} />
            <p className="text-[13px] font-medium text-zinc-100">{t.name}</p>
            <Badge tone="zinc" className="ml-auto !h-4.5 !text-[9px]">{t.aspect}</Badge>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{t.description}</p>
        </button>
      ))}
    </div>
  );
}

function FilesTab() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const load = () => fetch("/api/media").then((r) => r.json()).then((j) => setItems(j.media ?? [])).catch(() => {});
  useEffect(() => { load(); }, []);
  const upload = (file: File) => {
    if (file.size > 6 * 1024 * 1024) { alert("Keep uploads under ~6 MB in free local mode."); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      await fetch("/api/media", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, type: file.type.startsWith("video") ? "video" : file.type.startsWith("audio") ? "audio" : "image", category: "uploads", url: String(reader.result), size: file.size, duration: 0, tags: [] }),
      });
      load();
    };
    reader.readAsDataURL(file);
  };
  return (
    <div className="space-y-2">
      <Button variant="outline" size="sm" className="w-full" icon={<Upload className="size-3.5" />} onClick={() => fileRef.current?.click()}>Upload file</Button>
      <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
      <div className="space-y-1 max-h-80 overflow-y-auto">
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2.5 py-2">
            <Layers className="size-3.5 text-zinc-500 shrink-0" />
            <span className="text-[11.5px] text-zinc-300 truncate flex-1">{it.name}</span>
            <Badge tone="zinc" className="!h-4.5 !text-[9px]">{it.type}</Badge>
            <button className="text-zinc-600 hover:text-rose-300 cursor-pointer" onClick={async () => { await fetch("/api/media", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: it.id }) }); load(); }}>
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
        {!items.length && <p className="text-[11px] text-zinc-600 p-2">Nothing uploaded yet.</p>}
      </div>
    </div>
  );
}

export default function SidePanels() {
  const [tab, setTab] = useState<TabId>("media");
  return (
    <div className="hidden md:flex w-16 lg:w-72 shrink-0 border-r border-white/[0.05] bg-[#0b0c12] min-h-0">
      <div className="flex lg:hidden flex-col items-center py-3 gap-1 w-16 border-r border-white/[0.05]">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} title={t.label}
            className={`p-2.5 rounded-xl cursor-pointer ${tab === t.id ? "bg-violet-500/20 text-violet-300" : "text-zinc-500 hover:text-zinc-200"}`}>
            <t.icon className="size-4.5" />
          </button>
        ))}
      </div>
      <div className="hidden lg:flex flex-col flex-1 min-h-0">
        <div className="flex flex-wrap gap-1 p-3 border-b border-white/[0.05]">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-medium cursor-pointer transition-colors ${
                tab === t.id ? "bg-violet-500/20 text-violet-200" : "text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]"
              }`}>
              <t.icon className="size-3.5" /> {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-3.5">
          {tab === "media" && <MediaTab />}
          {tab === "text" && <TextTab />}
          {tab === "audio" && <AudioTab />}
          {tab === "transitions" && <TransitionsTab />}
          {tab === "animations" && <AnimationsTab />}
          {tab === "templates" && <TemplatesTab />}
          {tab === "files" && <FilesTab />}
        </div>
      </div>
    </div>
  );
}

// ================= PROPERTIES PANEL =================
export function PropertiesPanel() {
  const project = useEditor((s) => s.project);
  const selectedSceneId = useEditor((s) => s.selectedSceneId);
  const selectedClipId = useEditor((s) => s.selectedClipId);
  const [visualBusy, setVisualBusy] = useState(false);
  if (!project) return null;
  const st = useEditor.getState();

  const scene = selectedSceneId ? project.scenes.find((s) => s.id === selectedSceneId) : null;
  const clip = selectedClipId ? project.timeline.flatMap((t) => t.clips).find((c) => c.id === selectedClipId) : null;

  const newVisual = async () => {
    if (!scene) return;
    setVisualBusy(true);
    const imgs = await searchFreeImages(scene.visualQuery || project.title, project.language);
    if (imgs[0]) st.updateScene(scene.id, { visualUrl: imgs[0], visualKind: "image" });
    setVisualBusy(false);
  };

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="px-4 h-11 flex items-center border-b border-white/[0.05]">
        <h3 className="text-[13px] font-semibold text-zinc-200">
          {scene ? `Scene ${scene.index + 1} Properties` : clip ? "Clip Properties" : "Project Settings"}
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {scene && (
          <>
            <Field label="Narration">
              <Textarea rows={4} value={scene.narration} onChange={(e) => st.updateScene(scene.id, { narration: e.target.value })} className="!text-[12.5px]" />
            </Field>
            <Field label="Visual">
              <div className="rounded-xl overflow-hidden border border-white/10 aspect-video bg-black/40 mb-2">
                {scene.visualUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={scene.visualUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">Auto-generated gradient</div>
                )}
              </div>
              <Input value={scene.visualQuery} onChange={(e) => st.updateScene(scene.id, { visualQuery: e.target.value })} className="!h-8 text-xs mb-2" placeholder="Visual search query…" />
              <div className="flex gap-2">
                <Button size="xs" variant="soft" icon={<RefreshCw className="size-3" />} loading={visualBusy} onClick={() => void newVisual()}>New visual</Button>
                <Button size="xs" variant="ghost" onClick={() => st.updateScene(scene.id, { visualUrl: "", visualKind: "color" })}>Use gradient</Button>
              </div>
            </Field>
            <Field label={`Duration · ${scene.duration.toFixed(1)}s`}>
              <input type="range" min={1.5} max={20} step={0.1} value={scene.duration}
                onChange={(e) => st.updateScene(scene.id, { duration: Number(e.target.value) })} className="w-full accent-violet-500" />
            </Field>
            <Field label="Transition">
              <Select value={scene.transition} onChange={(e) => st.updateScene(scene.id, { transition: e.target.value as TransitionType })}>
                {TRANSITIONS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </Field>
            <Field label="Text overlay">
              <Input value={scene.overlay} onChange={(e) => st.updateScene(scene.id, { overlay: e.target.value })} placeholder="On-screen headline…" />
            </Field>
            <Field label="Sound effect on entry">
              <Select value={scene.sfx} onChange={(e) => st.updateScene(scene.id, { sfx: e.target.value })}>
                <option value="">None</option>
                {SFX_LIBRARY.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
            <Button variant="danger" size="sm" className="w-full" icon={<Trash2 className="size-3.5" />}
              onClick={() => st.removeSceneAt(scene.index)}>Delete scene</Button>
          </>
        )}

        {!scene && clip && clip.type === "text" && (
          <>
            <Field label="Text">
              <Input value={String(clip.payload?.text ?? "")} onChange={(e) => st.updateClip(clip.id, { label: e.target.value, payload: { ...clip.payload, text: e.target.value } }, false)} />
            </Field>
            <Field label="Size">
              <SliderRow label="Size" value={Number(clip.payload?.size ?? 64)} min={28} max={140}
                onChange={(v) => st.updateClip(clip.id, { payload: { ...clip.payload, size: v } }, false)} />
            </Field>
            <Field label="Color">
              <input type="color" value={String(clip.payload?.color ?? "#ffffff")}
                onChange={(e) => st.updateClip(clip.id, { payload: { ...clip.payload, color: e.target.value } }, false)}
                className="w-full h-9 rounded-lg bg-transparent border border-white/10 cursor-pointer" />
            </Field>
            <Field label="Position">
              <Select value={String(clip.payload?.position ?? "center")}
                onChange={(e) => st.updateClip(clip.id, { payload: { ...clip.payload, position: e.target.value } }, false)}>
                <option value="top">Top</option><option value="center">Center</option><option value="bottom">Bottom</option>
              </Select>
            </Field>
          </>
        )}

        {!scene && clip && clip.type === "sfx" && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-300 capitalize">SFX: {String(clip.payload?.sfx ?? clip.label)}</p>
            <div className="flex gap-2">
              <Button size="xs" variant="soft" icon={<Play className="size-3" />} onClick={() => playSfx(String(clip.payload?.sfx ?? clip.label))}>Preview</Button>
              <Button size="xs" variant="danger" icon={<Trash2 className="size-3" />} onClick={() => st.removeClip(clip.id)}>Delete</Button>
            </div>
          </div>
        )}

        {!scene && !clip && (
          <>
            <Field label="Caption preset">
              <div className="grid grid-cols-2 gap-1.5">
                {Object.keys(CAPTION_PRESETS).map((k) => (
                  <button key={k} onClick={() => st.patchProject({ captionStyle: { ...CAPTION_PRESETS[k], size: project.captionStyle.size, position: project.captionStyle.position } })}
                    className={`rounded-lg px-2.5 py-2 text-[12px] capitalize cursor-pointer transition-colors ${
                      project.captionStyle.preset === k ? "bg-violet-500/20 border border-violet-400/40 text-violet-200" : "bg-white/[0.03] border border-white/[0.07] text-zinc-300 hover:border-white/20"
                    }`}>{k}</button>
                ))}
              </div>
            </Field>
            <SliderRow label="Caption px" value={project.captionStyle.size} min={28} max={100}
              onChange={(v) => st.patchProject({ captionStyle: { ...project.captionStyle, size: v } }, false)} />
            <Field label="Voiceover">
              <Select value={project.voice.voiceURI} onChange={(e) => st.patchProject({ voice: { ...project.voice, voiceURI: e.target.value } }, false)}>
                <option value="">Auto ({project.language.toUpperCase()})</option>
                {voiceOptions(project.language).slice(0, 12).map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}
              </Select>
            </Field>
            <SliderRow label="Speed" value={project.voice.rate} min={0.6} max={1.6} step={0.05} format={(v) => `${v.toFixed(2)}x`}
              onChange={(v) => st.patchProject({ voice: { ...project.voice, rate: v } }, false)} />
            <SliderRow label="Pitch" value={project.voice.pitch} min={0.5} max={1.5} step={0.05} format={(v) => v.toFixed(2)}
              onChange={(v) => st.patchProject({ voice: { ...project.voice, pitch: v } }, false)} />
            <Field label="Emotion">
              <Select value={project.voice.emotion} onChange={(e) => st.patchProject({ voice: { ...project.voice, emotion: e.target.value as typeof project.voice.emotion } }, false)}>
                <option value="neutral">Neutral</option><option value="energetic">Energetic</option>
                <option value="calm">Calm</option><option value="serious">Serious</option>
              </Select>
            </Field>
            <div className="flex gap-2">
              <Button size="sm" variant="soft" icon={<Play className="size-3.5" />} onClick={() => previewVoice(project.voice, project.language)}>Preview voice</Button>
            </div>
            <Field label="Music mood">
              <Select value={project.musicMood} onChange={(e) => {
                const mood = e.target.value as MusicMood;
                const total = project.scenes.length ? project.scenes[project.scenes.length - 1].start + project.scenes[project.scenes.length - 1].duration : 10;
                const timeline = project.timeline.map((tr) =>
                  tr.type === "music"
                    ? { ...tr, clips: mood === "none" ? [] : [{ id: uid("clip"), trackId: tr.id, type: "music" as const, label: `Music · ${mood}`, start: 0, duration: total, offset: 0, color: "#f59e0b", payload: { mood } }] }
                    : tr
                );
                st.patchProject({ musicMood: mood, timeline });
              }}>
                {Object.entries(MOOD_META).map(([id, m]) => <option key={id} value={id}>{m.label}</option>)}
              </Select>
            </Field>
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 text-[11px] text-zinc-500 leading-relaxed">
              <Wand2 className="size-3.5 inline mr-1.5 text-violet-300" />
              Tip: open the <b className="text-zinc-300">AI Assistant</b> (top right) and say things like <i>“make the video faster”</i> or <i>“captions bigger”</i>.
            </div>
          </>
        )}
      </div>
    </div>
  );
}


