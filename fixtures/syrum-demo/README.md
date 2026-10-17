# Original synthetic Serum smoke-test fixture

Start with the [Serum test handoff](../../docs/SERUM_TEST_HANDOFF.md).

These files come from the prototype's existing `demo()`, `generate()` and `render()` functions in `apps/serum-wave-gen-vxx/src/dsp.ts`, using 44100 Hz, 55 Hz root, 1.5 seconds, 64 frames and phase alignment enabled. `writeWav()` writes Float32 WAV; only the table receives wavetable metadata.

- `source.wav`: original synthetic one-shot, 66150 samples.
- `Syrum_64x2048.wav`: candidate table, 131072 samples.
- `raw-resynthesis.wav`: offline raw B preview, 66150 samples.
- `playback-notes.txt`: settings and limitations from the browser export.

`Syrum_64x2048.wav`, `raw-resynthesis.wav` and the notes' algorithm line were regenerated on 2026-10-15 after the loop-point fix (crossfade instead of a linear ramp; harmonic ceiling raised to the source Nyquist). `source.wav` is unchanged. A Serum test already started with the 2026-10-14 table should finish on that file and record which version it used.

Source and preview are stored before the browser's shared -12 dB monitor gain. No per-file loudness normalization. All three are original synthetic material, not Connor's reference or a Serum recording. Compatibility remains unverified.
