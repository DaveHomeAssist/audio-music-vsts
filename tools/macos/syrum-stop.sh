#!/bin/zsh
# Stop the background Syrum server started by syrum-launch.sh.
PORT="${SYRUM_PORT:-4180}"
if pkill -f "vite preview apps/serum-wave-gen-vxx --host 127.0.0.1 --port $PORT"; then
  echo "Syrum stopped."
else
  echo "Syrum was not running."
fi
