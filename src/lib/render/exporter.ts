import type { CaptionStyle, ExportSettings, Scene, Track } from "@/lib/types";
import { aspectDims } from "@/lib/utils";
import { MusicEngine } from "@/lib/audio/music";
import { scheduleSfx } from "@/lib/audio/sfx";
import { drawFrame, drawGradientTile } from "./renderer";

/**
 * Local export pipeline. Video frames render on a canvas, music + SFX are
 * mixed in Web Audio, captured with MediaRecorder — 100% in-browser.
 * MP4 is used when the browser supports it natively; otherwise FFmpeg WASM
 * converts the WebM (loaded on demand, gracefully skipped when offline).
 */

export interface ExportResult {
  blob: Blob;
  ext: string;
  mime: string;
  note: string;
}

function pickMime(format: "webm" | "mp4"): { mime: string; ext: string } | null {
  const mp4 = [
    "video/mp4;codecs=avc1.640033,mp4a.40.2",
    "video/mp4;codecs=avc1,mp4a.40.2",
    "video/mp4",
  ];
  const webm = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  const candidates = format === "mp4" ? [...mp4, ...webm] : webm;
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return { mime: c, ext: c.includes("mp4") ? "mp4" : "webm" };
    } catch { /* next */ }
  }
  return null;
}

async function convertToMp4(webmBlob: Blob, onProgress: (p: number) => void): Promise<Blob | null> {
  try {
    const [{ FFmpeg }, { fetchFile, toBlobURL }] = await Promise.all([
      import("@ffmpeg/ffmpeg"),
      import("@ffmpeg/util"),
    ]);
    const ffmpeg = new FFmpeg();
    const base = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
    ffmpeg.on("progress", ({ progress }) => onProgress(Math.min(1, progress)));
    await ffmpeg.load({
      coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
    });
    await ffmpeg.writeFile("input.webm", await fetchFile(webmBlob));
    await ffmpeg.exec(["-i", "input.webm", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast", "-c:a", "aac", "output.mp4"]);
    const data = await ffmpeg.readFile("output.mp4");
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
    return new Blob([bytes.buffer as ArrayBuffer], { type: "video/mp4" });
  } catch {
    return null;
  }
}

export async function renderExport(opts: {
  title: string;
  scenes: Scene[];
  captionStyle: CaptionStyle;
  style: string;
  timeline?: Track[];
  watermark?: string;
  avatarUrl?: string | null;
  musicMood: string;
  settings: ExportSettings;
  muteMusic?: boolean;
  onProgress?: (pct: number, stage: string) => void;
  signal?: { cancelled: boolean };
}): Promise<ExportResult> {
  const { scenes, settings } = opts;
  const { w, h } = aspectDims(settings.aspect, settings.resolution);
  const total = scenes.length ? scenes[scenes.length - 1].start + scenes[scenes.length - 1].duration : 0;
  if (!total) throw new Error("Empty project — nothing to export.");

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  drawGradientTile(ctx, w, h, opts.title);

  const stream = canvas.captureStream(settings.fps);
  const audio = new AudioContext();
  const audioDest = audio.createMediaStreamDestination();
  const engine = new MusicEngine(audio, audioDest);

  const hasMusic = opts.musicMood && opts.musicMood !== "none" && !opts.muteMusic;
  if (hasMusic) engine.start(opts.musicMood as never);

  // schedule scene SFX exactly
  const t0 = audio.currentTime + 0.15;
  for (const scene of scenes) {
    if (scene.sfx) scheduleSfx(scene.sfx, audio, audioDest, t0 + scene.start);
  }

  const combined = new MediaStream([...stream.getVideoTracks(), ...audioDest.stream.getAudioTracks()]);
  const picked = pickMime(settings.format);
  if (!picked) throw new Error("MediaRecorder is not available in this browser.");
  const recorder = new MediaRecorder(combined, { mimeType: picked.mime, videoBitsPerSecond: settings.resolution === "1080p" ? 8_000_000 : 5_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

  const textTrack = opts.timeline?.find((t) => t.type === "text");
  const subsTrack = opts.timeline?.find((t) => t.type === "subtitle");

  await new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve();
    recorder.onerror = () => reject(new Error("Recorder failed"));
    recorder.start(400);
    let startTs: number | null = null;
    const loop = (ts: number) => {
      if (opts.signal?.cancelled) {
        recorder.stop();
        reject(new Error("Export cancelled"));
        return;
      }
      if (startTs === null) startTs = ts;
      const t = (ts - startTs) / 1000;
      if (t >= total) {
        recorder.stop();
        return;
      }
      drawFrame(ctx, w, h, {
        scenes,
        captionStyle: opts.captionStyle,
        style: opts.style,
        textTrackClips: textTrack && !textTrack.muted ? textTrack.clips.map((c) => ({ start: c.start, duration: c.duration, payload: c.payload })) : [],
        subtitlesMuted: subsTrack?.muted ?? false,
        watermark: opts.watermark,
        avatarUrl: opts.avatarUrl ?? undefined,
        cinematicBars: opts.style === "cinematic",
      }, t);
      opts.onProgress?.(t / total, "Rendering frames…");
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }).finally(() => {
    engine.dispose();
    stream.getTracks().forEach((t) => t.stop());
  });

  // small tail so audio flushes
  await new Promise((r) => setTimeout(r, 250));
  void audio.close();

  let blob = new Blob(chunks, { type: picked.mime });
  let ext = picked.ext;
  let note = "";

  if (settings.format === "mp4" && ext !== "mp4") {
    opts.onProgress?.(0.97, "Converting to MP4 via FFmpeg WASM…");
    const mp4 = await convertToMp4(blob, (p) => opts.onProgress?.(0.97 + p * 0.03, "Converting to MP4…"));
    if (mp4) {
      blob = mp4;
      ext = "mp4";
    } else {
      note = "MP4 conversion unavailable (offline) — exported as WebM instead. WebM uploads fine to YouTube.";
    }
  }
  opts.onProgress?.(1, "Finished!");
  return { blob, ext, mime: blob.type, note };
}
