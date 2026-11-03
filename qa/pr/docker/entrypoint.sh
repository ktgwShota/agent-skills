#!/usr/bin/env bash
set -euo pipefail

cmd="${1:-}"
shift || true

case "$cmd" in
  login)
    Xvfb :99 -screen 0 1280x900x24 > /dev/null 2>&1 &
    sleep 1
    DISPLAY=:99 fluxbox > /dev/null 2>&1 &
    x11vnc -display :99 -forever -nopw -quiet > /dev/null 2>&1 &
    websockify --web /usr/share/novnc 6080 localhost:5900 > /dev/null 2>&1 &
    DISPLAY=:99 node /app/scripts/login.js
    ;;
  record)
    node /app/scripts/record.js "$@"
    ;;
  upload)
    node /app/scripts/upload.js "$@"
    ;;
  shot)
    node /app/scripts/shot.js "$@"
    ;;
  *)
    echo "usage: login | record <scenario.json> <out_dir> | upload <owner/repo> <pr> <file>... | shot <spec.json> <out_dir>" >&2
    exit 1
    ;;
esac
