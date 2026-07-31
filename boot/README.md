# ctOS · DedSec boot chain

Make it DedSec from **power-on**: the GRUB menu, then the login screen, then (with
the `rice/` desktop shell) the ctOS dashboard's own boot intro. One greyscale
DedSec look end to end — reaper + skull field, red only on the skull.

```
power on ─▶ GRUB (boot/grub) ─▶ login greeter (boot/greeter) ─▶ session ─▶ ctOS dashboard boot intro (rice/)
```

Everything here is **Linux desktop theming** and touches nothing in the ctOS scope
gate. The shared 1920×1080 art (`grub/dedsec/background.png`) is rendered from
`boot/art.html`; regenerate it any time by opening that file and screenshotting at
1080p (or re-run the render step in the repo).

---

## 1 · GRUB theme (`boot/grub/`)

A GRUB2 theme: the DedSec reaper background with the boot menu in the lower third,
greyscale colours, Unifont (GRUB's always-loaded default — no extra font setup).

```bash
sudo bash boot/grub/install.sh
```

The installer detects your GRUB dir (`/boot/grub` on Debian/Arch, `/boot/grub2` on
Fedora/openSUSE) and config tool (`update-grub` / `grub-mkconfig` / `grub2-mkconfig`),
backs up `/etc/default/grub`, sets `GRUB_THEME` + `GRUB_TERMINAL_OUTPUT=gfxterm` +
`GRUB_GFXMODE=1920x1080,auto`, and regenerates `grub.cfg`. Reboot to see it.

**Revert:** restore the printed `/etc/default/grub.bak-<stamp>` and rerun the config
tool.

**Prereqs:** a GRUB2 system with graphics (`gfxterm`). Package `grub2-common` /
`grub` (already present if you boot with GRUB). No fonts to install.

## 2 · Login greeter (`boot/greeter/`)

Two options — pick one (display managers are mutually exclusive):

### A — SDDM (graphical) — recommended for a desktop
The DedSec background with a greyscale login box (plain QtQuick for Qt5
compatibility; red stays on the background skull).

```bash
sudo bash boot/greeter/install.sh          # installs + sets it current
sddm-greeter --test-mode --theme /usr/share/sddm/themes/ctos-dedsec   # preview
```
**Prereqs:** `sddm`, `qt5-quickcontrols2` / `qml-module-qtquick2` (the QtQuick
runtime SDDM uses). **Revert:** `rm /etc/sddm.conf.d/10-ctos-dedsec.conf`.

### B — greetd + tuigreet (minimal / kiosk) — pairs with the cage kiosk
A TUI greeter with the DedSec greeting, greyscale theme, no image.

```bash
# edit the --cmd session first, then:
sudo cp boot/greeter/greetd/config.toml /etc/greetd/config.toml
sudo systemctl enable greetd
```
**Prereqs:** `greetd`, `tuigreet` (aka `greetd-tuigreet`).

---

## Per-distro package cheatsheet

| Distro | GRUB | SDDM path | greetd path |
| --- | --- | --- | --- |
| **Arch** | (built-in) | `sddm qt5-quickcontrols2` | `greetd greetd-tuigreet` |
| **Debian/Ubuntu** | (built-in) | `sddm qml-module-qtquick-controls2` | `greetd` + tuigreet (cargo/pkg) |
| **Fedora** | (built-in) | `sddm qt5-qtquickcontrols2` | `greetd tuigreet` |

## Full DedSec chain

Pair this with the desktop shell in [`../rice/`](../rice/) (Hyprland/i3/cage kiosk)
so that after login you land straight in the ctOS dashboard — whose **own** boot
intro (the reaper + "we are dedsec") then plays. GRUB → login → ctOS, all one look.

## Files

```
boot/
  art.html                     source for the shared 1920x1080 DedSec background
  grub/
    install.sh                 detects GRUB dir/tool, backs up config, installs + regenerates
    dedsec/theme.txt           GRUB2 theme (Unifont, greyscale, reaper background)
    dedsec/background.png       1920x1080 art
  greeter/
    install.sh                 installs the SDDM theme + sets it current
    sddm-dedsec/               Main.qml + metadata.desktop + theme.conf + background.png
    greetd/config.toml         minimal tuigreet alternative
```
