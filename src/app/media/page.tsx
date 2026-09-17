"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { LibraryBig, Upload, Trash2, Search, Film, Image as ImageIcon, Music4, AudioLines, Type, Stamp, FolderOpen } from "lucide-react";
import { Button, Card, Badge, EmptyState, Input, Skeleton } from "@/components/ui";
import type { MediaItem } from "@/lib/types";
import { prettyBytes } from "@/lib/utils";

const CATS = [
  { id: "all", label: "All", icon: FolderOpen },
  { id: "videos", label: "Videos", icon: Film, types: ["video"] },
  { id: "images", label: "Images", icon: ImageIcon, types: ["image"] },
  { id: "audio", label: "Audio", icon: AudioLines, types: ["audio"] },
  { id: "music", label: "Music", icon: Music4, types: ["music"] },
  { id: "sfx", label: "SFX", icon: AudioLines, types: ["sfx"] },
  { id: "fonts", label: "Fonts", icon: Type, types: ["font"] },
  { id: "logos", label: "Logos", icon: Stamp, types: ["logo"] },
];

export default function MediaPage() {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"new" | "size" | "name">("new");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => fetch("/api/media").then((r) => r.json()).then((j) => setItems(j.media ?? [])).catch(() => setItems([]));
  useEffect(() => { load(); }, []);

  const upload = (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      if (file.size > 6 * 1024 * 1024) { alert(`"${file.name}" is over 6 MB — too large for the free local database.`); continue; }
      const reader = new FileReader();
      reader.onload = async () => {
        let type: MediaItem["type"] = "image";
        if (file.type.startsWith("video")) type = "video";
        else if (file.type.startsWith("audio")) type = "audio";
        await fetch("/api/media", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: file.name, type, category: "uploads", url: String(reader.result), size: file.size, duration: 0, tags: [] }),
        });
        load();
      };
      reader.readAsDataURL(file);
    }
  };

  const del = async (id: string) => {
    await fetch("/api/media", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setItems((r) => (r ? r.filter((x) => x.id !== id) : r));
  };

  const filtered = useMemo(() => {
    if (!items) return [];
    let out = items;
    const catDef = CATS.find((c) => c.id === cat);
    if (catDef?.types) out = out.filter((i) => catDef.types!.includes(i.type));
    if (q) out = out.filter((i) => i.name.toLowerCase().includes(q.toLowerCase()));
    out = [...out].sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "size" ? b.size - a.size : String(b.createdAt).localeCompare(String(a.createdAt)));
    return out;
  }, [items, cat, q, sort]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-white flex items-center gap-3">
            <LibraryBig className="size-7 text-violet-300" /> Media Library
          </h1>
          <p className="text-zinc-500 mt-1 text-sm">Your uploads, stored locally. Drag them into any project from the editor.</p>
        </div>
        <div className="flex-1" />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-600" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search media…" className="pl-9 w-48" />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}
          className="h-10 px-3 rounded-xl bg-[#14161f] border border-white/[0.08] text-sm text-zinc-100 cursor-pointer">
          <option value="new">Newest</option><option value="size">Largest</option><option value="name">Name</option>
        </select>
        <Button variant="primary" icon={<Upload className="size-4" />} onClick={() => fileRef.current?.click()}>Upload</Button>
        <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => e.target.files && upload(e.target.files)} />
      </div>

      <div className="flex gap-1.5 mb-5 overflow-x-auto">
        {CATS.map((c) => (
          <button key={c.id} onClick={() => setCat(c.id)}
            className={`flex items-center gap-1.5 h-7.5 px-3 rounded-full text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
              cat === c.id ? "bg-violet-500/20 text-violet-200 border border-violet-400/30" : "text-zinc-500 border border-white/[0.07] hover:text-zinc-200"
            }`}>
            <c.icon className="size-3.5" /> {c.label}
          </button>
        ))}
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) upload(e.dataTransfer.files); }}
        className={`rounded-2xl transition-colors ${dragOver ? "outline-2 outline-dashed outline-violet-400/60 bg-violet-500/[0.05]" : ""}`}
      >
        {items === null ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="aspect-video" />)}</div>
        ) : filtered.length === 0 ? (
          <Card>
            <EmptyState
              icon={<LibraryBig className="size-7" />}
              title={items.length === 0 ? "Library is empty" : "No matches"}
              desc="Drag & drop files anywhere on this page — images, videos, audio. Everything stays on your device."
              action={<Button variant="primary" icon={<Upload className="size-4" />} onClick={() => fileRef.current?.click()}>Upload files</Button>}
            />
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {filtered.map((it) => (
              <Card key={it.id} className="overflow-hidden group">
                <div className="aspect-video bg-black/50 relative flex items-center justify-center">
                  {it.type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.url} alt={it.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : it.type === "video" ? (
                    <Film className="size-7 text-zinc-600" />
                  ) : (
                    <AudioLines className="size-7 text-zinc-600" />
                  )}
                  <div className="absolute top-2 left-2"><Badge tone="zinc">{it.type}</Badge></div>
                  <button
                    onClick={() => void del(it.id)}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-zinc-400 hover:text-rose-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <div className="p-2.5">
                  <p className="text-[12px] text-zinc-200 truncate">{it.name}</p>
                  <p className="text-[10px] text-zinc-600">{prettyBytes(it.size)}</p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
