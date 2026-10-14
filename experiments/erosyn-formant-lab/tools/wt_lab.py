#!/usr/bin/env python3
"""wt_lab.py - reference-bass analysis + Serum wavetable toolkit.

Subcommands
  analyze  IN.wav [--start S --end E] [--out DIR]   pitch, periodicity, formant track, spectrogram
  extract  IN.wav --out WT.wav [--start S --end E]  pitch-synchronous wavetable (1 frame per cycle)
  formant  --out WT.wav [--root-hz F] [--frames N]  modeled (original) formant wavetable
  compare  A.wav B.wav [--out DIR]                  A/B metrics + long-term spectrum overlay

Requires: numpy, scipy, soundfile, matplotlib.  Input must be WAV/AIFF/FLAC
(convert m4a first:  ffmpeg -i hit.m4a -c:a pcm_f32le hit.wav).
Wavetables are 2048-sample frames, 32-bit float, with Serum's 'clm ' frame-size marker.
"""
import argparse, os, struct, sys
import numpy as np
import soundfile as sf
from scipy.ndimage import gaussian_filter1d
from scipy.signal import find_peaks, stft

P = 2048  # Serum frame size
NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']


# ---------------------------------------------------------------- io
def load(path, start=None, end=None):
    x, sr = sf.read(path, always_2d=True)
    a = int((start or 0) * sr); b = int(end * sr) if end else len(x)
    x = x[a:b]
    return x, x.mean(1) - x.mean(), sr


def write_serum_wt(path, frames):
    """frames: (n, 2048) float. Writes float32 WAV + 'clm ' chunk so Serum detects 2048 frames."""
    data = np.asarray(frames, np.float32).reshape(-1)
    clm = b'<!>2048 01000000 wavetable (www.xferrecords.com)'
    clm += b'\0' * (len(clm) % 2)
    fmt = struct.pack('<HHIIHH', 3, 1, 44100, 44100 * 4, 4, 32)
    body = (b'WAVE' + b'fmt ' + struct.pack('<I', len(fmt)) + fmt
            + b'clm ' + struct.pack('<I', len(clm)) + clm
            + b'data' + struct.pack('<I', data.nbytes) + data.tobytes())
    with open(path, 'wb') as f:
        f.write(b'RIFF' + struct.pack('<I', len(body)) + body)


def note_name(hz):
    m = 69 + 12 * np.log2(hz / 440); n = int(round(m))
    return f"{NOTE[n % 12]}{n // 12 - 1} {100 * (m - n):+.0f}c"


# ---------------------------------------------------------------- pitch model
def warp(sig, sr, t0, t1, f0, slope):
    """Resample [t0,t1] so every cycle of a linearly-gliding pitch becomes exactly P samples."""
    T = t1 - t0; n = int(np.floor(f0 * T + 0.5 * slope * T * T))
    if n < 1:
        return np.zeros((0, P))
    k = np.arange(n * P) / P
    tt = k / f0 if abs(slope) < 1e-9 else (-f0 + np.sqrt(f0 * f0 + 2 * slope * k)) / slope
    return np.interp((t0 + tt) * sr, np.arange(len(sig)), sig).reshape(n, P)


def periodic_fraction(C):
    """Bias-corrected cycle-coherence estimate, conditional on the pitch warp.

    The correction assumes a fixed repeating waveform plus independent,
    zero-mean noise across cycles. Modulation, gain changes, phase changes, and
    pitch-model error also lower this score; its complement is not noise energy.
    """
    n = len(C)
    pf = np.sum(C.mean(0) ** 2) * n / (np.sum(C ** 2) + 1e-20)
    return float(max(0.0, (n * pf - 1) / (n - 1))) if n > 1 else 0.0


def coarse_f0(sig, sr, t0, t1, fmin, fmax):
    """Scan log-spaced candidates; take the highest pitch within 85% of the best score
    (sub-octaves score about the same, so this avoids octave-down errors)."""
    cands = np.geomspace(fmin, fmax, int(np.log2(fmax / fmin) * 12 * 6))
    sc = np.array([periodic_fraction(warp(sig, sr, t0, t1, c, 0.0)) if c * (t1 - t0) >= 3 else 0.0
                   for c in cands])
    ok = np.where(sc >= 0.85 * sc.max())[0]
    return cands[ok.max()]


def fit_pitch(sig, sr, t0, t1, fmin=25, fmax=400):
    f_c = coarse_f0(sig, sr, t0, t1, fmin, fmax)
    best = (0, f_c, 0.0)
    for f0 in np.arange(f_c * 0.985, f_c * 1.015, f_c * 0.0003):
        for s in np.arange(-0.1 * f_c, 0.1 * f_c + 1e-9, f_c * 0.0067):
            C = warp(sig, sr, t0, t1, f0, s)
            if len(C) >= 2:
                v = periodic_fraction(C)
                if v > best[0]:
                    best = (v, f0, s)
    return best  # (periodic_frac, f0_at_t0, slope Hz/s)


# ---------------------------------------------------------------- analyze
def band_stats(C):
    H = np.fft.rfft(C, axis=1); n = len(C); out = []
    y = C.reshape(-1); Y = np.abs(np.fft.rfft(y * np.hanning(len(y)))) ** 2
    hmax = P // 2 - 1
    for lo, hi in [(1, 9), (9, 17), (17, 48), (48, 128), (128, 430)]:
        hi = min(hi, hmax)
        if lo >= hi:
            continue
        B = np.zeros_like(H); B[:, lo:hi] = H[:, lo:hi]
        c = np.fft.irfft(B, P, axis=1); c /= np.linalg.norm(c, axis=1, keepdims=True) + 1e-20
        R = c @ c.T
        adj = np.mean([R[i, i + 1] for i in range(n - 1)]) if n > 1 else np.nan
        on = off = 0.0
        for h in range(max(lo, 1), hi):
            seg = Y[h * n - n // 2:h * n + n // 2 + 1]; d = np.arange(-(n // 2), n // 2 + 1)[:len(seg)] / n
            on += seg[np.abs(d) < 0.2].sum(); off += seg.sum()
        out.append((lo, hi - 1, adj, on / (off + 1e-20)))
    return out


def formant_track(sig, sr, f0, slope, t_ref, nh=60):
    t = np.arange(len(sig)) / sr; rows = []; t0 = 0.0
    while True:
        fa = f0 + slope * (t0 - t_ref); T = 2 / fa
        if t0 + T > t[-1]:
            break
        m = (t >= t0) & (t < t0 + T); tt = t[m] - t0; seg = sig[m] * np.hanning(m.sum())
        ph = 2 * np.pi * (fa * tt + 0.5 * slope * tt * tt)
        hm = np.array([np.abs(np.sum(seg * np.exp(-1j * h * ph))) for h in range(1, nh + 1)])
        fr = np.arange(1, nh + 1) * fa; env = gaussian_filter1d(20 * np.log10(hm + 1e-9), 1.2)
        sel = (fr > 300) & (fr < 2000); pk, _ = find_peaks(np.where(sel, env, -999))
        pk = sorted(pk[np.argsort(env[pk])[::-1][:3]])
        low_mid = 10 * np.log10(np.sum(hm[:8] ** 2) / (np.sum(hm[8:47] ** 2) + 1e-20))
        rows.append((t0, [fr[p] for p in pk], low_mid))
        t0 += 1 / fa
    return rows


def spectrogram_png(sig, sr, f0, path):
    import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
    fig, ax = plt.subplots(2, 1, figsize=(11, 8))
    f, t, Z = stft(sig, sr, nperseg=4096, noverlap=4096 - 128, nfft=8192)
    D = 20 * np.log10(np.abs(Z) + 1e-9); D -= D.max()
    ax[0].pcolormesh(t * 1000, f, D, vmin=-70, vmax=0, cmap='magma', shading='auto')
    ax[0].set_yscale('symlog', linthresh=200); ax[0].set_ylim(20, min(16000, sr / 2))
    for h in [1, 2, 3, 4, 8, 16, 32]:
        ax[0].axhline(f0 * h, color='c', lw=.5, alpha=.6)
    ax[0].set_title(f'Harmonic view (93 ms window), cyan = harmonics of {f0:.2f} Hz'); ax[0].set_ylabel('Hz')
    f, t, Z = stft(sig, sr, nperseg=512, noverlap=512 - 32, nfft=2048)
    D = 20 * np.log10(np.abs(Z) + 1e-9); D -= D.max()
    ax[1].pcolormesh(t * 1000, f, D, vmin=-70, vmax=0, cmap='magma', shading='auto')
    ax[1].set_ylim(0, 8000); ax[1].set_title('Transient view (12 ms window)'); ax[1].set_xlabel('ms')
    plt.tight_layout(); plt.savefig(path, dpi=110); plt.close(fig)


def analyze(path, start=None, end=None, out=None, fmin=25, fmax=400, quiet=False):
    x, sig, sr = load(path, start, end); dur = len(sig) / sr
    # skip the first ~25% (attack) when fitting the sustain pitch
    t0, t1 = min(0.25 * dur, 0.12), dur - 0.01
    pf, f0, slope = fit_pitch(sig, sr, t0, t1, fmin, fmax)
    C = warp(sig, sr, t0, t1, f0, slope)
    fmid = f0 + slope * (t1 - t0) / 2
    r = dict(sr=sr, dur=dur, f0=fmid, f0_t0=f0, t0=t0, slope=slope, note=note_name(fmid), periodic=pf,
             hnr=10 * np.log10(pf / (1 - pf + 1e-9)), cycles=len(C), bands=band_stats(C))
    if x.shape[1] == 2:
        side = (x[:, 0] - x[:, 1]) / 2
        r['side_db'] = 10 * np.log10((np.sum(side ** 2) + 1e-20) / (np.sum(sig ** 2) + 1e-20))
    ff = np.fft.rfftfreq(len(sig), 1 / sr); S = 20 * np.log10(np.abs(np.fft.rfft(sig)) + 1e-9)
    ref = np.mean(S[(ff > 2000) & (ff < 8000)]); cut = None
    for fc in range(8000, int(sr / 2) - 500, 250):
        if np.mean(S[(ff > fc) & (ff < fc + 500)]) < ref - 40:
            cut = fc; break
    r['cutoff'] = cut
    r['formants'] = formant_track(sig, sr, f0, slope, t0)
    pm = np.sqrt((np.abs(np.fft.rfft(C, axis=1) / P * 2) ** 2).mean(0)); r['harm_rms'] = pm
    if not quiet:
        print(f"file            {os.path.basename(path)}  ({dur * 1000:.0f} ms, {sr} Hz)")
        print(f"pitch (sustain) {r['f0']:.2f} Hz = {r['note']}   drift {slope:+.2f} Hz/s   ({len(C)} cycles)")
        print(f"cycle coherence {pf * 100:.0f}%   (model score, not a measured noise fraction)")
        if 'side_db' in r:
            print(f"side/mid        {r['side_db']:.1f} dB")
        print(f"HF cutoff       {'%d Hz (band-limit candidate; cause unverified)' % cut if cut else 'none detected'}")
        print("band            adj-cycle corr   harmonic-line fraction (window/bin dependent)")
        for lo, hi, adj, lf in r['bands']:
            print(f"  h{lo:<3d}-{hi:<3d} {lo * fmid:6.0f}-{hi * fmid:6.0f} Hz   {adj:+.2f}            {lf:.2f}")
        print("formant track   t(ms): peaks 300-2000 Hz | low(h1-8) vs mid(h9-47) dB")
        for t, pk, lm in r['formants']:
            print(f"  {t * 1000:5.0f}: {', '.join('%5.0f' % p for p in pk):24s} | {lm:+5.1f}")
    if out:
        os.makedirs(out, exist_ok=True)
        spectrogram_png(sig, sr, fmid, os.path.join(out, 'spectrogram.png'))
        with open(os.path.join(out, 'harmonics.csv'), 'w') as f:
            f.write('harmonic,hz,rms_db\n'); ref = pm[1:430].max()
            for h in range(1, min(430, len(pm))):
                f.write(f"{h},{h * fmid:.1f},{20 * np.log10(pm[h] / ref + 1e-12):.2f}\n")
    return r, sig, sr


# ---------------------------------------------------------------- extract
def extract(path, out, start=None, end=None, smooth=1, fmin=25, fmax=400):
    r, sig, sr = analyze(path, start, end, quiet=True, fmin=fmin, fmax=fmax)
    dur = len(sig) / sr
    f_start = r['f0_t0'] - r['slope'] * r['t0']  # extrapolate the sustain pitch back to t=0
    C = warp(sig, sr, 0.0, dur - 0.005, f_start, r['slope'])
    H = np.fft.rfft(C, axis=1); H[:, 0] = 0
    hmax = int(min(16000, sr / 2) / r['f0']); H[:, hmax:] = 0          # nothing trustworthy above codec cut
    if smooth:
        mag = gaussian_filter1d(np.abs(H), smooth, axis=0); H = mag * np.exp(1j * np.angle(H))
    F = np.fft.irfft(H, P, axis=1)
    F /= np.sqrt(np.mean(F ** 2, axis=1, keepdims=True)) + 1e-12; F *= 0.95 / np.abs(F).max()
    write_serum_wt(out, F)
    print(f"wrote {out}: {len(F)} frames (1 per cycle @ {r['f0']:.2f} Hz, harmonics 1-{hmax})")


# ---------------------------------------------------------------- formant model (original)
def formant_wt(out, root_hz=36.71, frames=64, anchors=None, body_hz=130, src_tilt=-6.0):
    """Saw-phase source -> 3 resonant formants (Hz at root note) morphing through anchor vowels.
    anchors: list of [(F1,F2,F3),(g1,g2,g3 dB),(bw1,bw2,bw3 Hz), body_db]"""
    anchors = anchors or [
        [(300, 1100, 1450), (0, -1, -5), (90, 120, 160), 0.0],   # closed / attack-like
        [(520, 1120, 1500), (0, 0, -4), (90, 120, 160), -3.0],
        [(740, 1180, 1560), (0, 0, -3), (100, 130, 170), -6.0],  # open 'aw'
        [(950, 1450, 2400), (0, -2, -5), (120, 160, 220), -8.0], # wide / bright (beyond the reference)
    ]
    nh = P // 2 - 1; h = np.arange(1, nh + 1); hz = h * root_hz
    src_db = src_tilt * np.log2(h)                                         # saw = -6 dB/oct
    phase = np.where(h % 2 == 0, np.pi, 0.0)                               # saw phase (sin, alternating sign)
    pos = np.linspace(0, len(anchors) - 1, frames); F = []
    for p in pos:
        i = min(int(p), len(anchors) - 2); a = p - i; A, B = anchors[i], anchors[i + 1]
        lerp = lambda u, v: (1 - a) * np.asarray(u, float) + a * np.asarray(v, float)
        fc, g, bw, body = lerp(A[0], B[0]), lerp(A[1], B[1]), lerp(A[2], B[2]), lerp([A[3]], [B[3]])[0]
        lin = np.zeros(nh)
        for k in range(3):                                                 # resonant peaks
            lin += 10 ** (g[k] / 20) / (1 + ((hz - fc[k]) / (bw[k] / 2)) ** 2)
        lin += 10 ** (body / 20) * 0.6 / (1 + ((hz - body_hz) / 60) ** 2)  # low body around h3-h4
        lin += 10 ** (-24 / 20)                                            # floor keeps some edge
        lin *= np.minimum(1, (hz / 100) ** 2)                               # tame h1 so the Sub osc owns the sub
        mag = 10 ** (src_db / 20) * lin; mag[hz > 18000] = 0
        spec = np.zeros(P // 2 + 1, complex); spec[1:nh + 1] = mag * np.exp(1j * (phase - np.pi / 2))
        w = np.fft.irfft(spec, P); F.append(w / (np.sqrt(np.mean(w ** 2)) + 1e-12))
    F = np.array(F); F *= 0.95 / np.abs(F).max()
    write_serum_wt(out, F)
    print(f"wrote {out}: {frames} frames, formants modeled at root {root_hz:.2f} Hz ({note_name(root_hz)})")
    return F


# ---------------------------------------------------------------- compare
def ltas(sig, sr):
    f, t, Z = stft(sig, sr, nperseg=8192, noverlap=6144)
    S = 10 * np.log10(np.mean(np.abs(Z) ** 2, axis=1) + 1e-20)
    fo = np.geomspace(30, min(16000, sr / 2 - 1), 240); So = np.interp(fo, f, S)
    return fo, gaussian_filter1d(So, 3)  # ~1/6-oct smoothing


def compare(a, b, out=None):
    ra, sa, sra = analyze(a, quiet=True)
    # assume both files play the same note: search B's pitch near A's (avoids octave errors on high-passed patches)
    rb, sb, srb = analyze(b, quiet=True, fmin=ra['f0'] * 0.94, fmax=ra['f0'] * 1.06)
    print(f"{'metric':28s}{'A: ' + os.path.basename(a)[:24]:>30s}{'B: ' + os.path.basename(b)[:24]:>30s}")
    row = lambda k, va, vb: print(f"{k:28s}{va:>30s}{vb:>30s}")
    row('pitch', f"{ra['f0']:.2f} Hz {ra['note']}", f"{rb['f0']:.2f} Hz {rb['note']}")
    row('cycle coherence (model)', f"{ra['periodic'] * 100:.0f}%", f"{rb['periodic'] * 100:.0f}%")
    for (lo, hi, aa, la), (_, _, ab, lb) in zip(ra['bands'], rb['bands']):
        row(f'h{lo}-{hi} adj-corr / line', f"{aa:+.2f} / {la:.2f}", f"{ab:+.2f} / {lb:.2f}")
    fa, La = ltas(sa, sra); fb, Lb = ltas(sb, srb)
    m = (fa > 200) & (fa < 4000); Lb_al = Lb - (np.mean(Lb[m]) - np.mean(La[m]))  # level-match in the mids
    print("\nlong-term spectrum, B minus A (level-matched 200-4000 Hz):")
    for lo, hi in [(30, 60), (60, 120), (120, 250), (250, 500), (500, 1000), (1000, 2000), (2000, 4000), (4000, 8000), (8000, 16000)]:
        mm = (fa >= lo) & (fa < hi)
        if mm.any():
            d = np.mean(Lb_al[mm] - La[mm]); bar = ('+' if d > 0 else '-') * min(20, int(abs(d) / 1.5))
            print(f"  {lo:>5}-{hi:<5} Hz {d:+6.1f} dB  {bar}")
    if out:
        import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
        os.makedirs(out, exist_ok=True); fig, ax = plt.subplots(figsize=(11, 5))
        ax.semilogx(fa, La, label='A ' + os.path.basename(a)); ax.semilogx(fb, Lb_al, label='B ' + os.path.basename(b))
        ax.set_xlabel('Hz'); ax.set_ylabel('dB'); ax.grid(alpha=.3, which='both'); ax.legend()
        ax.set_title('Long-term average spectrum (B level-matched to A in 200-4000 Hz)')
        plt.tight_layout(); plt.savefig(os.path.join(out, 'compare_ltas.png'), dpi=110); plt.close(fig)


# ---------------------------------------------------------------- cli
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest='cmd', required=True)
    for name in ('analyze', 'extract'):
        p = sp.add_parser(name); p.add_argument('input')
        p.add_argument('--start', type=float); p.add_argument('--end', type=float)
        p.add_argument('--fmin', type=float, default=25); p.add_argument('--fmax', type=float, default=400)
        p.add_argument('--out', required=(name == 'extract'))
    p = sp.add_parser('formant'); p.add_argument('--out', required=True)
    p.add_argument("--root-hz", type=float, default=36.71); p.add_argument('--frames', type=int, default=64)
    p = sp.add_parser('compare'); p.add_argument('a'); p.add_argument('b'); p.add_argument('--out')
    a = ap.parse_args()
    if a.cmd == 'analyze':
        analyze(a.input, a.start, a.end, a.out, a.fmin, a.fmax)
    elif a.cmd == 'extract':
        extract(a.input, a.out, a.start, a.end, fmin=a.fmin, fmax=a.fmax)
    elif a.cmd == 'formant':
        formant_wt(a.out, a.root_hz, a.frames)
    else:
        compare(a.a, a.b, a.out)


if __name__ == '__main__':
    main()
