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

The lab reference estimate was **37.211 Hz**. Its average lag-difference repetition score was **0.424**, not a fidelity percentage. The regression generation uses the existing lab's working root of **37.17 Hz**. These values do not identify an original preset or validate reconstruction against Connor's original wavetable.

Early checks found layout overlap at desktop/phone/extreme zoom and a light-theme contrast issue. Those were corrected before the complete passing run. A test-navigation mistake was also fixed. No failing test is waived.

## Unverified and deliberately open

- Actual Serum import, frame interpretation, interpolation behavior, export portability and preset save/reopen.
- Connor's matching original table/lossless audio pair and playback settings; existing experimental tables and AAC-derived clips are not substitutes.
- Perceived fidelity, transient/noise preservation, full pitch tracking, headphone/monitor listening, native Safari, mobile devices and long-term audio performance.
- Very large files and browser memory behavior beyond the bounded fixtures. Input limit is 64 MiB; preview/scan control range is 0.02–120 seconds. No fixed one-second cutoff exists.
- No public deployment or hosted service was configured. There was no existing deployment workflow to complete. Repository delivery and the localhost preview are separate from public release.
- The configured cross-project board file was unavailable and no Syrum entry was registered. Project next steps are recorded locally; board synchronization is not claimed.

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
