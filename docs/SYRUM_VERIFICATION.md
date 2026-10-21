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

Cause of the `format:check` failure, found afterwards: the 12 files are every file the check covers, and the Windows checkout converted them to CRLF. The same files pass with LF and fail with CRLF on Linux too. The repository had no `.gitattributes`; one now enforces LF checkouts. The stored files did not need reformatting.

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
- Duncan's `npm run format:check` result after the `.gitattributes` change. The earlier failure was CRLF line endings in the Windows checkout, not a formatting defect.

The custom-table metadata follows [Xfer's published flag explanation](https://xferrecords.com/forums/general/file-types), using linear interpolation and factory flag off. That source explains the intended profile; only actual version-specific Serum tests can close compatibility.

## Re-run after the loop-point and harmonic-ceiling fix (October 15, 2026)

Two engine changes in `apps/serum-wave-gen-vxx/src/dsp.ts`:

- **Loop point:** the linear ramp that forced each cycle's ends to meet was replaced by a 10% raised-cosine crossfade into the neighbouring cycle. On noisy or drifting sources, the ramp added a sawtooth (strong h1 and h2). On the lab reference, h1 was −0.4 dB relative to the strongest harmonic (the measured sustain is about −16 to −22 dB).
- **Harmonic ceiling:** the 128-harmonic cap was replaced by the source Nyquist, at most 1023 harmonics. Preview banks now go up to 512 harmonics. At a 37 Hz root, the old cap removed everything above 4.76 kHz.

Run in a Claude Code cloud container: Node 22.22.0, local Chromium 1194 through a temporary `launchOptions.executablePath` override (not the pinned Playwright 1.63.0 browser image).

| Check                                                                             | Result                                        |
| --------------------------------------------------------------------------------- | --------------------------------------------- |
| New test: h1 on a noisy, drifting source stays within 3 dB of unrepaired cycles   | Failed before the fix (+9.1 dB), passes after |
| New test: harmonic 200 of a 40 Hz root survives in the table and the preview bank | Failed before the fix (absent), passes after  |
| `npm run format:check`                                                            | Passed                                        |
| `npm run build`                                                                   | Passed                                        |
| `npm test`                                                                        | 9 passed (7 existing, 2 new)                  |
| `npm run test:browser`                                                            | 9 passed                                      |

Fresh export of the lab reference (root 37.21 Hz, 64 frames), scanned offline at the original duration and compared with `experiments/erosyn-formant-lab/tools/wt_lab.py compare`:

| Measure                  | Before   | After    | Reference                        |
| ------------------------ | -------- | -------- | -------------------------------- |
| h1 vs strongest harmonic | −0.4 dB  | −16.5 dB | about −16 dB (direct extraction) |
| Highest harmonic kept    | 128      | 591      |                                  |
| 30–60 Hz vs reference    | +13.7 dB | +1.0 dB  | 0                                |
| 4–8 kHz vs reference     | −31.4 dB | −1.1 dB  | 0                                |
| 8–16 kHz vs reference    | −40.1 dB | −2.6 dB  | 0                                |
| Cycle coherence          | 18%      | 19%      | 19%                              |

The remaining top-end loss comes from linear interpolation while sampling each cycle (about −0.9 dB at 8 kHz and −3.9 dB at 16 kHz). These are offline numbers. They do not verify Serum import or listening quality.

## Connor's Mac — October 16–18, 2026

A fresh clone on Connor's Mac (macOS 26.6, Apple silicon) with a temporary toolchain: Node 24.22.0 and npm 11.19.1 from the official nodejs.org tarball (SHA-256 checked), Playwright Chromium revision 1243. The Mac had no Node and no Homebrew beforehand. Its `/usr/bin/git` shim fails until the Xcode license is accepted, so git ran from the Command Line Tools (`DEVELOPER_DIR=/Library/Developer/CommandLineTools`). No source change was needed to build or run.

| Check | `a823445` (Oct 16, before #1/#2) | `7acc719` (Oct 18, after #1/#2) |
| --- | --- | --- |
| `npm run format:check` | Passed | Passed |
| `npm test` | 7 passed | 9 passed (7 existing, 2 from #1) |
| `npm run build` | Passed | Passed |
| `npm run test:browser` | 9 passed | 9 passed |
| Demo export vs. `fixtures/syrum-demo` | Table and raw resynthesis byte-identical to the fixtures of that commit | Not repeated |

The lab reference estimate stayed at 37.211 Hz with repeatability 0.424 on both commits.

### Browser walkthrough (`a823445`, demo source)

Run in a Chromium pane at 1024×768 against `npm run dev`. Status text and control state were checked, not sound.

- Analyze: 55.00 Hz, MIDI 33, 0 cents, −14.2 dBFS RMS. Generate: 64 frames, aligned.
- Compare: A, raw B and envelope-assisted B each played to "Audition complete"; Stop stopped playback.
- Explore: Hold engaged; scrubbing to 50% and 10% updated the readout while holding. A 1.5 s scan at 55 Hz reached 100% and held the final frame. A 3 s scan at 110 Hz read 49.7% after about 1.5 s and 100% at 3 s. "Use source duration" restored 1.5 s; tempo sync at 140 BPM × 2 beats set 0.857 s.
- Export: the downloaded `Syrum_64x2048.wav` was byte-identical to the fixture. Every export uses this name regardless of source, so a second export collides in the Downloads folder.

### Third-party bass one-shots (`a823445`)

Splice one-shots from Connor's library, 24-bit stereo 44.1 kHz, analyzed as the mono sum with the app's own `analyze()`. No audio from these is committed.

| One-shot | Length | Estimate | Repetition / spread | Extra warnings |
| --- | --- | --- | --- | --- |
| `DS_TD_bass_synth_gnarl_D` | 0.843 s | 36.73 Hz, D1 +1 ¢ | 0.753 / 1.9 ¢ | none |
| `TSP_NOISIA_bass_jumpup_schreeuwbasje_E` | 1.009 s | 43.95 Hz, F1 +12 ¢ | 0.844 / 117 ¢ | pitch varies |
| `MO_RO_bass_bulldog_C` | 1.395 s | 33.23 Hz, C1 +28 ¢ | 0.799 / 2721 ¢ | pitch varies |
| `EFFIN_150_bass_neuro_tech` | 0.800 s | 59.74 Hz, A#1 +43 ¢ | 0.720 / 308 ¢ | pitch varies |
| `bass_tonal_stazz_B` | 0.857 s | 51.66 Hz, G#1 −9 ¢ | 0.649 / 788 ¢ | weak repetition, pitch varies |
| `PSYMBIONIC_bass_one_shot_reese_17_85_E` | 1.059 s | 115.40 Hz (wrong octave and note) | 0.424 / 720 ¢ | weak repetition, pitch varies |

The stable one-shot matched its labelled note. The drifting and detuned ones raised warnings rather than a confident wrong answer, except that the reese's estimate is far off. The D1 file went through the full browser flow; its downloaded table was byte-identical to a headless export of the same settings. Connor then used the macOS launcher (below) on a bass extracted from a song and reported that it worked well. That report is informal: no file, trim, root or settings were recorded.

### `clm ` flags in tables on this Mac

`python3 tools/clm_probe_tables.py inspect` over the installed table folders. "Serum layout" means the file starts with Serum's 28-byte `JUNK` chunk and has no `fact` chunk; the other files were written by other tools. The first digit is the one Xfer describes as the interpolation setting; the second is the factory flag.

| Folder | Serum layout | Other layout |
| --- | --- | --- |
| Serum 2 factory `Analog`, `Digital`, `Vowel`, `S2 Tables` | `01`, `11`, `21`, `31`, `41` (one `Digital` file has no `clm `) | `01`, `11`, `21` |
| Serum 2 factory `Spectral` | `21` | `01`, `11`, `21`, `31`, `41` |
| Serum 1 user tables (Connor's saves and third-party packs) | `00` ×1, `10` ×2, `20` ×11, `40` ×4 | `00` ×6, `10` ×11, `20` ×6, `40` ×2 |
| Serum 2 user tables | `20` ×2 | — |
| Syrum export | — | `10` |

So the first digit takes values 0–4 in Xfer's own factory tables and in tables Serum saved for Connor. Digit 1, which Syrum writes, is common in factory tables (for example `Analog/Basic_McB.wav`, 4 frames, `11`). If Serum also reports more frames than stored for a factory digit-1 table, the 256 reading on Duncan is how Serum presents that interpolation setting rather than a Syrum file defect. Matching pairs for the check: `Analog/Basic Mini.wav` (4 frames, digit 0) and `Analog/Basic_McB.wav` (4 frames, digit 1), and Connor's own Serum-saved `JaggedSin.wav` (4 frames, digit 1). `tools/clm_probe_tables.py probes` writes 8-frame probes with digits 0, 1 and 2 from the current fixture into `work/clm-probes`.

### Native Serum cases

Installed bundle versions: Serum 1.368 (AU, VST3, VST2) and Serum 2.1.4 (AU, VST3); Ableton Live 12 Suite 12.4.6. These are file versions; in-app versions and license state were not checked.

| Native case | Result |
| --- | --- |
| Frame count for factory digit-0/digit-1 tables and the probes | Not run |
| Candidate import and 64-frame inspection | Not run |
| 1.5-second scan and lossless render | Not run |
| 30-second holds and bidirectional scrubs | Not run |
| 3-second scan at 55 Hz and 110 Hz | Not run |
| Preset save/reopen | Not run |

Connor's own Serum-saved tables exist on this Mac, but no lossless render of any of them with recorded note, scan, envelope and Serum version was found, so the reconstruction comparison still uses the synthetic demo. Serum compatibility remains **unverified**.

## Desktop app — October 18–21, 2026

Host: Dave's MacBook Air (macOS 27.0.1, arm64). Packaging a macOS app needs macOS, and no inventoried runner has it (RUN-4). Electron 44.9.0, electron-builder 26.15.3, built from a clean clone of `claude/syrum-desktop` outside iCloud Drive.

- `npm run desktop:dist`: `Syrum-0.1.0-arm64.dmg`, 128 MB; `hdiutil verify` VALID. The app bundle is 289 MB. `app.asar` holds only `package.json`, the two shell scripts and the built `dist`.
- `npm run test:desktop` with `SYRUM_APP` pointing at the packaged binary: passed in 9.4 s. The test runs the demo journey with network requests blocked, plays hold and scan, and saves the WAV and notes. The WAV is byte-identical to the checked-in browser export. No process remains after Quit.
- Same test against the development build: passed. `npm test`: 9 passed. `npm run format:check`: clean.
- Not run here: `npm run test:browser` (no Playwright browsers on this Mac; run it on Dominic or Duncan), a real-WAV import in the packaged app, headphone listening for dropouts, or a first launch through Gatekeeper on another Mac.

