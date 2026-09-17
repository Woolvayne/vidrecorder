"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Rocket, Download, Trash2, Film, AlertTriangle } from "lucide-react";
import { Button, Card, Badge, EmptyState, Skeleton } from "@/components/ui";
import { idbGet, downloadBlob, prettyBytes } from "@/lib/utils";

interface Row {
  id: string; projectId: string; title: string; status: string; format: string;
  resolution: string; aspect: string; fps: number; size: number; error: string; createdAt: string;
}

export default function ExportsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);

  const load = () => fetch("/api/exports").then((r) => r.json()).then((j) => setRows(j.exports ?? [])).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  const download = async (row: Row) => {
    const blob = await idbGet(`export-${row.id}`).catch(() => null);
    if (blob) downloadBlob(blob, `${row.title.replace(/[^\w]+/g, "-").toLowerCase()}.${row.format}`);
    else alert("The local file for this export was cleared from browser storage. Re-export from the editor to download it again.");
  };

  const del = async (id: string) => {
    await fetch("/api/exports", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setRows((r) => (r ? r.filter((x) => x.id !== id) : r));
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-white flex items-center gap-3">
          <Rocket className="size-7 text-violet-300" /> Exports
        </h1>
        <p className="text-zinc-500 mt-1.5 text-sm">
          Rendered 100% in your browser — files live in local storage on this device. No cloud, no watermark, no cost.
        </p>
      </div>

      {rows === null ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Rocket className="size-7" />}
            title="No exports yet"
            desc="Open any project in the editor and hit Export — your rendered videos will land here."
            action={<Button variant="primary" onClick={() => router.push("/editor")} icon={<Film className="size-4" />}>Open editor</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id} className="p-4 flex flex-wrap items-center gap-4">
              <div className={`size-11 rounded-xl flex items-center justify-center shrink-0 ${
                r.status === "done" ? "bg-emerald-500/15 text-emerald-300" : r.status === "failed" ? "bg-rose-500/15 text-rose-300" : "bg-amber-500/15 text-amber-300"
              }`}>
                {r.status === "failed" ? <AlertTriangle className="size-5" /> : <Film className="size-5" />}
              </div>
              <div className="flex-1 min-w-48">
                <p className="font-medium text-sm text-zinc-100 truncate">{r.title}</p>
                <p className="text-[11px] text-zinc-500 mt-0.5 uppercase tracking-wide">
                  {r.format} · {r.resolution} · {r.aspect} · {r.fps}fps {r.size ? `· ${prettyBytes(r.size)}` : ""}
                </p>
                {r.error && <p className="text-[11px] text-rose-400 mt-0.5 truncate">{r.error}</p>}
              </div>
              <Badge tone={r.status === "done" ? "green" : r.status === "failed" ? "rose" : "amber"}>{r.status}</Badge>
              <span className="text-[11px] text-zinc-600 hidden sm:block">{new Date(r.createdAt).toLocaleString()}</span>
              <div className="flex gap-2">
                <Button size="xs" variant="soft" icon={<Download className="size-3.5" />} disabled={r.status !== "done"} onClick={() => void download(r)}>
                  Download
                </Button>
                <Button size="xs" variant="ghost" icon={<Trash2 className="size-3.5" />} onClick={() => void del(r.id)} aria-label="Delete" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
