# ctOS through Windows Terminal

Run the whole ctOS surface from **Windows Terminal** — a terminal-native HUD
(device grid, live scope gate, spectrum waterfall, audit log, finance) with the
terminal itself themed to ctOS. No browser required; the graphical dashboard is
still one command away.

The backend (Node server + scope gate + adapters) is cross-platform and runs on
Windows unchanged. `INTEGRATION_MODE=mock` (the default) needs no hardware; live
network discovery uses `arp -a` on Windows.

---

## Prerequisites

```powershell
winget install OpenJS.NodeJS.LTS        # Node >= 20  (npm comes with it)
winget install Microsoft.WindowsTerminal
# optional, for the box-drawing glyphs to line up perfectly:
winget install Microsoft.CascadiaCode
```

Clone the repo (this example assumes `%USERPROFILE%\Watchdogs`; adjust paths if
you put it elsewhere):

```powershell
git clone https://github.com/timurmomani0-glitch/Watchdogs.git $env:USERPROFILE\Watchdogs
cd $env:USERPROFILE\Watchdogs
npm install
```

---

## 1. Add the ctOS color scheme + profile

Windows Terminal auto-loads **fragments**. Drop the fragment into place:

```powershell
$dst = "$env:LOCALAPPDATA\Microsoft\Windows Terminal\Fragments\ctOS"
New-Item -ItemType Directory -Force -Path $dst | Out-Null
Copy-Item .\windows\settings.fragment.json "$dst\ctos.json"
```

Reopen Windows Terminal — a **ctOS** profile (with the ctOS color scheme, acrylic
blur, filled-box cursor) appears in the dropdown.

> If you cloned somewhere other than `%USERPROFILE%\Watchdogs`, edit the
> `commandline` and `startingDirectory` paths in `settings.fragment.json` (or in
> the copied `ctos.json`) before reopening.

Prefer to paste manually instead of using a fragment? Copy the `schemes[0]` object
into `"schemes"` and the `profiles[0]` object into `"profiles"."list"` in your
Windows Terminal `settings.json`.

## 2. Launch it

Open the **ctOS** profile. `windows\ctos.ps1` runs automatically: it starts the
dashboard server hidden (mock mode, port 7050) if it isn't already up, then opens
the terminal HUD.

Keys: **`1`–`5`** run a scope-gate command · **`r`** refresh · **`q`** quit.

- `[1]` scan owned LAN → **ALLOWED**
- `[2]` toggle owned lamp → **ALLOWED**
- `[3]` TX in-band → **DENIED** (transmit is off by default in the US profile)
- `[4]` scan neighbour ✗ / `[5]` emulate stranger ✗ → **DENIED**, logged to the
  hash-chained audit panel.

Graphical HUD as well? `start http://localhost:7050` in the same window.

## 3. (Optional) ctOS PowerShell prompt

```powershell
Copy-Item .\windows\Microsoft.PowerShell_profile.ps1 $PROFILE -Force   # backs nothing up; check $PROFILE first
. $PROFILE
```

A cyan `▚ ctOS <path> on <branch>` prompt, no external tools.

---

## Run without the profile

From any Windows Terminal tab in the repo:

```powershell
npm start                     # dashboard server (Ctrl+C to stop)
# in a second tab / pane:
npm run tui                   # the terminal HUD
```

`npm run tui` works on any OS, not just Windows — it's the same client.

## WSL note

If you run the repo inside **WSL** instead of native Windows, use the Linux
instructions (`npm start` / `npm run tui`) from your WSL distro's Windows Terminal
profile. Live network discovery there uses `arp-scan` (Linux) rather than `arp -a`.

## Uninstall

```powershell
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\Microsoft\Windows Terminal\Fragments\ctOS"
# and revert $PROFILE if you changed it.
```
