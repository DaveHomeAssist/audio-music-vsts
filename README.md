# Audio, Music & VST Experiments

Practical audio-analysis and synthesis experiments, with reproducible tools and listening materials.

## Syrum browser prototype

[Open the prototype guide](apps/serum-wave-gen-vxx/README.md) for local WAV import, cycle extraction, A/B playback, freeze/scrub/stretch and candidate wavetable export. Run `npm ci` then `npm run dev` from this repository. Actual Serum compatibility remains **unverified** until matching wavetable/audio tests and in-synth checks are completed.

## Erosyn formant lab

[Open the consolidated formant toolkit](experiments/erosyn-formant-lab/README.md) for the designed 64-frame vowel table, 16-frame pitch-synchronous extraction, offline effects previews, and analysis/comparison CLI supplied in the alternate archive. It complements the eight-frame experiment below. The guide explains why the two pitch estimates and repetition metrics differ, corrects the “81% noise” interpretation, and links validation results and source hashes.

## Serum bass wavetable lab

[Open the workflow and Serum instructions](experiments/serum-bass-lab/README.md).

This experiment analyzes a user-provided 0.44-second bass hit from Skrillex's “Kill Everybody” and creates two starting points for an original patch:

- [Extracted wavetable](experiments/serum-bass-lab/extracted_8x2048.wav): eight phase-aligned waveform frames.
- [Modeled wavetable](experiments/serum-bass-lab/modeled_8x2048.wav): eight frames reconstructed from 64 harmonic amplitudes.
- [Offline comparison](experiments/serum-bass-lab/comparison_reference_extracted_modeled.wav): reference, extracted render, modeled render, separated by silence.
- [Measurements and limitations](experiments/serum-bass-lab/analysis.json).

The working pitch estimate is 37.17 Hz, approximately MIDI note 26 (D1) +22 cents. File structure and numerical outputs have been verified. Actual Serum import and listening validation remain untested; the previews are offline renders, not Serum recordings.

### Reproduce the analysis

Use Python 3.11 or newer for the pinned dependencies. The checked dependency versions are listed in the experiment's requirements file.

```sh
python -m venv .venv
. .venv/bin/activate
python -m pip install -r experiments/serum-bass-lab/requirements.txt
OPENBLAS_NUM_THREADS=1 MPLCONFIGDIR=/tmp/mpl python experiments/serum-bass-lab/wt_lab.py experiments/serum-bass-lab/reference.wav
```

The script rewrites generated outputs beside the input WAV. It leaves the input unchanged. FFmpeg is needed only to decode a new compressed audio source; the included reference is already decoded.

The reference excerpt is third-party audio supplied for this analysis. Its inclusion does not confer rights to the underlying recording. No original Serum preset or claim about the artist's exact synthesis chain is included.

## Continue the native Serum test

Use the [Serum test handoff](docs/SERUM_TEST_HANDOFF.md) and [original synthetic demo fixtures](fixtures/syrum-demo/README.md) to continue in Ableton on Windows. This includes the candidate wavetable and both comparison audio files; actual Serum playback remains unverified.
