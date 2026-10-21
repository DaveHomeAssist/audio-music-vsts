# Syrum standalone desktop app brief

Status: **built, pending PR review and listening acceptance (2026-10-21).** Built with the recommended choices S01–S04 A: Electron, macOS first, unsigned private build, native Save dialog. Evidence is in [SYRUM_VERIFICATION.md](SYRUM_VERIFICATION.md#desktop-app--october-1821-2026).

## Problem

Today `tools/macos/Syrum.app` is a shortcut. It starts a background `vite preview` server on 127.0.0.1:4180 and opens the default browser. That approach has several drawbacks:

- It needs Node and an `npm ci` on first run.
- It leaves a server running after the tab closes.
- It depends on the checkout's path.
- It runs in whatever browser happens to be the default.

The goal is a self-contained app with its own window: double-click, use, quit, with nothing left running.

## This slice

- Wrap the existing production build (`apps/serum-wave-gen-vxx/dist`) unchanged. There is no second UI and no DSP changes.
- Serve the build from an app-internal secure origin, not `file://` and not a localhost server. AudioWorklet, module workers and Blob URLs need a secure context.
- One window with a standard app menu (About, Quit, Edit, Window), an icon and a minimum size matching the tested layouts.
- Native Save dialogs for **Download WAV** and **Playback notes**. This is a small hook in `main.ts`: when running in the desktop shell, call the native dialog. Otherwise keep the current browser download. Exported bytes must be identical either way.
- Fully offline: no network requests, no telemetry, no auto-update. The theme preference still persists, as it does today.
- Package as `Syrum.app`, plus a `.dmg` for sharing with Connor.
- Quitting the app ends all audio and processing. No background process remains.

## Exclusions

These are not part of this slice:

- Auto-update.
- Code signing and notarization, unless choice S03 selects them.
- Windows or Linux builds, unless choice S02 selects them.
- Persistent projects.
- File associations and drag-onto-Dock-icon.
- Any change to the converter, export format or compatibility status. Serum compatibility remains **unverified**.

## Choices (multiple choice, not approvals)

- **S01 — Shell**
  - **A (recommended): Electron.** It runs on Chromium, the same engine as the existing Playwright browser tests, so the tested behaviour carries over. The cost is a large bundle, roughly 200 MB.
  - **B: Tauri 2.** The bundle is about 10 MB and uses the system WebView (WKWebView on Mac, WebView2 on Windows). It needs a Rust toolchain, and AudioWorklet playback in WKWebView is untested because native Safari checks are still open.
  - **C: Installable PWA.** It gets its own window in Chrome or Edge with the least work. However, it still needs a running local server or public hosting, which conflicts with D03 (private).
- **S02 — Platforms**
  - **A (recommended): macOS only first.** Dave and Connor are both on Macs.
  - **B: macOS and Windows.** This adds Duncan. It needs a Windows build and test pass.
- **S03 — Distribution and Gatekeeper**
  - **A (recommended): Unsigned private build.** On first launch, right-click the app and choose Open.
  - **B: Developer ID signing and notarization.** This needs an Apple Developer account (paid) and credentials handled outside the repo.
- **S04 — Export saving**
  - **A (recommended): Native Save dialog.** The user chooses where each file goes.
  - **B: Keep browser-style downloads** to the Downloads folder.

## Observable acceptance

1. The app launches with networking off, with no Node install, no server and no terminal.
2. All six stages work: the demo, a real WAV import, Analyze, Generate, A/B, Hold, Scan and Export.
3. Hold sustains, and scan and scrub play through the AudioWorklet without dropouts on the Mac.
4. WAV and notes exported through the Save dialog are byte-identical to the browser export for the same input and settings.
5. After Quit, no Syrum or helper process remains. The app reopens cleanly.
6. Existing checks still pass (`npm test`, `npm run build`, `npm run test:browser`). One added desktop smoke test opens the window, runs the demo and exports.
7. The README reports the app's size and the first-launch Gatekeeper steps.

## Effort, placement and risks

- **Effort:** about one working session for S01 A + S02 A + S03 A + S04 A. Tauri adds toolchain setup and a WKWebView audio check. Windows adds a second build and test pass.
- **Placement:** packaging a Mac app has to run on a Mac. Installing dependencies and running tests can go to a runner where practical.
- **Risks:**
  - Bundle size (Electron).
  - The unsigned-app warning.
  - The desktop and web builds drifting apart. This is mitigated by wrapping the same `dist` and keeping the browser path as the default.
  - Electron security defaults must stay strict: context isolation on, no Node in the renderer, and a narrow preload that exposes only the save function.
