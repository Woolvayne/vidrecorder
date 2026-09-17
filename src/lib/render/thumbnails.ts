import type { Aspect } from "@/lib/types";
import { aspectDims, hashSeed, mulberry32 } from "@/lib/utils";
import { preloadImage } from "./renderer";

/**
 * Canvas thumbnail generator — builds 4 professional concepts from the
 * video title + available imagery. No AI image API required.
 */

interface ThumbOpts {
  title: string;
  subtitle?: string;
  images: string[];
  accent?: string;
  aspect?: Aspect;
}

function loadFonts() {
  try { return document.fonts?.ready ?? Promise.resolve(); } catch { return Promise.resolve(); }
}

function cover(ctx: CanvasRenderingContext2D, img: CanvasImageSource, x: number, y: number, w: number, h: number) {
  const iw = (img as HTMLImageElement).width || w;
  const ih = (img as HTMLImageElement).height || h;
  const s = Math.max(w / iw, h / ih);
  const dw = iw * s, dh = ih * s;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else line = test;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1];
    if (words.join(" ").length > lines.join(" ").length) lines[maxLines - 1] = last.replace(/\s?\S*$/, "") + "…";
  }
  return lines;
}

function badge(ctx: CanvasRenderingContext2D, accent: string, x: number, y: number, scale: number) {
  ctx.save();
  ctx.font = `800 ${Math.round(20 * scale)}px Inter, system-ui, sans-serif`;
  const text = "FREE RUSH";
  const tw = ctx.measureText(text).width;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.roundRect(x, y, tw + 28 * scale, 34 * scale, 8 * scale);
  ctx.fill();
  ctx.fillStyle = "#0b0b10";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + 14 * scale, y + 17 * scale);
  ctx.restore();
}

async function drawVariant(variant: number, opts: ThumbOpts, images: (HTMLImageElement | null)[]): Promise<string> {
  const { w, h } = aspectDims(opts.aspect ?? "16:9", "720p");
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const accent = opts.accent ?? "#7c5cff";
  const rng = mulberry32(hashSeed(opts.title + variant));
  const scale = h / 720;
  const img = images.find(Boolean) ?? null;
  const title = opts.title.toUpperCase();

  if (variant === 0) {
    // Bold Left — full bleed image, heavy left gradient
    if (img) cover(ctx, img, 0, 0, w, h);
    else {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#111330"); g.addColorStop(1, "#5b3df5");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    const g = ctx.createLinearGradient(0, 0, w * 0.75, 0);
    g.addColorStop(0, "rgba(4,4,10,0.96)");
    g.addColorStop(0.65, "rgba(4,4,10,0.75)");
    g.addColorStop(1, "rgba(4,4,10,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    badge(ctx, accent, w * 0.05, h * 0.08, scale);
    ctx.font = `900 ${Math.round(84 * scale)}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "top";
    const lines = wrap(ctx, title, w * 0.58, 3);
    lines.forEach((line, i) => ctx.fillText(line, w * 0.05, h * 0.28 + i * 92 * scale));
    ctx.fillStyle = accent;
    ctx.fillRect(w * 0.05, h * 0.28 + lines.length * 92 * scale + 14 * scale, 120 * scale, 10 * scale);
  } else if (variant === 1) {
    // Split — image right, deep panel left, ghost numeral
    ctx.fillStyle = "#0a0b14";
    ctx.fillRect(0, 0, w, h);
    const img2 = images[1] ?? img;
    if (img2) cover(ctx, img2, w * 0.52, 0, w * 0.48, h);
    const grad = ctx.createLinearGradient(w * 0.35, 0, w * 0.62, 0);
    grad.addColorStop(0, "#0a0b14");
    grad.addColorStop(1, "rgba(10,11,20,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(w * 0.3, 0, w * 0.4, h);
    ctx.font = `900 ${Math.round(340 * scale)}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = "rgba(124,92,255,0.13)";
    ctx.fillText("01", w * 0.02 - 20 * scale, h * 0.62);
    badge(ctx, accent, w * 0.05, h * 0.08, scale);
    ctx.font = `900 ${Math.round(66 * scale)}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "top";
    const lines = wrap(ctx, title, w * 0.5, 4);
    lines.forEach((line, i) => ctx.fillText(line, w * 0.05, h * 0.3 + i * 72 * scale));
    if (opts.subtitle) {
      ctx.font = `600 ${Math.round(26 * scale)}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = accent;
      ctx.fillText(opts.subtitle.toUpperCase().slice(0, 40), w * 0.05, h * 0.3 + lines.length * 72 * scale + 18 * scale);
    }
  } else if (variant === 2) {
    // Center Stage — dimmed image, huge centered type
    const img3 = images[2] ?? img;
    if (img3) { cover(ctx, img3, 0, 0, w, h); }
    else {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#1a0533"); g.addColorStop(1, "#060214");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    ctx.fillStyle = "rgba(3,3,8,0.62)";
    ctx.fillRect(0, 0, w, h);
    badge(ctx, accent, (w - 160 * scale) / 2, h * 0.1, scale);
    ctx.textAlign = "center";
    ctx.font = `900 ${Math.round(96 * scale)}px Inter, system-ui, sans-serif`;
    const lines = wrap(ctx, title, w * 0.86, 3);
    const startY = h / 2 - ((lines.length - 1) * 104 * scale) / 2;
    lines.forEach((line, i) => {
      ctx.lineWidth = 14 * scale;
      ctx.strokeStyle = "rgba(0,0,0,0.9)";
      ctx.strokeText(line, w / 2, startY + i * 104 * scale);
      ctx.fillStyle = "#fff";
      ctx.fillText(line, w / 2, startY + i * 104 * scale);
    });
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.roundRect(w / 2 - 90 * scale, startY + lines.length * 104 * scale + 4 * scale, 180 * scale, 12 * scale, 6 * scale);
    ctx.fill();
    ctx.textAlign = "left";
  } else {
    // Minimal — gradient + rings + type card
    const hue = Math.floor(rng() * 280);
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, `hsl(${hue} 60% 8%)`);
    g.addColorStop(1, `hsl(${(hue + 60) % 360} 70% 26%)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    for (let i = 1; i < 6; i++) {
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(w * 0.85, h * 0.2, i * 70 * scale, 0, Math.PI * 2);
      ctx.stroke();
    }
    const cardW = w * 0.8, cardH = h * 0.52, cx = (w - cardW) / 2, cy = h * 0.24;
    ctx.fillStyle = "rgba(5,5,12,0.78)";
    ctx.beginPath();
    ctx.roundRect(cx, cy, cardW, cardH, 22 * scale);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.stroke();
    badge(ctx, accent, cx + 26 * scale, cy + 26 * scale, scale);
    ctx.font = `900 ${Math.round(60 * scale)}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "top";
    const lines = wrap(ctx, title, cardW - 60 * scale, 3);
    lines.forEach((line, i) => ctx.fillText(line, cx + 26 * scale, cy + 90 * scale + i * 68 * scale));
    ctx.fillStyle = accent;
    ctx.fillRect(cx + 26 * scale, cy + 86 * scale + lines.length * 68 * scale + 12 * scale, 90 * scale, 8 * scale);
  }

  return canvas.toDataURL("image/png");
}

export async function generateThumbnails(opts: ThumbOpts): Promise<string[]> {
  await loadFonts();
  const imgs = await Promise.all(opts.images.slice(0, 3).map((u) => preloadImage(u)));
  const out: string[] = [];
  for (let v = 0; v < 4; v++) {
    try {
      out.push(await drawVariant(v, opts, imgs));
    } catch { /* keep others */ }
  }
  return out;
}
