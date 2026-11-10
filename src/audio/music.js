// The score. Each mood is a small ensemble that plays hand-written, voice-led progressions as
// phrases with real rests between them: a pass through the chords, then only the drone and the
// island. Which layers join a phrase, which progression, where the choir enters, how much of the
// melody is played: those are re-rolled every phrase, so twenty minutes never repeat exactly but
// nothing is improvised either.
import { midi, mtof, clamp } from './dsp.js';
import { padNote, choirNote, chime, pluck, drum, scrape, growl } from './instruments.js';
import { MOOD_K } from './levels.js';

const chords = (s) => s.split('|').map((c) => c.trim().split(/\s+/).map(midi));
const melody = (s) => s.split('|').map((c) => c.trim().split(/\s+/).map((x) => (x === '-' ? null : midi(x))));
const prog = (ch, mel) => ({ ch: chords(ch), mel: mel ? melody(mel) : null });
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Chords are written bass, tenor, alto, soprano. Upper voices move by step or stay.
// A melody lists, per chord, the bell notes spread over that chord ('-' is a rest).
const MOODS = {
  // D minor. The theme: a fifth and a third rising (A D F), the three Primes.
  title: {
    step: 8.5, rest: [12, 22], root: 38, drone: { g: 0.5, fifth: true, rest: 0.4 },
    pad: { g: 1, bright: 0.5 }, choir: { p: 0.65, g: 0.9, v: ['oo', 'ah'], min: 0.35 }, bell: { p: 0.8, g: 1, dk: 6 },
    progs: [
      prog('D2 A3 D4 F4|Bb2 Bb3 D4 F4|F2 A3 C4 F4|C3 G3 C4 E4|G2 G3 Bb3 D4|A2 F3 A3 D4|A2 E3 A3 D4|D2 F3 A3 D4', 'A4 D5 F5|-|C5|-|D5 - Bb4|-|E5 D5|D5'),
      prog('D2 F3 A3 D4|D2 G3 Bb3 D4|G2 G3 Bb3 Eb4|A2 A3 D4 E4|A2 A3 Cs4 E4|Bb2 Bb3 D4 F4|G2 Bb3 D4 E4|D2 A3 D4 F4', 'D5|-|Eb5 - D5|A4|E5 - Cs5|D5 F5|-|A4 D5'),
    ],
  },
  // Hearthfall. D Dorian: the raised sixth is the little warmth left in the moor.
  vale: {
    step: 7.5, rest: [18, 34], root: 38, drone: { g: 0.35, fifth: true },
    pad: { g: 0.85, bright: 0.45 }, choir: { p: 0.3, g: 0.6, v: ['mm', 'oo'], min: 0.55 }, pluck: { p: 0.75, g: 1, bright: 0.55, fig: 'rise', density: 0.6 },
    progs: [
      prog('D2 A3 D4 F4|G2 B3 D4 G4|D2 A3 D4 F4|C3 G3 C4 E4|A2 A3 C4 E4|F2 A3 C4 F4|G2 G3 B3 D4|D2 A3 D4 F4'),
      prog('A2 E3 A3 C4|F2 F3 A3 C4|C3 E3 G3 C4|G2 D3 G3 B3|D2 D3 F3 A3|F2 C3 F3 A3|G2 D3 G3 B3|A2 E3 A3 D4'),
    ],
  },
  // The Saltwood. E Phrygian in bare fifths, moving in parallel like plainchant. No warmth, no bass.
  saltwood: {
    step: 10, rest: [20, 38], root: 40, drone: { g: 0.22, fifth: true, air: 1.4 },
    pad: { g: 0.7, bright: 0.3, thin: true }, choir: { p: 0.7, g: 0.75, v: ['oo', 'oo'], min: 0.3 }, bell: { p: 0.55, g: 0.7, dk: 7, up: 12, stray: 0.35 },
    progs: [
      prog('E3 B3 E4 B4|F3 C4 F4 A4|E3 B3 E4 G4|D3 A3 D4 F4|C3 G3 C4 E4|D3 A3 D4 F4|F3 A3 C4 F4|E3 B3 E4 B4'),
      prog('E3 B3 E4 G4|E3 A3 E4 A4|F3 C4 F4 A4|G3 D4 G4 B4|F3 C4 F4 A4|E3 B3 E4 G4'),
    ],
  },
  // Quickmere. C sharp minor with ninths left hanging: still water, long harp figures.
  mere: {
    step: 9, rest: [18, 34], root: 37, drone: { g: 0.3, fifth: true },
    pad: { g: 0.8, bright: 0.6 }, choir: { p: 0.45, g: 0.6, v: ['oo', 'oh'], min: 0.45 }, pluck: { p: 0.8, g: 0.9, bright: 0.7, fig: 'harp', density: 0.5 },
    progs: [
      prog('Cs2 Gs3 Ds4 E4|A2 A3 Cs4 E4|E2 Gs3 B3 E4|B2 Fs3 B3 Ds4|Fs2 A3 Cs4 Fs4|Cs2 Gs3 Cs4 E4|Gs2 Gs3 B3 Ds4|Cs2 Gs3 Ds4 E4'),
      prog('A2 E3 A3 Cs4|B2 Fs3 B3 Ds4|Cs3 Gs3 Cs4 E4|Gs2 Ds3 Gs3 B3|A2 E3 A3 Cs4|Fs2 Cs3 Fs3 A3|Gs2 Ds3 Gs3 B3|Cs2 Gs3 Cs4 E4'),
    ],
  },
  // The Scar. A pedal with seconds and tritones ground against it; a reed growl underneath.
  scar: {
    step: 9.5, rest: [12, 24], root: 33, drone: { g: 0.5, fifth: false, dark: true, rest: 0.45 },
    pad: { g: 0.75, bright: 0.25 }, choir: { p: 0.3, g: 0.5, v: ['oh', 'eh'], min: 0.6 }, growl: 0.8, scrape: 0.5, transpose: [5],
    progs: [prog('A1 E3 A3 Bb3|A1 F3 Bb3 D4|A1 G3 Bb3 D4|A1 E3 A3 Cs4|A1 F3 A3 D4|Bb1 F3 Bb3 Eb4|A1 E3 A3 E4')],
  },
  // Greyhorn. Fourths and fifths stacked wide and high, thin as harmonics.
  heights: {
    step: 11, rest: [20, 38], root: 45, drone: { g: 0.2, fifth: true, air: 1.6 },
    pad: { g: 0.85, bright: 0.4, thin: true }, bell: { p: 0.4, g: 0.6, dk: 7, stray: 0.3 },
    progs: [prog('A2 E4 B4 E5|F2 C4 G4 C5|C3 G3 D4 G4|G2 D4 G4 A4|A2 E4 A4 B4|D2 A3 E4 A4|E2 B3 E4 B4|A2 E4 A4 E5')],
  },
  // Night anywhere. Low, close voicings and almost nothing else.
  night: {
    step: 12, rest: [24, 44], root: 38, drone: { g: 0.4, fifth: true, dark: true, rest: 0.2 },
    pad: { g: 0.6, bright: 0.2 }, choir: { p: 0.35, g: 0.5, v: ['mm', 'mm'], min: 0.4 }, bell: { p: 0.6, g: 0.6, dk: 8, stray: 0.3, up: 24 },
    progs: [prog('D2 A2 D3 A3|D2 A2 D3 F3|Bb1 Bb2 D3 F3|D2 A2 D3 A3|G1 G2 Bb2 D3|D2 A2 D3 F3')],
  },
  // The Gloom. A tritone and a minor second over D, a slow double heartbeat.
  gloom: {
    step: 7, rest: [8, 16], root: 38, drone: { g: 0.55, fifth: false, dark: true, tritone: true, rest: 0.5 },
    pad: { g: 0.55, bright: 0.2 }, choir: { p: 0.8, g: 0.7, v: ['eh', 'ah'], min: 0.3 }, drums: 'heart', scrape: 0.9,
    progs: [prog('D2 Gs3 D4 Eb4|D2 A3 D4 Eb4|D2 Gs3 Cs4 Eb4|D2 G3 Cs4 D4|Eb2 A3 D4 G4|D2 Gs3 D4 Eb4')],
  },
  // At the cauldron. G Dorian, a quiet four-note figure that keeps the hands moving.
  brew: {
    step: 6.5, rest: [10, 18], root: 43, drone: { g: 0.25, fifth: true },
    pad: { g: 0.75, bright: 0.5 }, pluck: { p: 0.9, g: 0.9, bright: 0.5, fig: 'ostinato', density: 0.75 }, bell: { p: 0.3, g: 0.6, dk: 5, stray: 0.25 },
    progs: [
      prog('G2 G3 Bb3 D4|C3 G3 C4 E4|G2 G3 Bb3 D4|F2 A3 C4 F4|Eb2 G3 Bb3 Eb4|Bb2 F3 Bb3 D4|C3 G3 C4 E4|D2 A3 D4 Fs4'),
      prog('G2 D3 G3 Bb3|Bb2 D3 F3 Bb3|F2 C3 F3 A3|C3 E3 G3 C4|G2 D3 G3 Bb3|Eb2 Eb3 G3 Bb3|D2 D3 Fs3 A3|G2 D3 G3 Bb3'),
    ],
  },
  // The Great Work. One pedal D and a soprano that climbs an octave, step by step.
  opus: {
    step: 7, rest: [4, 9], root: 38, drone: { g: 0.55, fifth: true, rest: 0.7 },
    pad: { g: 1, bright: 0.65 }, choir: { p: 0.9, g: 0.9, v: ['oh', 'ah'], min: 0.3 }, bell: { p: 0.7, g: 0.9, dk: 6 }, drums: 'march',
    progs: [prog('D2 A3 D4 F4|D2 Bb3 D4 F4|D2 Bb3 D4 G4|D2 A3 E4 A4|D2 A3 F4 A4|D2 Bb3 F4 Bb4|D2 C4 G4 C5|D2 D4 A4 D5', 'A4 D5 F5|-|-|-|-|-|-|A5 D6')],
  },
  // After. The theme with its third raised.
  ending: {
    step: 9, rest: [10, 18], root: 38, drone: { g: 0.4, fifth: true, rest: 0.3 },
    pad: { g: 1, bright: 0.6 }, choir: { p: 0.9, g: 0.9, v: ['oo', 'ah'], min: 0.2 }, bell: { p: 0.9, g: 1, dk: 7 },
    progs: [
      prog('D2 A3 D4 Fs4|G2 B3 D4 G4|D2 A3 D4 Fs4|B2 Fs3 B3 D4|G2 G3 B3 D4|D2 A3 D4 Fs4|A2 E3 A3 Cs4|D2 Fs3 A3 D4', 'A4 D5 Fs5|-|E5 - D5|-|B4 D5|-|E5|D5'),
      prog('G2 D3 G3 B3|D2 A3 D4 Fs4|E2 B3 E4 G4|C3 G3 C4 E4|G2 B3 D4 G4|A2 A3 D4 E4|A2 A3 Cs4 E4|D2 A3 D4 Fs4', 'D5|Fs5 - A5|G5|-|B4 D5|-|E5 Cs5|D5'),
    ],
  },
};
export const MOOD_NAMES = [...Object.keys(MOODS), 'none'];

const VOICE_VEL = [0.9, 0.7, 0.75, 0.8];

class Ensemble {
  constructor(S, name, dry, wet, t0, intensity) {
    this.S = S;
    this.name = name;
    this.spec = MOODS[name];
    this.intensity = intensity;
    this.k = MOOD_K[name] ?? 1; // level trim of the whole ensemble
    this.out = S.gain(0);
    this.out.connect(dry);
    this.send = S.gain(this.spec.wet ?? 0.7);
    this.out.connect(this.send);
    this.send.connect(wet);
    this.layers = {};
    for (const k of ['pad', 'choir', 'bell', 'pluck', 'drum', 'fx', 'drone']) {
      const g = S.gain(0);
      g.connect(this.out);
      this.layers[k] = g;
    }
    this.setIntensity(intensity, t0, 0);
    this.events = [];
    this.phraseEnd = t0 + 0.4;
    this.last = -1;
    this.dead = false;
    this.droneSrc = [];
    this.sways = [];
    this.notes = []; // { end, srcs } of every note scheduled and not yet over
    this.pruned = t0;
    this.startDrone(t0);
  }

  setIntensity(I, t, tc = 0.8) {
    this.intensity = I;
    const L = this.layers,
      set = (p, v) => (tc > 0 ? p.setTargetAtTime(v, t, tc) : p.setValueAtTime(v, t));
    set(L.pad.gain, 0.5 + 0.5 * I);
    set(L.choir.gain, 0.4 + 0.6 * smooth(0.3, 0.85, I));
    set(L.bell.gain, 0.6 + 0.4 * I);
    set(L.pluck.gain, 0.6 + 0.4 * I);
    set(L.drum.gain, smooth(0.2, 0.9, I));
    set(L.fx.gain, 0.4 + 0.6 * I);
    set(L.drone.gain, 0.65 + 0.35 * I);
  }

  startDrone(t) {
    const S = this.S,
      d = this.spec.drone;
    if (!d) return;
    const f = mtof(this.spec.root);
    const keep = (s) => {
      this.droneSrc.push(s);
      return s;
    };
    const sway = (targets, rate, shape) => this.sways.push(S.sway(targets, rate, shape, t));
    const g = S.gain(0);
    g.gain.setValueAtTime(0, t);
    g.gain.setTargetAtTime(d.g, t, 1.2);
    // it breathes: the level and the colour never quite stand still
    const breath = S.gain(1);
    sway([breath.gain, 1, 0.2], 0.7, null);
    const cut = d.dark ? 150 : 190;
    const lp = S.bq('lowpass', cut);
    sway([lp.frequency, cut, 45], 0.5, null);
    const pre = S.gain(0.5);
    // three strings a few cents apart and not equally loud: the beats between them drift in and
    // out of step, so the drone moves without throbbing in time or dropping out
    for (const [cents, lvl] of [[-3.1, 0.8], [0.7, 1], [4.3, 0.55]]) S.chain(keep(S.osc('sawtooth', f, t, null, cents)), S.gain(lvl), pre);
    S.chain(keep(S.osc('sine', f / 2, t)), S.gain(0.5), pre);
    if (d.fifth) S.chain(keep(S.osc('sawtooth', f * 1.5, t, null, 2)), S.gain(0.25), pre);
    if (d.tritone) S.chain(keep(S.osc('sawtooth', f * 1.414, t, null, -3)), S.gain(0.3), pre);
    // between phrases the drone sinks almost away (see buildPhrase): the rests are rests
    this.droneRest = S.gain(1);
    S.chain(pre, lp, breath, g, this.droneRest, this.layers.drone);
    // air on the fourth harmonic, coming and going: the drone as wind in a pipe
    const air = S.gain(0);
    sway([air.gain, 0, d.air || 1], 0.9, 'rect');
    S.chain(keep(S.noise('pink', t)), S.bq('bandpass', f * 4, 30), S.bq('bandpass', f * 4, 12), air, g);
  }

  fadeIn(t, secs) {
    this.out.gain.setValueAtTime(0, t);
    this.out.gain.linearRampToValueAtTime(this.k, t + secs);
  }
  /** Fade to nothing and stop for good. Returns the time at which the ensemble can be torn down. */
  fadeOut(t, secs, from = 1) {
    this.dead = true;
    this.events.length = 0;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(from * this.k, t);
    this.out.gain.linearRampToValueAtTime(0, t + secs);
    // every source still running is told to stop while it is still connected, so nothing is orphaned
    const srcs = [...this.droneSrc];
    for (const n of this.notes) srcs.push(...n.srcs);
    this.notes.length = 0;
    for (const m of this.sways) m.until = t + secs + 0.2;
    for (const s of srcs) {
      try {
        s.stop(t + secs + 0.2);
      } catch (e) {
        /* already stopped */
      }
    }
    return t + secs + 0.4;
  }

  buildPhrase(t0) {
    const S = this.S,
      spec = this.spec,
      I = this.intensity,
      ev = this.events;
    const first = this.last < 0;
    let pi = S.int(0, spec.progs.length - 1);
    if (spec.progs.length > 1 && pi === this.last) pi = (pi + 1) % spec.progs.length;
    this.last = pi;
    const { ch, mel } = spec.progs[pi];
    const n = ch.length;
    // thin music plays only a breath of the progression
    let from = 0,
      to = n;
    if (I < 0.2) {
      const len = S.int(2, 3);
      from = S.int(0, n - len);
      to = from + len;
    }
    const step = spec.step * S.jit(1, 0.05);
    const at = [];
    let t = t0;
    for (let i = from; i < to; i++) {
      const d = step * (i === to - 1 ? 1.35 : 1) * S.jit(1, 0.04);
      at.push([t, d]);
      t += d;
    }
    const end = t;
    const tr = spec.transpose && S.chance(0.35) ? S.pick(spec.transpose) : 0;
    const start = (i) => at[i - from][0];
    const stop = (i) => at[i - from][0] + at[i - from][1];
    /** Hold a voice across chords that share its note instead of bowing it again. */
    const lines = (v, a, b, fn) => {
      let i = a;
      while (i < b) {
        let j = i;
        while (j + 1 < b && ch[j + 1][v] === ch[i][v]) j++;
        fn(ch[i][v] + tr, start(i), stop(j));
        i = j + 1;
      }
    };

    // strings: all four voices
    const soft = I < 0.2 ? 0.6 : 1;
    for (let v = 0; v < 4; v++) {
      lines(v, from, to, (m, a, b) => ev.push({ t: a + (v ? S.range(0, 0.35) : 0), type: 'pad', m, dur: b - a - 0.4, vel: VOICE_VEL[v] * spec.pad.g * soft }));
    }
    // choir: the upper voices, sometimes only from the middle of the phrase
    const c = spec.choir;
    if (c && I >= c.min && S.chance(c.p * (0.5 + 0.5 * I))) {
      const a0 = S.chance(0.5) ? from : from + Math.floor((to - from) / 2);
      const voices = S.chance(0.4) ? [1, 2, 3] : [2, 3];
      let flip = false;
      for (const v of voices) {
        lines(v, a0, to, (m, a, b) => {
          while (m > 72) m -= 12;
          while (m < 48) m += 12;
          flip = !flip;
          ev.push({ t: a + S.range(0.1, 0.5), type: 'choir', m, dur: b - a - 0.5, vel: 0.55 * c.g, v0: c.v[flip ? 0 : 1], v1: c.v[flip ? 1 : 0] });
        });
      }
    }
    // bell: the written melody, or stray chord notes high above
    const bl = spec.bell;
    if (bl && I >= 0.2 && S.chance(bl.p * (0.55 + 0.45 * I))) {
      for (let i = from; i < to; i++) {
        const d = at[i - from][1];
        if (mel && !bl.stray) {
          const row = mel[i];
          row.forEach((m, k) => {
            if (m === null || !S.chance(0.65 + 0.35 * I)) return;
            ev.push({ t: start(i) + d * (0.12 + (0.76 * k) / row.length), type: 'bell', m: m + tr + (bl.up || 0), vel: 0.8 * bl.g, dk: bl.dk });
          });
        } else if (S.chance(bl.stray || 0.3)) {
          let m = ch[i][S.pick([2, 3, 3])] + tr + (bl.up || 0);
          while (m < 69) m += 12;
          ev.push({ t: start(i) + d * S.range(0.2, 0.6), type: 'bell', m, vel: S.range(0.5, 0.8) * bl.g, dk: bl.dk });
        }
      }
    }
    // plucked figures
    const pk = spec.pluck;
    if (pk && I >= 0.2 && S.chance(pk.p * (0.6 + 0.4 * I))) {
      for (let i = from; i < to; i++) {
        if (!S.chance(pk.density)) continue;
        const [b, te, al, so] = ch[i].map((m) => m + tr);
        const d = at[i - from][1];
        let fig;
        if (pk.fig === 'harp') fig = [b + 12, te, al, so, so + 12].map((m, k) => [0.3 + k * 0.52, m, 0.4 + k * 0.05]);
        else if (pk.fig === 'ostinato') fig = [te, so, al, so].map((m, k) => [(k * d) / 4 + 0.05, m, [0.42, 0.5, 0.4, 0.46][k]]);
        else {
          fig = [te, al, so].map((m, k) => [0.4 + k * 0.85, m, [0.5, 0.45, 0.55][k]]);
          if (S.chance(0.25)) fig = [so, al, te].map((m, k) => [0.4 + k * 0.85, m, [0.55, 0.45, 0.5][k]]);
        }
        for (const [dt, m, vel] of fig) ev.push({ t: start(i) + dt + S.range(-0.02, 0.02), type: 'pluck', m, vel: vel * pk.g, bright: pk.bright });
      }
    }
    // drums
    if (spec.drums === 'heart' && I >= 0.25 && (first || S.chance(0.35 + 0.5 * I))) {
      // the heart is there when the Gloom is entered; after that it comes and goes, sometimes only
      // for the second half of a phrase, and never at quite the same pace twice
      const period = (4.6 - 1.8 * I) * S.jit(1, 0.08);
      const late = !first && S.chance(0.4) ? start(from + Math.floor((to - from) / 2)) : t0;
      for (let tt = late + 1; tt < end; tt += period) {
        ev.push({ t: tt, type: 'drum', vel: 0.9 });
        ev.push({ t: tt + 0.42, type: 'drum', vel: 0.55 });
      }
    } else if (spec.drums === 'march' && I >= 0.25) {
      for (let i = from; i < to; i++) {
        const d = at[i - from][1],
          grow = 0.5 + 0.5 * ((i - from) / Math.max(1, to - from - 1));
        ev.push({ t: start(i), type: 'drum', vel: grow });
        if (I > 0.5) ev.push({ t: start(i) + d * 0.5, type: 'drum', vel: grow * 0.6 });
        if (I > 0.75) ev.push({ t: stop(i) - 0.5, type: 'drum', vel: grow * 0.4 });
      }
    }
    // colour
    if (spec.scrape && S.chance(spec.scrape * (0.4 + 0.6 * I))) {
      for (let k = 0, m = S.int(1, 2); k < m; k++) ev.push({ t: start(S.int(from, to - 1)) + S.range(0, 2), type: 'scrape', dur: S.range(4, 7), vel: 0.5, hz: S.pick([310, 420, 505]) });
    }
    if (spec.growl && S.chance(spec.growl)) {
      for (const i of [from, from + Math.floor((to - from) / 2)]) ev.push({ t: start(i) + 0.2, type: 'growl', dur: at[i - from][1] * 0.9, vel: 0.5, m: spec.root + tr });
    }
    ev.sort((a, b) => a.t - b.t);
    // and then silence, longer when the music is thin
    this.phraseEnd = end + S.range(spec.rest[0], spec.rest[1]) * (1.3 - 0.6 * I);
    // the drone rises with the phrase and sinks after its last chord has let go
    if (this.droneRest) {
      const rg = this.droneRest.gain;
      rg.setTargetAtTime(1, t0, 1.2);
      rg.setTargetAtTime(spec.drone.rest ?? 0.15, end + 1.5, 3.5);
    }
  }

  play(e) {
    const S = this.S,
      L = this.layers,
      p = this.spec.pad;
    const srcs = (S.collect = []);
    let end = e.t + 2;
    try {
      if (e.type === 'pad') end = padNote(S, L.pad, e.t, e.m, e.dur, e.vel * 0.42, { bright: p.bright, thin: p.thin, a: p.a, r: p.r });
      else if (e.type === 'choir') end = choirNote(S, L.choir, e.t, e.m, e.dur, e.vel * 0.5, { v0: e.v0, v1: e.v1 });
      else if (e.type === 'bell') end = chime(S, L.bell, e.t, e.m, e.vel * 0.7, { dk: e.dk });
      else if (e.type === 'pluck') end = pluck(S, L.pluck, e.t, e.m, e.vel * 0.6, { bright: e.bright });
      else if (e.type === 'drum') end = drum(S, L.drum, e.t, e.vel * 0.6);
      else if (e.type === 'scrape') end = scrape(S, L.fx, e.t, e.dur, e.vel * 0.5, e.hz);
      else if (e.type === 'growl') end = growl(S, L.fx, e.t, e.dur, e.vel * 0.5, e.m);
    } finally {
      S.collect = null;
    }
    this.notes.push({ end, srcs });
  }

  advance(until, now) {
    if (this.dead) return;
    if (now - this.pruned > 2) {
      this.pruned = now;
      this.notes = this.notes.filter((n) => n.end > now);
    }
    // the clock ran on without us (a hidden tab): slide the phrase forward instead of bursting
    if (this.events.length && this.events[0].t < now - 0.3) {
      const shift = now + 0.1 - this.events[0].t;
      for (const e of this.events) e.t += shift;
      this.phraseEnd += shift;
    } else if (!this.events.length && this.phraseEnd < now - 0.3) this.phraseEnd = now + 0.1;
    for (;;) {
      while (this.events.length && this.events[0].t < until) this.play(this.events.shift());
      if (this.events.length || this.phraseEnd >= until) break;
      this.buildPhrase(this.phraseEnd);
    }
  }
}

export function createMusic(S, dry, wet) {
  let cur = null,
    mood = 'none',
    intensity = 0.5,
    curFrom = 0, // when the current ensemble began fading in, and for how long
    curFade = 0;
  const queue = [];
  const fading = [];

  function change(req, t) {
    if (req.intensity != null) intensity = clamp(req.intensity, 0, 1);
    if (req.mood === mood) {
      if (cur) cur.setIntensity(intensity, t);
      return;
    }
    if (cur) {
      // if the old mood had not finished arriving, leave from where it had got to
      const lvl = curFade > 0 ? clamp((t - curFrom) / curFade, 0, 1) : 1;
      fading.push({ ens: cur, at: cur.fadeOut(t, 4, lvl) });
    }
    const had = !!cur;
    mood = req.mood;
    cur = null;
    if (MOODS[mood]) {
      cur = new Ensemble(S, mood, dry, wet, t + (had ? 1.2 : 0.1), intensity);
      curFrom = t;
      curFade = had ? 4 : 2;
      cur.fadeIn(t, curFade);
    }
  }

  return {
    /** Ask for a mood. `at` (context time) is only for scripted offline renders. */
    set(m, o = {}, at = null) {
      queue.push({ mood: m, intensity: o.intensity, at });
    },
    advance(until, now = S.now) {
      while (queue.length && (queue[0].at == null || queue[0].at <= until)) {
        const req = queue.shift();
        const t = req.at == null ? now : Math.max(req.at, now);
        if (cur) cur.advance(t, now);
        change(req, t);
      }
      if (cur) cur.advance(until, now);
      for (let i = fading.length - 1; i >= 0; i--) {
        if (now > fading[i].at) {
          fading[i].ens.out.disconnect();
          fading[i].ens.send.disconnect();
          fading.splice(i, 1);
        }
      }
    },
    get mood() {
      return mood;
    },
    get intensity() {
      return intensity;
    },
  };
}
