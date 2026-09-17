"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clapperboard, Plus, ArrowRight, Film } from "lucide-react";
import { Button, Card, Badge, EmptyState, Skeleton } from "@/components/ui";
import { prettyDuration } from "@/lib/utils";

interface Row { id: string; title: string; status: string; format: string; aspect: string; durationTargetSec: number; scenesCount: number; updatedAt: string }

export default function EditorPicker() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then((j) => setRows(j.projects ?? [])).catch(() => setRows([]));
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-white flex items-center gap-3">
            <Clapperboard className="size-7 text-violet-300" /> Editor
          </h1>
          <p className="text-zinc-500 mt-1.5">Pick a project to open in the studio.</p>
        </div>
        <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => router.push("/create")}>New Video</Button>
      </div>
      {rows === null ? (
        <div className="grid sm:grid-cols-2 gap-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Film className="size-7" />}
            title="Nothing to edit yet"
            desc="Generate your first video and it will open here in the full editor — timeline, tracks, captions and all."
            action={<Button variant="primary" onClick={() => router.push("/create")} icon={<Plus className="size-4" />}>Create video</Button>}
          />
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {rows.map((p) => (
            <Card key={p.id} interactive className="p-4" onClick={() => router.push(`/editor/${p.id}`)}>
              <div className="flex items-center justify-between gap-2">
                <Badge tone={p.status === "completed" ? "green" : p.status === "ready" ? "blue" : "zinc"}>{p.status}</Badge>
                <span className="text-[11px] text-zinc-600">{p.scenesCount} scenes</span>
              </div>
              <h3 className="mt-2.5 font-medium text-[14px] text-zinc-100 leading-snug line-clamp-2">{p.title}</h3>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-zinc-500 capitalize">{p.format.replace("top10", "Top 10")} · {p.aspect} · {prettyDuration(p.durationTargetSec)}</span>
                <span className="text-[11px] text-violet-300 flex items-center gap-1">Open <ArrowRight className="size-3" /></span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
