import type { MusicMood } from "@/lib/types";
import { clamp } from "@/lib/utils";

/**
 * Procedural music engine — 100% Web Audio API, zero samples, zero cost.
 * Generates an endless adaptive score in 9 moods, with auto-ducking
 * under the voiceover. Works fully offline.
 */

interface MoodConfig {
  chords: number[][];      // semitone offsets per chord
  bass: number[];          // bass root offsets
  bpm: number;
  padWave: OscillatorType;
  arpWave: OscillatorType;
  arpDensity: number;      // 0-1
  drumLevel: number;       // 0-1
  hatLevel: number;
  cutoff: number;
  barBeats: number;
  swing: number;
}

const f = (semi: number, base = 110) => base * Math.pow(2, semi / 12);

const MOODS: Record<Exclude<MusicMood, "none">, MoodConfig> = {
  cinematic: { chords: [[0, 3, 7, 14], [-4, 0, 3, 10], [-9, -5, -2, 7], [-2, 2, 5, 12]], bass: [0, -4, -9, -2], bpm: 72, padWave: "sawtooth", arpWave: "triangle", arpDensity: 0.5, drumLevel: 0.5, hatLevel: 0.15, cutoff: 900, barBeats: 4, swing: 0 },
  dramatic:  { chords: [[0, 3, 7, 10], [0, 3, 7, 10], [-4, -1, 3, 8], [-2, 2, 5, 9]], bass: [0, 0, -4, -2], bpm: 88, padWave: "sawtooth", arpWave: "square", arpDensity: 0.3, drumLevel: 0.7, hatLevel: 0.1, cutoff: 700, barBeats: 4, swing: 0 },
  happy:     { chords: [[0, 4, 7, 11], [7, 11, 14, 16], [9, 12, 16, 19], [5, 9, 12, 16]], bass: [0, 7, 9, 5], bpm: 116, padWave: "triangle", arpWave: "square", arpDensity: 0.8, drumLevel: 0.7, hatLevel: 0.4, cutoff: 2400, barBeats: 4, swing: 0.05 },
  sad:       { chords: [[0, 3, 7, 10], [-4, -1, 3, 8], [-7, -4, 0, 5], [-2, 2, 5, 9]], bass: [0, -4, -7, -2], bpm: 60, padWave: "sine", arpWave: "sine", arpDensity: 0.25, drumLevel: 0, hatLevel: 0, cutoff: 1100, barBeats: 4, swing: 0 },
  suspense:  { chords: [[0, 1, 7, 8], [0, 3, 6, 7], [0, 1, 6, 7], [-1, 0, 5, 7]], bass: [0, 0, 0, -1], bpm: 76, padWave: "sawtooth", arpWave: "sine", arpDensity: 0.2, drumLevel: 0.5, hatLevel: 0.06, cutoff: 420, barBeats: 4, swing: 0 },
  news:      { chords: [[0, 3, 7, 12], [0, 3, 7, 12], [5, 8, 12, 15], [7, 10, 14, 19]], bass: [0, 0, 5, 7], bpm: 126, padWave: "square", arpWave: "square", arpDensity: 0.9, drumLevel: 0.8, hatLevel: 0.5, cutoff: 1800, barBeats: 4, swing: 0 },
  documentary:{ chords: [[0, 4, 7, 14], [9, 12, 16, 21], [5, 9, 12, 17], [7, 11, 14, 19]], bass: [0, 9, 5, 7], bpm: 84, padWave: "triangle", arpWave: "sine", arpDensity: 0.4, drumLevel: 0.2, hatLevel: 0.08, cutoff: 1300, barBeats: 4, swing: 0 },
  epic:      { chords: [[0, 3, 7, 12], [-4, 0, 3, 8], [-2, 2, 5, 10], [-7, -4, 0, 5]], bass: [0, -4, -2, -7], bpm: 94, padWave: "sawtooth", arpWave: "sawtooth", arpDensity: 0.55, drumLevel: 1, hatLevel: 0.3, cutoff: 1500, barBeats: 4, swing: 0 },
  chill:     { chords: [[2, 5, 9, 12], [7, 11, 14, 16], [0, 4, 7, 11], [9, 12, 16, 19]], bass: [2, 7, 0, 9], bpm: 78, padWave: "triangle", arpWave: "sine", arpDensity: 0.45, drumLevel: 0.45, hatLevel: 0.35, cutoff: 1000, barBeats: 4, swing: 0.14 },
};

let sharedCtx: AudioContext | null = null;
export const audioCtx = () => {
  if (!sharedCtx) sharedCtx = new AudioContext();
  if (sharedCtx.state === "suspended") void sharedCtx.resume();
  return sharedCtx;
};

export class MusicEngine {
  private ctx: AudioContext;
  private out: GainNode;
  private duck: GainNode;
  private filter: BiquadFilterNode;
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private nextTime = 0;
  private mood: Exclude<MusicMood, "none"> = "cinematic";
  private running = false;
  private noiseBuf: AudioBuffer;
  volume = 0.3;

  constructor(ctx?: AudioContext, destination?: AudioNode) {
    this.ctx = ctx ?? audioCtx();
    this.duck = this.ctx.createGain();
    this.out = this.ctx.createGain();
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 1200;
    this.filter.connect(this.duck);
    this.duck.connect(this.out);
    this.out.gain.value = this.volume;
    this.out.connect(destination ?? this.ctx.destination);
    const len = this.ctx.sampleRate * 1;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  setVolume(v: number) {
    this.volume = clamp(v, 0, 1);
    this.out.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.1);
  }

  setDucked(ducked: boolean) {
    const target = ducked ? 0.22 : 1;
    this.duck.gain.setTargetAtTime(target, this.ctx.currentTime, ducked ? 0.18 : 0.6);
  }

  start(mood: MusicMood) {
    if (mood === "none") return;
    this.stop();
    this.mood = mood;
    const cfg = MOODS[this.mood];
    this.filter.frequency.setValueAtTime(cfg.cutoff, this.ctx.currentTime);
    this.running = true;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 40);
  }

  stop() {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  dispose() {
    this.stop();
    try { this.out.disconnect(); } catch { /* noop */ }
  }

  private schedule() {
    if (!this.running) return;
    const cfg = MOODS[this.mood];
    const stepDur = 60 / cfg.bpm / 4; // 16th notes
    while (this.nextTime < this.ctx.currentTime + 0.25) {
      this.playStep(this.step, this.nextTime, cfg, stepDur);
      this.step++;
      this.nextTime += stepDur * (this.step % 4 === 2 ? 1 - cfg.swing : 1 + cfg.swing * 0.5);
    }
  }

  private playStep(step: number, when: number, cfg: MoodConfig, stepDur: number) {
    const stepsPerBar = cfg.barBeats * 4;
    const bar = Math.floor(step / stepsPerBar);
    const stepInBar = step % stepsPerBar;
    const chordIdx = bar % cfg.chords.length;
    const chord = cfg.chords[chordIdx];

    // pad at bar start
    if (stepInBar === 0) {
      for (const semi of chord) this.tone(f(semi), when, stepDur * stepsPerBar * 0.95, cfg.padWave, 0.05, 0.4, 1.2);
    }
    // bass
    const bassPattern = [0, 8, 12, 8 + (cfg.barBeats >= 4 ? 4 : 0)];
    if (bassPattern.includes(stepInBar)) {
      this.tone(f(cfg.bass[chordIdx], 55), when, stepDur * 3.5, "sine", 0.16, 0.01, 0.2);
    }
    // arp
    if (cfg.arpDensity > 0 && stepInBar % 2 === 0 && Math.random() < cfg.arpDensity) {
      const note = chord[(step / 2) % chord.length] + 12;
      this.tone(f(note, 220), when + (stepInBar % 4 === 2 ? cfg.swing * stepDur : 0), stepDur * 1.6, cfg.arpWave, 0.045, 0.005, 0.12);
    }
    // drums
    if (cfg.drumLevel > 0) {
      if (stepInBar % 8 === 0 || (this.mood === "epic" && stepInBar % 8 === 6)) this.kick(when, cfg.drumLevel, this.mood === "suspense");
      if (cfg.barBeats === 4 && (stepInBar === 8)) this.snare(when, cfg.drumLevel * 0.5);
    }
    // hats
    if (cfg.hatLevel > 0 && stepInBar % 4 === 2) this.hat(when, cfg.hatLevel);
  }

  private tone(freq: number, when: number, dur: number, wave: OscillatorType, level: number, attack: number, release: number) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.value = freq;
    // slight detune for warmth
    const osc2 = this.ctx.createOscillator();
    osc2.type = wave;
    osc2.frequency.value = freq * 1.004;
    const g2 = this.ctx.createGain();
    g2.gain.value = 0.5;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(level, when + attack);
    g.gain.setTargetAtTime(0, when + dur - release, release / 3);
    osc.connect(g); osc2.connect(g2); g2.connect(g);
    g.connect(this.filter);
    osc.start(when); osc2.start(when);
    osc.stop(when + dur + release * 3); osc2.stop(when + dur + release * 3);
  }

  private kick(when: number, level: number, heartbeat = false) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(heartbeat ? 70 : 130, when);
    osc.frequency.exponentialRampToValueAtTime(38, when + 0.14);
    g.gain.setValueAtTime(0.5 * level, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.22);
    osc.connect(g); g.connect(this.filter);
    osc.start(when); osc.stop(when + 0.25);
    if (heartbeat) {
      const osc2 = this.ctx.createOscillator();
      const g2 = this.ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(60, when + 0.28);
      osc2.frequency.exponentialRampToValueAtTime(35, when + 0.4);
      g2.gain.setValueAtTime(0.32 * level, when + 0.28);
      g2.gain.exponentialRampToValueAtTime(0.001, when + 0.48);
      osc2.connect(g2); g2.connect(this.filter);
      osc2.start(when + 0.28); osc2.stop(when + 0.5);
    }
  }

  private snare(when: number, level: number) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 1900; bp.Q.value = 0.8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.22 * level, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.16);
    src.connect(bp); bp.connect(g); g.connect(this.filter);
    src.start(when, Math.random() * 0.5); src.stop(when + 0.2);
  }

  private hat(when: number, level: number) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = 8200;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.09 * level, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.05);
    src.connect(hp); hp.connect(g); g.connect(this.filter);
    src.start(when, Math.random() * 0.8); src.stop(when + 0.06);
  }
}
