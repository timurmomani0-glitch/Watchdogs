#!/usr/bin/env bash
# Install the ctOS DedSec GRUB2 theme. Detects the GRUB dir + config tool across
# Debian/Ubuntu, Arch, and Fedora/openSUSE. Backs up /etc/default/grub. Needs sudo.
set -euo pipefail

RICE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$RICE_DIR/dedsec"
STAMP="$(date +%Y%m%d-%H%M%S)"
say() { printf '\033[97m%s\033[0m\n' "$*"; }

[ -f "$SRC/theme.txt" ] || { echo "theme.txt not found in $SRC"; exit 1; }
[ -f "$SRC/background.png" ] || { echo "background.png not found in $SRC"; exit 1; }

# GRUB directory (Debian/Arch: /boot/grub ; Fedora/openSUSE: /boot/grub2)
if   [ -d /boot/grub ];  then GRUBDIR=/boot/grub
elif [ -d /boot/grub2 ]; then GRUBDIR=/boot/grub2
else echo "no /boot/grub or /boot/grub2 — is GRUB installed?"; exit 1; fi

# config regeneration command
if   command -v update-grub    >/dev/null 2>&1; then MKCFG="update-grub"
elif command -v grub-mkconfig  >/dev/null 2>&1; then MKCFG="grub-mkconfig -o $GRUBDIR/grub.cfg"
elif command -v grub2-mkconfig >/dev/null 2>&1; then MKCFG="grub2-mkconfig -o $GRUBDIR/grub.cfg"
else echo "no grub{,2}-mkconfig / update-grub found"; exit 1; fi

say "GRUB dir: $GRUBDIR   ·   regenerate: $MKCFG"

# 1) install theme
sudo mkdir -p "$GRUBDIR/themes/dedsec"
sudo cp "$SRC/theme.txt" "$SRC/background.png" "$GRUBDIR/themes/dedsec/"
say "installed theme -> $GRUBDIR/themes/dedsec/"

# 2) configure /etc/default/grub (back it up, then set keys idempotently)
DG=/etc/default/grub
sudo cp "$DG" "$DG.bak-$STAMP"
set_key() { # set_key KEY VALUE
  local k="$1" v="$2"
  if sudo grep -qE "^#?\s*$k=" "$DG"; then
    sudo sed -i "s|^#\?\s*$k=.*|$k=$v|" "$DG"
  else
    echo "$k=$v" | sudo tee -a "$DG" >/dev/null
  fi
}
set_key GRUB_THEME "\"$GRUBDIR/themes/dedsec/theme.txt\""
set_key GRUB_TERMINAL_OUTPUT "\"gfxterm\""
set_key GRUB_GFXMODE "\"1920x1080,auto\""
# gfxterm needs graphics: if GRUB_TERMINAL forces console, neutralise it
sudo sed -i 's|^GRUB_TERMINAL=|#GRUB_TERMINAL=|' "$DG" || true
say "configured $DG (backup: $DG.bak-$STAMP)"

# 3) regenerate grub.cfg
sudo $MKCFG
say "done — reboot to see the DedSec GRUB menu. Revert: restore $DG.bak-$STAMP and rerun $MKCFG."
