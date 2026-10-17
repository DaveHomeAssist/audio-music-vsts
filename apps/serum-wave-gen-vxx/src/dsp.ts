export const FRAME = 2048;
// Highest harmonic a 2048-sample frame can hold below its own Nyquist.
export const MAX_HARMONICS = FRAME / 2 - 1;
// Preview banks; 512 keeps low roots (below about 39 Hz at 44.1 kHz) bright.
export const CAPS = [512, 256, 128, 64, 32, 16, 8, 4, 2, 1];
// Fraction of the cycle crossfaded across the loop point.
const LOOP_FADE = 0.1;
export interface Analysis {
  hz: number;
  repetition: number;
  spread: number;
  rms: number;
  peak: number;
  warnings: string[];
}
export interface Table {
  samples: Float32Array;
  banks: Float32Array[];
  count: number;
  root: number;
  duration: number;
  first: number;
  last: number;
  envelope: Float32Array;
  aligned: boolean;
}
export function rms(a: Float32Array): number {
  let s = 0;
  for (const x of a) s += x * x;
  return Math.sqrt(s / Math.max(1, a.length));
}
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
export function sample(a: Float32Array, p: number): number {
  const x = Math.max(0, Math.min(a.length - 1, p)),
    i = Math.floor(x);
  return lerp(a[i] ?? 0, a[Math.min(i + 1, a.length - 1)] ?? 0, x - i);
}
export function analyze(source: Float32Array, sr: number): Analysis {
  if (source.length / sr < 0.025)
    throw new Error(
      "Selection is too short for pitch analysis. Select more of the one-shot or use a longer source.",
    );
  const level = rms(source);
  if (level < 0.00001)
    throw new Error(
      "Selection is silent or too quiet. Choose an audible section.",
    );
  const stride = Math.max(1, Math.floor(sr / 4000)),
    rate = sr / stride;
  const down = new Float32Array(Math.floor(source.length / stride));
  for (let i = 0; i < down.length; i++) {
    let s = 0;
    for (let j = 0; j < stride; j++) s += source[i * stride + j]!;
    down[i] = s / stride;
  }
  const maxLag = Math.min(Math.floor(rate / 25), Math.floor(down.length / 3));
  const minLag = Math.max(2, Math.floor(rate / 1000));
  const n = Math.min(Math.floor(rate * 0.12), down.length - maxLag);
  if (maxLag <= minLag || n < 16)
    throw new Error("Not enough samples for a pitch estimate.");
  const candidates: { hz: number; score: number }[] = [];
  for (let window = 0; window < 7; window++) {
    const start = Math.floor(((down.length - n - maxLag) * window) / 6),
      difference = new Float64Array(maxLag + 1);
    let sum = 0;
    for (let lag = 1; lag <= maxLag; lag++) {
      let d = 0;
      for (let i = 0; i < n; i++) {
        const delta = down[start + i]! - down[start + i + lag]!;
        d += delta * delta;
      }
      sum += d;
      difference[lag] = sum > 1e-16 ? (d * lag) / sum : 1;
    }
    let best = minLag;
    for (let lag = minLag; lag < maxLag; lag++) {
      if (difference[lag]! < difference[best]!) best = lag;
      if (difference[lag]! < 0.15 && difference[lag]! <= difference[lag + 1]!) {
        best = lag;
        break;
      }
    }
    const l = difference[Math.max(1, best - 1)]!,
      m = difference[best]!,
      r = difference[Math.min(maxLag, best + 1)]!;
    const denom = l - 2 * m + r,
      offset =
        Math.abs(denom) > 1e-12
          ? Math.max(-0.5, Math.min(0.5, (0.5 * (l - r)) / denom))
          : 0;
    candidates.push({ hz: rate / (best + offset), score: Math.max(0, 1 - m) });
  }
  candidates.sort((a, b) => a.hz - b.hz);
  const hz = candidates[3]!.hz,
    repetition = candidates.reduce((s, x) => s + x.score, 0) / 7;
  const spread = 1200 * Math.log2(candidates[5]!.hz / candidates[1]!.hz);
  let peak = 0;
  for (const x of source) peak = Math.max(peak, Math.abs(x));
  const warnings = [
    "Pitch is an estimate; confirm the octave before generation. No repetition score measures fidelity.",
  ];
  if (repetition < 0.7)
    warnings.push(
      "Weak repetition: noise, overlapping components or pitch movement may make extraction unreliable.",
    );
  if (spread > 40)
    warnings.push(
      "Pitch estimates vary across the selection. This baseline uses one fixed root.",
    );
  if (peak >= 1)
    warnings.push(
      "Source reaches or exceeds full scale. The source is not repaired or normalized automatically.",
    );
  return { hz, repetition, spread, rms: level, peak, warnings };
}
// Iterative radix-2 FFT; forward is unnormalized, inverse divides by N.
export function fft(re: Float64Array, im: Float64Array, inverse = false): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let size = 2; size <= n; size *= 2) {
    const angle = ((inverse ? 2 : -2) * Math.PI) / size;
    for (let start = 0; start < n; start += size)
      for (let j = 0; j < size / 2; j++) {
        const c = Math.cos(angle * j),
          s = Math.sin(angle * j),
          a = start + j,
          b = a + size / 2;
        const r = re[b]! * c - im[b]! * s,
          q = re[b]! * s + im[b]! * c;
        re[b] = re[a]! - r;
        im[b] = im[a]! - q;
        re[a] = re[a]! + r;
        im[a] = im[a]! + q;
      }
  }
  if (inverse)
    for (let i = 0; i < n; i++) {
      re[i] = re[i]! / n;
      im[i] = im[i]! / n;
    }
}
export function bandlimit(frame: Float32Array, cap: number): Float32Array {
  const re = Float64Array.from(frame),
    im = new Float64Array(FRAME);
  fft(re, im);
  re[0] = 0;
  im[0] = 0;
  for (let k = cap + 1; k < FRAME - cap; k++) {
    re[k] = 0;
    im[k] = 0;
  }
  fft(re, im, true);
  return Float32Array.from(re);
}
// Samples one cycle and closes the loop by crossfading with the neighbouring cycle. A linear
// ramp correction would add a sawtooth (strong h1/h2) whenever the cycle ends do not meet.
export function cycle(
  source: Float32Array,
  start: number,
  period: number,
): Float32Array {
  const frame = new Float32Array(FRAME),
    fade = FRAME * LOOP_FADE;
  // Blend the head toward the next cycle when it exists, otherwise the tail toward the previous one.
  const forward =
    start + period * (1 + LOOP_FADE) <= source.length - 1 ||
    start < period * LOOP_FADE;
  for (let j = 0; j < FRAME; j++) {
    const at = start + (j / FRAME) * period,
      edge = forward ? j : FRAME - j;
    const w = edge < fade ? 0.5 * (1 + Math.cos((Math.PI * edge) / fade)) : 0;
    frame[j] =
      (1 - w) * sample(source, at) +
      w * sample(source, at + (forward ? period : -period));
  }
  return frame;
}
export function generate(
  source: Float32Array,
  sr: number,
  root: number,
  count: number,
  aligned: boolean,
  progress: (value: number) => void = () => {},
): Table {
  if (!Number.isFinite(root) || root < 25 || root > 1000)
    throw new Error("Root pitch must be 25–1000 Hz.");
  if (!Number.isInteger(count) || count < 1 || count > 256)
    throw new Error("Choose 1–256 frames.");
  if (rms(source) < 0.00001)
    throw new Error("Cannot generate a table from silence.");
  const period = sr / root,
    duration = source.length / sr;
  if (source.length < period * 2)
    throw new Error(
      "Selection needs at least two cycles at the chosen root. Extend the trim or correct the pitch.",
    );
  const first = period / 2 / sr,
    last = (source.length - 1 - period / 2) / sr;
  const samples = new Float32Array(count * FRAME),
    envelope = new Float32Array(256);
  for (let i = 0; i < envelope.length; i++) {
    const center = (i / 255) * (source.length - 1),
      half = Math.max(period / 2, sr * 0.005);
    let sum = 0,
      n = 0;
    for (
      let j = Math.max(0, Math.floor(center - half));
      j < Math.min(source.length, center + half);
      j++
    ) {
      sum += source[j]! ** 2;
      n++;
    }
    envelope[i] = Math.sqrt(sum / Math.max(1, n));
  }
  let previous: Float32Array | undefined;
  const sourceCap = Math.max(
    1,
    Math.min(MAX_HARMONICS, Math.floor(sr / (2 * root)) - 1),
  );
  for (let f = 0; f < count; f++) {
    const center = lerp(first, last, count === 1 ? 0.5 : f / (count - 1)) * sr;
    let frame = bandlimit(
      cycle(source, center - period / 2, period),
      sourceCap,
    );
    if (aligned && previous) {
      // Circular correlation in the frequency domain chooses a relative cycle rotation.
      const ar = Float64Array.from(previous),
        ai = new Float64Array(FRAME),
        br = Float64Array.from(frame),
        bi = new Float64Array(FRAME);
      fft(ar, ai);
      fft(br, bi);
      for (let j = 0; j < FRAME; j++) {
        const r = ar[j]! * br[j]! + ai[j]! * bi[j]!;
        ai[j] = ar[j]! * bi[j]! - ai[j]! * br[j]!;
        ar[j] = r;
      }
      fft(ar, ai, true);
      let shift = 0;
      for (let j = 1; j < FRAME; j++) if (ar[j]! > ar[shift]!) shift = j;
      frame = frame.map((_, j) => frame[(j + shift) % FRAME]!);
    }
    samples.set(frame, f * FRAME);
    previous = frame;
    progress(Math.round((70 * (f + 1)) / count));
  }
  let peak = 0;
  for (const x of samples) peak = Math.max(peak, Math.abs(x));
  if (peak < 1e-9)
    throw new Error(
      "No usable periodic waveform was extracted. Try a different section or root.",
    );
  // One table-wide gain preserves relative frame levels; do not normalize frames separately.
  for (let i = 0; i < samples.length; i++)
    samples[i] = (samples[i]! * 0.9) / peak;
  const banks = CAPS.map((cap) => {
    const bank = new Float32Array(samples.length);
    for (let f = 0; f < count; f++)
      bank.set(
        bandlimit(samples.subarray(f * FRAME, (f + 1) * FRAME), cap),
        f * FRAME,
      );
    return bank;
  });
  // A shared bank gain avoids clipping from harmonic removal without changing mip levels independently.
  let bankPeak = 1;
  for (const bank of banks)
    for (const x of bank) bankPeak = Math.max(bankPeak, Math.abs(x));
  for (const bank of banks)
    for (let i = 0; i < bank.length; i++) bank[i] = bank[i]! / bankPeak;
  progress(100);
  return {
    samples,
    banks,
    count,
    root,
    duration,
    first,
    last,
    envelope,
    aligned,
  };
}
export function positionAt(t: number, table: Table): number {
  return Math.max(
    0,
    Math.min(1, (t - table.first) / (table.last - table.first)),
  );
}
export function bankFor(table: Table, hz: number, sr: number): Float32Array {
  const index = CAPS.findIndex((cap) => cap * hz < sr * 0.45);
  return table.banks[index < 0 ? CAPS.length - 1 : index]!;
}
export function oscillator(
  bank: Float32Array,
  count: number,
  position: number,
  phase: number,
): number {
  const f = Math.max(0, Math.min(1, position)) * (count - 1),
    lo = Math.floor(f),
    hi = Math.min(count - 1, lo + 1);
  const p = (phase - Math.floor(phase)) * FRAME,
    i = Math.floor(p),
    next = (i + 1) % FRAME;
  const a = lerp(bank[lo * FRAME + i]!, bank[lo * FRAME + next]!, p - i),
    b = lerp(bank[hi * FRAME + i]!, bank[hi * FRAME + next]!, p - i);
  return lerp(a, b, f - lo);
}
export function render(
  table: Table,
  sr: number,
  hz: number,
  seconds: number,
  assisted: boolean,
): Float32Array {
  if (
    !Number.isFinite(seconds) ||
    seconds <= 0 ||
    seconds > 120 ||
    hz < 25 ||
    hz > 1000
  )
    throw new Error("Preview needs 0–120 seconds and 25–1000 Hz.");
  const out = new Float32Array(Math.round(seconds * sr)),
    bank = bankFor(table, hz, sr);
  const frameRms = new Float32Array(table.count);
  for (let i = 0; i < table.count; i++)
    frameRms[i] = rms(bank.subarray(i * FRAME, (i + 1) * FRAME));
  for (let i = 0; i < out.length; i++) {
    const t = i / sr,
      fraction = t / seconds,
      pos = positionAt(fraction * table.duration, table);
    const gain = assisted
      ? Math.min(
          4,
          sample(table.envelope, fraction * 255) /
            Math.max(0.0001, sample(frameRms, pos * (table.count - 1))),
        )
      : 1;
    const fade = Math.min(1, t / 0.005, (seconds - t) / 0.005);
    out[i] = oscillator(bank, table.count, pos, t * hz) * gain * fade;
  }
  return out;
}
export function demo(sr = 44100, seconds = 1.5, hz = 55): Float32Array {
  return Float32Array.from({ length: Math.round(sr * seconds) }, (_, i) => {
    const t = i / sr,
      motion = t / seconds,
      phase = 2 * Math.PI * hz * t;
    return (
      (0.45 * Math.sin(phase) +
        0.2 * motion * Math.sin(phase * 3 + 0.3) +
        0.12 * (1 - motion) * Math.sin(phase * 7)) *
      Math.min(1, t / 0.01) *
      Math.exp(-1.3 * motion)
    );
  });
}
