# Serum Bass Lab: reference-hit analysis kit

The goal is to learn the technique and build an **original** patch with similar character. The reference is used for measurement and A/B only.

## Files

| Path | What it is |
| --- | --- |
| `wavetables/ORIG_formant_growl_D1.wav` | **Use this one.** 64-frame wavetable built from a model: a saw source with 3 moving formants (closed, then "aw", then wide), voiced at D1. |
| `wavetables/REF_extract_D1_learning-only.wav` | 16 frames, one per cycle of the reference, extracted pitch-synchronously. It shows what a direct extraction captures (mostly noise). Use it for A/B; don't put it in a release. |
| `renders/v1_dry.wav` | ORIG wavetable alone: position envelope only, no FX. |
| `renders/v2_unison_drive.wav` | Adds 4-voice mono unison (25 c spread) and tanh drive at +18 dB. |
| `renders/v3_full_chain.wav` | Best preview so far: 6 voices / 40 c, drive +24 dB, 3x downsample, attack noise, 90 Hz high-pass, 11 Hz LFO on position. |
| `analysis/reference_report.txt` | Pitch, periodicity, stereo, codec cutoff, per-band stability, formant track. |
| `analysis/spectrogram.png` | Harmonic view and transient view of the reference hit. |
| `analysis/harmonics.csv` | Average harmonic levels over the sustain (harmonic number, Hz, dB). |
| `analysis/wavetable_overview.png` | Model frames, extracted cycles, model vs reference harmonic profile. |
| `analysis/compare_ltas.png`, `compare_v3_vs_reference.txt` | Example A/B: long-term spectrum difference, v3 vs reference. |
| `tools/wt_lab.py` | `analyze` / `extract` / `formant` / `compare` |
| `tools/preview_render.py` | Offline Serum-like renderer for checking a wavetable model before building it by ear. |

## Reference fingerprint (0.44 s hit)

- **Pitch:** 37.28 Hz = **D1 +27 cents**, drifting about +2.5 Hz/s (rises ~+20–35 c over the hit)
- **Periodic energy:** only **19%**. About 81% of the energy is noise, modulation or other aperiodic content.
- **Stable body:** h1–h8 (37–300 Hz), with h3/h4 (111/148 Hz) strongest. h1 (the true sub) sits about 18 dB under them.
- **Formant region:** 0.33–1.75 kHz. Each cycle matches the next one (corr 0.5–0.66) but has decorrelated after ~5 cycles, so it is moving.
  - Peaks: F1 ≈ 700–930 Hz (appears after ~140 ms), F2 ≈ 1.0–1.23 kHz (present the whole time), F3 ≈ 1.45–1.57 kHz
- **Fizz above ~1.8 kHz:** aperiodic. The harmonic-line fraction is 0.43–0.49, close to the 0.40 of pure noise.
- **Attack (0–110 ms):** aperiodic and broadband up to ~5 kHz.
- **Source quality:** near-mono (side −20.5 dB). AAC lowpass at ~16.25 kHz, which is a codec artifact.

## Commands (macOS)

```bash
pip3 install numpy scipy soundfile matplotlib        # plus ffmpeg (brew install ffmpeg)
ffmpeg -i "Skrillex - Kill EVERYBODY (Original Mix) [2026-10-14 173920].m4a" -c:a pcm_f32le ref_hit.wav
python3 tools/wt_lab.py analyze ref_hit.wav --out analysis
python3 tools/wt_lab.py formant --out wavetables/my_growl.wav --root-hz 36.71 --frames 64
python3 tools/wt_lab.py compare ref_hit.wav my_serum_bounce.wav --out analysis   # same note, same length
```

`compare` expects both files to play the same note. Edit the `anchors` list in `formant_wt()` to design your own vowel path. That list is where the patch becomes yours.
