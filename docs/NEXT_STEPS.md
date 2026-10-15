# Syrum next steps

This is the prototype's implementation follow-through, linked to the existing research requirements. It does not replace Connor's requirements or turn their Draft / Needs ground truth statuses into validation.

## Current slice

Local TypeScript/Web Audio converter under `apps/serum-wave-gen-vxx`. Product name Syrum; Serum is the compatibility target. Direct-cycle baseline, six working stages, original synthetic demo, WAV export plus playback notes. Build, seven numerical/file checks and nine browser tests passed on the isolated runner. Execution evidence lives in [SYRUM_VERIFICATION.md](SYRUM_VERIFICATION.md).

## Next evidence gate

Connor: provide a matching original table and lossless render with MIDI note, scan curve/time, envelope, effects, phase, sample rate, exact Serum version and OS. The existing experimental generated tables and AAC-derived reference are not this ground truth.

Dave: run that pair through the prototype, document reconstruction and reference differences, then verify import/frame count, original-duration render, 30-second hold, both scrub directions, pitch versus scan independence, and preset save/reopen in Serum. Preserve compatibility as **unverified** until actual version-specific evidence exists.

## Open choices (not approvals)

- D01 — Qualification target: **A recommended:** one exact Serum 2 version first. B: Serum 1 and 2 together, increasing test scope. Owner: Dave + Connor.
- D02 — Next algorithm experiment: **A recommended:** local pitch tracking against the known pair. B: harmonic modeling comparison. C: residual-layer output. Choose after listening to the baseline; no automatic residual classification.
- D03 — Distribution: **A recommended:** localhost/private review until listening acceptance. B: a public hosted prototype with explicit experimental labels. No hosting target has been configured by this slice.

## Remaining engineering work

- Headphone/monitor listening acceptance and native Safari/device checks.
- Calibration against matching tables/audio; better local pitch tracking and low-confidence handling based on those results.
- Profile large inputs, audio dropouts and mobile resource use; improve per-stage progress if warranted.
- Decide project persistence and expanded WAV formats separately; the prototype is session-only.

The cross-project board is not synchronized: its configured file was unavailable and this project has no registered board ID. Do not create a replacement or mark unrelated requirements validated.
