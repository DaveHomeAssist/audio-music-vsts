import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  analyze,
  bankFor,
  demo,
  fft,
  FRAME,
  generate,
  oscillator,
  render,
  rms,
  sample,
} from "../src/dsp.ts";
import { mono, readWav, writeWav } from "../src/wav.ts";
const buffer = (b: Buffer): ArrayBuffer =>
  b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
const close = (a: number, b: number, tolerance: number) =>
  assert.ok(Math.abs(a - b) < tolerance, `${a} not near ${b} ± ${tolerance}`);
const source = demo(44100, 1.5, 55);

test("known pitches and durations above one second", () => {
  for (const seconds of [0.5, 1, 3])
    for (const hz of [36.71, 55, 110, 440]) {
      const a = analyze(demo(44100, seconds, hz), 44100);
      close(a.hz, hz, hz * 0.015);
    }
  assert.throws(() => analyze(new Float32Array(44100), 44100), /silent/);
});
test("FFT roundtrip and exact periodic extraction alignment", () => {
  const re = Float64Array.from({ length: FRAME }, (_, i) =>
      Math.sin((i / FRAME) * 2 * Math.PI),
    ),
    im = new Float64Array(FRAME),
    original = re.slice();
  fft(re, im);
  fft(re, im, true);
  for (let i = 0; i < FRAME; i++) close(re[i]!, original[i]!, 1e-10);
  const sine = Float32Array.from({ length: 44100 }, (_, i) =>
    Math.sin((i / 44100) * 2 * Math.PI * 55),
  );
  const t = generate(sine, 44100, 55, 8, true);
  for (let f = 1; f < t.count; f++) {
    let dot = 0,
      a = 0,
      b = 0;
    for (let i = 0; i < FRAME; i++) {
      const x = t.samples[i]!,
        y = t.samples[f * FRAME + i]!;
      dot += x * y;
      a += x * x;
      b += y * y;
    }
    assert.ok(dot / Math.sqrt(a * b) > 0.999, "alignment correlation");
  }
});
test("frame bounds, finite output, DC and export metadata", () => {
  for (const count of [1, 8, 64, 256]) {
    const t = generate(source, 44100, 55, count, true);
    assert.equal(t.samples.length, count * FRAME);
    for (let f = 0; f < count; f++) {
      let sum = 0;
      for (const x of t.samples.subarray(f * FRAME, (f + 1) * FRAME)) {
        assert.ok(Number.isFinite(x));
        assert.ok(Math.abs(x) <= 0.901);
        sum += x;
      }
      close(sum / FRAME, 0, 1e-6);
    }
    const wav = writeWav(t.samples, 44100, true),
      decoded = readWav(wav);
    assert.deepEqual(decoded.channels[0], t.samples);
    assert.equal(decoded.bits, 32);
    const bytes = Buffer.from(wav);
    assert.ok(bytes.includes(Buffer.from("<!>2048 10000000")));
    assert.equal(bytes.readUInt32LE(4) + 8, bytes.length);
  }
  assert.throws(() => generate(source, 44100, 55, 257, true), /1–256/);
  assert.throws(() => generate(source, 44100, 55, 1.5, true), /1–256/);
  assert.throws(
    () => generate(source.subarray(0, 20), 44100, 55, 8, true),
    /two cycles/,
  );
  assert.throws(() => writeWav(new Float32Array(2049), 44100, true), /1–256/);
});
test("30-second hold, scrubbing endpoints and pitch/scan independence", () => {
  const pure = Float32Array.from(
    { length: 44100 },
    (_, i) => 0.6 * Math.sin((2 * Math.PI * 55 * i) / 44100),
  );
  const t = generate(pure, 44100, 55, 8, true),
    sr = 8000,
    bank = bankFor(t, 55, sr);
  let peakDelta = 0,
    previous = 0;
  for (let i = 0; i < sr * 30; i++) {
    const x = oscillator(bank, t.count, 0.5, (i * 55) / sr);
    assert.ok(Number.isFinite(x));
    if (i) peakDelta = Math.max(peakDelta, Math.abs(x - previous));
    previous = x;
  }
  assert.ok(peakDelta < 0.05);
  for (const seconds of [0.5, 1, 3])
    for (const hz of [55, 110]) {
      const out = render(t, sr, hz, seconds, false);
      assert.equal(out.length, Math.round(sr * seconds));
      let crossings = 0;
      for (let i = 1; i < out.length; i++)
        if (out[i - 1]! <= 0 && out[i]! > 0) crossings++;
      close(crossings / seconds, hz, 2.1);
    }
  close(
    oscillator(bank, t.count, 0, 0.3),
    oscillator(bank, t.count, -1, 0.3),
    1e-10,
  );
  close(
    oscillator(bank, t.count, 1, 0.3),
    oscillator(bank, t.count, 2, 0.3),
    1e-10,
  );
  for (let i = 0; i < 1000; i++) {
    const p = i / 999;
    close(
      oscillator(bank, t.count, p, 0.2),
      oscillator(bank, t.count, 1 - (999 - i) / 999, 0.2),
      1e-6,
    );
  }
});
// Mean power of harmonic k across frames, relative to harmonics 1-40, in dB.
function harmonicDb(frames: Float32Array, count: number, k: number): number {
  let target = 0,
    total = 0;
  for (let f = 0; f < count; f++) {
    const re = Float64Array.from(frames.subarray(f * FRAME, (f + 1) * FRAME)),
      im = new Float64Array(FRAME);
    fft(re, im);
    for (let h = 1; h <= 40; h++) {
      const p = re[h]! ** 2 + im[h]! ** 2;
      total += p;
      if (h === k) target += p;
    }
  }
  return 10 * Math.log10(target / total);
}
test("boundary repair keeps harmonic 1 near the unrepaired value on noisy, drifting cycles", () => {
  const sr = 44100,
    root = 41;
  let seed = 7,
    phase = 0;
  const noise = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 31 - 1;
  };
  // Weak fundamental, saw-like upper harmonics, pitch gliding 40 -> 42 Hz, plus broadband noise.
  const drifting = Float32Array.from(
    { length: Math.round(sr * 1.5) },
    (_, i) => {
      phase += (2 * Math.PI * (40 + (2 * i) / (sr * 1.5))) / sr;
      let x = 0.05 * Math.sin(phase);
      for (let h = 2; h <= 30; h++) x += Math.sin(h * phase) / h;
      return 0.4 * x + 0.25 * noise();
    },
  );
  const t = generate(drifting, sr, root, 64, false),
    period = sr / root,
    raw = new Float32Array(64 * FRAME);
  for (let f = 0; f < 64; f++) {
    const start = (t.first + ((t.last - t.first) * f) / 63) * sr - period / 2;
    for (let j = 0; j < FRAME; j++)
      raw[f * FRAME + j] = sample(drifting, start + (j / FRAME) * period);
  }
  close(harmonicDb(t.samples, 64, 1), harmonicDb(raw, 64, 1), 3);
});
test("low roots keep harmonics up to source Nyquist, in the table and the preview bank", () => {
  const sr = 44100,
    tone = (root: number, h: number) =>
      Float32Array.from(
        { length: sr },
        (_, i) =>
          0.5 * Math.sin((2 * Math.PI * root * i) / sr) +
          0.25 * Math.sin((2 * Math.PI * root * h * i) / sr),
      );
  const level = (frame: Float32Array, k: number) => {
    const re = Float64Array.from(frame),
      im = new Float64Array(FRAME);
    fft(re, im);
    return Math.hypot(re[k]!, im[k]!) / Math.hypot(re[1]!, im[1]!);
  };
  // Harmonic 200 of 40 Hz is 8 kHz: well inside Nyquist, far above the old 128-harmonic ceiling.
  // Linear interpolation in sample() rolls off about 0.9 dB at 8 kHz, hence 0.5 ± 0.07.
  const low = generate(tone(40, 200), sr, 40, 4, false);
  close(level(low.samples.subarray(0, FRAME), 200), 0.5, 0.07);
  close(level(bankFor(low, 40, sr).subarray(0, FRAME), 200), 0.5, 0.07);
  // At 440 Hz the source Nyquist still limits the table: harmonic 60 is 26.4 kHz.
  const high = generate(tone(440, 60), sr, 440, 4, false);
  assert.ok(level(high.samples.subarray(0, FRAME), 60) < 1e-6);
});
test("raw and assisted render are distinct and finite", () => {
  const t = generate(source, 44100, 55, 16, true),
    raw = render(t, 44100, 55, 1.5, false),
    assisted = render(t, 44100, 55, 1.5, true);
  assert.notEqual(rms(raw), rms(assisted));
  for (const x of assisted) assert.ok(Number.isFinite(x));
});
test("existing lab WAVs parse; reference generates without treating it as ground truth", () => {
  const reference = readWav(
    buffer(readFileSync("experiments/serum-bass-lab/reference.wav")),
  );
  assert.equal(reference.sampleRate, 44100);
  assert.equal(reference.channels[0]!.length, 19392);
  const data = mono(reference, "mid"),
    a = analyze(data, reference.sampleRate);
  assert.ok(a.hz >= 25 && a.hz <= 1000);
  const t = generate(data, 44100, 37.17, 64, true);
  assert.equal(t.samples.length, 64 * FRAME);
  assert.ok(rms(render(t, 44100, 37.17, t.duration, false)) > 0);
  for (const [path, frames] of [
    ["experiments/serum-bass-lab/extracted_8x2048.wav", 8],
    [
      "experiments/erosyn-formant-lab/wavetables/REF_extract_D1_learning-only.wav",
      16,
    ],
    ["experiments/erosyn-formant-lab/wavetables/ORIG_formant_growl_D1.wav", 64],
  ] as const) {
    assert.equal(
      readWav(buffer(readFileSync(path))).channels[0]!.length,
      frames * FRAME,
    );
  }
  console.log(
    `Lab reference: ${data.length} samples, estimated ${a.hz.toFixed(3)} Hz, repeatability ${a.repetition.toFixed(3)} (not fidelity); test root 37.17 Hz.`,
  );
});
test("WAV failures and channel policy", () => {
  assert.throws(() => readWav(new ArrayBuffer(44)), /Choose/);
  const bad = writeWav(source, 44100);
  new DataView(bad).setUint32(52, 0xffffffff, true);
  assert.throws(() => readWav(bad), /truncated/);
  const nonfinite = writeWav(source, 44100);
  new DataView(nonfinite).setFloat32(56, NaN, true);
  assert.throws(() => readWav(nonfinite), /nonfinite/);
  const w = {
    channels: [new Float32Array([1, -1]), new Float32Array([-1, 1])],
    sampleRate: 44100,
    bits: 32,
    encoding: "float",
  };
  assert.deepEqual([...mono(w, "mid")], [0, 0]);
  assert.deepEqual([...mono(w, "right")], [-1, 1]);
  for (const bits of [16, 24, 32]) {
    const bytes = bits / 8,
      b = new ArrayBuffer(44 + bytes * 2),
      v = new DataView(b);
    const put = (p: number, s: string) => {
      for (let i = 0; i < s.length; i++) v.setUint8(p + i, s.charCodeAt(i));
    };
    put(0, "RIFF");
    v.setUint32(4, b.byteLength - 8, true);
    put(8, "WAVE");
    put(12, "fmt ");
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, 48000, true);
    v.setUint32(28, 48000 * bytes, true);
    v.setUint16(32, bytes, true);
    v.setUint16(34, bits, true);
    put(36, "data");
    v.setUint32(40, bytes * 2, true);
    v.setUint8(44 + bytes - 1, 0x40);
    v.setUint8(44 + bytes * 2 - 1, 0xc0);
    const decoded = readWav(b);
    close(decoded.channels[0]![0]!, 0.5, 1e-7);
    close(decoded.channels[0]![1]!, -0.5, 1e-7);
  }
});
