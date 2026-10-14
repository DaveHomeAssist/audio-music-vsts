"""Analyze a short bass hit and export experimental 2048-sample-frame tables.

Usage: OPENBLAS_NUM_THREADS=1 MPLCONFIGDIR=/tmp/mpl python wt_lab.py reference.wav
Requires Python 3.10+, NumPy, SciPy, and Matplotlib. Input must be decoded WAV.
"""
from __future__ import annotations

import argparse
import json
import struct
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from scipy import optimize, signal
from scipy.io import wavfile

FRAME_SIZE = 2048
FRAME_COUNT = 8
HARMONICS = 64


def write_table(path: Path, frames: np.ndarray, sr: int) -> None:
    """Write PCM16 WAV with Serum-style clm frame-size metadata."""
    samples = np.rint(np.clip(frames.ravel(), -1, 1) * 32767).astype('<i2')
    chunks = [(b'fmt ', struct.pack('<HHIIHH', 1, 1, sr, sr * 2, 2, 16)),
              (b'clm ', b'<!>2048 00000000'), (b'data', samples.tobytes())]
    body = b'WAVE'
    for name, payload in chunks:
        body += name + struct.pack('<I', len(payload)) + payload
        if len(payload) % 2:
            body += b'\x00'
    path.write_bytes(b'RIFF' + struct.pack('<I', len(body)) + body)


def verify_table(path: Path) -> dict:
    """Validate actual RIFF boundaries, metadata, and sample payload."""
    raw = path.read_bytes()
    assert raw[:4] == b'RIFF' and raw[8:12] == b'WAVE'
    assert struct.unpack_from('<I', raw, 4)[0] + 8 == len(raw)
    chunks = {}
    pos = 12
    while pos < len(raw):
        name, size = struct.unpack_from('<4sI', raw, pos)
        payload = raw[pos + 8:pos + 8 + size]
        assert len(payload) == size
        chunks[name.decode()] = payload
        pos += 8 + size + (size % 2)
    assert pos == len(raw)
    assert chunks['clm '].startswith(b'<!>2048 ')
    assert struct.unpack_from('<HH', chunks['fmt ']) == (1, 1)
    samples = np.frombuffer(chunks['data'], dtype='<i2').reshape(FRAME_COUNT, FRAME_SIZE)
    assert np.max(np.abs(samples.astype(float))) < 32767
    assert np.all(np.std(samples, axis=1) > 0)
    return {'frames': len(samples), 'samples_per_frame': FRAME_SIZE,
            'chunks': list(chunks), 'peak': float(np.max(np.abs(samples.astype(float))) / 32767)}


def scale_table(frames: np.ndarray) -> np.ndarray:
    frames = frames - frames.mean(axis=1, keepdims=True)
    return frames * (0.90 / np.max(np.abs(frames)))


def render(frames: np.ndarray, f0: float, sr: int, n: int, centers: np.ndarray) -> np.ndarray:
    """Offline linear table scan; not a Serum engine emulation."""
    t = np.arange(n) / sr
    position = np.interp(t, centers, np.arange(len(frames)))
    lo = np.floor(position).astype(int)
    hi = np.minimum(lo + 1, len(frames) - 1)
    mix = position - lo
    phase = np.remainder(t * f0, 1) * FRAME_SIZE
    j = np.floor(phase).astype(int)
    k = (j + 1) % FRAME_SIZE
    frac = phase - j
    a = frames[lo, j] * (1 - frac) + frames[lo, k] * frac
    b = frames[hi, j] * (1 - frac) + frames[hi, k] * frac
    return a * (1 - mix) + b * mix


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    args = parser.parse_args()
    out = args.source.resolve().parent
    sr, audio = wavfile.read(args.source)
    if np.issubdtype(audio.dtype, np.integer):
        audio = audio.astype(float) / max(abs(np.iinfo(audio.dtype).min), np.iinfo(audio.dtype).max)
    audio = audio.astype(float)
    x = audio.mean(axis=1) if audio.ndim == 2 else audio
    x -= x.mean()
    t = np.arange(len(x)) / sr
    fs = sr / 4
    y = signal.resample_poly(x, 1, 4)
    ty = np.arange(len(y)) / fs
    filtered = signal.sosfiltfilt(signal.butter(4, [30, 2000], fs=fs, btype='bandpass', output='sos'), y)
    ac = signal.correlate(filtered, filtered, method='fft')[len(y)-1:]
    ac /= ac[0]
    peaks, _ = signal.find_peaks(ac)
    peaks = [p for p in peaks if fs / 160 < p < fs / 25]
    peaks.sort(key=lambda p: ac[p], reverse=True)
    lag = peaks[0]
    correction = .5 * (ac[lag-1] - ac[lag+1]) / (ac[lag-1] - 2*ac[lag] + ac[lag+1])
    ac_pitch = fs / (lag + correction)

    # Local harmonic-comb estimate near the independently found ACF candidate.
    # This is an estimator, not proof that all energy follows one fundamental.
    f, power = signal.periodogram(y, fs, window='hann', nfft=131072)
    harmonics = np.arange(1, HARMONICS + 1)
    def comb_score(freq: float) -> float:
        return float(np.sum(np.interp(freq * harmonics, f, power)))
    grid = np.linspace(ac_pitch * .97, ac_pitch * 1.03, 401)
    best = int(np.argmax([comb_score(q) for q in grid]))
    fit = optimize.minimize_scalar(lambda q: -comb_score(q), bounds=(grid[max(0,best-1)], grid[min(len(grid)-1,best+1)]), method='bounded')
    f0 = float(fit.x)
    midi = 69 + 12 * np.log2(f0 / 440)
    centers = np.linspace(2 / f0, t[-1] - 2 / f0, FRAME_COUNT)
    phases = np.arange(FRAME_SIZE) / FRAME_SIZE
    extracted, modeled, fit_details, amps = [], [], [], []
    for center in centers:
        # Raw single-cycle crop, boundary detrending, band limiting, then alignment.
        frame = np.interp(center + (phases - .5) / f0, t, x)
        frame -= np.linspace(frame[0], frame[-1], FRAME_SIZE)
        spectrum = np.fft.rfft(frame)
        spectrum[0] = 0
        spectrum[257:] = 0
        frame = np.fft.irfft(spectrum, n=FRAME_SIZE)
        if extracted:
            corr = np.fft.irfft(np.fft.rfft(extracted[-1]) * np.conj(np.fft.rfft(frame)), n=FRAME_SIZE)
            frame = np.roll(frame, int(np.argmax(corr)))
        extracted.append(frame)

        # Weighted least squares on four periods, retaining 64 harmonic amplitudes.
        mask = np.abs(ty - center) <= 2 / f0
        times, values = ty[mask] - center, y[mask]
        angles = 2 * np.pi * times[:, None] * f0 * harmonics
        design = np.column_stack([np.ones(len(times)), np.cos(angles), np.sin(angles)])
        weight = np.hanning(len(times))
        coefficients = np.linalg.lstsq(design * np.sqrt(weight[:,None]), values * np.sqrt(weight), rcond=None)[0]
        amplitudes = np.hypot(coefficients[1:HARMONICS+1], coefficients[HARMONICS+1:])
        prediction = design @ coefficients
        mean = np.average(values, weights=weight)
        explained = 1 - np.sum(weight * (values - prediction)**2) / np.sum(weight * (values - mean)**2)
        # Fixed Schroeder phases reduce peaky all-cosine waveforms and permit stable scans.
        harmonic_phase = -np.pi * harmonics * (harmonics - 1) / HARMONICS
        modeled.append(np.cos(2*np.pi*phases[:,None]*harmonics + harmonic_phase) @ amplitudes)
        amps.append(amplitudes)
        fit_details.append({'center_seconds': float(center), 'weighted_harmonic_fit_fraction': float(explained)})
    extracted, modeled = scale_table(np.array(extracted)), scale_table(np.array(modeled))
    checks = {}
    for name, frames in [('extracted', extracted), ('modeled', modeled)]:
        path = out / f'{name}_8x2048.wav'
        write_table(path, frames, sr)
        checks[name] = verify_table(path)

    # Impose the same measured slow RMS envelope on both offline previews.
    envelope = np.sqrt(signal.convolve(x*x, np.ones(441)/441, mode='same'))
    envelope[:88] *= np.linspace(0, 1, 88)
    envelope[-220:] *= np.linspace(1, 0, 220)
    previews = [x]
    for frames in [extracted, modeled]:
        r = render(frames, f0, sr, len(x), centers)
        slow_rms = np.sqrt(signal.convolve(r*r, np.ones(882)/882, mode='same') + 1e-8)
        r *= envelope / slow_rms
        r *= np.sqrt(np.mean(x*x) / np.mean(r*r))
        previews.append(r)
    gain = .90 / max(np.max(np.abs(r)) for r in previews)
    for name, r in zip(['reference_mid', 'extracted_preview', 'modeled_preview'], previews):
        wavfile.write(out / f'{name}.wav', sr, (r * gain).astype(np.float32))
    silence = np.zeros(round(sr * .5))
    wavfile.write(out / 'comparison_reference_extracted_modeled.wav', sr,
                  np.concatenate([v for r in previews for v in (r*gain, silence)]).astype(np.float32))

    fig, axes = plt.subplots(3, 1, figsize=(11, 9), constrained_layout=True)
    for ax, length, title in zip(axes[:2], [4096, 512], ['93 ms window: harmonic detail', '12 ms window: timing detail']):
        freqs, times, spec = signal.spectrogram(x, sr, window='hann', nperseg=length, noverlap=length-length//8, mode='magnitude')
        db = 20*np.log10(np.maximum(spec, 1e-10))
        ax.pcolormesh(times * 1000, freqs, db, shading='auto', cmap='magma', vmin=db.max()-65, vmax=db.max())
        ax.set(title=title, ylabel='Hz', ylim=(30, 10000))
        ax.set_yscale('log')
    axes[2].plot(t*1000, x, lw=.4)
    axes[2].set(xlabel='Time (ms)', ylabel='Amplitude', title='Decoded mono mid signal')
    fig.savefig(out/'spectrogram.png', dpi=150)
    plt.close(fig)
    fig, ax = plt.subplots(figsize=(10, 4), constrained_layout=True)
    for index, label in [(0,'Early'), (3,'Middle'), (7,'Late')]:
        a = np.array(amps[index])
        ax.plot(harmonics*f0, 20*np.log10(np.maximum(a,1e-8)), label=label)
    ax.set(xlabel='Frequency (Hz)', ylabel='Fitted harmonic amplitude (dBFS)', title='64-harmonic fits; lines connect harmonic samples')
    ax.legend()
    fig.savefig(out/'harmonic_profiles.png', dpi=150)
    plt.close(fig)
    np.savetxt(out/'harmonic_amplitudes.csv', np.column_stack([harmonics, harmonics*f0, np.array(amps).T]), delimiter=',', header='harmonic,frequency_hz,'+','.join(f'frame_{i}' for i in range(FRAME_COUNT)), comments='')
    report = {'sample_rate': sr, 'decoded_duration_seconds': len(x)/sr,
              'acf_candidate_hz': ac_pitch, 'acf_peak_normalized': float(ac[lag]),
              'local_comb_pitch_hz': f0, 'midi_note_float': float(midi),
              'cents_from_midi_26_D1': float((midi-26)*100),
              'frame_fits': fit_details, 'wav_validation': checks,
              'preview_rms': [float(np.sqrt(np.mean((r*gain)**2))) for r in previews],
              'limitations': ['Pitch is a working estimate for a modulated, noisy AAC sample.',
                 'Fit fraction is weighted local variance explained by 64 harmonics, not an intrinsic periodic-energy percentage.',
                 'Extracted frames use boundary detrending, 256-harmonic low-pass, and circular phase alignment.',
                 'Modeled frames use fixed synthetic phase; original phase and non-harmonic residual are omitted.',
                 'Offline previews are not Serum renders; actual Serum import remains untested.']}
    (out/'analysis.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
