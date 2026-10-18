# Syrum next steps

This is the prototype's implementation follow-through, linked to the existing research requirements. It does not replace Connor's requirements or turn their Draft / Needs ground truth statuses into validation.

## Current slice

Local TypeScript/Web Audio converter under `apps/serum-wave-gen-vxx`. Product name Syrum; Serum is the compatibility target. Direct-cycle baseline, six working stages, original synthetic demo, WAV export plus playback notes. Build, seven numerical/file checks and nine browser tests passed on Dominic and again on Duncan. Duncan's October 15, 2026 rerun used Node 24.22.0 and Playwright Chromium revision 1243. Duncan's `format:check` failure (12 files) came from CRLF line endings in the Windows checkout, not from formatting; `.gitattributes` now keeps LF checkouts on every OS. Execution evidence lives in [SYRUM_VERIFICATION.md](SYRUM_VERIFICATION.md).

## Next evidence gate

Connor: provide a matching original table and lossless render with MIDI note, scan curve/time, envelope, effects, phase, sample rate, exact Serum version and OS. The existing experimental generated tables and AAC-derived reference are not this ground truth.

Dave: run that pair through the prototype, document reconstruction and reference differences, then verify import/frame count, original-duration render, 30-second hold, both scrub directions, pitch versus scan independence, and preset save/reopen in Serum. Preserve compatibility as **unverified** until actual version-specific evidence exists.

## Connor's Mac — 2026-10-18

Connor's Mac now runs the prototype from a double-click launcher (`tools/macos/`) and has Serum 1.368, Serum 2.1.4 and Live 12.4.6 with full export, so it can run the native cases that Duncan's non-commercial Ableton could not. Cheapest next check for the 256-frame question: read Serum's frame count for the factory pair `Analog/Basic Mini.wav` (digit 0) and `Analog/Basic_McB.wav` (digit 1), both 4 frames, then the Syrum candidate. Results and the `clm ` survey are in [SYRUM_VERIFICATION.md](SYRUM_VERIFICATION.md#connors-mac--october-1618-2026). Connor's matching original table and lossless render are still outstanding.

## Standalone desktop app — proposed 2026-10-18

Scoped in [SYRUM_DESKTOP_BRIEF.md](SYRUM_DESKTOP_BRIEF.md): wrap the existing build in a self-contained app window (no Node, server or browser). Not approved; awaiting choices S01–S04 (recommended: Electron, macOS first, unsigned private build, native Save dialog).

## Open choices (not approvals)

- D01 — Qualification target: **A recommended:** one exact Serum 2 version first. B: Serum 1 and 2 together, increasing test scope. Owner: Dave + Connor.
- D02 — Next algorithm experiment: **A recommended:** local pitch tracking against the known pair. B: harmonic modeling comparison. C: residual-layer output. Choose after listening to the baseline; no automatic residual classification.
- D03 — Distribution: **A recommended:** localhost/private review until listening acceptance. B: a public hosted prototype with explicit experimental labels. No hosting target has been configured by this slice.

## Remaining engineering work

- On Duncan, refresh the existing checkout so it picks up `.gitattributes`, then rerun all checks. On a clean tree: `git pull`, `git rm --cached -r -q .`, `git reset --hard`, `npm run format:check`. The reset discards uncommitted changes. Do not reformat the files with Prettier; the stored files already pass.
- Headphone/monitor listening acceptance and native Safari/device checks.
- Calibration against matching tables/audio; better local pitch tracking and low-confidence handling based on those results.
- Profile large inputs, audio dropouts and mobile resource use; improve per-stage progress if warranted.
- Decide project persistence and expanded WAV formats separately; the prototype is session-only.

The cross-project board is not synchronized: its configured file was unavailable and this project has no registered board ID. Do not create a replacement or mark unrelated requirements validated.

## Windows test handoff — 2026-10-14

The next executable step remains the [Serum test handoff](SERUM_TEST_HANDOFF.md), using the checked-in original synthetic fixtures. On October 15, 2026, the permitted Windows controller could not capture the Ableton window on Duncan, so the native cases were continued by hand. Serum loads `Syrum_64x2048.wav` as a wavetable in Ableton Live 12.1.1, and frame 1 and frame order match the file (checked visually). Serum reports 256 frames for the 64-frame table; the likely cause is the linear-interpolation `clm ` flag, still to be confirmed with 8-frame probe tables. Ableton cannot save or export on Duncan (non-commercial session), so the scan render, holds, scrubs and pitch/scan cases remain Not run. Render them in FL Studio 2025, and use Serum's own preset save for the preset case. Do not send blind input. License state, the 256-frame reading, rendered audio and preset portability remain unverified; see [SYRUM_VERIFICATION.md](SYRUM_VERIFICATION.md). Dave retains mouse control; recording is cancelled. Connor ground truth and actual version-specific acceptance remain outstanding.
