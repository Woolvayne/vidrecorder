"use client";
import { useEffect, useState } from "react";
import { Palette, Plus, Trash2, Check, Pencil } from "lucide-react";
import { Button, Card, Badge, EmptyState, Modal, Input, Select, Field, Skeleton } from "@/components/ui";
import type { BrandProfile } from "@/lib/types";
import { CAPTION_PRESETS, MOOD_META } from "@/lib/data/templates";

interface BrandRow { id: string; name: string; settings: Partial<BrandProfile>; createdAt: string }

const DEFAULT_SETTINGS: Partial<BrandProfile> = {
  language: "en", voiceURI: "", font: "Inter",
  colorPrimary: "#7c5cff", colorAccent: "#38bdf8", colorText: "#ffffff", colorBg: "#08090d",
  captionPreset: "modern", musicMood: "cinematic", intro: "", outro: "",
  logoUrl: "", watermark: "", defaultFormat: "youtube", defaultDurationSec: 300,
  writingStyle: "confident", editingStyle: "fast-paced",
};

export default function BrandsPage() {
  const [rows, setRows] = useState<BrandRow[] | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BrandRow | null>(null);
  const [form, setForm] = useState<{ name: string; settings: Partial<BrandProfile> }>({ name: "", settings: DEFAULT_SETTINGS });

  const load = () => fetch("/api/brands").then((r) => r.json()).then((j) => setRows(j.brands ?? [])).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  const set = (k: keyof BrandProfile, v: string) => setForm((f) => ({ ...f, settings: { ...f.settings, [k]: v } }));

  const save = async () => {
    if (!form.name.trim()) return;
    if (editing) {
      await fetch("/api/brands", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing.id, name: form.name, settings: form.settings }) });
    } else {
      await fetch("/api/brands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name, settings: form.settings }) });
    }
    setOpen(false); setEditing(null); setForm({ name: "", settings: DEFAULT_SETTINGS });
    load();
  };

  const del = async (id: string) => {
    await fetch("/api/brands", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    load();
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-white flex items-center gap-3">
            <Palette className="size-7 text-violet-300" /> Brand Profiles
          </h1>
          <p className="text-zinc-500 mt-1.5 text-sm max-w-lg">
            Your channel's identity — voice, fonts, colors, captions, intros. Applied automatically to every new video.
          </p>
        </div>
        <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => { setEditing(null); setForm({ name: "", settings: DEFAULT_SETTINGS }); setOpen(true); }}>
          New Profile
        </Button>
      </div>

      {rows === null ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-48" />)}</div>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Palette className="size-7" />}
            title="No brand profiles"
            desc="Create a profile like “My YouTube Channel” — every video will automatically use its voice, colors, captions and music."
            action={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>Create profile</Button>}
          />
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((b) => {
            const s = b.settings ?? {};
            return (
              <Card key={b.id} interactive className="p-5">
                <div className="flex items-center gap-2">
                  <span className="size-4 rounded-full" style={{ background: s.colorPrimary ?? "#7c5cff" }} />
                  <span className="size-4 rounded-full" style={{ background: s.colorAccent ?? "#38bdf8" }} />
                  <div className="flex-1" />
                  <Badge tone="zinc" className="uppercase">{s.language ?? "en"}</Badge>
                </div>
                <h3 className="mt-3 font-semibold text-zinc-100">{b.name}</h3>
                <div className="mt-2 space-y-1 text-[11.5px] text-zinc-500">
                  <p>Font: {s.font ?? "Inter"} · Captions: <span className="capitalize">{s.captionPreset ?? "modern"}</span></p>
                  <p>Music: {s.musicMood ?? "cinematic"} · Default: {(s.defaultFormat ?? "youtube").replace("top10", "Top 10")}, {Math.round((s.defaultDurationSec ?? 300) / 60)} min</p>
                  {s.watermark && <p>Watermark: “{s.watermark}”</p>}
                </div>
                <div className="mt-4 pt-3 border-t border-white/[0.06] flex gap-2">
                  <Button size="xs" variant="soft" icon={<Pencil className="size-3" />}
                    onClick={() => { setEditing(b); setForm({ name: b.name, settings: { ...DEFAULT_SETTINGS, ...b.settings } }); setOpen(true); }}>
                    Edit
                  </Button>
                  <Button size="xs" variant="danger" icon={<Trash2 className="size-3" />} onClick={() => void del(b.id)}>Delete</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit brand profile" : "New brand profile"} wide>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Profile name" className="sm:col-span-2">
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="My YouTube Channel" />
          </Field>
          <Field label="Language">
            <Select value={form.settings.language} onChange={(e) => set("language", e.target.value)}>
              <option value="en">English</option><option value="de">Deutsch</option>
              <option value="es">Español</option><option value="fr">Français</option>
            </Select>
          </Field>
          <Field label="Font">
            <Select value={form.settings.font} onChange={(e) => set("font", e.target.value)}>
              <option value="Inter">Inter</option><option value="Georgia">Georgia (serif)</option>
              <option value="Courier New">Courier (mono)</option>
            </Select>
          </Field>
          <Field label="Caption style">
            <Select value={form.settings.captionPreset} onChange={(e) => set("captionPreset", e.target.value)}>
              {Object.keys(CAPTION_PRESETS).map((k) => <option key={k} value={k} className="capitalize">{k}</option>)}
            </Select>
          </Field>
          <Field label="Music style">
            <Select value={form.settings.musicMood} onChange={(e) => set("musicMood", e.target.value)}>
              {Object.entries(MOOD_META).map(([id, m]) => <option key={id} value={id}>{m.label}</option>)}
            </Select>
          </Field>
          <Field label="Default format">
            <Select value={form.settings.defaultFormat} onChange={(e) => set("defaultFormat", e.target.value)}>
              {["youtube", "documentary", "explainer", "news", "top10", "story", "educational", "shorts"].map((f) => <option key={f} value={f}>{f.replace("top10", "Top 10")}</option>)}
            </Select>
          </Field>
          <Field label="Default duration">
            <Select value={String(form.settings.defaultDurationSec ?? 300)} onChange={(e) => setForm((f) => ({ ...f, settings: { ...f.settings, defaultDurationSec: Number(e.target.value) } }))}>
              {[60, 180, 300, 480, 600, 900].map((s) => <option key={s} value={s}>{Math.round(s / 60)} min</option>)}
            </Select>
          </Field>
          {(["colorPrimary", "colorAccent", "colorText", "colorBg"] as const).map((k) => (
            <Field key={k} label={k.replace("color", "Color ")}>
              <input type="color" value={String(form.settings[k] ?? "#7c5cff")} onChange={(e) => set(k, e.target.value)}
                className="w-full h-10 rounded-xl bg-transparent border border-white/10 cursor-pointer" />
            </Field>
          ))}
          <Field label="Watermark text">
            <Input value={form.settings.watermark} onChange={(e) => set("watermark", e.target.value)} placeholder="@yourchannel" />
          </Field>
          <Field label="Writing style">
            <Input value={form.settings.writingStyle} onChange={(e) => set("writingStyle", e.target.value)} placeholder="confident, witty, academic…" />
          </Field>
          <Field label="Intro line (optional)">
            <Input value={form.settings.intro} onChange={(e) => set("intro", e.target.value)} placeholder="Welcome back to…" />
          </Field>
          <Field label="Outro line (optional)">
            <Input value={form.settings.outro} onChange={(e) => set("outro", e.target.value)} placeholder="See you next week…" />
          </Field>
        </div>
        <Button variant="primary" className="w-full mt-5" icon={<Check className="size-4" />} onClick={() => void save()} disabled={!form.name.trim()}>
          Save profile
        </Button>
      </Modal>
    </div>
  );
}
