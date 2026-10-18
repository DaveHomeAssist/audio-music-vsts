#!/bin/zsh
# Create a double-clickable Syrum.app that runs syrum-launch.sh from this checkout.
# Usage: zsh tools/macos/make-desktop-app.sh [destination folder, default ~/Desktop] [--force]
DEST="$HOME/Desktop"
FORCE=0
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    *) DEST="$arg" ;;
  esac
done
LAUNCH="${0:A:h}/syrum-launch.sh"
TARGET="$DEST/Syrum.app"
if [ -e "$TARGET" ] && [ "$FORCE" -ne 1 ]; then
  echo "$TARGET already exists. Re-run with --force to replace it."
  exit 1
fi
rm -rf "$TARGET"
/usr/bin/osacompile -o "$TARGET" \
  -e "do shell script \"/bin/zsh \" & quoted form of \"$LAUNCH\" & \" >/dev/null 2>&1\"" || exit 1
echo "Created $TARGET. It runs $LAUNCH. Moving this checkout breaks it; re-run this script after a move."
