#!/usr/bin/env bash
# Install the ctOS DedSec SDDM login theme and set it current. Needs sudo.
# (For the minimal greetd/tuigreet path instead, see greetd/config.toml.)
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$DIR/sddm-dedsec"
say() { printf '\033[97m%s\033[0m\n' "$*"; }

[ -f "$SRC/Main.qml" ] || { echo "sddm-dedsec/Main.qml missing"; exit 1; }
[ -f "$SRC/background.png" ] || { echo "sddm-dedsec/background.png missing"; exit 1; }
command -v sddm >/dev/null 2>&1 || say "note: sddm not detected on PATH — installing the theme anyway"

DST=/usr/share/sddm/themes/ctos-dedsec
sudo mkdir -p "$DST"
sudo cp "$SRC/Main.qml" "$SRC/metadata.desktop" "$SRC/theme.conf" "$SRC/background.png" "$DST/"
say "installed SDDM theme -> $DST"

sudo mkdir -p /etc/sddm.conf.d
printf '[Theme]\nCurrent=ctos-dedsec\n' | sudo tee /etc/sddm.conf.d/10-ctos-dedsec.conf >/dev/null
say "set ctos-dedsec as the current SDDM theme (/etc/sddm.conf.d/10-ctos-dedsec.conf)"

say "preview without logging out:"
say "  sddm-greeter --test-mode --theme $DST     # (or: sddm-greeter-qt6 …)"
say "revert: rm /etc/sddm.conf.d/10-ctos-dedsec.conf"
