#!/bin/zsh
# Start Syrum in the background (once) and open it in the default browser.
# Serves the production build on 127.0.0.1:4180 with `vite preview`; rebuilds first
# if the build is missing or older than the app source. Port 4173 stays free for
# `npm run test:browser`.
REPO="${0:A:h:h:h}"
PORT="${SYRUM_PORT:-4180}"
URL="http://127.0.0.1:$PORT/"
LOG="$REPO/work/syrum-server.log"
APP="$REPO/apps/serum-wave-gen-vxx"

# Finder-launched apps get a minimal PATH. Use Node from PATH, else ~/.local/node.
command -v node >/dev/null 2>&1 || export PATH="$HOME/.local/node/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  /usr/bin/osascript -e 'display alert "Syrum needs Node.js 22.12 or newer." message "Install Node 24 from nodejs.org, then open Syrum again."'
  exit 1
fi

cd "$REPO" || exit 1
mkdir -p "$REPO/work"
if ! /usr/bin/curl -s -o /dev/null "$URL"; then
  [ -d node_modules ] || npm ci >"$LOG" 2>&1 || exit 1
  if [ ! -f "$APP/dist/index.html" ] ||
    [ -n "$(find "$APP/src" "$APP/index.html" -newer "$APP/dist/index.html" 2>/dev/null)" ]; then
    npm run build >>"$LOG" 2>&1 || exit 1
  fi
  nohup npm run preview -- --port "$PORT" --strictPort >>"$LOG" 2>&1 </dev/null &
  for i in {1..50}; do
    /usr/bin/curl -s -o /dev/null "$URL" && break
    sleep 0.2
  done
fi
/usr/bin/open "$URL"
