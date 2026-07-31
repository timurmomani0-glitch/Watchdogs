# ctOS terminal HUD (TUI)

The whole dashboard **inside your terminal** — no browser. Same server, same
scope gate, same audit chain. Truecolor ANSI; built for Windows Terminal but runs
in any modern terminal (kitty, foot, WezTerm, iTerm2, GNOME Terminal…).

```bash
npm start        # start the dashboard server (mock mode)
npm run tui      # in another tab/pane: the terminal HUD
```

Or on Windows, just open the **ctOS** Windows Terminal profile — see
[`../windows/README.md`](../windows/README.md), which starts the server for you.

## Panels

- **Device Grid** — owned hosts with online/offline dots
- **Scope Gate** — press `1`–`5` to fire a command through `authorize()`; the
  result (`ALLOW` / `AMBER` / `DENIED`) prints inline
- **Spectrum Waterfall** — RX-only, streamed live over WebSocket
- **Audit Log** — the append-only, hash-chained trail; every command lands here
- **Finance / Notifications** — own-account balances + events

## Keys

| Key | Action |
| --- | --- |
| `1` | scan owned LAN → ALLOWED |
| `2` | toggle owned lamp → ALLOWED |
| `3` | TX in-band → DENIED (transmit off by default) |
| `4` | scan neighbour → DENIED (out of scope) |
| `5` | emulate stranger card → DENIED (not your card) |
| `r` | refresh REST data |
| `q` / `Ctrl-C` | quit |

## Notes

- Needs a terminal ≥ 80×24 (it tells you if it's too small).
- Truecolor (24-bit) required for the waterfall gradient — Windows Terminal,
  kitty, foot, WezTerm, iTerm2 all support it.
- `node tui/ctos-tui.mjs --once` renders a single frame and exits (used for
  smoke tests / screenshots).
- `PORT` env var is honored if your server runs on a non-default port.
