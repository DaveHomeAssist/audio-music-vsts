# Syrum on macOS: double-click launcher

For trying the prototype without a terminal. It serves the production build locally; nothing is uploaded.

## One-time setup

1. Install Node 22.12 or newer (Node 24 recommended). The launcher also finds a Node unpacked at `~/.local/node`.
2. From the repository root, create the app:

   ```sh
   zsh tools/macos/make-desktop-app.sh
   ```

   This writes `~/Desktop/Syrum.app`. Pass another folder as the first argument, or `--force` to replace an existing app.

## Use

Double-click **Syrum**. The first launch runs `npm ci` if needed, builds the app if the source changed, starts `vite preview` on `http://127.0.0.1:4180/` in the background and opens it in the default browser. Later launches reuse the running server. Drop a single-note WAV on the Import page, then Analyze → Set up frames → Generate → Export → Download WAV.

Server output goes to `work/syrum-server.log` (gitignored). The server stops at logout, or with:

```sh
zsh tools/macos/syrum-stop.sh
```

## Notes

- `SYRUM_PORT` overrides the port for both scripts. 4180 is used so `npm run test:browser` keeps 4173.
- The app stores the absolute path of `syrum-launch.sh`. After moving the checkout, run `make-desktop-app.sh --force` again.
- The app is an unsigned AppleScript applet built locally with `osacompile`, so Gatekeeper does not quarantine it. A copy downloaded from elsewhere would be.
