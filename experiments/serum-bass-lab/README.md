# Bass-hit wavetable experiment

This folder contains an independent analysis of the uploaded AAC bass hit, two experimental wavetables, and offline previews. These are starting materials for an original Serum patch, not a recovery of the original preset.

## What was verified

- The upload decodes to 19,392 samples at 44,100 Hz: 0.439728 seconds, stereo. Its container reports a longer duration; measurements here use decoded samples.
- The stereo mid signal is `(left + right) / 2`, with DC removed. The original stereo WAV remains in `reference.wav`.
- A 30–2,000 Hz band-limited autocorrelation search gives a leading candidate near 37.31 Hz. A local 64-harmonic spectral-comb refinement gives 37.17 Hz, approximately MIDI 26 (D1) +22 cents. This is a working estimate; modulation and AAC encoding limit precision.
- A strong spectral region falls near 1.16–1.23 kHz. This does not prove a particular formant filter or synthesis method.
- Local 64-harmonic fits explain about 18–64% of Hann-weighted variance in four-period windows of audio downsampled to 11,025 Hz. This metric depends on bandwidth, window, pitch, and harmonic count. It is not directly comparable to an unspecified “19% periodic energy” figure.
- Both table files have eight frames of 2,048 samples, mono PCM16, 44.1 kHz, and a `clm ` chunk declaring the frame length. RIFF sizes, chunk boundaries, sample count, nonzero frames, and peak headroom were checked. FFprobe also decoded the format metadata.
- All previews contain finite samples and remain below full scale. The three standalone previews have equal whole-hit RMS, not guaranteed equal perceived loudness.
- Serum itself is unavailable here. Import behavior and perceived patch quality still need checking in Serum. Offline renders use simple linear frame interpolation, not Serum's oscillator engine.

## Files

- `extracted_8x2048.wav`: individual periods selected across the hit, boundary detrended, limited to 256 harmonics, circularly aligned between neighboring frames. It preserves more irregular waveform detail but also folds nonperiodic content into repeating cycles. Boundary repair changes the sound; this is not a lossless extraction.
- `modeled_8x2048.wav`: 64 fitted harmonic amplitudes per frame, with a fixed Schroeder phase convention. Harmonics reach approximately 2.38 kHz at the estimated note. It omits the non-harmonic residual and higher-frequency texture. Relative frame levels are preserved through one global gain per table.
- `comparison_reference_extracted_modeled.wav`: reference mid, extracted render, modeled render, in that order, with 0.5-second gaps.
- `reference_mid.wav`, `extracted_preview.wav`, `modeled_preview.wav`: separate RMS-matched comparison files. Both synthesized previews follow a smoothed reference amplitude envelope.
- `spectrogram.png`, `harmonic_profiles.png`, `harmonic_amplitudes.csv`, `analysis.json`: measured outputs and limitations.
- `wt_lab.py`: reproducible analysis/export script; needs NumPy, SciPy, Matplotlib and an already-decoded WAV.

Do not audition the raw wavetable file as if it were a bass-hit render: its sample sequence is a frame container, not the original timing or pitch.

## First experiment in Serum

1. Initialize a preset. Load `modeled_8x2048.wav` into oscillator A as a wavetable, not into Serum 2's sample oscillator. Check that the editor shows eight frames. The metadata declares 2,048-sample frames; if your version ignores it, use its fixed-frame audio import with a 2,048-sample frame length. Avoid a new pitch-detection/resynthesis pass on the exported table.
2. Use one voice, random phase zero, warp off, and no effects. Set A fine tuning to approximately +22 cents. Play MIDI note 26; DAW octave labels can differ, so MIDI note number is the unambiguous reference.
3. First audition individual frames. Then assign a one-shot ascending LFO to WT POS over approximately 440 ms. For closer correspondence to the offline render, hold the first frame for 54 ms, scan through the table over 332 ms, then hold the last frame for 54 ms. This scan is a starting point, not a recovered modulation curve.
4. Use a 2 ms amplitude attack and full sustain; release the note around 410 ms with approximately 30 ms release. Adjust the envelope by ear to match the reference's broad amplitude gesture. The offline previews used the measured RMS envelope, so this simpler Serum envelope will differ.
5. Render once. Replace A's table with `extracted_8x2048.wav`, keeping everything else identical, and render again. Gain-match both to the reference. Choose the version whose body and movement you prefer.
6. For a third variation, add oscillator B as a sine, one octave above A, level zero, and apply a small amount of FM from B to A. Increase from zero and stop when it adds useful texture. Use a 100–200 ms decay envelope for an optional stronger FM onset.
7. Add modest soft clipping and compensate the output level. If the sound needs moving vowel-like emphasis, audition a peak filter around 700–1,500 Hz with moderate resonance. Those limits are experiments, not a measured sweep. Avoid adding a strong filter sweep automatically: the table already contains changing spectral emphasis.
8. If the modeled version remains too clean, add a quiet noise layer high-passed around 2 kHz and shaped by the amp envelope. Do not assume all residual energy is noise; modulation, pitch drift, phase changes, and AAC artifacts can contribute.

## Reusable analysis workflow

1. **Cleanup and pitch:** retain the unprocessed stereo source; inspect each channel and mono sum; remove DC; compare autocorrelation, harmonic spacing, and a tuning reference. Do not aggressively denoise before measurement. Audacity and Sonic Visualiser are useful for manual inspection. A full source track was not available for contextual comparison in this run.
2. **Spectral analysis:** compare attack, middle, and tail. The supplied 4,096-sample Hann spectrogram emphasizes frequency detail, while the 512-sample version emphasizes timing. At 37 Hz, even the long window contains only about 3.4 cycles. Longer windows improve low-frequency resolution at the expense of time detail. Harmonic amplitudes here use four-period fits at eight time positions.
3. **Wavetable design:** compare direct cycle extraction with amplitude-only harmonic reconstruction. The latter intentionally chooses new phases. Neither method recovers the unique original oscillator or effects chain. A baked-in spectral peak transposes with the note; use an external filter if that resonance should remain fixed across the keyboard.
4. **Synthesis:** add FM, filter movement, clipping, or noise one at a time. Integer-ratio FM is a useful harmonic starting point; noninteger ratios can add inharmonic sidebands. Compare filter-before-distortion with distortion-before-filter when your routing permits it.
5. **A/B:** align onsets and compare at matched perceived loudness. Check body, midrange motion, attack, and upper texture separately. Then check mono, other notes, and musical context. Spectrum similarity is evidence, not a substitute for listening. Null tests are not an appropriate target for this original patch.

Automation handles decoding, candidate pitch estimation, harmonic fitting, frame export, plots, and structural file checks. Listening determines octave interpretation, useful timbre, modulation shape, processing order, and whether the result works musically. No claim of a successful ear-based A/B is made here.

## Re-run

From this folder, with Python 3.10+ and NumPy/SciPy/Matplotlib installed:

```sh
OPENBLAS_NUM_THREADS=1 MPLCONFIGDIR=/tmp/mpl python wt_lab.py reference.wav
```

The script rewrites its generated outputs in the source WAV's directory. It leaves the input WAV unchanged. To decode a new input, use FFmpeg with `-c:a pcm_f32le`; retain the original file separately. No repository code, dependencies, or lockfiles were changed for this experiment.
