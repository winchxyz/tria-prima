// The instruments of the score. They are also borrowed by a few one-shots (a lantern answering,
// a Prime taken), so they live apart from the music scheduler. Every function schedules one note on
// `out` at time `t` and returns the time at which it has gone silent.
import { mtof, clamp } from './dsp.js';

// Formants [hz, gain, Q] of a low mixed choir.
const VOWELS = {
  oo: [[325, 1.0, 5], [700, 0.28, 8], [2530, 0.05, 10]],
  oh: [[450, 1.0, 5], [800, 0.42, 8], [2830, 0.07, 10]],
  ah: [[700, 1.0, 5], [1150, 0.6, 8], [2600, 0.16, 10]],
  eh: [[480, 1.0, 5], [1750, 0.35, 9], [2450, 0.2, 10]],
  mm: [[260, 1.0, 4], [620, 0.12, 6], [2200, 0.02, 8]],
};

/** A bowed string section holding one note. o: a r bright thin */
export function padNote(S, out, t, m, dur, vel = 1, o = {}) {
  const f = mtof(m);
  const a = o.a ?? 2.4,
    r = o.r ?? 3.6,
    bright = o.bright ?? 0.5;
  dur = Math.max(dur, a * 0.6);
  const g = S.gain(0);
  const end = S.swell(g.gain, t, vel, a, dur, r);
  const life = end - t + 0.05;
  const sum = S.gain(o.thin ? 0.42 : 0.3);
  const lfo = S.osc('sine', S.range(4.3, 5.4), t, life);
  const lfoG = S.gain(0);
  lfoG.gain.setValueAtTime(0, t);
  lfoG.gain.linearRampToValueAtTime(o.thin ? 3 : 6, t + a + 1.5);
  lfo.connect(lfoG);
  const voices = o.thin
    ? [['triangle', 1, -4, 1], ['sine', 2, 5, 0.25]]
    : [['sawtooth', 1, -9, 1], ['sawtooth', 1, 7, 1], ['sawtooth', bright > 0.6 ? 2 : 1, 1, bright > 0.6 ? 0.4 : 0.8]];
  for (const [type, mul, det, lvl] of voices) {
    const osc = S.osc(type, f * mul, t, life, det + S.range(-3, 3));
    lfoG.connect(S.slow(osc.detune));
    if (lvl === 1) osc.connect(sum);
    else S.chain(osc, S.gain(lvl), sum);
  }
  // a little rosin: breath of the bow around the second harmonic
  S.chain(S.noise('pink', t, life), S.bq('bandpass', Math.min(f * 2, 3000), 1.5), S.gain(o.thin ? 0.05 : 0.035), sum);
  const cut0 = Math.min(f * 1.5 + 110, 2400),
    cut1 = Math.min(f * (2.2 + bright * 3.4) + 240, 5200);
  const lp = S.bq('lowpass', cut0);
  lp.frequency.setValueAtTime(cut0, t);
  lp.frequency.linearRampToValueAtTime(cut1, t + a);
  lp.frequency.setTargetAtTime(cut0, t + Math.max(dur, a + 0.05), r / 3);
  S.chain(sum, lp, g, out);
  return end;
}

/** Two singers on one note, the vowel drifting from v0 to v1. o: a r v0 v1 */
export function choirNote(S, out, t, m, dur, vel = 1, o = {}) {
  const f = mtof(m);
  const a = o.a ?? 2.0,
    r = o.r ?? 3.2;
  const v0 = VOWELS[o.v0 || 'oo'],
    v1 = VOWELS[o.v1 || o.v0 || 'oo'];
  const shift = m > 66 ? 1.16 : m > 59 ? 1.07 : 1;
  dur = Math.max(dur, a * 0.6);
  const g = S.gain(0);
  const end = S.swell(g.gain, t, vel, a, dur, r);
  const life = end - t + 0.05;
  const src = S.gain(1);
  for (let i = 0; i < 2; i++) {
    const osc = S.osc('sawtooth', f, t, life, (i ? 8 : -7) + S.range(-4, 4));
    const vib = S.osc('sine', S.range(4.7, 5.9), t, life);
    const vg = S.gain(0);
    vg.gain.setValueAtTime(0, t);
    vg.gain.linearRampToValueAtTime(S.range(9, 16), t + a + 0.8);
    S.chain(vib, vg);
    vg.connect(S.slow(osc.detune));
    osc.connect(src);
  }
  S.chain(S.noise('pink', t, life), S.gain(0.35), src);
  const mix = S.gain(2.2);
  for (let k = 0; k < 3; k++) {
    const bp = S.bq('bandpass', v0[k][0] * shift, v0[k][2]);
    bp.frequency.setValueAtTime(v0[k][0] * shift, t);
    bp.frequency.linearRampToValueAtTime(v1[k][0] * shift, t + dur);
    const fg = S.gain(v0[k][1]);
    fg.gain.setValueAtTime(v0[k][1], t);
    fg.gain.linearRampToValueAtTime(v1[k][1], t + dur);
    S.chain(src, bp, fg, mix);
  }
  S.chain(mix, S.bq('lowpass', 3600), g, out);
  return end;
}

// Partials [ratio, gain, decay share] of a small dark bell.
const CHIME = [[0.5, 0.22, 1.3], [1, 1, 1], [2, 0.42, 0.62], [2.42, 0.2, 0.5], [3.0, 0.16, 0.4], [4.08, 0.1, 0.3], [5.4, 0.05, 0.2]];
/** A hand bell or a struck glass: the rare single notes of the score. o: dk (seconds of ring) */
export function chime(S, out, t, m, vel = 1, o = {}) {
  const f = mtof(m),
    base = o.dk ?? 5.5;
  S.nz(out, t, { k: 'white', d: 0.03, a: 0.001, f: Math.min(f * 4, 6000), q: 1.2, g: 0.1 * vel });
  return t + S.modal(out, t, { f, parts: CHIME.map(([r, g, d]) => [r, g * vel * 0.3, base * d]), a: 0.004, det: 2 });
}

// Partials of a cast church bell: hum, prime, tierce (the minor third that makes it mournful), quint, nominal...
const BELL = [[0.5, 0.4, 1.0], [1, 0.8, 0.8], [1.19, 0.55, 0.6], [1.5, 0.35, 0.42], [2, 0.7, 0.48], [2.51, 0.28, 0.26], [3.01, 0.22, 0.2], [4.07, 0.15, 0.14], [5.32, 0.1, 0.09], [6.71, 0.06, 0.06]];
/** A great bell. f is the pitch of its prime; ring is the length of the hum in seconds. */
export function bigBell(S, out, t, f, vel = 1, ring = 9) {
  const parts = [];
  for (const [r, g, d] of BELL) {
    parts.push([r * f, g * vel * 0.24, ring * d]);
    // real bells are never round: each low mode is a close pair that beats slowly
    if (r <= 2) parts.push([r * f + S.range(0.35, 1.1), g * vel * 0.14, ring * d * 0.9]);
  }
  S.nz(out, t, { k: 'white', d: 0.035, a: 0.0008, f: 2100, q: 0.9, g: 0.3 * vel });
  S.tn(out, t, { f: 95, f1: 58, d: 0.09, a: 0.002, g: 0.3 * vel });
  return t + S.modal(out, t, { parts, a: 0.003 });
}

/** A plucked or hammered string. Buffers are computed for every third semitone and re-tuned. o: bright */
export function pluck(S, out, t, m, vel = 1, o = {}) {
  const bright = o.bright ?? 0.5;
  const base = 3 * Math.round(m / 3);
  const buf = S.pluckBuffer(base, bright);
  const rate = Math.pow(2, (m - base) / 12);
  const src = S.play(buf, t, { rate });
  const lp = S.bq('lowpass', clamp(mtof(m) * (3 + 7 * bright), 900, 9000));
  // the sound box: a broad low resonance
  const body = S.bq('peaking', 240, 1.2, 4);
  S.chain(src, lp, body, S.gain(vel * 0.5), out);
  return t + buf.duration / rate;
}

/** A very large, very slack drum, far away. */
export function drum(S, out, t, vel = 1) {
  S.tn(out, t, { f: 72, f1: 39, tf: 0.3, d: 1.5, a: 0.004, g: 0.75 * vel });
  S.tn(out, t, { f: 104, f1: 60, tf: 0.12, d: 0.4, a: 0.003, g: 0.35 * vel });
  S.nz(out, t, { k: 'brown', d: 0.32, a: 0.003, f: 190, ft: 'lowpass', g: 0.7 * vel });
  S.nz(out, t, { k: 'pink', d: 0.03, a: 0.001, f: 900, q: 0.8, g: 0.09 * vel });
  return t + 1.6;
}

/** Bowed metal: noise ringing in a handful of narrow, unrelated resonances, swelling and gone. */
export function scrape(S, out, t, dur, vel = 1, hz = 420) {
  const g = S.gain(0);
  S.env(g.gain, t, 0, [[dur * 0.6, vel, 't'], [dur * 0.4, 0, 't'], [0.3, 0]]);
  const src = S.noise('pink', t, dur + 0.4);
  const mix = S.gain(5);
  for (const r of [1, 1.47, 2.09, 2.56, 3.22]) {
    const bp = S.bq('bandpass', hz * r, 45);
    bp.frequency.setValueAtTime(hz * r, t);
    bp.frequency.linearRampToValueAtTime(hz * r * S.range(1.01, 1.05), t + dur);
    S.chain(src, bp, S.bq('bandpass', hz * r, 20), mix);
  }
  S.chain(mix, g, out);
  return t + dur + 0.4;
}

/** A low reed growl: two rough saws opening and closing. */
export function growl(S, out, t, dur, vel = 1, m = 33) {
  const f = mtof(m);
  const g = S.gain(0);
  const end = S.swell(g.gain, t, vel, dur * 0.45, dur * 0.5, dur * 0.4);
  const life = end - t + 0.05;
  const pre = S.gain(1.4);
  S.osc('sawtooth', f, t, life, -12).connect(pre);
  S.osc('sawtooth', f, t, life, 11).connect(pre);
  S.chain(S.osc('sawtooth', f * 0.5, t, life, 3), S.gain(0.6), pre);
  const lp = S.bq('lowpass', 110, 4);
  lp.frequency.setValueAtTime(110, t);
  lp.frequency.linearRampToValueAtTime(330, t + dur * 0.5);
  lp.frequency.linearRampToValueAtTime(120, t + dur);
  S.chain(pre, S.shaper('drive'), lp, g, out);
  return end;
}

/** A held chord on choir and strings together: the swell under the big moments. */
export function chord(S, out, t, midis, dur, vel = 1, o = {}) {
  let end = t;
  for (const m of midis) {
    if (o.strings !== false) end = Math.max(end, padNote(S, out, t, m, dur, vel * 0.5, { a: o.a ?? 0.8, r: o.r ?? 2.2, bright: o.bright ?? 0.6 }));
    if (o.voices !== false && m >= 48) end = Math.max(end, choirNote(S, out, t, m, dur, vel * 0.5, { a: o.a ?? 0.8, r: o.r ?? 2.2, v0: o.v0 || 'oo', v1: o.v1 || 'ah' }));
  }
  return end;
}
