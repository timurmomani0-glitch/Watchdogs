#!/usr/bin/env bash
# ctOS rice installer. Copies the Hyprland/i3 + terminal configs, installs a
# per-user systemd service for the dashboard, and (with --with-plymouth) the
# boot splash. Non-destructive: existing files are backed up to *.bak-<stamp>.
# Re-runnable.
set -euo pipefail

RICE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$RICE_DIR/.." && pwd)"
CFG="${XDG_CONFIG_HOME:-$HOME/.config}"
STAMP="$(date +%Y%m%d-%H%M%S)"
WITH_PLYMOUTH=0
[ "${1:-}" = "--with-plymouth" ] && WITH_PLYMOUTH=1

say()    { printf '\033[36m%s\033[0m\n' "$*"; }
backup() { [ -e "$1" ] && cp -a "$1" "$1.bak-$STAMP" && echo "  backed up $1 -> $1.bak-$STAMP" || true; }

say "ctOS rice → dashboard repo at $REPO_DIR"

# 1) kiosk launcher
mkdir -p "$CFG/ctos"
install -m 0755 "$RICE_DIR/kiosk/launch-ctos.sh" "$CFG/ctos/launch-ctos.sh"
say "installed launcher  → $CFG/ctos/launch-ctos.sh"

# 2) Hyprland configs (with __REPO__ substituted, harmless if absent)
mkdir -p "$CFG/hypr"
for f in hyprland.conf hyprlock.conf hypridle.conf; do
    backup "$CFG/hypr/$f"
    sed "s#__REPO__#$REPO_DIR#g" "$RICE_DIR/hypr/$f" > "$CFG/hypr/$f"
done
say "installed Hyprland  → $CFG/hypr/{hyprland,hyprlock,hypridle}.conf"

# 3) i3 config (X11 fallback)
mkdir -p "$CFG/i3"
backup "$CFG/i3/config"
cp "$RICE_DIR/i3/config" "$CFG/i3/config"
say "installed i3        → $CFG/i3/config (X11 fallback)"

# 4) foot terminal theme
mkdir -p "$CFG/foot"
backup "$CFG/foot/foot.ini"
cp "$RICE_DIR/foot/foot.ini" "$CFG/foot/foot.ini"
say "installed foot      → $CFG/foot/foot.ini"

# 5) per-user systemd service for the dashboard server
NPM="$(command -v npm || echo /usr/bin/npm)"
mkdir -p "$CFG/systemd/user"
sed -e "s#__REPO__#$REPO_DIR#g" -e "s#__NPM__#$NPM#g" \
    "$RICE_DIR/systemd/ctos.service" > "$CFG/systemd/user/ctos.service"
if command -v systemctl >/dev/null 2>&1; then
    systemctl --user daemon-reload 2>/dev/null || true
    systemctl --user enable ctos.service 2>/dev/null || true
    say "installed service   → ctos.service (enabled; starts the dashboard on login)"
    say "  start now:              systemctl --user start ctos.service"
    say "  survive logout (kiosk): loginctl enable-linger $USER"
else
    say "systemctl not found — service file written but not enabled"
fi

# 6) optional boot splash (needs sudo + plymouth)
if [ "$WITH_PLYMOUTH" = "1" ]; then
    if command -v plymouth-set-default-theme >/dev/null 2>&1; then
        say "installing Plymouth boot splash (sudo)…"
        sudo mkdir -p /usr/share/plymouth/themes/ctos
        sudo cp "$RICE_DIR/plymouth/ctos/ctos.plymouth" \
                "$RICE_DIR/plymouth/ctos/ctos.script" \
                /usr/share/plymouth/themes/ctos/
        sudo plymouth-set-default-theme -R ctos
        say "Plymouth theme 'ctos' set as default (some distros need an initramfs rebuild)"
    else
        say "plymouth-set-default-theme not found — skipping boot splash"
    fi
fi

say ""
say "done. Next:"
say "  • Full desktop:  install Hyprland + hyprlock + hypridle + foot + chromium,"
say "                   then log into a Hyprland session — it boots into ctOS."
say "  • Dedicated kiosk: see rice/cage/greetd-config.toml"
say "  • X11 hardware:  log into an i3 session instead (config already installed)."
