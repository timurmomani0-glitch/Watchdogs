#!/usr/bin/env bash
# Wait for the ctOS dashboard server, then open it fullscreen in a kiosk browser.
# Chromium-family only (kiosk flags). Works under Wayland and X11.
set -euo pipefail
URL="${CTOS_URL:-http://localhost:7050}"

BROWSER=""
for b in chromium chromium-browser google-chrome-stable google-chrome brave brave-browser; do
  if command -v "$b" >/dev/null 2>&1; then BROWSER="$b"; break; fi
done
[ -n "$BROWSER" ] || { echo "launch-ctos: no chromium-family browser found (install chromium)"; exit 1; }

# Wait up to ~30s for the dashboard to answer.
for _ in $(seq 1 60); do
  if curl -sf "$URL/api/system" >/dev/null 2>&1; then break; fi
  sleep 0.5
done

OZONE=()
if [ -n "${WAYLAND_DISPLAY:-}" ]; then
  OZONE=(--ozone-platform=wayland --enable-features=UseOzonePlatform)
fi

exec "$BROWSER" \
  --kiosk --app="$URL" \
  --no-first-run --fast --fast-start \
  --disable-infobars --disable-translate --disable-features=TranslateUI \
  --disable-session-crashed-bubble --hide-crash-restore-bubble \
  --overscroll-history-navigation=0 \
  --check-for-update-interval=31536000 \
  --user-data-dir="${XDG_DATA_HOME:-$HOME/.local/share}/ctos-kiosk" \
  "${OZONE[@]}"
