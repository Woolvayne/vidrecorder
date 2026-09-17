"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FolderKanban, Plus, Trash2, Film, Search, CalendarDays } from "lucide-react";
import { Button, Card, Badge, EmptyState, Skeleton, Input } from "@/components/ui";
import { prettyDuration } from "@/lib/utils";

interface Row {
  id: string; title: string; status: string; format: string; aspect: string; mode: string;
  language: string; durationTargetSec: number; scenesCount: number; thumbnail: string | null;
  updatedAt: string; prompt: string;
}

const STATUS_TONES: Record<string, "green" | "blue" | "amber" | "zinc" | "rose"> = {
  draft: "zinc", generating: "amber", ready: "blue", exporting: "amber", completed: "green",
};

function ProjectsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState(params.get("q") ?? "");
  const [status, setStatus] = useState("all");

  const load = () => fetch("/api/projects").then((r) => r.json()).then((j) => setRows(j.projects ?? [])).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (q && !`${r.title} ${r.prompt}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [rows, q, status]);

  const del = async (id: string) => {
    await fetch(`/api/projects/${id}`, { method: "DELETE" }).catch(() => {});
    setRows((r) => (r ? r.filter((x) => x.id !== id) : r));
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Projects</h1>
          <p className="text-zinc-500 mt-1 text-sm">Every video, autosaved locally. Pick up where you left off.</p>
        </div>
        <div className="flex-1" />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-600" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter projects…" className="pl-9 w-56" />
        </div>
        <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => router.push("/create")}>New Video</Button>
      </div>

      <div className="flex gap-1.5 mb-5 overflow-x-auto">
        {["all", "draft", "generating", "ready", "exporting", "completed"].map((s) => (
          <button key={s} onClick={() => setStatus(s)}
            className={`h-7.5 px-3 rounded-full text-xs font-medium capitalize cursor-pointer transition-colors ${
              status === s ? "bg-violet-500/20 text-violet-200 border border-violet-400/30" : "text-zinc-500 border border-white/[0.07] hover:text-zinc-200"
            }`}>{s}</button>
        ))}
      </div>

      {rows === null ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-44" />)}</div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FolderKanban className="size-7" />}
            title={rows.length === 0 ? "No projects yet" : "Nothing matches your filter"}
            desc={rows.length === 0 ? "Your ideas become videos here. Start with one sentence — research, script and editing are automatic." : "Try a different search or status filter."}
            action={rows.length === 0 ? <Button variant="primary" onClick={() => router.push("/create")} icon={<Plus className="size-4" />}>Create your first video</Button> : undefined}
          />
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <Card key={p.id} interactive className="overflow-hidden" onClick={() => router.push(`/editor/${p.id}`)}>
              <div className="aspect-video bg-black/50 relative">
                {p.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.thumbnail} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-600/20 via-[#0d0f16] to-indigo-900/20">
                    <Film className="size-8 text-zinc-700" />
                  </div>
                )}
                <div className="absolute top-2.5 right-2.5">
                  <Badge tone={STATUS_TONES[p.status] ?? "zinc"}>{p.status}</Badge>
                </div>
                <div className="absolute bottom-2.5 left-2.5 text-[10px] font-mono text-white/80 bg-black/60 rounded px-1.5 py-0.5 uppercase">
                  {p.aspect} · {p.language}
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-medium text-[14px] text-zinc-100 leading-snug line-clamp-2">{p.title}</h3>
                <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500">
                  <span className="capitalize">{p.format.replace("top10", "Top 10")}</span>
                  <span>·</span><span>{p.scenesCount} scenes</span>
                  <span>·</span><span>{prettyDuration(p.durationTargetSec)}</span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[10.5px] text-zinc-600 flex items-center gap-1">
                    <CalendarDays className="size-3" />
                    {new Date(p.updatedAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); if (confirm("Delete this project permanently?")) void del(p.id); }}
                    className="p-1.5 rounded-lg text-zinc-600 hover:text-rose-300 hover:bg-rose-500/10 cursor-pointer transition-colors"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProjectsPage() {
  return <Suspense fallback={<div className="py-20 text-center text-zinc-500">Loading…</div>}><ProjectsInner /></Suspense>;
}
