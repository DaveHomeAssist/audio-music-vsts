#!/usr/bin/env python3
"""preview_render.py - offline 'Serum-like' render of a 2048-frame wavetable, for checking a
wavetable model with wt_lab.py compare before you rebuild it by ear in Serum.

  python3 preview_render.py WT.wav OUT.wav [--hz 37.28] [--dur 0.44] [--unison 1] [--detune 0]
                            [--drive 0] [--crush 1] [--noise -99] [--pos 0,0.62,0.7] [--hp 60] [--lfo 0,0]

--pos      wavetable position envelope: start, value at 160 ms, end   (0..1 like Serum's WT POS)
--unison   voices (summed in mono), --detune total spread in cents
--drive    tanh drive in dB (0 = off)        --crush  sample-and-hold factor (1 = off)
--noise    attack noise burst level dB (decays over ~60 ms)
--hp       high-pass Hz (4-pole), --lfo rate_hz,depth  sine LFO added to WT position
"""
import argparse
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt

P = 2048
ap = argparse.ArgumentParser()
ap.add_argument('wt'); ap.add_argument('out')
ap.add_argument('--hz', type=float, default=37.28); ap.add_argument('--dur', type=float, default=0.44)
ap.add_argument('--unison', type=int, default=1); ap.add_argument('--detune', type=float, default=0)
ap.add_argument('--drive', type=float, default=0); ap.add_argument('--crush', type=int, default=1)
ap.add_argument('--noise', type=float, default=-99); ap.add_argument('--pos', default='0,0.62,0.7')
ap.add_argument('--hp', type=float, default=60); ap.add_argument('--lfo', default='0,0')
ap.add_argument('--seed', type=int, default=1)
a = ap.parse_args()
sr = 44100; rng = np.random.default_rng(a.seed)

wt, _ = sf.read(a.wt); F = wt.reshape(-1, P); nf = len(F)
# band-limit every frame for this pitch (Serum does this with mip-maps)
spec = np.fft.rfft(F, axis=1); spec[:, int(19000 / (a.hz * 2 ** (a.detune / 2400))):] = 0
F = np.fft.irfft(spec, P, axis=1)

n = int(a.dur * sr); t = np.arange(n) / sr
p0, p1, p2 = [float(v) for v in a.pos.split(',')]
pos = np.where(t < 0.16, p0 + (p1 - p0) * (1 - np.exp(-t / 0.05)) / (1 - np.exp(-0.16 / 0.05)),
               p1 + (p2 - p1) * (t - 0.16) / max(1e-9, a.dur - 0.16))
lr, ld = [float(v) for v in a.lfo.split(',')]; pos = pos + ld * np.sin(2 * np.pi * lr * t)
fi = np.clip(pos, 0, 1) * (nf - 1); i0 = np.floor(fi).astype(int); i1 = np.minimum(i0 + 1, nf - 1); fw = fi - i0

y = np.zeros(n)
cents = [0.0] if a.unison == 1 else np.linspace(-a.detune / 2, a.detune / 2, a.unison)
for c in cents:
    f = a.hz * 2 ** (c / 1200); ph = (rng.random() + np.cumsum(np.full(n, f / sr))) % 1.0
    x = ph * P; k = np.floor(x).astype(int); r = x - k; k1 = (k + 1) % P
    v0 = F[i0, k] * (1 - r) + F[i0, k1] * r; v1 = F[i1, k] * (1 - r) + F[i1, k1] * r
    y += (1 - fw) * v0 + fw * v1
y /= np.sqrt(len(cents))
if a.noise > -90:
    nb = sosfilt(butter(2, [1500, 7000], 'bandpass', fs=sr, output='sos'), rng.standard_normal(n))
    y += 10 ** (a.noise / 20) * nb / np.std(nb) * np.exp(-t / 0.06) * np.std(y)
if a.drive:
    g = 10 ** (a.drive / 20); y = np.tanh(g * y / np.max(np.abs(y))) / np.tanh(g)
if a.crush > 1:
    y = np.repeat(y[::a.crush], a.crush)[:n]
y = sosfilt(butter(4, a.hp, 'highpass', fs=sr, output='sos'), y)     # leave the sub to a separate osc
y *= np.minimum(1, (n - np.arange(n)) / (0.01 * sr))               # 10 ms release
y *= 0.89 / np.max(np.abs(y))
sf.write(a.out, np.c_[y, y].astype(np.float32), sr, subtype='FLOAT')
print(f"wrote {a.out}")
