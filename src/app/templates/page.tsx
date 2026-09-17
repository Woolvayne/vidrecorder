"use client";
import { useRouter } from "next/navigation";
import { LayoutTemplate, ArrowRight, Film, ListOrdered, Lightbulb, Newspaper, Zap, GraduationCap, VenetianMask, Music4 } from "lucide-react";
import { Button, Card, Badge } from "@/components/ui";
import { TEMPLATES } from "@/lib/data/templates";

const ICONS: Record<string, typeof Film> = {
  tpl_documentary: Film, tpl_news: Newspaper, tpl_top10: ListOrdered, tpl_explainer: Lightbulb,
  tpl_story: VenetianMask, tpl_shorts: Zap, tpl_tiktok: Music4, tpl_educational: GraduationCap,
};

export default function TemplatesPage() {
  const router = useRouter();
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-7">
        <h1 className="font-display text-3xl font-bold text-white flex items-center gap-3">
          <LayoutTemplate className="size-7 text-violet-300" /> Templates
        </h1>
        <p className="text-zinc-500 mt-1.5 text-sm max-w-xl">
          Battle-tested structures. Each template defines scene structure, pacing, transitions,
          caption style and music mood — apply one and only add your topic.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TEMPLATES.map((t) => {
          const Icon = ICONS[t.id] ?? Film;
          return (
            <Card key={t.id} interactive className="p-5 flex flex-col">
              <div className="flex items-start justify-between">
                <div className="size-11 rounded-xl flex items-center justify-center" style={{ background: `${t.color}1f`, color: t.color }}>
                  <Icon className="size-5" />
                </div>
                <div className="flex gap-1.5">
                  <Badge tone="zinc">{t.aspect}</Badge>
                  <Badge tone="zinc" className="capitalize">{t.pace}</Badge>
                </div>
              </div>
              <h3 className="mt-3.5 font-semibold text-zinc-100">{t.name}</h3>
              <p className="mt-1.5 text-[12.5px] text-zinc-500 leading-relaxed flex-1">{t.description}</p>
              <div className="mt-4 space-y-1">
                {t.structure.slice(0, 5).map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px] text-zinc-500">
                    <span className="size-1 rounded-full" style={{ background: t.color }} />
                    {s.label}
                  </div>
                ))}
                {t.structure.length > 5 && <p className="text-[10px] text-zinc-600 pl-3">+{t.structure.length - 5} more sections</p>}
              </div>
              <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center justify-between">
                <span className="text-[11px] text-zinc-600 capitalize">Music: {t.musicMood}</span>
                <Button size="sm" variant="soft" onClick={() => router.push(`/create?template=${t.id}`)}>
                  Use template <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
