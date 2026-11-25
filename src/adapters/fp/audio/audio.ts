// Procedural sound with WebAudio: no sample files. Nothing plays until the player's first click, tap
// or key press (browsers require a gesture); an ambience asked for before then starts at that moment.
// Volume and mute follow the player's settings (casework.fp.settings) on their own, and the engine
// can also set them. Patterns ported from Frozen Star's audio.js (MIT, same owner).
//
// Ambiences (one fixed graph each, crossfaded): office (fluorescent hum + HVAC), morgue (walk-in
// cooler compressor cycling + fan), house-night (still room, fridge, clock, crickets outside),
// house-day (distant traffic, birds, clock), basement (low rumble, furnace, drips).
// One-shots: step, door, click, paper, drawer, beep, sign, success, fail. Nodes are made per sound,
// never per frame.
import { loadSettings, onSettingsChange } from "../ui/settings.ts";

export type SfxKey = "step" | "door" | "click" | "paper" | "drawer" | "beep" | "sign" | "success" | "fail";
export interface Audio { ambience(key: string | null): void; sfx(key: SfxKey): void; setVolume(v: number): void; setMuted(m: boolean): void }

export const AMBIENCES = ["office", "morgue", "house-night", "house-day", "basement"] as const;
export const SFX: readonly SfxKey[] = ["step", "door", "click", "paper", "drawer", "beep", "sign", "success", "fail"];

/** Slider volume is perceptual: square it so 50% sounds like half. */
export function gainFor(volume: number, muted: boolean): number {
  const v = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0;
  return muted ? 0 : v * v;
}

interface Amb { out: GainNode; stop(at: number): void; timers: number[] }

export function createAudio(opts: { context?: BaseAudioContext } = {}): Audio & { readonly started: boolean; dispose(): void; /** extra: the last few sounds played, for tests and debugging */ readonly log: string[] } {
  const s0 = loadSettings();
  let volume = s0.volume, muted = s0.muted;
  let ctx: BaseAudioContext | null = null;
  let master: GainNode | null = null, ambBus: GainNode | null = null, sfxBus: GainNode | null = null;
  let noise: AudioBuffer | null = null, brown: AudioBuffer | null = null;
  let want: string | null = null, playing: { key: string; amb: Amb } | null = null;
  let disposed = false;
  let lastStep = 0;
  const log: string[] = [];
  const note = (n: string) => {
    log.push(n);
    if (log.length > 40) log.shift();
  };
  const safe = <A extends unknown[]>(fn: (...a: A) => void) => (...a: A) => {
    try {
      fn(...a);
    } catch {
      /* audio is never worth breaking the game over */
    }
  };

  function ensure(): boolean {
    if (disposed) return false;
    if (ctx) {
      if (ctx instanceof AudioContext && ctx.state === "suspended" && !document.hidden) ctx.resume().catch(() => {});
      return true;
    }
    if (opts.context) ctx = opts.context;
    else {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return false;
      ctx = new AC({ latencyHint: "playback" });
    }
    build();
    return true;
  }

  function buf(sec: number, isBrown: boolean): AudioBuffer {
    const c = ctx as BaseAudioContext;
    const b = c.createBuffer(1, Math.floor(c.sampleRate * sec), c.sampleRate);
    const d = b.getChannelData(0);
    let acc = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (isBrown) {
        acc = (acc + 0.02 * w) / 1.02;
        d[i] = acc * 3.5;
      } else d[i] = w;
    }
    return b;
  }
  const g = (v: number, to?: AudioNode) => {
    const n = (ctx as BaseAudioContext).createGain();
    n.gain.value = v;
    if (to) n.connect(to);
    return n;
  };
  const f = (type: BiquadFilterType, freq: number, q: number, to?: AudioNode) => {
    const n = (ctx as BaseAudioContext).createBiquadFilter();
    n.type = type;
    n.frequency.value = freq;
    n.Q.value = q;
    if (to) n.connect(to);
    return n;
  };
  const o = (type: OscillatorType, freq: number, to?: AudioNode) => {
    const n = (ctx as BaseAudioContext).createOscillator();
    n.type = type;
    n.frequency.value = freq;
    if (to) n.connect(to);
    return n;
  };
  const src = (b: AudioBuffer, to: AudioNode, loop = true) => {
    const n = (ctx as BaseAudioContext).createBufferSource();
    n.buffer = b;
    n.loop = loop;
    n.connect(to);
    return n;
  };

  function build(): void {
    const c = ctx as BaseAudioContext;
    master = g(gainFor(volume, muted));
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.25;
    master.connect(f("highpass", 28, 0.5, comp));
    comp.connect(c.destination);
    ambBus = g(0.9, master);
    sfxBus = g(1, master);
    noise = buf(2, false);
    brown = buf(3, true);
    if (want) startAmb(want);
  }

  const applyLevel = () => {
    if (master && ctx) master.gain.setTargetAtTime(gainFor(volume, muted), ctx.currentTime, 0.08);
  };

  // ---------- ambiences ----------
  /** A recurring event at random intervals while an ambience plays (a drip, a bird, a clock tick). */
  function every(amb: Amb, min: number, max: number, fn: (t: number) => void): void {
    const go = () => {
      if (!ctx || disposed) return;
      safe(fn)(ctx.currentTime + 0.05);
      amb.timers.push(window.setTimeout(go, (min + Math.random() * (max - min)) * 1000));
    };
    amb.timers.push(window.setTimeout(go, (min + Math.random() * (max - min)) * 500));
  }
  function blip(to: AudioNode, t: number, freq: number, dur: number, vol: number, type: OscillatorType = "sine", glideTo?: number): void {
    const e = g(0, to);
    const n = o(type, freq, e);
    if (glideTo) n.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(vol, t + Math.min(0.01, dur / 4));
    e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.start(t);
    n.stop(t + dur + 0.05);
  }
  function burst(to: AudioNode, t: number, dur: number, vol: number, type: BiquadFilterType, freq: number, q = 0.8, attack = 0.004): void {
    const e = g(0, to);
    const fl = f(type, freq, q, e);
    const n = src(noise as AudioBuffer, fl, false);
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(vol, t + attack);
    e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.start(t, Math.random() * 1.5);
    n.stop(t + dur + 0.05);
  }

  function makeAmb(key: string): Amb | null {
    const c = ctx as BaseAudioContext;
    const t = c.currentTime;
    const out = g(0, ambBus as GainNode);
    const nodes: AudioScheduledSourceNode[] = [];
    const amb: Amb = {
      out,
      timers: [],
      stop(at) {
        for (const id of amb.timers) clearTimeout(id);
        amb.timers = [];
        for (const n of nodes) {
          try {
            n.stop(at);
          } catch {
            /* already stopped */
          }
        }
      },
    };
    const keep = <N extends AudioScheduledSourceNode>(n: N) => {
      nodes.push(n);
      n.start(t);
      return n;
    };
    const lfo = (rate: number, depth: number, param: AudioParam) => {
      const l = o("sine", rate);
      l.connect(g(depth)).connect(param);
      keep(l);
    };
    switch (key) {
      case "office": {
        // fluorescent tubes: 120 Hz mains buzz with a few harmonics, thin and steady
        const buzz = g(0.05, f("lowpass", 1400, 0.7, out));
        keep(o("sawtooth", 120, g(0.35, buzz)));
        keep(o("sine", 240, g(0.5, buzz)));
        keep(o("sine", 360.5, g(0.18, buzz)));
        // HVAC: brown noise through a soft low-pass, breathing slowly
        const hv = g(0.32, out);
        keep(src(brown as AudioBuffer, f("lowpass", 520, 0.5, hv)));
        lfo(0.07, 0.08, hv.gain);
        // a vent's hiss on top
        keep(src(noise as AudioBuffer, f("bandpass", 2600, 0.6, g(0.012, out))));
        break;
      }
      case "morgue": {
        // walk-in cooler: a compressor that cycles on and off (a slow square-ish swell), and its fan
        const comp = g(0, out);
        const body = f("lowpass", 220, 1.2, comp);
        keep(o("sawtooth", 50, g(0.4, body)));
        keep(o("triangle", 100.3, g(0.3, body)));
        const cyc = o("sine", 1 / 26);
        const shape = (c as BaseAudioContext).createWaveShaper();
        shape.curve = new Float32Array(Array.from({ length: 64 }, (_, i) => Math.max(0, Math.tanh(((i / 63) * 2 - 1) * 4)) * 0.22));
        cyc.connect(shape).connect(comp.gain);
        keep(cyc);
        keep(src(brown as AudioBuffer, f("bandpass", 180, 0.7, g(0.22, out))));
        keep(src(noise as AudioBuffer, f("bandpass", 1200, 1.5, g(0.01, out))));
        // stainless steel: an occasional faint tick of the cooling pipes
        every(amb, 7, 16, (at) => blip(out, at, 2400 + Math.random() * 500, 0.06, 0.02));
        break;
      }
      case "house-night": {
        keep(src(brown as AudioBuffer, f("lowpass", 260, 0.5, g(0.12, out))));
        // the fridge in the next room
        keep(o("sine", 60, g(0.025, f("lowpass", 200, 0.7, out))));
        keep(o("sine", 120.4, g(0.012, out)));
        // a wall clock
        let tick = 0;
        every(amb, 1, 1, (at) => blip(out, at, ++tick % 2 ? 3100 : 2700, 0.025, 0.03, "triangle"));
        // crickets outside, through the glass
        const cr = f("lowpass", 5200, 0.7, g(0.6, out));
        every(amb, 1.4, 3.2, (at) => {
          for (let i = 0; i < 3; i++) blip(cr, at + i * 0.07, 4400 + Math.random() * 120, 0.045, 0.012);
        });
        break;
      }
      case "house-day": {
        // distant traffic: brown noise swelling slowly through a window
        const tr = g(0.18, out);
        keep(src(brown as AudioBuffer, f("lowpass", 700, 0.5, tr)));
        lfo(0.05, 0.08, tr.gain);
        keep(src(noise as AudioBuffer, f("highpass", 3000, 0.5, g(0.006, out))));
        let tick = 0;
        every(amb, 1, 1, (at) => blip(out, at, ++tick % 2 ? 3100 : 2700, 0.025, 0.022, "triangle"));
        // birds outside: short falling chirps
        every(amb, 3, 9, (at) => {
          const n = 2 + Math.floor(Math.random() * 3), base = 2600 + Math.random() * 1200;
          for (let i = 0; i < n; i++) blip(out, at + i * 0.11, base * (1 + Math.random() * 0.1), 0.08, 0.018, "sine", base * 0.7);
        });
        break;
      }
      case "basement": {
        keep(src(brown as AudioBuffer, f("lowpass", 120, 0.7, g(0.45, out))));
        // the furnace: a deep hum with a slow beat
        const fu = g(0.05, f("lowpass", 160, 0.8, out));
        keep(o("sawtooth", 45, fu));
        keep(o("sine", 45.6, g(0.6, fu)));
        lfo(0.11, 0.02, fu.gain);
        // drips in the corner
        every(amb, 2.5, 7, (at) => blip(out, at, 1500 + Math.random() * 500, 0.12, 0.05, "sine", 700));
        break;
      }
      default:
        return null;
    }
    return amb;
  }

  function startAmb(key: string | null): void {
    if (!ctx) return;
    const t = ctx.currentTime;
    if (playing && playing.key === key) return;
    if (playing) {
      const old = playing.amb;
      old.out.gain.cancelScheduledValues(t);
      old.out.gain.setTargetAtTime(0, t, 0.4);
      old.stop(t + 2.5);
      playing = null;
    }
    if (!key) return;
    const amb = makeAmb(key);
    if (!amb) return;
    amb.out.gain.setTargetAtTime(1, t, 0.5);
    playing = { key, amb };
    note(`ambience:${key}`);
  }

  // ---------- one-shots ----------
  function play(key: SfxKey): void {
    if (!ctx || !sfxBus) return;
    const t = ctx.currentTime + 0.01;
    const out = sfxBus;
    switch (key) {
      case "step": {
        if (t - lastStep < 0.12) return;
        lastStep = t;
        // heel thud and a little sole scuff, a bit different every time
        const k = 0.8 + Math.random() * 0.4;
        blip(out, t, 85 * k, 0.09, 0.22, "sine", 55);
        burst(out, t, 0.07, 0.05 * k, "bandpass", 900 * k, 0.9);
        break;
      }
      case "door": {
        // latch click, a short hinge creak, then the door settling against its frame
        burst(out, t, 0.03, 0.18, "highpass", 3000, 0.7, 0.001);
        const cr = g(0, out);
        const bp = f("bandpass", 600, 8, cr);
        const saw = o("sawtooth", 140, bp);
        saw.frequency.setValueAtTime(140, t + 0.05);
        saw.frequency.linearRampToValueAtTime(95, t + 0.5);
        cr.gain.setValueAtTime(0, t + 0.05);
        cr.gain.linearRampToValueAtTime(0.06, t + 0.12);
        cr.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
        saw.start(t + 0.05);
        saw.stop(t + 0.6);
        blip(out, t + 0.55, 70, 0.25, 0.3, "sine", 45);
        burst(out, t + 0.55, 0.12, 0.08, "lowpass", 400);
        break;
      }
      case "click":
        blip(out, t, 1800, 0.03, 0.06, "triangle");
        blip(out, t, 900, 0.04, 0.03);
        break;
      case "paper":
        // a sheet lifted: bright noise with a little flutter
        for (let i = 0; i < 4; i++) burst(out, t + i * 0.045 + Math.random() * 0.02, 0.09, 0.05 - i * 0.008, "highpass", 2500 + Math.random() * 1500, 0.6, 0.01);
        break;
      case "drawer": {
        // a metal drawer runs on its rails, then stops with a thunk
        const e = g(0, out);
        const bp = f("bandpass", 380, 2.5, e);
        const n = src(noise as AudioBuffer, bp, false);
        bp.frequency.linearRampToValueAtTime(520, t + 0.35);
        e.gain.setValueAtTime(0, t);
        e.gain.linearRampToValueAtTime(0.12, t + 0.05);
        e.gain.setValueAtTime(0.12, t + 0.3);
        e.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
        n.start(t);
        n.stop(t + 0.42);
        blip(out, t + 0.36, 110, 0.18, 0.25, "sine", 70);
        blip(out, t + 0.36, 1300, 0.12, 0.03, "triangle");
        break;
      }
      case "beep":
        blip(out, t, 880, 0.14, 0.08);
        break;
      case "sign": {
        // a pen across paper: short scratches in a quick rhythm, then the full stop
        for (let i = 0; i < 7; i++) burst(out, t + i * 0.075 + Math.random() * 0.02, 0.06, 0.04, "bandpass", 3400 + Math.random() * 1600, 2.2, 0.008);
        burst(out, t + 0.62, 0.03, 0.05, "bandpass", 2600, 1.5, 0.002);
        break;
      }
      case "success":
        // two soft rising notes (C5 → G5) with a bell-like overtone
        for (const [i, fr] of [523.25, 783.99].entries()) {
          blip(out, t + i * 0.12, fr, 0.5, 0.09, "triangle");
          blip(out, t + i * 0.12, fr * 2, 0.3, 0.02);
        }
        break;
      case "fail":
        // two low falling notes, muted (not a buzzer: it's a learning game)
        blip(f("lowpass", 900, 0.7, out), t, 330, 0.18, 0.08, "square");
        blip(f("lowpass", 900, 0.7, out), t + 0.16, 262, 0.26, 0.08, "square");
        break;
    }
    note(`sfx:${key}`);
  }

  // ---------- start on the first gesture; quiet while hidden ----------
  const unlock = safe(() => {
    if (ensure()) {
      removeEventListener("pointerdown", unlock, true);
      removeEventListener("keydown", unlock, true);
      removeEventListener("touchend", unlock, true);
    }
  });
  const onVis = safe(() => {
    if (!(ctx instanceof AudioContext)) return;
    (document.hidden ? ctx.suspend() : ctx.resume()).catch(() => {});
  });
  const offSettings = onSettingsChange((s) => {
    volume = s.volume;
    muted = s.muted;
    applyLevel();
  });
  if (opts.context) ensure();
  else if (typeof window !== "undefined") {
    const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
    if (ua?.hasBeenActive) unlock();
    addEventListener("pointerdown", unlock, true);
    addEventListener("keydown", unlock, true);
    addEventListener("touchend", unlock, true);
    document.addEventListener("visibilitychange", onVis);
  }

  return {
    get started() {
      return !!ctx;
    },
    log,
    ambience: safe((key: string | null) => {
      want = key;
      startAmb(key);
    }),
    sfx: safe((key: SfxKey) => play(key)),
    setVolume: safe((v: number) => {
      volume = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : volume;
      applyLevel();
    }),
    setMuted: safe((m: boolean) => {
      muted = !!m;
      applyLevel();
    }),
    dispose() {
      disposed = true;
      offSettings();
      if (playing && ctx) playing.amb.stop(ctx.currentTime);
      playing = null;
      if (typeof window !== "undefined") {
        removeEventListener("pointerdown", unlock, true);
        removeEventListener("keydown", unlock, true);
        removeEventListener("touchend", unlock, true);
        document.removeEventListener("visibilitychange", onVis);
      }
      if (ctx instanceof AudioContext) ctx.close().catch(() => {});
    },
  };
}
