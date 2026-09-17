import { audioCtx } from "./music";

/**
 * Synthesized SFX library — every sound generated with the Web Audio API.
 * No samples, no downloads, no paid libraries.
 */

let noiseBuf: AudioBuffer | null = null;
function getNoise(ctx: AudioContext): AudioBuffer {
  if (!noiseBuf) {
    const len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function noiseHit(ctx: AudioContext, dest: AudioNode, when: number, dur: number, filterType: BiquadFilterType, freqStart: number, freqEnd: number, peak: number, q = 1) {
  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  const flt = ctx.createBiquadFilter();
  flt.type = filterType;
  flt.Q.value = q;
  flt.frequency.setValueAtTime(freqStart, when);
  flt.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd), when + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(peak, when + dur * 0.25);
  g.gain.exponentialRampToValueAtTime(0.001, when + dur);
  src.connect(flt); flt.connect(g); g.connect(dest);
  src.start(when, Math.random() * 1.2);
  src.stop(when + dur + 0.05);
}

function toneBlip(ctx: AudioContext, dest: AudioNode, when: number, freq: number, dur: number, peak = 0.25, type: OscillatorType = "sine", slide = 0) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), when + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(peak, when);
  g.gain.exponentialRampToValueAtTime(0.001, when + dur);
  osc.connect(g); g.connect(dest);
  osc.start(when); osc.stop(when + dur + 0.02);
}

export function scheduleSfx(id: string, ctx: AudioContext, dest: AudioNode, when: number) {
  const t = Math.max(when, ctx.currentTime);
  switch (id) {
    case "whoosh": noiseHit(ctx, dest, t, 0.45, "bandpass", 400, 3200, 0.5, 1.6); break;
    case "swoosh": noiseHit(ctx, dest, t, 0.3, "bandpass", 2600, 500, 0.4, 2); break;
    case "riser": noiseHit(ctx, dest, t, 1.1, "bandpass", 220, 4200, 0.42, 3); break;
    case "sweep": noiseHit(ctx, dest, t, 0.9, "highpass", 4200, 300, 0.35, 1); break;
    case "impact": {
      toneBlip(ctx, dest, t, 120, 0.4, 0.7, "sine", -90);
      noiseHit(ctx, dest, t, 0.18, "lowpass", 2400, 200, 0.5);
      break;
    }
    case "boom": toneBlip(ctx, dest, t, 70, 0.9, 0.8, "sine", -45); break;
    case "thud": { toneBlip(ctx, dest, t, 180, 0.16, 0.55, "triangle", -110); noiseHit(ctx, dest, t, 0.09, "lowpass", 900, 200, 0.35); break; }
    case "click": toneBlip(ctx, dest, t, 2200, 0.03, 0.22, "square"); break;
    case "pop": toneBlip(ctx, dest, t, 620, 0.09, 0.4, "sine", 480); break;
    case "tick": toneBlip(ctx, dest, t, 3400, 0.025, 0.18, "square"); break;
    case "chime": { toneBlip(ctx, dest, t, 880, 0.5, 0.3); toneBlip(ctx, dest, t + 0.12, 1320, 0.6, 0.3); break; }
    case "ding": { toneBlip(ctx, dest, t, 1180, 0.7, 0.35, "triangle"); toneBlip(ctx, dest, t, 2360, 0.4, 0.12); break; }
    case "cinehit": { toneBlip(ctx, dest, t, 90, 1.2, 0.7, "sawtooth", -60); noiseHit(ctx, dest, t, 0.8, "lowpass", 3000, 120, 0.5); break; }
    case "rain": noiseHit(ctx, dest, t, 1.6, "highpass", 1400, 1400, 0.14); break;
    case "wind": noiseHit(ctx, dest, t, 1.8, "bandpass", 300, 800, 0.2, 0.6); break;
    case "cityhum": noiseHit(ctx, dest, t, 1.8, "lowpass", 240, 240, 0.22); break;
    case "siren": {
      for (let i = 0; i < 3; i++) {
        toneBlip(ctx, dest, t + i * 0.6, 660, 0.3, 0.22, "triangle", 220);
        toneBlip(ctx, dest, t + i * 0.6 + 0.3, 880, 0.3, 0.22, "triangle", -220);
      }
      break;
    }
    case "engine": { toneBlip(ctx, dest, t, 85, 1.1, 0.4, "sawtooth", 90); noiseHit(ctx, dest, t + 0.1, 0.9, "lowpass", 400, 900, 0.2); break; }
    case "glitch": { for (let i = 0; i < 6; i++) toneBlip(ctx, dest, t + i * 0.045, 300 + Math.random() * 2400, 0.04, 0.16, "square"); break; }
    case "beep": { toneBlip(ctx, dest, t, 1046, 0.08, 0.25, "square"); toneBlip(ctx, dest, t + 0.1, 1046, 0.08, 0.25, "square"); break; }
    default: toneBlip(ctx, dest, t, 800, 0.2, 0.25);
  }
}

export function playSfx(id: string) {
  try {
    const ctx = audioCtx();
    scheduleSfx(id, ctx, ctx.destination, ctx.currentTime);
  } catch { /* audio unavailable */ }
}
