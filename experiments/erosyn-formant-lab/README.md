# Erosyn formant wavetable lab

This is the distinct toolkit supplied in `erosyn-bass-lab-kit-alt1.zip`, consolidated alongside the [eight-frame harmonic-fit experiment](../serum-bass-lab/README.md). It adds a designed 64-frame vowel progression, a 16-frame extraction, a pitch-glide analysis model, an A/B command, and an offline effects renderer.

> **Metadata note (2026-10-15):** both committed tables carry `clm` flags `01000000`, copied from Xfer's factory example. That means no frame interpolation, and the factory flag on, which tells Serum the table ships with Serum and must not be embedded in user presets ([Xfer file types](https://xferrecords.com/forums/general/file-types)). `tools/wt_lab.py` now writes `10000000` (linear crossfade, custom). Regenerating with the current tool gives identical sample data with corrected flags. The committed files are left unchanged because `provenance.json` records their hashes.

Start with the [64-frame original formant table](wavetables/ORIG_formant_growl_D1.wav) for sound design. Use the [16-frame extracted table](wavetables/REF_extract_D1_learning-only.wav) to compare what direct extraction retains. The designed table uses a saw-like harmonic source with chosen resonances; it is not a measurement-derived reconstruction of the original oscillator.

## How the two experiments differ

| | This formant lab | Existing harmonic-fit lab |
| --- | --- | --- |
| Modeled table | 64 frames, designed vowel anchors | 8 frames, 64 fitted harmonic amplitudes per frame |
| Extracted table | 16 cycles, pitch-glide compensation and magnitude smoothing | 8 selected cycles, boundary repair and phase alignment |
| Working pitch | Sustain fit with linear glide: 37.28 Hz, D1 +27 cents | Fixed-frequency fit: 37.17 Hz, D1 +22 cents |
| Repetition metric | Bias-corrected coherence of 11 pitch-warped sustain cycles | Local weighted variance explained by 64 harmonics |
| Preview | Unison, position envelope/LFO, noise, tanh drive, sample-and-hold, high-pass | Table scan following the measured amplitude envelope |

The two pitch estimates differ by about five cents. Their repetition metrics use different models, time windows, and bandwidths and should not be compared as though they measure the same quantity.

## Interpretation corrections

- **19% is a model-dependent cycle-coherence estimate, not evidence of 81% noise.** Its bias correction assumes a fixed waveform plus independent noise across aligned cycles. Pitch-model errors, phase changes, gain changes, and timbral modulation also reduce the score. The analyzer's CLI now says “cycle coherence”; the internal `periodic` and `hnr` keys are retained for compatibility, but `hnr` is only an algebraic transform of that model score.
- **Low cycle correlation does not prove pure noise.** A harmonic-line fraction near 0.40 is not a universal noise threshold: bin count, windows, spectral shape, and alignment affect it. The supplied reports' numbers are retained; their original interpretations are historical.
- **A static distortion applied to a periodic input remains periodic.** Noise, detuned voices, time-varying modulation, and some sample-rate interactions can reduce repetition. Do not add distortion solely to force a coherence target.
- The measured spectral rolloff is consistent with band-limiting, but the data alone cannot establish that the codec caused it. Strong spectral peaks are candidate resonances, not proof of a particular formant filter.
- More notes can help test whether resonance positions track pitch, but tracking alone does not prove an oscillator source: filters can have key tracking too.
- An 8192–16384-sample analysis window spans roughly 186–372 ms at 44.1 kHz. This helps frequency resolution but averages over much of this hit; use a shorter window for timing.
- The comparison command aligns mean log-spectrum levels over 200–4000 Hz. It does not loudness-normalize an audio bounce, align onsets, or perform a perceptual listening check. The imported previews are independently peak-normalized.
- The offline renderer is not Serum. Its nonlinear processing is not oversampled, so drive and sample-and-hold can introduce aliasing. Its detune/drive settings are not calibrated Serum knob equivalents.

## Run from the repository root

Use Python 3.11+ for the pinned dependencies. SoundFile wheels provide libsndfile on supported platforms; other platforms may need libsndfile installed separately. The decoded reference is shared with the existing lab, so no second audio source is needed.

```sh
python -m venv .venv
. .venv/bin/activate
python -m pip install -r experiments/erosyn-formant-lab/requirements.txt
mkdir -p experiments/erosyn-formant-lab/generated

python experiments/erosyn-formant-lab/tools/wt_lab.py analyze experiments/serum-bass-lab/reference.wav --out experiments/erosyn-formant-lab/generated/reference
python experiments/erosyn-formant-lab/tools/wt_lab.py extract experiments/serum-bass-lab/reference.wav --out experiments/erosyn-formant-lab/generated/extracted.wav
python experiments/erosyn-formant-lab/tools/wt_lab.py formant --out experiments/erosyn-formant-lab/generated/my_growl.wav --root-hz 36.71 --frames 64
python experiments/erosyn-formant-lab/tools/preview_render.py experiments/erosyn-formant-lab/generated/my_growl.wav experiments/erosyn-formant-lab/generated/preview.wav
python experiments/erosyn-formant-lab/tools/wt_lab.py compare experiments/serum-bass-lab/reference.wav experiments/erosyn-formant-lab/generated/preview.wav --out experiments/erosyn-formant-lab/generated/comparison
```

For headless cloud execution, use a writable Matplotlib cache, e.g. `MPLCONFIGDIR=/tmp/mpl`, and `OPENBLAS_NUM_THREADS=1` to limit numerical-library threads. `generated/` is ignored by Git. Commands assume a nonempty, audible bass hit with enough cycles; these research scripts are not general-purpose audio validators.

## First Serum experiment

1. Load `ORIG_formant_growl_D1.wav` into a wavetable oscillator. Confirm 64 frames of 2048 samples. Use one voice, random phase off, warp off, and effects off.
2. Play MIDI note 26 (D1), optionally +27 cents when comparing with the reference. The model's design root is 36.71 Hz; fine-tuning also shifts its baked-in resonances slightly.
3. Set WT POS to the first frame. Modulate it upward by about 62% with a 150 ms attack envelope and full sustain. Gate the note for about 430 ms with about 10 ms release. Adjust by ear rather than treating these as measured envelope settings.
4. Render this clean pass. Then audition a small WT POS LFO, modest mono unison, and soft distortion, one addition at a time. Match perceived level after each addition. The supplied v1/v2/v3 renders are examples, not proof that any stage sounds closer in Serum.
5. Compare the body, vowel motion, attack, and upper texture. Add a small high-passed noise burst only if useful. Try an external formant filter on another patch to explore fixed-frequency versus transposing vowels.

No “periodic percentage” target is required for success. The goal is an original patch that works musically and teaches which processing stage contributes each audible feature.

## Provenance and verification

[provenance.json](provenance.json) records the supplied archive and original file hashes. The other upload, `erosyn-bass-lab-kit.zip`, exactly duplicates all 13 files already in `experiments/serum-bass-lab` and was not imported again.

[SUPPLIED_README.md](SUPPLIED_README.md), the files under `analysis/`, and the supplied audio/plots are retained as historical artifacts. Use this README for current guidance. The active analyzer has only explanatory docstring/output-label changes; its numerical analysis is unchanged. The preview renderer is unchanged.

Current execution evidence is in [validation/](validation/). All four analyzer subcommands and the default preview-render command were exercised. Table structure, frame counts, finite samples, and headroom were checked. Regeneration comparisons are recorded in `validation/validation.json`. The historical render commands omit some settings, so exact recreation of all supplied previews is not claimed.

Actual Serum import, listening comparison, and full-track context remain unverified. The reported Erosyn Notion pages were not accessed or modified; no page URLs were supplied.
