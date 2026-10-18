# SFT | Syrum Wavetable Generator

A local browser prototype: import a single-note WAV one-shot, trim, estimate its root, generate periodic frames, compare, hold/scrub/stretch, and export. **Actual Serum compatibility and listening acceptance remain unverified.** The folder/package name is `serum-wave-gen-vxx`; the product spelling is Syrum, and the target synthesizer is Serum.

From the repository root, use Node 22.12+ or 24:

```sh
npm ci
npm run dev
```

Open the printed localhost address. On macOS, [tools/macos](../../tools/macos/README.md) makes a double-click `Syrum.app` that starts the built app in the background. `npm run build` creates `apps/serum-wave-gen-vxx/dist`; `npm run preview` serves that build. AudioWorklet playback needs localhost or HTTPS. No source audio is uploaded. Refreshing closes the session; only your theme preference persists.

## Try it

1. Choose **Try the original synth demo** for a generated 1.5-second, 55 Hz evolving bass. It is original synthetic test material.
2. Or choose the existing `experiments/serum-bass-lab/reference.wav` through the file picker. That lab file was decoded from AAC; a WAV wrapper does not restore lossless provenance. The loose compressed clips are deliberately not accepted by this converter.
3. Analyze, check the root/octave, and generate. For the lab reference, compare the automatic candidate with the existing lab's working root of 37.17 Hz.
4. A auditions the selected mono source at its original pitch. B auditions the table at the chosen fixed root over the same selected duration. Both restart from zero. Select raw or explicitly envelope-assisted B. Shared −12 dB monitoring is not loudness matching.
5. Explore holds an indefinitely repeating frame through an AudioWorklet. Position changes use 12 ms smoothing. Scanning holds the first and last cycle at the source's endpoint margins, then sustains the final frame. Stop ends playback. Pitch changes restart playback but do not change scan duration.
6. Download the table and its playback notes separately. The WAV is a frame container, not a bounce of the source. Its source envelope, note and timing are only described in the notes.

## Engine and known limits

The direct-cycle baseline draws on the existing eight-frame lab: fixed-root sampling, a crossfaded loop point (10% of the cycle, no linear ramp, which would add a false fundamental), DC removal, harmonic limiting, and optional circular alignment between frames. This TypeScript implementation is independently tested; it is not a bit-identical port. The alternate lab's hand-designed formant model remains a separate experiment.

- PCM 16/24/32 or IEEE float32 RIFF WAV; one or two channels, 8–192 kHz. Extensible WAV, RF64, compressed inputs and multichannel sources are rejected with an explanation.
- 64 MiB input memory limit. No one-second duration limit. Generation needs at least two cycles at the selected root. Pitch estimation is limited to 25–1000 Hz; analyze requires at least 25 ms of audio.
- 1–256 frames, exactly 2048 samples each. Harmonics up to the source Nyquist, at most 1023 (a 37 Hz root keeps 591, about 22 kHz). Preview banks go up to 512 harmonics. Linear interpolation while sampling each cycle rolls off the top (about −0.9 dB at 8 kHz, −3.9 dB at 16 kHz at 44.1 kHz). One global table gain preserves relative frame amplitudes.
- Pitch estimation uses averaged/downsampled lag differences in seven windows. Weak repetition and pitch spread produce warnings, not a fictional accuracy percentage. This baseline is not a pitch tracker, source separator or transient reconstruction engine.
- Boundary repair and phase alignment alter the original phase/time relationship. Noise, transients, overlapping notes, stereo effects, rapid modulation and pitch drift are difficult cases. Holding a noisy cycle makes it periodic.
- Preview uses harmonic banks selected below Nyquist plus linear sample/frame interpolation. This reduces aliasing; it does not reproduce Serum's oscillator or prove alias-free playback. Preview banks have shared headroom compensation and can differ in gain from the exported raw table.
- Raw B contains table amplitude evolution; assisted B additionally estimates source RMS, with gain capped at 4×. This is disclosed, is not a fidelity score and is not included in the table. B has 5 ms endpoint fades. There is no hidden loudness normalization or null-test claim.
- Scan controls support 0.02–120 seconds independent of pitch. Optional BPM converts beats to seconds. Explore is raw; compare is always original duration/root. No accounts, persistent projects, automation or preset export.

## Export profile and verification gate

Float32 mono RIFF WAV at 44.1 kHz, with `fact`, `data`, and `clm ` chunks. Metadata is `<!>2048 10000000 Syrum prototype`: interpolation flag 1 (linear), factory flag 0 (custom). This follows [Xfer's published explanation](https://xferrecords.com/forums/general/file-types); it **does not establish acceptance in any installed Serum version**. Existing kit exports are preserved unchanged.

Obtain Connor's matching original wavetable and lossless bounce with note, scan curve, duration, amplitude envelope, effects, phase, sample rate, Serum version and OS. Verify import frame count; original-duration render; 30-second holds; slow/fast forward and reverse scrubs; independent pitch and scan time; and saved/reopened custom preset portability. Collect listening notes separately from numerical and browser evidence.

## Checks

```sh
npm test
npm run build
npm run test:browser
```

Browser tests require Playwright Chromium. The checked runner uses the Playwright 1.63.0 image, with bounded CPU/memory. Tests cover synthesized known pitches, frame bounds, finite/DC output, WAV parsing/export, existing lab assets, a numerical 30-second hold, scan/pitch independence, and real browser journeys across five viewport sizes and both themes. Consult [verification](../../docs/SYRUM_VERIFICATION.md) for actual execution results and remaining gaps; tests listed here are not a blanket claim that they passed.

Design and execution scope: [prototype brief](../../docs/SYRUM_BRIEF.md). Next work: [next steps](../../docs/NEXT_STEPS.md).
