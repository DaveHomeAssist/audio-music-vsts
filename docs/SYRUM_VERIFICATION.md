# Syrum prototype verification

Prototype 0.1, October 14, 2026. Source baseline: `b890738` in `DaveHomeAssist/audio-music-vsts`; this change introduces `apps/serum-wave-gen-vxx`. These results qualify the browser prototype, not Serum compatibility or perceived reconstruction quality.

## Executed

Build and tests ran on Dominic in an isolated temporary checkout using `mcr.microsoft.com/playwright:v1.63.0-noble`, Node 24.20.0, two CPU cores and a 3 GiB memory bound. The Mac handled editing, inspection and serving the already-built preview only.

| Check | Result | What it establishes |
| --- | --- | --- |
| `npm run format:check` | Passed | New TypeScript, CSS, HTML and configuration match the formatter. |
| `npm run build` | Passed | Strict TypeScript and production Vite bundles, including worker and AudioWorklet. |
| `npm test` | 7 passed | Known pitches at 0.5/1/3 seconds; FFT roundtrip/alignment; 1/8/64/256 frames; finite/DC output; export roundtrip and metadata; numerical 30-second hold; pitch/scan independence; raw versus assisted distinction; malformed/PCM/float WAV and channel policy. |
| Existing lab fixtures | Passed | Original 19,392-sample stereo reference parses and generates; existing 8/16/64-frame lab tables parse. No source fixtures changed. |
| `npm run test:browser` | 9 passed | Complete demo and lab journeys, audio output and stopping, export downloads, trim invalidation, cancellation/retry, keyboard tab navigation, theme persistence and fresh light default. |
| Viewport checks | Passed | Six stages, both themes, 1440×900, 375×812, 844×390, 320×256 and 3840×1080; compact subpages where applicable. Root dimensions and visible controls stay in the viewport; controls are not obstructed at their centers. |
| Accessibility checks | Passed | Axe WCAG 2 A/AA and 2.1 AA rules on all six empty/populated stages in both themes at the default browser viewport. This is an automated check, not full accessibility certification. |
| Visual inspection | Desktop and phone reviewed | Dark navy/cyan hierarchy, light alternative, source waveform and generated frame visualization. Screenshots are local test artifacts, not deployed UI evidence. |

The browser audio check samples the actual AudioWorklet signal through an analyser and confirms Stop makes it fall below the threshold. It is a short signal check. The 30-second hold is a separate numerical synthesis check, not a 30-second hardware listening test.

## Duncan rerun — October 15, 2026

The current `main` checkout at `dea6eea` was verified directly on Duncan using a temporary Node 24.22.0 and npm 11.21.0 toolchain. Duncan's installed Node 20.20.2 is below the repository requirement of Node 22.12 or newer. Locked dependencies were installed with `npm ci`. Playwright 1.63.0 required Chromium revision 1243, which was not in Duncan's existing browser cache; the matching Chromium and headless-shell builds were installed before the successful rerun.

| Check | Result | Notes |
| --- | --- | --- |
| `npm test` | 7 passed | All numerical, DSP, WAV and fixture checks passed in 3.1 seconds. The lab estimate remained 37.211 Hz. |
| `npm run build` | Passed | TypeScript checking and the production Vite build completed successfully. |
| `npm run test:browser` | 9 passed | All browser journeys, five viewport cases, AudioWorklet signal/stop behavior and automated accessibility coverage passed in 27.7 seconds. |
| `npm run format:check` | Failed | Prettier reported existing style differences in 12 tracked files. No files were reformatted during this verification run. |

The browser suite's first attempt failed before application execution because Playwright could not find Chromium revision 1243. After installing that exact revision, two complete reruns passed 9 of 9 tests. The repository working tree remained clean after verification.

The lab reference estimate was **37.211 Hz**. Its average lag-difference repetition score was **0.424**, not a fidelity percentage. The regression generation uses the existing lab's working root of **37.17 Hz**. These values do not identify an original preset or validate reconstruction against Connor's original wavetable.

Early checks found layout overlap at desktop/phone/extreme zoom and a light-theme contrast issue. Those were corrected before the complete passing run. A test-navigation mistake was also fixed. No failing test is waived.

## Duncan native Serum attempt — October 15, 2026

Ableton Live 12 Suite executable version 12.1.1 launched successfully on Duncan into a fresh untitled set. The installed instrument file `C:\Program Files\Common Files\VST3\Serum_x64.dll` reports file version 1.334; the 32-bit VST2 instrument also reports 1.334. These file properties do not establish the in-app Serum version, license state or successful plugin loading.

The permitted Windows controller found exactly one Ableton window and activated it, but window capture timed out with `FrameArrived timed out`. An accessibility-only read returned no usable controls. After the controller's prescribed reset and one retry, capture failed with the same error. No blind input was sent.

| Native case | Result | Evidence |
| --- | --- | --- |
| Serum instrument load and license | Not run | Ableton launched, but the plugin browser and Serum window could not be inspected. |
| Candidate import and 64-frame inspection | Not run | No wavetable was loaded. |
| 1.5-second scan and lossless render | Not run | No MIDI, automation, playback or render was created. |
| 30-second frame holds and bidirectional scrubs | Not run | No playback was started. |
| 3-second scan at 55 Hz and 110 Hz | Not run | No pitch or scan automation was created. |
| Preset and Ableton set save/reopen | Not run | No preset or set was saved. |

No plugin search paths, Ableton preferences, projects, presets or fixture files were changed. Ableton was left open at the fresh untitled set for local continuation. Serum compatibility remains unverified.

## Duncan manual Serum check — October 15, 2026

The native cases were then continued by hand on Duncan and recorded in three screenshots (about 03:48–04:03 local time) plus written notes. Serum ran as `Serum_x64` on Ableton track `1-Serum_x64`, starting from the `- Init -` preset. The table was `fixtures/syrum-demo/Syrum_64x2048.wav` from `main`, generated before the loop-point and harmonic-ceiling fix. That is fine for a format test. The in-app About screen was not captured, so the 1.334 file version is still the only version evidence.

| Native case | Result | Evidence |
| --- | --- | --- |
| Serum instrument load | Passed | The Serum window opened in Ableton with the `- Init -` preset. License state was not checked. |
| Candidate import as a wavetable | Passed | Loaded into Osc A by hand. The wavetable selector shows `Syrum_64x2048`. |
| Frame 1 and frame order | Passed (visual) | At WT POS 0, the 2D display matches a plot of frame 1 made from the file. The 3D view runs from the uneven first frame to smoother later frames, the same order as the file. |
| 64-frame inspection | Open: Serum reports 256 | The frame box reads `1` at WT POS 0 (screenshot) and `256` with WT POS fully clockwise (reported by hand, no screenshot). Serum's Copy Osc A → B menu action also produced a 256-frame table named `Custom` in Osc B. |
| 1.5-second scan and lossless render | Blocked | Ableton reports that saving and exporting are deactivated in this non-commercial session. No render was made. FL Studio 2025 on Duncan is the planned render host. |
| 30-second frame holds and bidirectional scrubs | Not run | Needs a render host. |
| 3-second scan at 55 Hz and 110 Hz | Not run | Needs a render host. |
| Preset and Ableton set save/reopen | Not run | Ableton set saving is deactivated. Serum's own preset save was not tried. |

The 256 reading is probably not a misread of the file. Cutting 64 × 2048 samples into 512-sample frames would give 256 frames, but frame 1 would then show only a quarter of the stored cycle, and the display shows the whole cycle. The likely cause is the `clm ` metadata: Syrum writes `<!>2048 10000000`, where the first digit, `1`, selects linear crossfade interpolation. Serum may fill the 64 stored frames out to 256 by crossfading between them. This is a hypothesis. To test it, load two 8-frame probe tables from the separate Duncan test package and read the frame box at full WT POS. A probe with flag `1` should read 256, and a probe with flag `0` should read 8.

## Unverified and deliberately open

- Serum's 256-frame reading of the 64-frame table and the interpolation flag behind it, rendered Serum output, export portability and preset save/reopen. Wavetable import and frame order are checked visually only; see the manual check above.
- Connor's matching original table/lossless audio pair and playback settings; existing experimental tables and AAC-derived clips are not substitutes.
- Perceived fidelity, transient/noise preservation, full pitch tracking, headphone/monitor listening, native Safari, mobile devices and long-term audio performance.
- Very large files and browser memory behavior beyond the bounded fixtures. Input limit is 64 MiB; preview/scan control range is 0.02–120 seconds. No fixed one-second cutoff exists.
- No public deployment or hosted service was configured. There was no existing deployment workflow to complete. Repository delivery and the localhost preview are separate from public release.
- The configured cross-project board file was unavailable and no Syrum entry was registered. Project next steps are recorded locally; board synchronization is not claimed.
- Duncan’s October 15 checkout reported 12 formatting differences. A clean cloud checkout of `a823445` was rechecked on October 17: `npm run format:check` passed without edits, all seven DSP tests passed via `node --import tsx --test apps/serum-wave-gen-vxx/tests/dsp.test.ts`, and `npm run build` passed. The npm test wrapper could not create its Unix IPC socket in this environment; the direct Node invocation ran the same test file. No new native Serum or browser acceptance is claimed.

The custom-table metadata follows [Xfer's published flag explanation](https://xferrecords.com/forums/general/file-types), using linear interpolation and factory flag off. That source explains the intended profile; only actual version-specific Serum tests can close compatibility.
