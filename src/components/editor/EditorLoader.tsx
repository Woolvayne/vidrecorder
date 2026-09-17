"use client";
import { useEffect, useState } from "react";
import { useEditor } from "@/lib/store/editorStore";
import type { ProjectData } from "@/lib/types";
import EditorClient from "./EditorClient";
import { Clapperboard } from "lucide-react";
import { Button } from "@/components/ui";
import { useRouter } from "next/navigation";

export default function EditorLoader({ id }: { id: string }) {
  const loadedId = useEditor((s) => s.project?.id);
  const [error, setError] = useState("");
  const [tried, setTried] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (loadedId === id) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/projects/${id}`);
        const j = await r.json();
        if (!cancelled && j.project?.data) {
          const p = j.project.data as ProjectData;
          p.id = j.project.id;
          useEditor.getState().loadProject(p);
          setTried(true);
          return;
        }
        const ls = localStorage.getItem(`freerush.project.${id}`);
        if (ls) {
          const p = JSON.parse(ls) as ProjectData;
          p.id = id;
          useEditor.getState().loadProject(p);
          setTried(true);
          return;
        }
        setError("Project not found.");
      } catch {
        const ls = localStorage.getItem(`freerush.project.${id}`);
        if (ls) {
          const p = JSON.parse(ls) as ProjectData;
          p.id = id;
          useEditor.getState().loadProject(p);
        } else setError("Could not load this project (offline and no local copy).");
      }
      setTried(true);
    })();
    return () => { cancelled = true; };
  }, [id, loadedId]);

  if (loadedId === id) return <EditorClient />;

  return (
    <div className="h-[70vh] flex flex-col items-center justify-center gap-4 text-zinc-500">
      <Clapperboard className="size-10 animate-pulse" />
      {!tried && <p className="text-sm">Loading project…</p>}
      {tried && error && (
        <>
          <p className="text-sm text-rose-300">{error}</p>
          <Button variant="outline" size="sm" onClick={() => router.push("/projects")}>Back to projects</Button>
        </>
      )}
    </div>
  );
}
