# Continue the Serum test

## Objective and current boundary

Test the synthetic demo wavetable in actual Serum through Ableton on the Windows test machine. Keep **Serum compatibility unverified** until version-specific import and playback evidence is collected. This synthetic smoke test does not validate fidelity against Connor's missing matching original wavetable and lossless audio.

Dave wants to retain control of his mouse. Do not move the Mac cursor or use remote-control clicks. Work locally on the Windows machine with available permitted tools; coordinate any desktop interaction with Dave. Do not create agents or workflows. Recording was cancelled and is not part of this task. Preserve existing DAW projects and settings; use a new test project and record any plugin-search-path changes.

## What is available

- Browser prototype: [setup and commands](../apps/serum-wave-gen-vxx/README.md).
- Original synthetic [source.wav](../fixtures/syrum-demo/source.wav): mono, 44.1 kHz, 1.5 seconds, 55 Hz.
- Candidate [Syrum_64x2048.wav](../fixtures/syrum-demo/Syrum_64x2048.wav): Float32 mono, 64 frames of 2048 samples, custom linear metadata. Byte-identical to the browser demo export; regenerated on 2026-10-15 after the loop-point fix (see the fixture README).
- Offline [raw-resynthesis.wav](../fixtures/syrum-demo/raw-resynthesis.wav): same generated table at 55 Hz over 1.5 seconds, raw mode with 5 ms endpoint fades. This is not a Serum render.
- [Playback notes](../fixtures/syrum-demo/playback-notes.txt): root, phase alignment, scan endpoints and caveats.

Source and raw resynthesis files are **before monitor attenuation**. Apply the same -12 dB playback gain to both to match the browser. Do not normalize each independently. The wavetable file is a table, not an ordinary pitched audio audition.

The test host's file inventory on 2026-10-14 found Serum instrument/FX DLLs with file version 1.3.3.4, Ableton Live 12 Suite executable version 12.1.1, and FL Studio 2025 executable version 25.2.5.5319. These are file-resource versions, not verified in-app versions or license status. No Serum 2 was found in the checked locations. Recheck locally before use. The 64-bit Serum DLLs were in the common VST3 directory, but a directory name does not make a DLL a VST3 plugin: inspect Ableton's VST2 search path. Do not relocate plugins or change global paths without preserving the existing configuration.

No Ableton project was opened and no Serum test was executed from the Mac. SSH inventory succeeded; desktop capture failed. No test files were staged in a Windows checkout during that attempt. This repository now provides the files directly.

## Setup

Clone or pull `main` of this repository. For the browser prototype use Node 22.12+ or Node 24, then `npm ci` and `npm run dev`. The previously observed Node 20 on the Windows host is below the project's requirement; inspect the current runtime first. Testing the included WAVs inside Ableton does not require Node or npm.

Read [verification](SYRUM_VERIFICATION.md) and [next steps](NEXT_STEPS.md). Prior build/unit/browser results are historical evidence; they do not prove native Windows or Serum acceptance.

## Test sequence

1. Create a fresh Ableton set, insert the Serum **instrument**, and record exact OS, Live and Serum versions. Confirm plugin loading and license state. Do not bypass activation.
2. Initialize Serum: one wavetable oscillator, one unison voice; disable other oscillators, noise, filters, effects and warp. Disable random phase and use a known phase. Use a flat sustained amplitude envelope for the raw-table comparison; document short attack/release settings separately.
3. Load the candidate as an existing wavetable, not through sample conversion, pitch estimation or FFT re-analysis. Use the installed version's supported loading route. Confirm 64 frames and inspect first/middle/last frame shapes.
4. Play MIDI note 33 (55 Hz at A440; octave labels differ by host). Hold the first frame until 0.009091 s, sweep linearly to the last by 1.490886 s, then hold until 1.5 s. Use the playback notes as the timing authority. Document interpolation and phase settings.
5. Render lossless audio with no normalization, effects or hidden gain correction. Compare first against raw-resynthesis.wav to isolate host/export differences, then against source.wav to assess reconstruction. Match note, timing and disclosed gain; do not promise a sample-perfect null across different oscillators.
6. Hold first, middle and last frames for 30 seconds each. Scrub slowly and quickly in both directions. Note clicks, dropouts and unexpected discontinuities; save renders where possible.
7. Repeat the scan over 3 seconds at 55 Hz, then change pitch to 110 Hz while keeping the 3-second scan. Verify timing and pitch are independent.
8. Save a test preset and Ableton set, close and reopen, and verify the same custom table and playback. Check missing-file behavior/portability separately without moving or deleting user assets.

## Result record

Record each case as Passed, Failed or Not run, with exact versions, settings, expected/observed frame count, output filenames, gain and listening notes. Store only original synthetic test renders in version control after inspecting size/content; never commit license material, personal paths, whole DAW preferences or private projects. Update SYRUM_VERIFICATION.md and NEXT_STEPS.md with bounded findings. If Serum 1 passes, report that exact version only; Serum 2 and Connor fidelity remain open.
