#!/usr/bin/env bash
# Install the ctOS DedSec GRUB2 theme. Needs sudo.
#
# Path handling matters here: the GRUB directory and the config tool must agree,
# and on some UEFI layouts the config GRUB actually reads lives under
# /boot/efi/EFI/<distro>/. Getting this wrong installs a theme that silently
# never appears. So: derive the directory FROM the tool, then regenerate every
# real grub.cfg we can find.
set -euo pipefail

RICE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$RICE_DIR/dedsec"
STAMP="$(date +%Y%m%d-%H%M%S)"
say()  { printf '\033[97m%s\033[0m\n' "$*"; }
warn() { printf '\033[93m%s\033[0m\n' "$*"; }

[ -f "$SRC/theme.txt" ]       || { echo "theme.txt not found in $SRC"; exit 1; }
[ -f "$SRC/background.png" ]  || { echo "background.png not found in $SRC"; exit 1; }

# ── 1. Tool first, directory derived from it ────────────────────────────────
if   command -v update-grub    >/dev/null 2>&1; then MKCFG_BIN="update-grub";    GRUBDIR=/boot/grub
elif command -v grub2-mkconfig >/dev/null 2>&1; then MKCFG_BIN="grub2-mkconfig"; GRUBDIR=/boot/grub2
elif command -v grub-mkconfig  >/dev/null 2>&1; then MKCFG_BIN="grub-mkconfig";  GRUBDIR=/boot/grub
else echo "no update-grub / grub-mkconfig / grub2-mkconfig found — is GRUB installed?"; exit 1; fi

# Sanity: if the derived dir doesn't exist but the other one does, follow reality.
if [ ! -d "$GRUBDIR" ]; then
  if   [ -d /boot/grub2 ]; then GRUBDIR=/boot/grub2
  elif [ -d /boot/grub ];  then GRUBDIR=/boot/grub
  else echo "neither /boot/grub nor /boot/grub2 exists"; exit 1; fi
fi
say "GRUB dir: $GRUBDIR   ·   tool: $MKCFG_BIN"

# ── 2. Collect every grub.cfg that is a REAL config ─────────────────────────
# Some UEFI installs (older Fedora/RHEL) boot /boot/efi/EFI/<distro>/grub.cfg.
# A one-line stub that just sources the main config must NOT be regenerated.
CFGS=("$GRUBDIR/grub.cfg")
shopt -s nullglob
for efi in /boot/efi/EFI/*/grub.cfg; do
  # >10 lines ⇒ a full config, not a stub pointing elsewhere
  if [ -f "$efi" ] && [ "$(wc -l < "$efi")" -gt 10 ]; then
    CFGS+=("$efi")
    say "also found active UEFI config: $efi"
  fi
done
shopt -u nullglob

# ── 3. Install the theme ────────────────────────────────────────────────────
sudo mkdir -p "$GRUBDIR/themes/dedsec"
sudo cp "$SRC/theme.txt" "$SRC/background.png" "$GRUBDIR/themes/dedsec/"
say "installed theme -> $GRUBDIR/themes/dedsec/"

# ── 4. Configure /etc/default/grub (backed up, idempotent) ──────────────────
DG=/etc/default/grub
sudo cp "$DG" "$DG.bak-$STAMP"
set_key() { # set_key KEY VALUE
  local k="$1" v="$2"
  if sudo grep -qE "^#?[[:space:]]*$k=" "$DG"; then
    sudo sed -i "s|^#\?[[:space:]]*$k=.*|$k=$v|" "$DG"
  else
    echo "$k=$v" | sudo tee -a "$DG" >/dev/null
  fi
}
set_key GRUB_THEME "\"$GRUBDIR/themes/dedsec/theme.txt\""
set_key GRUB_GFXMODE "\"1920x1080,auto\""

# gfxterm needs a graphics terminal — but never strip a serial console, or a
# headless box loses its interactive boot menu entirely.
CURRENT_TERM="$(sudo grep -E '^GRUB_TERMINAL=' "$DG" || true)"
if echo "$CURRENT_TERM" | grep -q 'serial'; then
  warn "GRUB_TERMINAL contains 'serial' — leaving it untouched (serial console preserved)."
  warn "The theme will not render on serial output; that is expected."
else
  sudo sed -i 's|^GRUB_TERMINAL=|#GRUB_TERMINAL=|' "$DG" || true
  set_key GRUB_TERMINAL_OUTPUT "\"gfxterm\""
fi
say "configured $DG (backup: $DG.bak-$STAMP)"

# ── 5. Regenerate every real config ─────────────────────────────────────────
for cfg in "${CFGS[@]}"; do
  if [ "$MKCFG_BIN" = "update-grub" ] && [ "$cfg" = "$GRUBDIR/grub.cfg" ]; then
    sudo update-grub
  else
    sudo "$MKCFG_BIN" -o "$cfg"
  fi
  say "regenerated $cfg"
done

say "done — reboot to see the DedSec GRUB menu."
say "revert: sudo cp $DG.bak-$STAMP $DG && sudo $MKCFG_BIN -o ${CFGS[0]}"
