export interface Wave {
  channels: Float32Array[];
  sampleRate: number;
  bits: number;
  encoding: string;
}
export const MAX_FILE_BYTES = 64 * 1024 * 1024;
export function readWav(buffer: ArrayBuffer): Wave {
  if (buffer.byteLength > MAX_FILE_BYTES)
    throw new Error(
      "Prototype memory limit: choose a WAV smaller than 64 MiB. There is no one-second cutoff.",
    );
  const v = new DataView(buffer);
  const text = (p: number, n: number) =>
    String.fromCharCode(...new Uint8Array(buffer, p, n));
  if (v.byteLength < 44 || text(0, 4) !== "RIFF" || text(8, 4) !== "WAVE")
    throw new Error(
      "Choose a PCM or float WAV. Compressed audio and RF64 are not supported in this prototype.",
    );
  const end = v.getUint32(4, true) + 8;
  if (end > buffer.byteLength || end < 12)
    throw new Error("The WAV is truncated or has an invalid RIFF length.");
  let format = 0,
    channels = 0,
    rate = 0,
    bits = 0,
    align = 0,
    data = -1,
    bytes = 0;
  for (let p = 12; p + 8 <= end;) {
    const id = text(p, 4),
      size = v.getUint32(p + 4, true),
      start = p + 8;
    if (start + size > end)
      throw new Error("The WAV contains a truncated chunk.");
    if (id === "fmt ") {
      if (size < 16) throw new Error("Invalid WAV format chunk.");
      format = v.getUint16(start, true);
      channels = v.getUint16(start + 2, true);
      rate = v.getUint32(start + 4, true);
      align = v.getUint16(start + 12, true);
      bits = v.getUint16(start + 14, true);
    } else if (id === "data" && data < 0) {
      data = start;
      bytes = size;
    }
    p = start + size + (size & 1);
  }
  if (
    ![1, 3].includes(format) ||
    (format === 1 && ![16, 24, 32].includes(bits)) ||
    (format === 3 && bits !== 32)
  )
    throw new Error(
      "Supported: PCM 16/24/32-bit or IEEE float32 WAV. Export an ordinary WAV if your file uses extensible or compressed encoding.",
    );
  if (![1, 2].includes(channels) || rate < 8000 || rate > 192000)
    throw new Error("Supported: mono or stereo WAV, 8–192 kHz.");
  if (
    data < 0 ||
    bytes === 0 ||
    align !== (channels * bits) / 8 ||
    bytes % align
  )
    throw new Error("Missing or incomplete WAV audio frames.");
  const length = bytes / align;
  const out = Array.from({ length: channels }, () => new Float32Array(length));
  for (let i = 0; i < length; i++)
    for (let c = 0; c < channels; c++) {
      const p = data + i * align + (c * bits) / 8;
      let value: number;
      if (format === 3) value = v.getFloat32(p, true);
      else if (bits === 16) value = v.getInt16(p, true) / 32768;
      else if (bits === 24) {
        let n =
          v.getUint8(p) | (v.getUint8(p + 1) << 8) | (v.getUint8(p + 2) << 16);
        if (n & 0x800000) n -= 0x1000000;
        value = n / 8388608;
      } else value = v.getInt32(p, true) / 2147483648;
      if (!Number.isFinite(value))
        throw new Error("The WAV contains nonfinite audio samples.");
      if (Math.abs(value) > 8)
        throw new Error(
          "Audio exceeds the prototype’s safe input range (±8). Reduce the source level.",
        );
      out[c]![i] = value;
    }
  return {
    channels: out,
    sampleRate: rate,
    bits,
    encoding: format === 3 ? "float" : "PCM",
  };
}
export function writeWav(
  samples: Float32Array,
  sampleRate: number,
  table = false,
): ArrayBuffer {
  if (
    !samples.length ||
    !Number.isInteger(sampleRate) ||
    sampleRate < 8000 ||
    sampleRate > 192000
  )
    throw new Error("Invalid WAV output.");
  if (table && (samples.length % 2048 || samples.length / 2048 > 256))
    throw new Error("A table needs 1–256 frames of 2048 samples.");
  for (const x of samples)
    if (!Number.isFinite(x) || Math.abs(x) > 1)
      throw new Error("Output is nonfinite or exceeds full scale.");
  const meta = new TextEncoder().encode("<!>2048 10000000 Syrum prototype");
  const metaSize = table ? 8 + meta.length + (meta.length & 1) : 0;
  const result = new ArrayBuffer(56 + metaSize + samples.length * 4),
    v = new DataView(result);
  const text = (p: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(p + i, s.charCodeAt(i));
  };
  text(0, "RIFF");
  v.setUint32(4, result.byteLength - 8, true);
  text(8, "WAVE");
  text(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 3, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 4, true);
  v.setUint16(32, 4, true);
  v.setUint16(34, 32, true);
  text(36, "fact");
  v.setUint32(40, 4, true);
  v.setUint32(44, samples.length, true);
  let p = 48;
  if (table) {
    text(p, "clm ");
    v.setUint32(p + 4, meta.length, true);
    new Uint8Array(result, p + 8, meta.length).set(meta);
    p += metaSize;
  }
  text(p, "data");
  v.setUint32(p + 4, samples.length * 4, true);
  for (let i = 0; i < samples.length; i++)
    v.setFloat32(p + 8 + i * 4, samples[i]!, true);
  return result;
}
export function mono(wave: Wave, channel: string): Float32Array {
  const a = wave.channels[0]!,
    b = wave.channels[1];
  if (!b || channel === "left") return a.slice();
  if (channel === "right") return b.slice();
  return a.map((x, i) => (x + b[i]!) / 2);
}
