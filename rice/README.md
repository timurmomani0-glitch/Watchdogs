# ctOS rice — the dashboard *as your desktop*

This turns the ctOS dashboard into a Linux desktop shell: the machine boots into
the HUD, locks to a ctOS screen, and themes the terminal and boot splash to
match. Three ways to run it, from "daily-driver desktop" to "wall-mounted kiosk."

Everything here is **jurisdiction-agnostic ricing** — it does not touch the scope
gate. The dashboard it displays is the same gated, mock-by-default Stage-A app.

> Heads-up: these are configs for *your* machine — a graphical session can't be
> booted inside the build sandbox, so they're written to spec, not screenshotted
> from a live WM. Install commands and the exact packages are below; the shell
> scripts pass `bash -n` and the installer backs up anything it replaces.

---

## Pick your path

| Path | You get | Best for |
| --- | --- | --- |
| **A — Hyprland desktop** (Wayland) | Full riced desktop: cyan-glow borders, blur, animations, `hyprlock` lock screen, idle-lock, themed `foot` terminal, and the dashboard as a fullscreen kiosk window | A daily-driver machine that *looks* like ctOS |
| **B — cage kiosk** (Wayland) | Boots straight into the dashboard fullscreen, nothing else, via `greetd` + `cage` | A dedicated / wall-mounted ctOS screen, or the Pi home base |
| **C — i3 desktop** (X11) | Same idea as A on X11: themed borders, `i3lock`, dashboard kiosk window | Older hardware or GPUs without a good Wayland session |

All three share: the **kiosk launcher** (`kiosk/launch-ctos.sh`) and the
**dashboard service** (`systemd/ctos.service`, installed per-user).

---

## Install

From the repo root, with the dashboard already working (`npm install` done):

```bash
bash rice/install.sh                 # configs + user service (no sudo)
bash rice/install.sh --with-plymouth # also install the boot splash (asks for sudo)
```

The installer:
- copies `launch-ctos.sh` → `~/.config/ctos/`
- writes `~/.config/hypr/{hyprland,hyprlock,hypridle}.conf`, `~/.config/i3/config`, `~/.config/foot/foot.ini` (backing up any existing file)
- installs and enables `ctos.service` as a **user** service (starts the dashboard on login)
- with `--with-plymouth`: installs the ctOS boot splash to `/usr/share/plymouth/themes/ctos` and sets it default

### Packages

| Distro | Path A (Hyprland) | Path B (kiosk) | Path C (i3) | Splash |
| --- | --- | --- | --- | --- |
| **Arch** | `hyprland hyprlock hypridle foot chromium` | `greetd cage chromium` | `i3-wm i3lock chromium` | `plymouth` |
| **Debian/Ubuntu** | `hyprland foot chromium` (hyprlock/hypridle may need their repos) | `greetd cage chromium` | `i3 i3lock chromium` | `plymouth plymouth-themes` |
| **Fedora** | `hyprland hyprlock hypridle foot chromium` | `greetd cage chromium` | `i3 i3lock chromium` | `plymouth plymouth-scripts` |

`node`/`npm` are required for the dashboard itself (Node ≥ 20).

---

## Path A — Hyprland desktop

1. Install the Hyprland packages, then `bash rice/install.sh`.
2. Log into a **Hyprland** session (from your display manager, or `Hyprland` from a TTY).
3. It autostarts `ctos.service` and opens the dashboard fullscreen.

Keys: `SUPER+Return` terminal · `SUPER+L` lock · `SUPER+F` fullscreen toggle ·
`SUPER+R` relaunch dashboard · `SUPER+Q` close window · `SUPER+Shift+E` exit.
Idle → lock at 5 min, screen off at 10 min (`hypridle.conf`).

## Path B — cage kiosk (dedicated screen)

1. Install `greetd`, `cage`, `chromium`; run `bash rice/install.sh`.
2. Make the dashboard survive logout:
   ```bash
   systemctl --user enable ctos.service
   loginctl enable-linger "$USER"
   ```
3. Edit `rice/cage/greetd-config.toml` (replace `USER`), then:
   ```bash
   sudo cp rice/cage/greetd-config.toml /etc/greetd/config.toml
   sudo systemctl enable greetd
   sudo reboot
   ```
   The box boots straight into the dashboard, fullscreen, no desktop.

## Path C — i3 desktop (X11)

1. Install `i3`, `i3lock`, `chromium`; run `bash rice/install.sh`.
2. Log into an **i3** session. Same autostart + kiosk window; `SUPER+L` locks.

---

## Boot splash

`bash rice/install.sh --with-plymouth` installs a self-contained Plymouth
`script` theme (`rice/plymouth/ctos/`) that draws the `ctOS` wordmark and a
progress bar in the dashboard palette — no image assets. Preview without
rebooting:

```bash
sudo plymouthd ; sudo plymouth --show-splash ; sleep 4 ; sudo plymouth --quit
```

Some distros need an initramfs rebuild after changing the theme
(`sudo mkinitcpio -P` on Arch, `sudo update-initramfs -u` on Debian,
`sudo dracut -f` on Fedora).

---

## Uninstall

```bash
systemctl --user disable --now ctos.service
rm -rf ~/.config/ctos ~/.config/hypr/hyprland.conf ~/.config/hypr/hyprlock.conf \
       ~/.config/hypr/hypridle.conf ~/.config/i3/config ~/.config/foot/foot.ini \
       ~/.config/systemd/user/ctos.service
# restore any *.bak-<stamp> the installer made, and (if used) reset Plymouth:
sudo plymouth-set-default-theme -R bgrt   # or your previous theme
```

## Files

```
rice/
  install.sh                 idempotent installer (backs up what it replaces)
  kiosk/launch-ctos.sh       wait-for-server → chromium --kiosk on the dashboard
  systemd/ctos.service       per-user service that runs `npm start`
  hypr/hyprland.conf         Wayland desktop: theme, autostart, keybinds
  hypr/hyprlock.conf         ctOS lock screen
  hypr/hypridle.conf         idle → lock / screen-off
  i3/config                  X11 desktop equivalent
  cage/greetd-config.toml    dedicated fullscreen kiosk on boot
  foot/foot.ini              terminal colour scheme
  plymouth/ctos/             boot splash (script theme, no binary assets)
```
