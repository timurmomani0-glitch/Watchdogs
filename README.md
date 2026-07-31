# ctOS · personal

A **Watch Dogs 2 "ctOS"-style command dashboard for your own domain** — your devices, your
network, your radio spectrum, your accounts. The in-game fantasy of "hack the city" is reframed,
without exception, as **"command what you own."** The legal boundary is not a disclaimer at the
bottom of a README — it is a scope gate every command passes through *in code*, and it denies
anything not in your owned-asset registry.

> **Stage A build.** Ships with mock data and the example registry so it runs on any laptop in 60
> seconds. Every panel is wired to a **real integration seam** — swap `INTEGRATION_MODE=mock` for
> `live`, fill your registry, and the same buttons drive real hardware. Recommended hardware path:
> **Tier 2 (~$300–500)**, jurisdiction **US/FCC**. See [`DELIVERABLE.md`](DELIVERABLE.md).

---

## What it is (and what it refuses to be)

| It does | It never does |
| --- | --- |
| Scan / map / control / view devices & networks **you own** | Touch any device, network, or account not in your registry |
| Read **your own** accounts via official aggregation APIs (Plaid/Teller) | "Steal money" / drain anyone's account |
| Read & emulate **your own** RFID/NFC cards | Clone or attack a third party's card |
| **Receive** any spectrum; **transmit** only in license-free bands | Jam, blackout, or disrupt any shared/public system |
| Intrusion **detection** on your own LAN (defensive ctOS) | Crack third-party wifi / phones / cameras / cars / locks |

Anything with no legal form (steal-money, drain-bank, mass-hack strangers, traffic-light control,
police-dispatch manipulation, signal jammer) is **struck** in the capability map — it is not in the
code and cannot be enabled. See [`DELIVERABLE.md` §2](DELIVERABLE.md).

---

## Quick start (60 seconds, no hardware)

```bash
npm install
npm run check      # 26-check proof: in-scope ALLOW, conservative AMBER-off DENY, out-of-scope DENY, ERP cap, audit chain
npm start          # http://localhost:7050  → the ctOS dashboard on mock data
```

Open <http://localhost:7050>. You get the full HUD: force-directed **Network Map**, **Device Grid**,
**Profiler**, **Control Panel** (scenes + toggles), scrolling **Spectrum Waterfall** (RX-only),
**Finance/Notifications**, **Live Feed**, a live **Scope Gate** demo, and the **Audit Log**.

In the **Scope Gate** panel, press *"scan neighbour ✗"* or *"emulate stranger card ✗"* — they come
back **DENIED** in red with a reason, and the denial is written to the hash-chained audit log. That
is the whole thesis, running.

### Prefer the terminal?

```bash
npm start        # dashboard server
npm run tui      # the whole HUD inside your terminal — no browser
```

`npm run tui` is a full-screen ANSI HUD (device grid, live scope gate, spectrum waterfall, audit log,
finance). On **Windows**, open the themed **ctOS** Windows Terminal profile and it starts the server
for you — see [`windows/README.md`](windows/README.md). Terminal HUD details:
[`tui/README.md`](tui/README.md). Turn the browser app into a full Linux desktop shell:
[`rice/README.md`](rice/README.md).

---

## Going live (Stage A → B)

**One command — no hardware needed:**

```bash
npm run setup      # detects your networks, confirms ownership, writes the registry
```

Then start it against your real LAN:

```bash
INTEGRATION_MODE=live npm start                    # macOS / Linux
$env:INTEGRATION_MODE="live"; npm start            # Windows PowerShell
```

The Device Grid and Network Map now show your real devices (via `arp -a` on Windows, `arp-scan`
elsewhere). Everything outside your registered CIDR stays denied and logged.

Check what's in scope at any time:

```bash
npm run scope      # what YOUR registry allows/denies right now
npm run check      # gate-logic proof against fixed fixtures (always 26/26)
```

> `setup` never assumes ownership — adding a network requires typing `I OWN THIS`, and it warns on
> ranges that are typically shared infrastructure (carrier NAT, oversized campus/hotel subnets).

### Manual alternative

1. `cp config/owned-assets.example.yaml config/owned-assets.yaml` and list **only** assets you own:
   your LAN CIDR, your device MACs / Home Assistant entity IDs, your RFID UIDs, your permitted TX
   bands, your account IDs. This file is gitignored — your asset list never leaves the box.
2. `cp config/jurisdiction.example.yaml config/jurisdiction.yaml` — pre-filled for **US/FCC** and
   **RX-only by default** (RF transmit, RFID/NFC emulation, and camera/mic all ship **off**). Turn a
   capability on deliberately, only after verifying it against current law for your state.
3. Set `INTEGRATION_MODE=live` and the relevant env (`HA_URL`/`HA_TOKEN`, `PLAID_*`, `FLIPPER_PORT`,
   `AUDIT_KEY`). Each adapter's real transport is documented at its swap point in
   `server/adapters/*.js`.

The registry is the single source of truth for scope. Add an asset → it becomes controllable. Remove
it → the gate denies it on the next command. There is no convenience override.

---

## How the scope gate works

```
UI button ─▶ WebSocket command {verb, class, target, params}
                     │
                     ▼
        server/scope-gate.js  authorize(cmd, registry, jurisdiction)
             ├─ target ∈ owned registry?        (deny by default)
             └─ AMBER class? jurisdiction permits? (US: RX-only / own-card / consent)
                     │
        allow ───────┴─────── deny
          │                     │
   record() to audit      record() to audit  ── UI shows DENIED, adapter never runs
          │
   dispatch to adapter (mock | live)
```

- **Registry** (`config/owned-assets.yaml`) — owned CIDRs, device IDs, RFID UIDs, TX bands, accounts.
- **Jurisdiction profile** (`config/jurisdiction.yaml`) — country field that toggles the AMBER
  features (RF transmit, RFID emulation, camera/mic) on or off.
- **Audit** (`data/audit.log`) — append-only, SHA-256 **hash-chained** (HMAC-signed if `AUDIT_KEY`
  is set). Rewriting any past line breaks every later hash; `verifyChain()` detects it.

---

## File map

```
config/
  owned-assets.example.yaml   the OWNED-ASSET REGISTRY schema  (copy → owned-assets.yaml, gitignored)
  jurisdiction.example.yaml   jurisdiction profile (US/FCC)     (copy → jurisdiction.yaml, gitignored)
server/
  scope-gate.js               the enforced boundary: authorize() — deny by default, no override
  audit.js                    append-only, hash-chained/HMAC-signed audit log + verifyChain()
  command-bus.js              authorize → record → dispatch. denied commands never reach an adapter
  config.js                   loads registry + jurisdiction (falls back to examples = demo mode)
  index.js                    Express + WebSocket server, REST endpoints, telemetry stream
  selftest.js                 npm run check — proves the gate + audit chain
  adapters/                   network, homeassistant, sdr, flipper, finance, hosts — mock ↔ live seam
public/                       the ctOS UI (vanilla JS + canvas, zero build step)
DELIVERABLE.md                full 11-section build strategy (capability map, BOM, build sequence…)
```

---

## Legal

For use against systems, networks, spectrum, and accounts **you own or are explicitly authorized in
writing to control.** The scope gate enforces this technically; you remain responsible for keeping
the registry honest and for verifying the AMBER features against current law in your jurisdiction.
No exploit code, third-party attacks, or non-consensual surveillance exist anywhere in this project.
