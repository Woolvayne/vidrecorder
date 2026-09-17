import type { CaptionStyle, Scene, Track } from "@/lib/types";
import { clamp, hashSeed, mulberry32, splitSentences } from "@/lib/utils";

/**
 * Canvas render engine — draws every frame of the video: imagery with
 * Ken Burns motion, transitions, overlays, captions, letterbox, watermark.
 * Fully local — powers both the live preview and the export recorder.
 */

const imageCache = new Map<string, HTMLImageElement | "error">();

/** Route external URLs through the local proxy so canvases stay CORS-clean. */
export function safeSrc(url: string): string {
  if (/^https?:\/\//i.test(url) && typeof window !== "undefined") {
    return `/api/proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

export function preloadImage(url: string): Promise<HTMLImageElement | null> {
  const hit = imageCache.get(url);
  if (hit && hit !== "error") return Promise.resolve(hit);
  if (hit === "error") return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { imageCache.set(url, img); resolve(img); };
    img.onerror = () => {
      // retry once via proxy if direct load failed
      const proxied = safeSrc(url);
      if (proxied !== url) {
        const img2 = new Image();
        img2.onload = () => { imageCache.set(url, img2); resolve(img2); };
        img2.onerror = () => { imageCache.set(url, "error"); resolve(null); };
        img2.src = proxied;
      } else {
        imageCache.set(url, "error");
        resolve(null);
      }
    };
    img.src = safeSrc(url);
  });
}

export async function preloadImages(urls: string[], batch = 6): Promise<void> {
  const unique = [...new Set(urls.filter(Boolean))];
  for (let i = 0; i < unique.length; i += batch) {
    await Promise.all(unique.slice(i, i + batch).map((u) => preloadImage(u)));
  }
}

export function getImage(url: string): HTMLImageElement | null {
  const hit = imageCache.get(url);
  return hit && hit !== "error" ? hit : null;
}

// procedural tile fallback — always available, seeded by text
export function drawGradientTile(ctx: CanvasRenderingContext2D, w: number, h: number, seedText: string) {
  const rng = mulberry32(hashSeed(seedText || "freerush"));
  const hue1 = Math.floor(rng() * 360);
  const hue2 = (hue1 + 40 + Math.floor(rng() * 80)) % 360;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, `hsl(${hue1} 45% 10%)`);
  g.addColorStop(0.55, `hsl(${hue2} 55% 22%)`);
  g.addColorStop(1, `hsl(${hue1} 50% 8%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    const x = rng() * w, y = rng() * h, r = (0.15 + rng() * 0.35) * Math.max(w, h);
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `hsl(${hue2} 70% 60%)`);
    rg.addColorStop(1, "transparent");
    ctx.fillStyle = rg;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export interface RenderInput {
  scenes: Scene[];
  captionStyle: CaptionStyle;
  style: string;
  textTrackClips?: { start: number; duration: number; payload?: Record<string, unknown> }[];
  subtitlesMuted?: boolean;
  watermark?: string;
  cinematicBars?: boolean;
  avatarUrl?: string;
  speaking?: boolean;
}

export function sceneAt(scenes: Scene[], t: number): { scene: Scene; local: number; prev: Scene | null } {
  for (let i = scenes.length - 1; i >= 0; i--) {
    if (t >= scenes[i].start) {
      const scene = scenes[i];
      return { scene, local: t - scene.start, prev: i > 0 ? scenes[i - 1] : null };
    }
  }
  return { scene: scenes[0], local: 0, prev: null };
}

function drawCover(ctx: CanvasRenderingContext2D, img: CanvasImageSource, w: number, h: number, scale: number, dx = 0, dy = 0) {
  const iw = (img as HTMLImageElement).width || w;
  const ih = (img as HTMLImageElement).height || h;
  const s = Math.max(w / iw, h / ih) * scale;
  const dw = iw * s, dh = ih * s;
  ctx.drawImage(img, (w - dw) / 2 + dx, (h - dh) / 2 + dy, dw, dh);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

const TRANSITION_DUR = 0.5;

function drawSceneVisual(ctx: CanvasRenderingContext2D, scene: Scene, w: number, h: number, local: number, entering: number) {
  const img = scene.visualUrl ? getImage(scene.visualUrl) : null;
  // Ken Burns: alternate zoom-in / zoom-out + pan
  const dir = scene.index % 2 === 0 ? 1 : -1;
  const progress = clamp(local / scene.duration, 0, 1);
  const zoomBase = dir === 1 ? 1.02 + progress * 0.1 : 1.12 - progress * 0.1;
  const pan = (0.5 - progress) * dir * w * 0.02;

  ctx.save();
  if (entering < 1) {
    if (scene.transition === "zoom") {
      const s = 0.9 + entering * 0.1;
      ctx.translate(w / 2, h / 2);
      ctx.scale(s, s);
      ctx.translate(-w / 2, -h / 2);
      ctx.globalAlpha = entering;
    } else if (scene.transition === "slide") {
      ctx.translate((1 - entering) * w * 0.35, 0);
      ctx.globalAlpha = clamp(entering * 1.6, 0, 1);
    } else if (scene.transition === "wipe") {
      ctx.beginPath();
      ctx.rect(0, 0, w * entering, h);
      ctx.clip();
    } else {
      ctx.globalAlpha = entering;
    }
  } else if (scene.transition === "wipe" && local > scene.duration - TRANSITION_DUR && scene.duration > 2) {
    // outgoing wipe handled by next scene's entering
  }
  if (img) drawCover(ctx, img, w, h, zoomBase, pan, 0);
  else drawGradientTile(ctx, w, h, scene.visualQuery || scene.narration);
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawFrame(ctx: CanvasRenderingContext2D, w: number, h: number, input: RenderInput, t: number) {
  const { scenes, captionStyle } = input;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  if (!scenes.length) return;

  const { scene, local, prev } = sceneAt(scenes, t);
  const entering = clamp(local / TRANSITION_DUR, 0, 1);
  const isTransitioning = local < TRANSITION_DUR && prev && scene.transition !== "cut";

  // --- avatar mode ---
  if (input.avatarUrl) {
    const bg = scene.visualUrl ? getImage(scene.visualUrl) : null;
    ctx.save();
    if (bg) { drawCover(ctx, bg, w, h, 1.05); ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(0, 0, w, h); }
    else { drawGradientTile(ctx, w, h, "avatar-bg"); }
    ctx.restore();
    const avatar = getImage(input.avatarUrl);
    const bob = Math.sin(t * 2.2) * h * 0.006;
    const aw = w * 0.42, ah = avatar ? (avatar.height / Math.max(1, avatar.width)) * aw : aw;
    const ax = (w - aw) / 2, ay = h - ah - h * 0.04 + bob;
    if (avatar) {
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 40;
      ctx.drawImage(avatar, ax, ay, aw, ah);
      ctx.restore();
      // simulated lip-sync: animated mouth bar while speaking
      if (input.speaking) {
        const open = 0.5 + Math.abs(Math.sin(t * 11)) * 0.8;
        ctx.fillStyle = "rgba(10,10,14,0.85)";
        roundRect(ctx, w / 2 - aw * 0.06, ay + ah * 0.62, aw * 0.12, aw * 0.03 * open + 2, 6);
        ctx.fill();
      }
    }
  } else {
    // draw previous scene underneath during transition
    if (isTransitioning && prev) drawSceneVisual(ctx, prev, w, h, prev.duration, 1);
    drawSceneVisual(ctx, scene, w, h, local, isTransitioning ? entering : 1);
  }

  // grade: subtle vignette + bottom gradient
  const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.42)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
  const bg = ctx.createLinearGradient(0, h * 0.5, 0, h);
  bg.addColorStop(0, "rgba(0,0,0,0)");
  bg.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // cinematic letterbox bars
  if (input.style === "cinematic" || input.cinematicBars) {
    const bar = h * 0.07;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, bar);
    ctx.fillRect(0, h - bar, w, bar);
  }

  const scaleRef = h / 1080;

  // --- scene overlay text ---
  if (scene.overlay && scene.section !== "cta") {
    const entranceDur = 0.55;
    const e = clamp(local / entranceDur, 0, 1);
    const exit = clamp((scene.duration - local) / 0.4, 0, 1);
    const alpha = Math.min(e, exit);
    ctx.save();
    ctx.globalAlpha = alpha;
    const fontSize = Math.round(46 * scaleRef);
    ctx.font = `800 ${fontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "left";
    const tx = w * 0.06 + (1 - e) * 26;
    const ty = h * 0.16;
    const label = scene.overlay.toUpperCase().slice(0, 48);
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#ffffff";
    const lines = wrapText(ctx, label, w * 0.55).slice(0, 2);
    lines.forEach((line, i) => ctx.fillText(line, tx, ty + i * fontSize * 1.15));
    ctx.shadowBlur = 0;
    // accent bar
    ctx.fillStyle = "#7c5cff";
    ctx.fillRect(tx, ty + lines.length * fontSize * 1.15 + 6, 70 * scaleRef, 5 * scaleRef);
    // chapter tag on chapter starts
    if (scene.section === "chapter" && scene.chapter) {
      ctx.globalAlpha = alpha * 0.85;
      ctx.font = `600 ${Math.round(22 * scaleRef)}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText(scene.chapter.toUpperCase(), tx, ty - 20 * scaleRef);
    }
    ctx.restore();
  }

  // --- free text clips (text overlay track) ---
  for (const clip of input.textTrackClips ?? []) {
    if (t >= clip.start && t <= clip.start + clip.duration) {
      const p = (t - clip.start) / clip.duration;
      const a = Math.min(clamp(p / 0.15, 0, 1), clamp((1 - p) / 0.15, 0, 1));
      const payload = clip.payload ?? {};
      const fontSize = Math.round(Number(payload.size ?? 64) * scaleRef);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = `800 ${fontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(0,0,0,0.8)";
      ctx.shadowBlur = 14;
      ctx.fillStyle = String(payload.color ?? "#ffffff");
      const yPos = payload.position === "top" ? h * 0.22 : payload.position === "bottom" ? h * 0.78 : h * 0.5;
      ctx.fillText(String(payload.text ?? "Text"), w / 2, yPos);
      ctx.restore();
    }
  }

  // --- captions / subtitles ---
  if (!input.subtitlesMuted) {
    const caption = currentCaption(scene, local, captionStyle);
    if (caption) drawCaption(ctx, w, h, caption, captionStyle, local);
  }

  // --- watermark ---
  if (input.watermark) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.font = `600 ${Math.round(24 * scaleRef)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 6;
    ctx.fillText(input.watermark, w - 20 * scaleRef, h - 22 * scaleRef - (captionStyle.position === "bottom" ? 90 * scaleRef * (captionStyle.size / 54) : 0));
    ctx.restore();
  }
}

export type CaptionChunk = { words: { word: string; active: boolean }[] } | { text: string };

function currentCaption(scene: Scene, local: number, style: CaptionStyle): CaptionChunk | null {
  if (!scene.narration) return null;
  const p = clamp(local / scene.duration, 0, 1);
  if (style.mode === "sentence") {
    const sents = splitSentences(scene.narration);
    if (!sents.length) return { text: scene.narration };
    const idx = Math.min(sents.length - 1, Math.floor(p * sents.length));
    return { text: sents[idx] };
  }
  const words = scene.narration.split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const chunkSize = 5;
  const chunkIdx = Math.min(Math.ceil(words.length / chunkSize) - 1, Math.floor(p * Math.ceil(words.length / chunkSize)));
  const start = chunkIdx * chunkSize;
  const chunkWords = words.slice(start, start + chunkSize);
  const activeIdx = Math.min(chunkWords.length - 1, Math.floor((p * words.length - start)));
  return { words: chunkWords.map((w, i) => ({ word: w, active: i <= activeIdx })) };
}

function drawCaption(ctx: CanvasRenderingContext2D, w: number, h: number, caption: CaptionChunk, style: CaptionStyle, local: number) {
  const scaleRef = h / 1080;
  const fontSize = Math.round(style.size * scaleRef);
  const family = style.font === "Georgia" ? "Georgia, 'Times New Roman', serif" : style.font === "Courier New" ? "'Courier New', monospace" : "Inter, system-ui, sans-serif";
  ctx.save();
  const family2 = style.preset === "tiktok" || style.preset === "shorts" ? `900 ${fontSize}px ${family}` : `700 ${fontSize}px ${family}`;
  ctx.font = family2;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // entrance animation
  let alpha = 1, yOffset = 0, pop = 1;
  const eDur = 0.18;
  const e = clamp((local % 1.2) / eDur, 0, 1); // re-trigger on chunk changes via modulo
  if (style.animation === "fade") alpha = 0.4 + 0.6 * e;
  else if (style.animation === "rise") yOffset = (1 - e) * 18 * scaleRef;
  else if (style.animation === "pop") pop = 0.85 + 0.15 * e;

  const yBase = style.position === "top" ? h * 0.16 : style.position === "center" ? h * 0.5 : h * 0.85;

  const drawWord = (text: string, x: number, y: number, color: string, isActive: boolean) => {
    ctx.font = isActive && style.preset !== "documentary" ? `900 ${Math.round(fontSize * 1.04 * pop)}px ${family}` : family2;
    if (style.shadow) {
      ctx.shadowColor = "rgba(0,0,0,0.85)";
      ctx.shadowBlur = 10;
    }
    if (style.outline && style.outline !== "transparent") {
      ctx.lineWidth = Math.max(3, fontSize * 0.14);
      ctx.strokeStyle = style.outline;
      ctx.strokeText(text, x, y);
    }
    ctx.shadowBlur = style.shadow ? 4 : 0;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.shadowBlur = 0;
  };

  if ("words" in caption) {
    const gap = fontSize * 0.32;
    const widths = caption.words.map((wd) => ctx.measureText(wd.word).width);
    const totalW = widths.reduce((a, b) => a + b, 0) + gap * (caption.words.length - 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(w / 2, yBase + yOffset);
    ctx.scale(pop, pop);
    // backdrop pill for loud presets
    if (style.preset === "tiktok" || style.preset === "shorts" || style.preset === "gaming") {
      ctx.fillStyle = style.preset === "gaming" ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.38)";
      roundRect(ctx, -totalW / 2 - fontSize * 0.5, -fontSize * 0.85, totalW + fontSize, fontSize * 1.7, fontSize * 0.45);
      ctx.fill();
    }
    let x = -totalW / 2;
    caption.words.forEach((wd, i) => {
      drawWord(wd.word, x + widths[i] / 2, 0, wd.active ? style.highlight : style.color, wd.active);
      x += widths[i] + gap;
    });
    ctx.restore();
  } else {
    ctx.save();
    ctx.globalAlpha = alpha;
    const lines = wrapText(ctx, caption.text, w * 0.84).slice(0, 2);
    lines.forEach((line, i) => {
      const y = yBase + yOffset + (i - (lines.length - 1) / 2) * fontSize * 1.3;
      if (style.shadow) { ctx.shadowColor = "rgba(0,0,0,0.85)"; ctx.shadowBlur = 10; }
      if (style.outline && style.outline !== "transparent") {
        ctx.lineWidth = Math.max(3, fontSize * 0.12);
        ctx.strokeStyle = style.outline;
        ctx.strokeText(line, w / 2, y);
      }
      ctx.fillStyle = style.color;
      ctx.fillText(line, w / 2, y);
    });
    ctx.restore();
  }
  ctx.restore();
}

export function buildRenderInput(scenes: Scene[], captionStyle: CaptionStyle, style: string, timeline?: Track[], watermark?: string, avatarUrl?: string | null, speaking = false): RenderInput {
  const textTrack = timeline?.find((t) => t.type === "text");
  const subsTrack = timeline?.find((t) => t.type === "subtitle");
  return {
    scenes,
    captionStyle,
    style,
    textTrackClips: textTrack && !textTrack.muted ? textTrack.clips.map((c) => ({ start: c.start, duration: c.duration, payload: c.payload })) : [],
    subtitlesMuted: subsTrack?.muted ?? false,
    watermark,
    avatarUrl: avatarUrl ?? undefined,
    speaking,
  };
}
