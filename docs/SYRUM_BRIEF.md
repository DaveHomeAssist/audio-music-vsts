# Syrum prototype brief

SFT | Syrum Wavetable Generator turns an isolated single-note WAV one-shot into a playable evolving wavetable. The first prototype must complete import/trim → analyze → generate → compare → freeze/scrub/stretch → export, while keeping actual Serum compatibility unverified.

## This slice

- Browser TypeScript application, local processing, no accounts, uploads or saved projects. Vite builds the worker and AudioWorklet; no UI framework or runtime dependencies are needed.
- WAV PCM 16/24/32 or float32, mono/stereo, explicit mono channel selection. Reject compressed input rather than pretending AAC becomes lossless. Preserve source sample rate and decoded sample count.
- Worker pitch estimate with manual override; pitch-synchronous cycle extraction, DC/boundary repair, harmonic limiting and optional relative phase alignment. This is derived from the direct-cycle experiments, not a port of the hand-designed formant model.
- 1–256 frames × 2048 samples; preview original trimmed duration, independent scan seconds/pitch, optional BPM, stable hold and bidirectional scrub.
- A is selected source channel at original timing/pitch. B is raw table or explicitly envelope-assisted. Shared monitoring attenuation; no hidden loudness matching. Compare restarts at time zero.
- Export float32 mono WAV with custom linear-interpolation metadata and separate playback notes. Export success never changes compatibility status.
- Synthetic original demo; existing lab reference available for local import and numerical regression. Existing research assets remain untouched.

## Exclusions and risks

No loop/song separation, residual layer, preset recovery, automatic Serum control, perfect phase restoration, automatic confidence-as-fidelity score, or full production qualification. The fixed-root baseline does not follow pitch drift. Noise, overlapping pitches, transients and stereo effects are reduced or folded into periodic waves. Phase alignment changes temporal phase. Preview band-limiting and linear interpolation are not Serum's engine. A finite source frame budget loses time detail; there is no one-second limit. Resource bounds are disclosed in the UI.

## Observable acceptance

Valid WAV and lab reference import; malformed/nonfinite/silent inputs fail clearly; trim invalidates results. Synthetic pitch estimates are near known fundamentals. Frame counts 1/8/64/256 and 2048 frame length round-trip in the WAV container with factory flag zero. Output remains finite. A 3-second one-shot works. Scan speed does not alter oscillator pitch; freezing sustains without scan reset; scrubbing interpolates. UI works with keyboard, both themes and desktop/mobile layouts. Export notes state actual settings and compatibility unverified.

Actual Serum gate: obtain matching original tables/lossless bounces plus note, scan, envelope, effects, phase and exact Serum version; load generated tables, confirm frame interpretation, render original duration, hold/scrub, save/reopen preset and collect listening acceptance. Until then all Serum claims remain unverified.
