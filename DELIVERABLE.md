# ctOS · personal — Build Strategy

> Recreating Watch Dogs 2 ctOS capability **against only what you own or are authorized in writing to
> control.** The legal boundary is a hard design input, enforced by the scope gate in
> [`server/scope-gate.js`](server/scope-gate.js) — not a warning label. Struck (RED) abilities are
> gone from the design and never reappear downstream.

**Locked context for this build:** Stage **A** · Jurisdiction **US / FCC** · Budget **Tier 2
(~$300–500)** · Form factor **Both** (always-on home base + portable thin client over WireGuard).

---

## 1. Stage Classification

**STAGE A — AESTHETIC / SIMULATION.** No hardware or network integration is owned yet, so the
deliverable is the full ctOS UI on mock data with every panel wired to a real, marked integration
seam, plus the Tier-2 shopping path to Stage B. Depth for every later phase is routed to Stage A:
you get the complete command architecture and the enforced scope gate **now** (both already built and
tested), and turning on real hardware is a config change (`INTEGRATION_MODE=live` + registry), not a
rewrite. No Stage-C hardware is prescribed.

---

## 2. Capability Map

Every Watch Dogs 2 ctOS/Marcus ability, reframed to the owned-scope boundary and mapped to the components already running in this codebase. **Flag legend:** GREEN = fully legal and buildable now (mock in Stage A, real at Tier-2 flip). AMBER = legal only inside a named US-FCC/owned-scope condition, enforced by `AMBER_CLASSES = new Set(['sdr','flipper','camera'])` in `server/scope-gate.js`. RED = no legal form; the WD2 mechanic is struck, and the row still ships as its closest legal cousin. Nothing RED reaches an adapter — `authorize()` denies by default and `server/audit.js` records the deny.

Every GREEN/AMBER row routes the same way: `command-bus.js` → `authorize(cmd, config)` → `record()` → adapter (`INTEGRATION_MODE=mock` now, `live` when hardware lands).

### 2.1 Recon, Profiling & Vision — GREEN (network/host/read classes)

| WD2 Ability | Legal Equivalent (own-domain reframe) | Real Tech / Named Tool | Owned-Scope Requirement | Feasibility for THIS Stage-A US user | Flag |
|---|---|---|---|---|---|
| ctOS network scan | Sweep the CIDRs in your registry, enumerate every live host/service | `arp-scan`, `nmap -sn`/`-sV`, avahi/mDNS | `network` class, `scan` verb; target CIDR/IP must be in `registry.networks[]` | **Mock now** via `adapters/network.js` → Network Map + Device Grid; real at flip (`arp-scan`/`nmap` swap point, zero hardware needed — LAN-only) | GREEN |
| ScoutX (find hidden nodes) | Rogue-device / unregistered-asset detection: diff live scan against the registry | `arp-scan` sweep + registry diff, `nmap` ping sweep, SSDP/mDNS discovery | `network` class, `scan` verb on owned CIDR; intrusion **detection** on your own net | Mock now; real at flip. This is your legal intrusion-detection story | GREEN |
| Profiler (people → devices) | Profile the *devices you own*: OUI vendor, open ports, hostname, DHCP lease, HA entity metadata | `nmap -O`, MAC-OUI lookup, mDNS, HA REST | `host` class, `read` verb; host in `registry.hosts[]`/`devices[]` | Mock now via `adapters/network.js` (`profile()`)/`homeassistant.js` → **Profiler panel**. *(Profiling non-consenting passersby has no legal form — that mechanic is dropped, not reframed.)* | GREEN |
| NetHack vision (see hackable objects) | Unified live overlay of *your* registered fleet: topology + status + metrics | The UI itself (force-directed canvas), HA entity states, Prometheus metrics | All classes, `read`/`view`; every node already in registry | **Fully working now** — this is the Network Map + Device Grid canvas render | GREEN |
| Proximity / auto hacks | Presence-triggered automations across owned devices (thin client nears the brain → scene fires) | HA presence detection, BLE beacons, Tailscale/WireGuard geofence trigger | `homeassistant` class, `control`; entities in registry | Mock now; real when HA + `HA_TOKEN` connected. WireGuard/Tailscale link is the Stage-A both-form-factor backbone | GREEN |
| Botnet (resource to power hacks) | Your *own* device fleet as a compute/automation pool — job queue across owned hosts | Owned Pi/mini-PC cluster, `systemd`/cron, Ansible fan-out, Prometheus | `host` class, `control`; hosts in `registry.hosts[]` | Mock now via `adapters/hosts.js`; the command-bus + audit chain **is** the orchestrator. *(WD2 botnet = compromised strangers' devices — that source is dropped.)* | GREEN |
| Network bypass (node puzzle) | The authorization flow itself: routing a command through allow/deny checks | `scope-gate.js` `authorize()`, `audit.js` `verifyChain()` | n/a — meta-capability | **Fully working now** — live in the Scope Gate panel (allow/deny demo) | GREEN |

### 2.2 Control & Actuation

| WD2 Ability | Legal Equivalent (own-domain reframe) | Real Tech / Named Tool | Owned-Scope Requirement | Feasibility for THIS Stage-A US user | Flag |
|---|---|---|---|---|---|
| Mass-hack (Followers / mass comm) | Fleet-wide broadcast: apply one scene/command to every owned device at once | HA scenes/scripts, Ansible fan-out | `homeassistant`/`host` class, `control`; all targets in registry | Mock now via Control Panel scenes; real at HA flip. *(The "hack everyone nearby" version is dropped — only your own fleet.)* | GREEN |
| Distraction (ring phones, trigger devices) | Ring *your own* phone, flash *your own* lights, play sound on *your own* speaker | HA `notify` + `media_player` + `light`, Find My, `ntfy` | `homeassistant` class, `control`; entities in registry | Mock now → Control Panel; real at HA flip | GREEN |
| Blackout / cut power | Kill power to *your own* circuits/plugs — "blackout scene" over owned smart plugs | HA switch, Shelly, Emporia smart plug/panel, smart breaker | `homeassistant` class, `control`; **owned circuits only, never shared/grid** | Mock now; real at HA flip. Condition: the plug/breaker is in your registry | GREEN |
| Environmental hacks — *owned actuators* (your garage door, gate, water valve, linear-actuator lift) | Drive relays/actuators you own | ESPHome relay boards, Zigbee/Z-Wave actuators, HA `cover`/`switch` | `homeassistant` class, `control`; actuator in registry | Mock now; real at HA flip | GREEN |
| ~~Environmental hacks — public infra (traffic lights, road barriers, public crane/forklift/hydraulic lift, city pipes)~~ — *struck: disrupting shared/public systems is a federal/state crime and endangers others* | Closest legal cousin: control the same *class* of machine only when **you own it** (private crane, warehouse forklift, your irrigation valves) — routes through the owned-actuator row above | HA + ESPHome relays on owned equipment | Would require the target in `registry.devices[]`; public infra can never be | Never — public targets are denied by the gate; only owned equivalents ship | RED |
| ~~Shock-trap / detonate device~~ — *struck: weaponizing hardware to injure a person, and overloading shared infra, has no legal form* | Closest legal cousin: remotely **power-cycle/reboot** your own device (smart-plug off→on, PoE port bounce) | HA switch cycle, PoE switch API | `homeassistant`/`host` class, `control`; device in registry | Reboot form works mock-now/real-at-flip; the "shock the enemy" mechanic never ships | RED |
| Fixed-camera hijack (public CCTV) | View *your own* IP cameras / HA camera entities | HA camera entities, ONVIF/RTSP, Frigate | `camera` class (**AMBER**): `jurisdiction.camera_mic.recording_allowed` + `require_confirmation` → `params.confirmed=true`; **owned cameras only** (`kind: camera` in `registry.devices[]`) | Mock now → Live Feed panel; real needs owned cameras + consent confirm. **Condition: consent gate must pass in `scope-gate.js`** | AMBER |
| ~~Device-as-camera (strangers' phones/laptops)~~ — *struck: covert access to non-consenting people's cameras is illegal surveillance* | Closest legal cousin: view *your own* laptop/phone webcam behind the explicit consent gate | HA, `motion`/`go2rtc` on owned devices | `camera` class (AMBER), same consent condition; device owned by you | Only the own-device, consented form ships — never arbitrary third-party devices | RED |

### 2.3 RF & RFID — AMBER hardware (`sdr` / `flipper` classes)

| WD2 Ability | Legal Equivalent (own-domain reframe) | Real Tech / Named Tool | Owned-Scope Requirement | Feasibility for THIS Stage-A US user | Flag |
|---|---|---|---|---|---|
| Signal analysis / airwave scan (ctOS "scan the signals") | RX-only spectrum monitoring — watch and log *any* band, TX nothing | RTL-SDR v4 (RX-only HW), `rtl_tcp`/SoapySDR (sweep via `rtl_power`) | `sdr` class (**AMBER**): gate checks `jurisdiction.rf.rx_allowed=true` for `view`/`read` verbs only; **no `transmit`** (RTL-SDR is RX-only hardware) | Mock now → **Spectrum Waterfall panel**; real when the ~$40 RTL-SDR arrives (Tier-2). Condition: RX-only, always legal | AMBER |
| Key grab (RFID) — *cash-grab half dropped* | Read/emulate *your own* RFID/NFC fobs & cards; inventory your own credentials | Flipper Zero (serial CLI `/dev/ttyACM0`), PN532 | `flipper` class (**AMBER**): `jurisdiction.rfid_emulation_allowed=true`; `emulate` requires UID in `registry.rfid[]`; `read` is benign (non-AMBER `allow(false)`) | Mock now → `adapters/flipper.js`; real when Flipper Zero arrives (~$169, Tier-2). **Condition: UID must be your own registered card.** *(The "grab NPC cash" half is the steal-money RED row.)* | AMBER |
| ~~Signal jammer (jam enemy comms / deauth)~~ — *struck: RF jamming is a federal crime (47 U.S.C. §333); Wi-Fi deauth of others is illegal too — never licensable, at any power* | Closest legal cousin: RTL-SDR **RX** detection of interference + disconnect a client from **your own** access point via the AP's admin API | RTL-SDR RX (detect only), UniFi/OpenWrt AP client-kick on owned AP | `sdr` RX-only (never `transmit` for jamming); AP must be yours | Detection ships (AMBER RX); jamming is hard-denied by the gate and by FCC — never ships | RED |

### 2.4 Robotics & Aerial

| WD2 Ability | Legal Equivalent (own-domain reframe) | Real Tech / Named Tool | Owned-Scope Requirement | Feasibility for THIS Stage-A US user | Flag |
|---|---|---|---|---|---|
| RC Jumper (RC car) | Drive *your own* RC rover / ESP32 robot | ESP32/Pi rover over WiFi/MQTT/HTTP, or a hobby 2.4 GHz RC transmitter (its own radio) | `homeassistant`/`host` class, `control`; rover in registry. The rover's own 2.4 GHz link is license-free (Part 15) and is **NOT** driven through the rig's RX-only SDR — there is no `sdr transmit` path here | Mock now — rover shows as an owned node via the network/HA adapters; real needs the rover (Tier-2 add-on). Condition: WiFi/control link stays in a license-free ISM band | GREEN |
| Quadcopter drone | Fly *your own* drone; pull its camera feed into the UI | DJI / DIY MAVLink; control link on the drone's own 2.4 GHz (Part 15) radio | Owned airframe; the control link is the drone's own license-free 2.4 GHz radio (not the rig's RX-only SDR); camera feed via `camera` class (consent gate) | Mock now — drone shows as an owned node + camera source; real needs the drone. **Condition (FAA): >250 g requires FAA registration + Remote ID; control link stays in license-free ISM (2.4 GHz)** | AMBER |

### 2.5 Finance, Auth & Dispatch — RED core (`finance` class is read-only by design)

| WD2 Ability | Legal Equivalent (own-domain reframe) | Real Tech / Named Tool | Owned-Scope Requirement | Feasibility for THIS Stage-A US user | Flag |
|---|---|---|---|---|---|
| ~~Steal-money (grab cash from a passerby)~~ — *struck: taking funds from accounts not yours is theft/wire fraud* | Closest legal cousin: **read** your own balances via official aggregation | Plaid / Teller / TrueLayer / GoCardless (Nordigen), your own creds | `finance` class; target must be an owned `acct:` in `registry.accounts[]` — the schema exposes no write/transfer verb | Mock now → `adapters/finance.js` → Finance panel; real when you link your own accounts | RED |
| ~~Drain-bank-account (Data Breach)~~ — *struck: emptying an account you don't own is a felony* | Closest legal cousin: **read** your own transactions & net-worth aggregation | Same aggregation APIs, read-only | `finance` class, `read` only | Mock now; real at your own account link. No transfer capability exists anywhere in the codebase | RED |
| ~~2FA / password bypass~~ — *struck: bypassing auth on anything is illegal; on your own accounts it's the wrong frame* | Closest legal cousin: **manage** your own credentials/2FA and authenticate legitimately with your own creds | Vaultwarden (self-hosted), your own TOTP, legitimate Plaid Link | No gate class grants bypass; auth is always with your own creds | Own-credential management ships; "bypass" never ships | RED |
| ~~Gang / police dispatch manipulation (send cops/gang, raise bounty)~~ — *struck: false dispatch / swatting is a serious crime* | Closest legal cousin: dispatch alerts **to yourself** when your own net sees a rogue device | HA automation + `ntfy`/push, tied to the ScoutX detection row | `network` detection + `homeassistant` `control` on your own alerting | Mock now → Finance/Notifications panel; real at HA flip. Only self-directed alerts — never dispatching force at a person | RED |

### 2.6 Vehicle

| WD2 Ability | Legal Equivalent (own-domain reframe) | Real Tech / Named Tool | Owned-Scope Requirement | Feasibility for THIS Stage-A US user | Flag |
|---|---|---|---|---|---|
| ~~Vehicle steal / remote-drive (any car)~~ — *struck: commandeering or piloting a vehicle you don't own — or autonomously driving one on public roads — is illegal and unsafe* | Closest legal cousin: telematics on **your own** vehicle only | Smartcar API, Tesla Fleet API, Tessie, FordPass — official APIs, your VIN | Owned vehicle; official-API auth with your creds; no third-party targets | Mock now; the "drive any car" mechanic never ships | RED |
| Vehicle alarm / honk / flash / lock / locate / climate (own car) | Honk, flash, lock, locate, precondition *your own* car | Same official APIs (Smartcar/Tesla), often bridged into HA | `homeassistant` class, `control`; vehicle in `registry.devices[]` (`kind: homeassistant`), official-API creds | Mock now → Control Panel toggle; real when you connect your own car's API. **Condition: your VIN, manufacturer API, no public-road autonomy** | GREEN |

### 2.7 Component coverage summary

- **All GREEN/AMBER rows already have a home:** `network`/`host` → `adapters/network.js`,`hosts.js` (Network Map, Device Grid, Profiler); `homeassistant` → `adapters/homeassistant.js` (Control Panel, Notifications); `sdr` → `adapters/sdr.js` (Spectrum Waterfall); `flipper` → `adapters/flipper.js`; `camera` → Live Feed; `finance` → `adapters/finance.js` (Finance panel).
- **Every AMBER condition is enforced in code, not prose:** `AMBER_CLASSES = new Set(['sdr','flipper','camera'])` in `scope-gate.js` requires the jurisdiction profile to permit the class (plus the global `amber_enabled` kill-switch); SDR gates RX on `jurisdiction.rf.rx_allowed` and blocks `transmit` outside `registry.rf.tx_bands`; flipper `emulate` requires the UID in `registry.rfid[]`; camera requires `params.confirmed` when `require_confirmation` is set.
- **Every RED mechanic is denied by default** and logged to the hash-chained audit — the closest legal cousin is the only thing that ships. `npm run check` proves the gate allows in-scope and denies out-of-scope targets across its 57 checks — in-scope ALLOW, conservative AMBER-off DENY, out-of-scope DENY, deliberately-enabled AMBER ALLOW/DENY (including the ERP power cap), results confinement (scan output filtered to the authorized CIDR), and audit-chain verify — and exits non-zero on any failure.

---

## 3. Beyond-Game Feature List

WD2's ctOS was a scripted prop: no history, no telemetry, no real feeds, and every "hack" was theatre against NPCs. This rig does the inverse — narrow scope, real signal. Below is what genuine tooling gives you that the game never had, each mapped to the adapter and panel it lands in, and the gate class that keeps it legal.

### RX spectrum waterfall — your own airspace, live
**Tool:** `rtl_tcp` / SoapySDR feeding `rtl_power` FFT rows. **Lands in:** `server/adapters/sdr.js` `sweepRow()` → `#panel-wf` Spectrum Waterfall (scrolling canvas). **Gate:** class `sdr`, AMBER — RX passes freely (`rf.rx_allowed`), TX is impossible on RX-only RTL-SDR and would be denied to non-registry bands anyway. WD2 faked a spectrum graphic; this is real dBFS-per-bin off a $30 dongle. Beyond-game because it's *empirical* — you see your own 433/915 traffic, not a canned animation.

### Sub-GHz sensor decode — your devices talking
**Tool:** `rtl_433`. **Lands in:** parallel path into `sdr.js`, decoded packets surfaced in `#panel-grid` Device Grid and `#panel-feed` Live Feed. Decodes your own weather station, soil/temp sensors, tire-pressure monitors, 433 MHz doorbell — anything transmitting in the clear that you own. The game had no concept of decoding real protocol; this turns ambient RF into structured device state.

### Presence / geofence automation
**Tool:** Home Assistant **Zones** + the HA companion app (or Bluetooth/mmWave presence). **Lands in:** `server/adapters/homeassistant.js`, driving `#panel-control`. **Gate:** class `homeassistant` — entity must be `ha:<entity>` in the registry. Crossing a zone boundary fires scenes automatically. WD2 tracked *other people*; this tracks only you/your household devices and acts on it — arrive-home lights, away-mode lockdown.

### Scheduled scenes — arrive-home / sleep / away
**Tool:** HA `scene.turn_on` + Node cron / HA automations. **Lands in:** `homeassistant.js` `runScene()` → `#panel-control` scene buttons. **Gate:** class `homeassistant`. Time- and event-triggered orchestration of *owned* entities. The game's "hacks" were momentary; scenes are stateful, scheduled, and repeatable.

### Real personal financial dashboard
**Tool:** Plaid / Teller / TrueLayer / GoCardless (Nordigen) — read-only aggregation with *your own* credentials. **Lands in:** `server/adapters/finance.js` `balances()` / `notifications()` → `#panel-finance`. **Gate:** class `finance` — only `accounts[]` ids are ever queried; secrets in env, never in the registry. This is the hard inversion of WD2's "steal from strangers" mechanic: read-only, your accounts, balances and 24h deltas. Genuinely useful, zero theft surface.

### Self-hosted service status grid
**Tool:** Prometheus `node_exporter` + **Uptime Kuma** for HTTP/port checks. **Lands in:** `server/adapters/hosts.js` `status()` → `#panel-feed` / notifications. **Gate:** class `host` — target must resolve into a registry CIDR. Per-host CPU/mem/uptime and per-service up/down (sshd, nginx, home-assistant, wireguard). A real NOC pane the game never attempted.

### Energy / power monitoring
**Tool:** Shelly EM / Emporia Vue / Zigbee smart plugs → Prometheus + **Grafana**. **Lands in:** `hosts.js` metrics path, rendered in `#panel-finance` (cost overlay) or an embedded Grafana pane. **Gate:** class `host` / `homeassistant`. Live watts per circuit, kWh trends, and — tying to the finance adapter — dollar cost per device. WD2 never modeled the physical grid you actually pay for.

### Own-network intrusion DETECTION (defensive ctOS)
**Tool:** **Suricata** (signature IDS) or **Zeek** (protocol logging) on a SPAN/mirror port. **Lands in:** `server/adapters/network.js` alert path → `#panel-feed` and security notifications ("New device joined home-lan"). **Gate:** class `network`, verbs `scan`/`read` only — detection, never intrusion. This is the legal, defensive flip of the game's offensive fantasy: you watch *your* wire for anomalies. Beyond-game because WD2 had no defensive posture at all.

### Voice command
**Tool:** **Rhasspy** or **HA Assist** (local Whisper STT + Piper TTS — no cloud). **Lands in:** issues intents into `server/command-bus.js` as `{verb,class,target}` commands. **Gate:** every voice command still passes `scope-gate.js` — speech is not an override; "unlock the neighbor's door" is denied and logged like any other out-of-scope call. Hands-free ctOS, fully offline.

### 3D / graph map of owned devices
**Tool:** extend the existing force-directed canvas with `3d-force-graph` / vis-network. **Lands in:** `network.js` `discover()` → `#panel-map` Network Map. **Gate:** class `network`. Live topology of your CIDR — nodes by kind (host/iot/camera/ap), edges by subnet, click-through to the Profiler. The game's map was a static art asset; this is generated from real `arp-scan`/`nmap` output.

### Automated backup + remote kill-switch of the rig
**Tool:** **restic** or **borg** (encrypted, deduplicated, scheduled snapshots) + an SSH-triggered kill-switch. **Lands in:** `server/adapters/hosts.js` `control` over SSH. **Gate:** class `host` — requires an explicit `hosts[]` entry; the gate enforces it separately from status reads. One command snapshots config + audit log off-box; a second can `wg-quick down` / power-cut the brain remotely from the portable thin client. Self-preservation the game character never needed.

### Historical time-series & trends
**Tool:** Prometheus TSDB + **Grafana** dashboards (and Loki for logs). **Lands in:** backs every metric panel; embeddable in `#panel-finance` / `#panel-feed`. WD2 had zero memory — every readout was instantaneous and forgotten. Real ctOS remembers: 30-day network growth, energy curves, uptime SLOs, spending trend.

### Push alerts to the portable thin client
**Tool:** **ntfy** or **Gotify** (self-hosted push). **Lands in:** fan-out from `finance.js`/`hosts.js`/`network.js` notification streams to your phone. **Gate:** inherits the source command's class. The home base (brain) computes; the thin client gets pinged — "new device joined," "vps-01 disk 90%," "direct deposit posted" — over WireGuard. Ties the BOTH form factor together.

### Mesh VPN status
**Tool:** **WireGuard** / **Tailscale** peer telemetry. **Lands in:** `#panel-feed`, driven from `hosts.js` (service `wireguard` already tracked). **Gate:** class `host`. Shows the tunnel between base and thin client — handshake age, endpoint, rx/tx. The sync backbone made visible, so you can see when the portable node is actually live.

---

### Wiring map

| Feature | Named tool | Adapter | Panel | Gate class |
|---|---|---|---|---|
| Spectrum waterfall | rtl_tcp / SoapySDR + rtl_power | `sdr.js` | `#panel-wf` | `sdr` (AMBER) |
| Sub-GHz decode | rtl_433 | `sdr.js` | `#panel-grid` / `#panel-feed` | `sdr` (AMBER) |
| Presence / geofence | HA Zones | `homeassistant.js` | `#panel-control` | `homeassistant` |
| Scheduled scenes | HA scenes + cron | `homeassistant.js` | `#panel-control` | `homeassistant` |
| Finance dashboard | Plaid / Teller / TrueLayer / Nordigen | `finance.js` | `#panel-finance` | `finance` |
| Service status grid | Prometheus + Uptime Kuma | `hosts.js` | `#panel-feed` | `host` |
| Energy monitoring | Shelly/Emporia → Prometheus + Grafana | `hosts.js` | `#panel-finance` | `host` |
| Intrusion detection | Suricata / Zeek | `network.js` | `#panel-feed` | `network` (scan/read) |
| Voice command | Rhasspy / HA Assist | `command-bus.js` | (bus-wide) | per-intent |
| 3D device graph | 3d-force-graph / vis-network | `network.js` | `#panel-map` | `network` |
| Backup + kill-switch | restic / borg + SSH | `hosts.js` | `#panel-control` | `host` |
| Historical trends | Prometheus + Grafana + Loki | `hosts.js` | `#panel-finance` | `host` |
| Push to thin client | ntfy / Gotify | all notification adapters | `#panel-feed` | inherited |
| Mesh VPN status | WireGuard / Tailscale | `hosts.js` | `#panel-feed` | `host` |

Every row above — voice, geofence, kill-switch, IDS alert — still transits `scope-gate.js` and lands in the hash-chained audit log (allow, deny, or error, recorded before any adapter runs). Registry-scoped classes (network / host / homeassistant / finance, plus Flipper emulation) reach an adapter only with an in-registry target; AMBER RX — the waterfall and sub-GHz decode — is gated instead on the jurisdiction profile permitting you to listen, since receiving your own spectrum is legal and deliberately not registry-bound. That is the line between this and the game: real capability, provably fenced.

---

## 4. System Architecture

Four layers, one choke point. The **Scope Gate** (`server/scope-gate.js`) sits between every UI intent and every real transport — nothing in the layers below it can act on a target that is not in the owned-asset registry. The layers are: **OS** (the metal), **Control** (the command bus), **Aesthetic** (the ctOS UI), **Hardware** (Stage B unlocks). Data flows UI → WebSocket → `command-bus.js` → `authorize()` → `audit.record()` → adapter → transport. Deny is the default and there is no override path in code.

```
 AESTHETIC   public/index.html · ctos.js · ctos.css   (canvas + REST poll + WS stream)
     │  ws://…/ws  {id,verb,class,target,params}
 CONTROL     command-bus.js → scope-gate.authorize() → audit.record() → adapters/*.js
     │  arp-scan · HA REST/WS · SSH/Prometheus · Flipper serial · rtl_tcp · aggregator token
 OS          Debian 12 (brain) · Pi OS Lite/DietPi (thin client) · LUKS · non-root svc user
 HARDWARE    RTL-SDR · Flipper Zero · Alfa AWUS036ACM · Pi 5 (BOM → Section 5)
```

---

### 1. OS Layer — the metal

| Role | Distro | Why |
|---|---|---|
| **Home base (the brain)** | **Debian 12 "bookworm" stable** | Boring on purpose. 5-year support, systemd, every tool (`arp-scan`, `nmap`, `rtl-sdr`, `soapysdr`, `wireguard`) in-repo. The always-on node must survive unattended reboots — stable > bleeding-edge. |
| **Portable thin client (Pi)** | **Raspberry Pi OS Lite (64-bit)** or **DietPi** | Lite = no desktop, boots to console, ~500 MB. DietPi if you want its `dietpi-software` menu to install Chromium-kiosk + WireGuard in one pass and aggressive RAM tuning. Either runs the Chromium `--kiosk` shell against the brain's ctOS URL. |
| **Only if you want the pentest toolchain** | Kali or Parrot | Justified *only* if you specifically want a pentest distro's pre-packaged wireless-analysis stack (`kismet`, `gnuradio-companion`, `wireshark`) for passive work on **your own** gear. For this build's GREEN/AMBER scope — detection and monitoring, not offense — they are unnecessary weight and a worse always-on base; Debian + the specific tools you need is cleaner and lower-attack-surface. Do not run the brain on Kali. |

**Kernel / driver notes (do these on the brain and the Pi):**

- **WiFi monitor mode:** the Network Map's live transport (`arp-scan`) needs no special chipset — it works on any onboard NIC — but for real 802.11 monitor-mode capture on *your own* AP use an **Alfa AWUS036ACM (mt7612u)**. The `mt76x2u` driver is mainline in the Debian 12 kernel; monitor mode works out of the box (`iw dev wlan1 set type monitor`). Avoid Realtek dongles that need out-of-tree DKMS.
- **SDR udev:** blacklist the DVB TV driver so the RTL dongle enumerates as an SDR, and grant the service user access without root:
  ```
  # /etc/modprobe.d/blacklist-rtl.conf
  blacklist dvb_usb_rtl28xxu
  # /etc/udev/rules.d/20-rtlsdr.rules
  SUBSYSTEM=="usb", ATTRS{idVendor}=="0bda", ATTRS{idProduct}=="2838", MODE="0660", GROUP="plugdev"
  ```
  Same pattern for the Flipper serial device (`ATTRS{idVendor}=="0483"`, group `dialout`) so `/dev/ttyACM0` opens without sudo — matches the `FLIPPER_PORT` in `server/adapters/flipper.js`.
- **Disk:** **LUKS full-disk encryption** on both nodes. The registry (`config/owned-assets.yaml`) and audit chain (`data/audit.log`, HMAC-signed when `AUDIT_KEY` is set) are the crown jewels; a stolen portable unit must reveal nothing.
- **Service isolation:** run the Node server as a **non-root `ctos` user**. Grant *only* the two raw-socket tools it needs via a scoped sudoers entry — not blanket sudo:
  ```
  # /etc/sudoers.d/ctos
  ctos ALL=(root) NOPASSWD: /usr/sbin/arp-scan, /usr/bin/nmap
  ```
  Everything else (HA, finance, SDR RX, Flipper) runs unprivileged. This is defense-in-depth *behind* the scope gate, not instead of it.

---

### 2. Control Layer — the command bus (built)

The bus already exists: `server/command-bus.js` `dispatch(cmd, config, actor)`. Every UI action becomes one message on the WebSocket (`server/index.js`, path `/ws`), authorized and logged before any adapter is touched. **Denied commands never reach an adapter** (`command-bus.js` returns before `execute()`).

**Message schema** (client → server), from `command-bus.js`:

```json
{ "id": "c8f3a1", "verb": "control", "class": "homeassistant",
  "target": "ha:switch.office_lamp", "params": { "action": "toggle" } }
```
- **verb** ∈ `scan | read | view | control | transmit | emulate`
- **class** ∈ `network | host | homeassistant | sdr | flipper | camera | finance`
- **target** — the string the gate parses (`parseTarget` in `scope-gate.js`): `192.168.1.0/24` · `192.168.1.10` · `ha:switch.x` · `rf:433920000` · `nfc:04AB` · `acct:checking`

Result (server → client): `{ id, ok, denied, reason, amber, data }`.

**The choke point.** `dispatch()` calls `authorize(cmd, config)` (`scope-gate.js`) first, always. A CIDR must be a subset of an owned network (`cidrSubsetOf`); a host IP must fall inside an owned CIDR (`ipInCidr`) and, for `control`, appear explicitly in `hosts[]`; an HA entity must be a `kind: homeassistant` device in the registry; SDR `transmit` must land inside a registry `tx_bands[]` window *and* be permitted by the jurisdiction profile; Flipper `emulate` needs the UID in `rfid[]` *and* `rfid_emulation_allowed`; camera needs an owned camera device *and* `params.confirmed` when `require_confirmation` is set. The three AMBER classes (`sdr`, `flipper`, `camera`) are additionally killed globally if `amber_enabled: false`.

**Transport per device class** (each adapter has a marked `INTEGRATION_MODE=live` swap point; Stage A returns mock):

| Class | Adapter | Live transport (swap point) |
|---|---|---|
| `network` | `adapters/network.js` | `arp-scan --localnet --quiet` (fast, needs `CAP_NET_RAW`); `nmap -sn <cidr>` fallback |
| `host` | `adapters/hosts.js` | **SSH** to a `hosts[]` entry, or scrape **Prometheus** `node_exporter` `/api/v1/query` |
| `homeassistant` | `adapters/homeassistant.js` | **HA REST** `POST /api/services/<domain>/<service>` with `HA_TOKEN`; **HA WebSocket** for live state streaming |
| `sdr` | `adapters/sdr.js` | **`rtl_tcp` / SoapySDR** IQ → FFT (`rtl_power` cheap sweep) → power-per-bin rows. RX only on RTL hardware |
| `flipper` | `adapters/flipper.js` | **Flipper serial CLI** over `/dev/ttyACM0` (`nfc detect`, `rfid read`, `subghz rx`) |
| `finance` | `adapters/finance.js` | **Aggregator token** — Plaid / Teller / TrueLayer / Nordigen, your own creds, secrets in env vars |

---

### 3. Aesthetic Layer — the ctOS UI (built)

Stack: **vanilla JS + `<canvas>`, zero build** (`public/index.html`, `public/ctos.js`, `public/ctos.css`). No framework in Stage A on purpose — nine panels, one WebSocket, a few `fetch()` polls. A framework would add a toolchain and bundle step to buy nothing; the canvas panels (map, waterfall) are hand-drawn on `requestAnimationFrame` and would be *slower* through a virtual DOM. **Graduate to Svelte or React + D3 / Sigma.js** only when the network map exceeds ~150 nodes (Sigma's WebGL renderer) or panels need shared reactive state — i.e., Stage C, not now.

| Panel | Data source | Refresh mechanism |
|---|---|---|
| **Network Map** (force-directed canvas) | `GET /api/devices` → `buildMap()` | REST once on load; `stepMap()` spring layout on `requestAnimationFrame` |
| **Device Grid** | `GET /api/devices` (`network.discover`) | REST poll on load / on demand |
| **Profiler** | `GET /api/profile/:ip` | REST on node click; also emits a `read/network` cmd to the audit log |
| **Control Panel** (scenes + HA toggles) | `GET /api/devices` → `buildControls(ha)` | REST for state; each toggle sends a `control/homeassistant` cmd over **WS** |
| **Spectrum Waterfall** (scrolling) | `sweepRow()` broadcast every 600 ms | **WS stream** `waterfall`; `pushWaterfall()` scrolls canvas 1px/row |
| **Finance / Notifications** | `GET /api/finance` | REST poll, `setInterval(loadFinance, 15000)` |
| **Live Feed** | server telemetry `feed` events | **WS stream** `feed` |
| **Scope Gate** (allow/deny demo) | issues real cmds over WS | **WS stream** `result`; refreshes audit on each |
| **Audit Log** | `GET /api/audit` (`verifyChain` + `tail`) | REST on load and after every gate result |

**Rule of thumb baked in:** streaming/continuous data (waterfall, feed, command results) = WebSocket; snapshot/tabular data (devices, finance, audit, profile) = REST poll.

**Theme system:** CSS custom properties in `ctos.css` (`--red`, cyan/green HUD accents), a scanline overlay div, glitch title, `data-text` doubling. To turn the browser app into a full **desktop rice / ctOS shell** on the brain or the Pi:

- **Compositor:** **Hyprland** (Wayland, animations) or **i3** (X11, lighter on the Pi) in kiosk mode.
- **Kiosk:** `chromium --kiosk --app=http://ctos-base.lan:7050 --noerrdialogs` autostarted by the compositor. On DietPi this is one `dietpi-software` entry.
- **Terminal:** **foot** (Wayland) or **kitty**, themed to the same cyan/black palette for the drop-down console.
- **Boot splash:** **Plymouth** with a ctOS logo theme so the machine *boots into the fiction*.
- **Lock screen:** **swaylock** (Hyprland) or **hyprlock**, styled to the ctOS HUD — the lock screen is the login-to-ctOS moment.

---

### 4. Hardware Layer — Stage B unlocks (pointer)

Stage A owns no hardware; every adapter runs mock. The **Tier-2 BOM (~$300–500) is detailed in Section 5** — this layer only maps each purchase to the capability it turns from mock to live:

| Component (Tier 2) | Unlocks | Adapter it wires |
|---|---|---|
| **Raspberry Pi 5 (8 GB) + PoE/SSD** | The always-on brain / portable thin client metal | all |
| **RTL-SDR Blog V4** (~$40, **RX-only**) | Live Spectrum Waterfall, RF receive/decode | `adapters/sdr.js` (`sdr.view`) |
| **Flipper Zero** (~$170) | Read/emulate **your own** NFC/RFID + sub-GHz RX | `adapters/flipper.js` |
| **Alfa AWUS036ACM (mt7612u)** (~$50) | Monitor-mode capture on **your own** WiFi | `adapters/network.js` (live 802.11) |
| **Proxmark3 Easy** (optional) | Deeper own-card RFID work | `flipper` adapter, or a new dedicated adapter (no card class exists today) |

TX-capable radio (HackRF) is deliberately **out of Tier 2** — RX-only RTL hardware keeps AMBER TX physically impossible until you deliberately step up, and the gate still bounds any TX to registry Part-15 bands.

---

### Component-to-Capability Map

Every GREEN/AMBER capability from the built legend (`server/index.js` `capabilityLegend()`) mapped to the exact component and transport that delivers it. No orphan capabilities, no orphan components.

| Capability (verb.class) | Tier | Component (Stage B) | Transport / live swap point | Gate rule (`scope-gate.js`) |
|---|---|---|---|---|
| `scan.network` | GREEN | Pi NIC (+ Alfa for WiFi) | `arp-scan --localnet` / `nmap -sn` | CIDR ⊆ owned `networks[]` |
| `read/profile.network` | GREEN | Pi NIC | passive ARP/mDNS parse | host IP ∈ owned CIDR |
| `status.host` | GREEN | Pi + own servers | SSH / Prometheus `node_exporter` | IP ∈ CIDR; `control` needs `hosts[]` |
| `control.homeassistant` | GREEN | HA server + Pi | HA REST `/api/services/*` (`HA_TOKEN`) | entity ∈ owned `devices[]` (`kind: homeassistant`) |
| `scene.homeassistant` | GREEN | HA server | HA REST `scene.turn_on` | same as above |
| `view.sdr` (RX waterfall) | GREEN | **RTL-SDR Blog V4** | `rtl_tcp` / SoapySDR → FFT | `rf.rx_allowed` in profile |
| `read.flipper` (own card) | GREEN | **Flipper Zero** | serial CLI `/dev/ttyACM0` | read always allowed |
| `read.finance` | GREEN | (no HW) own accounts | Plaid/Teller/TrueLayer/Nordigen token | acct ∈ owned `accounts[]` |
| `verify.audit` | GREEN | Pi disk (LUKS) | `verifyChain()` over `data/audit.log` | n/a — integrity check |
| `transmit.sdr` (Part-15 only) | **AMBER** | *HackRF (Tier 3, not in BOM)* | `hackrf_transfer` / SoapySDR TX | freq ∈ registry `tx_bands[]` **and** `rf.tx_allowed` |
| `emulate.flipper` (own cards) | **AMBER** | **Flipper Zero** | serial CLI `nfc/rfid emulate` | UID ∈ `rfid[]` **and** `rfid_emulation_allowed` |
| `view.camera` (consent-confirmed) | **AMBER** | own IP camera (RTSP) + Pi | RTSP pull / HA camera proxy | camera ∈ `devices[]` **and** `params.confirmed` |

Note the two intentional asymmetries: `transmit.sdr` is a real AMBER capability in the gate but has **no Tier-2 component** — RTL-SDR is RX-only, so the capability is enforceable-yet-inert until a Tier-3 HackRF is deliberately added. `emulate.flipper` and `read.flipper` share one component (Flipper Zero) across a GREEN and an AMBER capability — the split lives in the gate, not the hardware.

---

## 5. Bill of Materials (tiered)

**Recommendation: stop at Tier 2.** It lands the "Both" form factor — an always-on Pi 5 home base plus a portable thin client — inside your $300-500 budget with cumulative spend near **$489**. Tier 1 is the Stage A->B on-ramp you can buy today against your existing laptop; Tier 3 is shown for context only and is out of scope for this budget. Every RX item is passive receive, permitted by the jurisdiction profile (`rf.rx_allowed`); every TX item is constrained in code to license-free ISM bands via the scope gate (`server/scope-gate.js` `sdr`-class `transmit` verb, checked against `rf.tx_bands` in the registry). Prices are early-2026 street and **will drift** — verify at purchase.

### Tier 1 — ~$50-150 (Stage A -> B, runs on your laptop)

| Item | Model | Price | Unlocks | Wires into |
|---|---|---|---|---|
| SDR (RX) | RTL-SDR Blog V4 + dipole kit | ~$40 | 500 kHz–1.7 GHz **receive-only** spectrum; Spectrum Waterfall panel on real IQ | `adapters/sdr.js` live path (`rtl_tcp`/SoapySDR) |
| WiFi NIC (dual-band) | Alfa AWUS036ACM (MediaTek MT7612U) | ~$50 | Dual-band (2.4/5 GHz) USB NIC for a headless home base; **active device discovery on your OWN CIDR** — no third-party air capture | `adapters/network.js` live path (arp-scan/nmap) |
| Compute | Existing laptop | $0 | Node 22 server + full ctOS UI at `localhost:7050` | entire stack |
| **Antennas/adapters buffer** | pigtails, SMA, USB hub | ~$10-40 | — | — |
| **Running total** | | **~$90 (range $50-150)** | | |

The V4 is RX-only hardware by design — it cannot transmit, which keeps spectrum work AMBER-clean without relying on software gates alone. The Alfa's role here is a NIC: `adapters/network.js` runs `arp-scan --localnet` / `nmap -sn <cidr>` against a registry CIDR that the scope gate has already authorized. It is **not** used for promiscuous/monitor-mode capture — the network class only gates IP-layer scans of owned space, and passive sniffing of the air (neighbouring APs, non-consenting devices' probe requests) is out of scope and not built.

### Tier 2 — $300-500 (Stage B) — **RECOMMENDED STOPPING POINT**

| Item | Model | Price | Unlocks | Wires into |
|---|---|---|---|---|
| Home-base compute | Raspberry Pi 5 8GB | ~$80 | Always-on "brain": server, gate, audit chain, adapters | whole backend |
| Power | Official 27W USB-C PSU | ~$13 | Stable Pi 5 + NVMe power budget | — |
| Cooling | Official Active Cooler | ~$6 | Sustained 24/7 load without throttle | — |
| Storage HAT | Pi M.2 HAT+ | ~$13 | PCIe NVMe boot | — |
| SSD | 250GB NVMe (WD Blue SN580; or Crucial P3 500GB) | ~$28 | Durable append-only audit log at `data/audit.log` (SD cards die under continuous append writes) | `server/audit.js` |
| Multi-tool | Flipper Zero | ~$169 | **Your own** RFID/NFC read + emulate (gated by `registry.rfid` + `rfid_emulation_allowed`), plus IR and sub-GHz RX over the Flipper CLI | `adapters/flipper.js` live path (serial CLI `/dev/ttyACM0`) |
| Home-automation radio | Home Assistant Connect ZBT-1 (ex-SkyConnect) **or** Sonoff ZBDongle-E | ~$30 | Zigbee/Matter coordinator; drives Control Panel scenes + toggles | `adapters/homeassistant.js` live path (HA REST/WS) |
| Owned smart devices | Shelly 1 Gen3 (~$16) + Sonoff Zigbee plug (~$12) + Aqara motion/contact sensors (~$30) | ~$60 | Real controllable/observable endpoints for Control Panel + Live Feed | `adapters/homeassistant.js` |
| **Carried from Tier 1** | RTL-SDR V4 + Alfa ACM | (~$90) | Spectrum + owned-CIDR discovery ride forward onto the Pi | sdr/network adapters |
| **New spend this tier** | | **~$399** | | |
| **Cumulative** | | **~$489** | | |

This is the recommendation. It activates five of six adapters live — `network` (arp-scan/nmap on your own CIDR), `homeassistant` (HA REST/WS), `sdr` (RX), `flipper` (read/emulate own cards), and `hosts` (SSH/Prometheus to your own boxes, the Pi included) — leaving only `finance` in mock until you wire your own aggregation creds (Plaid/Teller/TrueLayer sandbox). The Flipper covers RFID/NFC/IR/sub-GHz **RX** in one $169 unit instead of several separate radios — best capability-per-dollar in the build. Note the scope of that unit inside this codebase: the `flipper` class in `scope-gate.js` exposes only `read` and `emulate` verbs — reading is always allowed, emulation requires the card UID to be in `registry.rfid` and `rfid_emulation_allowed` to be true. Sub-GHz **TX** is Flipper-hardware-capable but is **not** routed through the flipper adapter; any RF transmit is gated separately by the `sdr`-class `transmit` verb against `registry.rf.tx_bands` and stays inside license-free ISM bands only.

### Tier 3 — $800-1500+ (Stage C, context only — over budget)

| Item | Model | Price | Unlocks |
|---|---|---|---|
| Beefier brain | Beelink EQ13 (N100, ~$170) or Minisforum UM-series (Ryzen, ~$400) | $170-450 | Full nmap sweeps, IDS (Suricata/Zeek) on your own VLAN, container stack |
| Wideband SDR | HackRF One (+ case) | ~$150-180 | 1 MHz–6 GHz RX; **TX only in license-free bands**, gated by `registry.rf.tx_bands` |
| Card research | Proxmark3 RDV4 | ~$300-350 | Deep read/analysis of **your own** LF/HF cards (Flipper can't reach) |
| Portable rig | 7" HDMI touchscreen (~$60) + UPS HAT / LiPo (~$120) + case | ~$180-250 | Standalone backpack thin client (no phone tether) |
| Segmentation | Mikrotik hEX (~$70) or UniFi USW-Lite-8-PoE (~$110); add UniFi Flex Mini (~$30) for cheap VLAN ports | $30-150 | VLANs to isolate IoT; a **port-mirror/SPAN feed for IDS requires the hEX or USW-Lite-8-PoE** — the Flex Mini has no port mirroring |
| CCTV (owned) | Reolink/Amcrest PoE NVR + 2 cameras | ~$250-400 | Own-property cameras behind the `camera`-class consent gate |
| **Range** | | **$800-1500+** | recommendation does **not** extend here |

Camera and Proxmark items stay behind the AMBER consent/jurisdiction gates; the HackRF's transmit path is dead unless a matching license-free `tx_band` exists in your registry and `rf.tx_allowed` is set. The SPAN/mirror port only exists on the managed switches (USW-Lite-8-PoE, Mikrotik hEX) — budget the Flex Mini for VLANs alone, not IDS capture.

### "Both" form factor at Tier 2 — no second computer needed

The Pi 5 is the **brain**: always on, holding the server, scope gate, hash-chained audit log, and all adapters. You do **not** buy a separate portable computer at this tier. The **thin client is a device you already own** — your phone or an old tablet — running the ctOS UI in a browser and reaching the Pi over an encrypted WireGuard (or Tailscale) tunnel. The UI is vanilla JS with zero build, so any modern browser renders the full HUD; all compute and all privileged adapter access stay on the home base, never on the portable. If you later want a dedicated screen you can strap to the rig, that is the Tier 3 touchscreen+battery add-on — strictly optional. At Tier 2 the split costs **$0 extra** beyond hardware you have, which is exactly why cumulative spend fits under $500.

---

## 6. Authorization Model — the self-enforcing scope gate

This is the mechanism that makes the system **refuse out-of-scope action automatically.** It is fully
implemented in [`server/scope-gate.js`](server/scope-gate.js), [`server/audit.js`](server/audit.js),
and [`server/command-bus.js`](server/command-bus.js), and proven by
[`server/selftest.js`](server/selftest.js) (`npm run check`, 65 checks).

### 6.1 Owned-asset registry (single source of truth)

Every action validates its target against this registry **before** executing. Schema
(`config/owned-assets.yaml`; ships as `.example.yaml`):

```yaml
owner: "Your Name"                 # stamped into every audit entry
networks:                          # CIDRs you administer — the ONLY scannable ranges
  - { cidr: "192.168.1.0/24", label: "home-lan", controls_dhcp: true }
devices:                           # id is the match key
  - { id: "aa:bb:cc:dd:ee:01", label: "my-nas", kind: "host" }          # kind: host|homeassistant|camera|sensor
  - { id: "ha:switch.office_lamp", label: "office lamp", kind: "homeassistant" }
hosts:                             # SSH-controllable; host must resolve into a network CIDR above
  - { host: "192.168.1.10", user: "admin", label: "my-nas" }
rfid:                              # your OWN card UIDs (emulation also gated by jurisdiction)
  - { uid: "04A1B2C3", label: "my-office-badge" }
rf:                                # RX unrestricted; TX ONLY within these bands, at/below max_erp_dbm
  rx_unrestricted: true
  tx_bands:
    - { center_hz: 433920000, bandwidth_hz: 250000, max_erp_dbm: 10, note: "433 MHz ISM (Part 15)" }
accounts:                          # read via official aggregator with YOUR creds (secrets in env, not here)
  - { id: "acct:checking", provider: "plaid", label: "primary checking" }
```

### 6.2 Validation gate (pseudocode — mirrors the real `authorize()`)

```
authorize(cmd = {verb, class, target, params}, registry, jurisdiction):
    t = parseTarget(cmd.target)         # ha: | rf: | nfc: | acct: | CIDR | IPv4
    amber = cmd.class in {sdr, flipper, camera}

    if amber and jurisdiction.amber_enabled == false:
        return DENY("AMBER disabled in jurisdiction profile")

    switch cmd.class:
      network:  # scan/profile
        if t is CIDR: return t ⊆ some registry.networks[].cidr ? ALLOW : DENY
        if t is IP:   return t ∈ some registry.networks[].cidr ? ALLOW : DENY
      host:
        if t not in any owned CIDR: return DENY
        if cmd.verb == control and t not in registry.hosts[]: return DENY   # exec needs explicit entry
        return ALLOW
      homeassistant:
        return t ∈ registry.devices where kind==homeassistant ? ALLOW : DENY
      sdr:
        if verb in {view, read}: return jurisdiction.rf.rx_allowed ? ALLOW : DENY   # RX not registry-bound
        if verb == transmit:
            if not jurisdiction.rf.tx_allowed: return DENY                  # ships false (off by default)
            band = registry.rf.tx_bands[] containing t.hz
            if not band: return DENY
            if params.power_dbm != null and params.power_dbm > band.max_erp_dbm: return DENY   # ERP cap
            return ALLOW(amber)
      flipper:
        if verb == read:    return ALLOW                                    # a card you physically hold; not registry-bound
        if verb == emulate: return (jurisdiction.rfid_emulation_allowed
                                     and t.uid ∈ registry.rfid[]) ? ALLOW(amber) : DENY
      camera:
        if not jurisdiction.camera_mic.recording_allowed: return DENY
        if t not an owned camera:                          return DENY
        if requires_confirmation and not params.confirmed: return DENY      # consent check
        return ALLOW(amber)
      finance:
        return t ∈ registry.accounts[] ? ALLOW : DENY
      default: return DENY("unknown class")                                 # deny by default
```

**Deny is the default.** Anything not matched is denied. There is no override flag.

### 6.3 Refusal behavior

For every **registry-scoped** class — `network`, `host`, `homeassistant`, `finance`, plus `flipper`
emulation and `sdr` transmit — a target not in the registry is **denied, logged, and surfaced in the
UI** (the Scope Gate panel prints `DENIED · <reason>` in red; the Audit Log records it). The adapter
is never reached — denial happens before dispatch in `command-bus.js`. No convenience path re-enables
a denied target; the only way to make such an action allowed is to add the asset to the registry, a
deliberate, auditable edit.

Two actions are intentionally **not** registry-bound because both are legal and benign regardless of
what you own: **SDR receive** (listening to spectrum injures no one) and **reading a card you
physically hold** (you need the UID before you can register it). These are gated by the jurisdiction
profile instead of the registry — RX by `rf.rx_allowed`, and neither is capable of acting on a remote
or third-party target. Every *acting* verb (transmit, emulate, control, scan) remains registry-scoped.

### 6.4 Audit — append-only, signed

Every attempt (allow / deny / error) is one JSON line in `data/audit.log`:

```
{ ts, actor, verb, class, target, result, reason, prev, signed, hash }
hash = SHA256(prev + JSON(row-without-hash))     # HMAC-SHA256 if AUDIT_KEY is set → "signed"
```

The `prev`/`hash` fields chain each entry to the one before it. Rewriting or deleting any past line
changes its hash, which breaks every subsequent link — `verifyChain()` walks the chain and reports
the first broken index. Set `AUDIT_KEY` (env) to turn the chain into an HMAC so entries are not just
tamper-evident but signed, defensible after the fact.

### 6.5 Jurisdiction profile

A single country field (`config/jurisdiction.yaml`) toggles the AMBER features. Pre-filled for the
**US**, and **conservative by default**: out of the box the rig is RX-only — no transmit, no
emulation, no camera. You turn each sensitive capability on deliberately, after verifying it against
current law for your state.

| Feature | Shipped US default | Gate effect |
| --- | --- | --- |
| `rf.rx_allowed` | `true` | Receiving/decoding your own spectrum always allowed |
| `rf.tx_allowed` | **`false`** | TX off. When enabled, allowed only if the band is in `registry.rf.tx_bands` **and** the requested `power_dbm` ≤ the band's `max_erp_dbm` |
| `rfid_emulation_allowed` | **`false`** | Emulation off. When enabled, allowed only for UIDs in `registry.rfid` |
| `camera_mic.recording_allowed` | **`false`** | Camera/mic off. When enabled, still requires an owned `kind: camera` device |
| `camera_mic.require_confirmation` | `true` | With camera on, view demands an explicit `confirmed` param (consent) |
| `amber_enabled` | `true` | Framework master switch — `false` disables **all** of sdr/flipper/camera (including RX) |

So a fresh `npm start` demonstrates the gate denying TX, emulation, and camera by default (visible in
the Scope Gate panel). Change `country` and re-verify each toggle against local law before enabling.
US Part 15 note: 902–928 MHz / 2.4 GHz are broad Part 15.247 bands, but **433.92 MHz is restricted**
(Part 15.231/15.240) — the registry ships it disabled and flagged.

---

## 7. Phased Build Sequence

Eleven milestones, dependency-ordered. A visible, clickable ctOS UI exists at **M1** and runs on your real network topology by **M3**; everything after that swaps mock adapters for live transports one class at a time. Do not reorder — each milestone's Prerequisite is the prior milestone's Checkpoint. Hardware milestones (M5, M6) are Stage B and can be skipped without breaking anything earlier: those AMBER classes keep returning mock data until the hardware exists and its live swap point is filled, and every AMBER class stays killable via the jurisdiction profile's `amber_enabled` master switch.

| # | Milestone | Depends on | Mode after | Visible result |
|---|-----------|-----------|-----------|----------------|
| 0 | Base OS + LUKS on home base | — | — | Encrypted brain boots |
| 1 | Clone, `npm install`, `npm start` | 0 | mock | Full ctOS UI, `npm run check` green |
| 2 | Fill `owned-assets.yaml` | 1 | mock | UI reflects YOUR CIDR/devices |
| 3 | Owned-network discovery | 2 | live (network) | Real hosts in Grid + Map |
| 4 | Home Assistant + token | 3 | live (+ha) | Control Panel toggles real devices |
| 5 | RTL-SDR dongle (RX-only) | 4 | live (+sdr) | Real spectrum in Waterfall |
| 6 | Flipper Zero, own cards | 2 | live (+flipper) | Your card UIDs in registry |
| 7 | Telemetry + finance aggregator | 4 | live (+finance) | Real balances/uptime in Finance |
| 8 | Registry hardening + `AUDIT_KEY` | 2 | any | Signed, tamper-evident audit chain |
| 9 | Desktop shell / kiosk rice | 1 | any | Boots straight into ctOS fullscreen |
| 10 | Hardening + remote kill-switch | 8, 9 | any | WG-only admin, remote-wipe armed |

---

### M0 — Base OS + full-disk encryption on the home base

**Objective:** A headless, always-on Linux brain whose disk is unreadable if the box is stolen. This is the root of trust for the whole rig; the registry, audit log, and API secrets all live here.

**Prerequisite:** A Tier-2 machine — mini-PC (Beelink/GMKtec N100, ~$150–180) or Raspberry Pi 5 8GB (~$80 + NVMe HAT). Ethernet to your router.

**Do it:** Install Debian 12 or Ubuntu Server 24.04. At the partitioner choose **\"Guided – use entire disk and set up encrypted LVM\"** (LUKS2). On a Pi, encrypt the root with `cryptsetup` + a `dropbear-initramfs` remote-unlock, or accept an unencrypted `/boot` and LUKS the data partition holding `~/ctos` and `data/`.

Post-install baseline:

```bash
sudo apt update && sudo apt -y full-upgrade
sudo apt -y install curl git ufw unattended-upgrades
# Node 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt -y install nodejs
sudo timedatectl set-ntp true          # audit-chain timestamps must be sane
sudo systemctl enable --now ssh
```

**Checkpoint:** Box boots, prompts for the LUKS passphrase, comes up headless on a static LAN IP. `node -v` prints `v22.x` (the app's `engines` floor is Node 20, so 22 is safely above it). `lsblk` shows a `crypt` device under your root LVM.

---

### M1 — Clone, install, run: ctOS up on mock data

**Objective:** The entire dashboard running and self-verifying, before any real hardware or credentials exist. This is your Stage-A deliverable.

**Prerequisite:** M0.

**Do it:**

```bash
git clone <your-fork-url> ~/ctos && cd ~/ctos
npm install          # express, ws, js-yaml — zero build step
npm run check        # 26-check proof: gate allow/deny, conservative AMBER defaults, ERP cap, audit-chain verify
npm start            # serves http://localhost:7050  (INTEGRATION_MODE defaults to mock)
```

Browse to `http://<home-base-ip>:7050`. Every panel renders on synthetic data: Network Map (force-directed canvas), Device Grid, Profiler, Control Panel, Spectrum Waterfall, Finance/Notifications, Live Feed, Scope Gate demo, Audit Log.

`npm run check` runs `server/selftest.js`: 28 scope-gate assertions (in-scope ALLOW, conservative AMBER-off DENY, out-of-scope DENY, and deliberately-enabled AMBER ALLOW/DENY including the ERP power cap), 20 results-confinement assertions (a missing/malformed CIDR matches nothing, scan output filtered to the authorized CIDR, ARP junk dropped), 8 sweep-range assertions (probes stay inside the owned range; no sweep when this machine is not on that network) plus one audit-chain verify — 57 checks, printed as `57 passed, 0 failed`, exit 0.

**Checkpoint:** `npm run check` prints all checks passing and the audit chain intact. The UI is live and animating on mock data. The Scope Gate panel's preset buttons fire an in-scope command (allowed) and an out-of-scope one (e.g. *scan neighbour ✗*, *emulate stranger card ✗* → DENIED + logged) with nothing owned yet — the gate authorizes against the committed example registry in demo mode.

---

### M2 — Author your owned-asset registry

**Objective:** Point the enforced scope boundary at YOUR real assets. Nothing here turns on live transport — it only defines what *would* be permitted once you do. Creating the private registry also flips the system out of demo mode (`config.demo` goes false; `/api/system` reports `stage: wired`).

**Prerequisite:** M1. Know your LAN CIDR (`ip route | grep default`), device MACs (`arp -a`), and Home Assistant entity IDs (if HA already exists).

**Do it:**

```bash
cp config/owned-assets.example.yaml config/owned-assets.yaml   # gitignored
cp config/jurisdiction.example.yaml config/jurisdiction.yaml   # gitignored, pre-filled US/FCC
$EDITOR config/owned-assets.yaml
```

Set `owner:` to your legal name (stamped into every audit entry). Replace `networks[].cidr` with your real range, list real device MACs and `ha:` entity IDs under `devices[]` (each with `kind: host` or `kind: homeassistant`), real SSH targets under `hosts[]`. Leave `rfid[]`, `rf.tx_bands`, and `accounts[]` as-is for now — later milestones fill them. Keep `jurisdiction.yaml` as the shipped US/FCC profile — it is RX-only by default (TX, emulation, and camera ship **off**). Turn a capability on only when you reach the milestone that needs it and have verified it against your state's law.

Restart: `npm start`.

**Checkpoint:** Network Map and Device Grid now render *your* CIDR and device labels (still mock reachability — transport stays mock until M3). In the Scope Gate panel, a `scan` against an IP inside your CIDR is **allowed**; the same verb against `8.8.8.8` or a neighbor's subnet is **denied** and appears in the Audit Log with your `owner` stamp.

---

### M3 — Owned-network discovery (first live adapter)

**Objective:** Replace the network adapter's mock with a real LAN sweep so the Grid and Map show hosts that are actually up. First real integration; scoped to CIDRs in your registry only.

**Prerequisite:** M2. `server/adapters/network.js` already ships a working `liveDiscover(cidr)` that calls `arp-scan --localnet --quiet`, filters every result through `inCidr()` so output cannot escape the authorized range, and returns an empty list with a loud console warning if the scanner is missing — it never falls back to fabricated hosts in live mode — network is the one live transport that is fully implemented, no swap-point coding required.

**Do it:**

```bash
sudo apt -y install arp-scan nmap
# The adapter execs arp-scan DIRECTLY (no sudo), and arp-scan needs raw sockets.
# Grant the capability on the binary — a sudoers rule would be inert here:
sudo setcap cap_net_raw+ep "$(command -v arp-scan)"
# (A NOPASSWD sudoers rule only helps if you first edit the adapter's swap point
#  to invoke `sudo arp-scan` — the shipped code does not.)

INTEGRATION_MODE=live npm start
```

The scope gate authorizes every `scan` against your owned CIDRs *before* the adapter is reached, so a CIDR you don't own can't be dispatched even by editing a request. `arp-scan --localnet` then sweeps the home-base's own LAN segment; keep the brain on your owned network.

**Checkpoint:** Device Grid populates with live MACs/IPs from your LAN; the Map redraws real topology. A discovered host that isn't in `hosts[]`/`devices[]` still shows in the Grid, but any `control` verb against it is **denied** by the gate (host control requires an explicit `hosts[]` entry; HA control requires a `devices[]` entry). Audit Log shows one `scan network` allow per sweep.

---

### M4 — Home Assistant + long-lived token → Control Panel

**Objective:** Make the Control Panel toggle real devices. This is the highest-payoff live integration — it is the visible \"ctOS controls my house\" moment. Like network, the HA live transport is fully implemented in `server/adapters/homeassistant.js` (REST `POST /api/services/<domain>/<service>` with a bearer token).

**Prerequisite:** M3. A running Home Assistant. If you don't have one:

```bash
# Container on the home base:
sudo apt -y install docker.io
sudo docker run -d --name homeassistant --restart=unless-stopped \
  --network=host -v ~/ha-config:/config ghcr.io/home-assistant/home-assistant:stable
```

**Do it:** In HA, create a **Long-Lived Access Token** (profile → Security → bottom of page). Wire the adapter via env — `homeassistant.js` reads `HA_URL` and `HA_TOKEN` and only takes the live path when `INTEGRATION_MODE=live` AND both are set:

```bash
cat >> ~/ctos/.env <<'EOF'
INTEGRATION_MODE=live
HA_URL=http://localhost:8123
HA_TOKEN=<paste-long-lived-token>
EOF
set -a && . ~/ctos/.env && set +a     # the server has no dotenv loader — source it yourself
npm start
```

Every controllable device must be listed in `devices[]` as `ha:<entity_id>` with `kind: homeassistant` (done in M2). The gate authorizes `control homeassistant` only for registered `ha:` entities.

**Checkpoint:** Control Panel shows your real HA entities; toggling `switch.office_lamp` flips the physical device. Scenes fire. A `control` against an `ha:` entity NOT in your registry is denied. Audit Log records each toggle.

---

### M5 — RTL-SDR → Spectrum Waterfall (AMBER, RX-only)

**Objective:** Feed the Waterfall with real RF you receive. **RX-only** — RTL-SDR cannot transmit. The registry `rf.tx_bands` and jurisdiction `rf.tx_allowed` govern TX only if you later add a HackRF-class radio, and never outside 433/915 MHz / 2.4 GHz ISM.

**Prerequisite:** M4. **Hardware to buy (Stage B, ~$40):** RTL-SDR Blog V4 dongle (~$40, ships with a basic antenna kit). `amber_enabled: true` and `rf.rx_allowed: true` are already set in the shipped profile.

**Do it:**

```bash
sudo apt -y install rtl-sdr soapysdr-tools
# Blacklist the DVB-T kernel driver so rtl_* can claim the dongle:
echo -e "blacklist dvb_usb_rtl28xxu\nblacklist rtl2832" | sudo tee /etc/modprobe.d/blacklist-rtl.conf
# udev rule -> non-root access:
sudo tee /etc/udev/rules.d/20-rtlsdr.rules >/dev/null <<'EOF'
SUBSYSTEM=="usb", ATTRS{idVendor}=="0bda", ATTRS{idProduct}=="2838", MODE="0660", GROUP="plugdev"
EOF
sudo udevadm control --reload-rules && sudo udevadm trigger
sudo usermod -aG plugdev "$USER"     # re-login after this
rtl_test -t                          # confirm the dongle is seen

INTEGRATION_MODE=live npm start
```

`server/adapters/sdr.js` ships with the live branch **stubbed** — `if (MODE === 'live') { /* placeholder */ }` at the marked swap point, then it falls through to the synthetic sweep. Fill that swap point to forward power-per-bin from `rtl_power`/SoapySDR for your RX-only band plan; until you do, the Waterfall keeps drawing mock data even under `INTEGRATION_MODE=live`.

**Checkpoint:** `rtl_test -t` reports the tuner with no sample loss. Once the swap point is wired, the Spectrum Waterfall scrolls **real** energy (tune to 433.92 MHz and key a keyfob you own to see the trace). A `transmit` command is denied unless its band is in `rf.tx_bands` AND `rf.tx_allowed` — and with RX-only RTL-SDR it's denied at the hardware level regardless.

---

### M6 — Flipper Zero: read your OWN cards, register their UIDs (AMBER)

**Objective:** Read RFID/NFC cards you physically own and record their UIDs in `rfid[]` so emulation of *your* cards is authorized. Emulating any card not in `rfid[]` is denied — that is the enforced \"yours only\" line, checked in `scope-gate.js`.

**Prerequisite:** M2, `rfid_emulation_allowed: true` (set). **Hardware (Stage B, ~$170):** Flipper Zero. `server/adapters/flipper.js` talks to the serial CLI, default `FLIPPER_PORT=/dev/ttyACM0`.

**Do it:** On the Flipper, read a card you own (NFC or 125 kHz → Read). Note the UID. Add it to the registry:

```yaml
# config/owned-assets.yaml
rfid:
  - uid: "04A1B2C3"      # your real read UID
    label: "my-office-badge"
```

Serial access:

```bash
sudo usermod -aG dialout "$USER"     # /dev/ttyACM0 access; re-login
# override port only if it enumerates elsewhere:
export FLIPPER_PORT=/dev/ttyACM0
INTEGRATION_MODE=live npm start
```

Like sdr.js, `flipper.js` ships with its live branch as a placeholder at the swap point (open serial to `FLIPPER_PORT`, issue `nfc read` / `rfid read`, parse the UID) — fill it to move off the mock `04A1B2C3` UID.

**Checkpoint:** Profiler/Control shows your registered card UIDs. `emulate flipper` for a UID in `rfid[]` is authorized; an unknown UID is **denied** and logged. Never register or emulate a card you don't own — the gate is the boundary, not a suggestion.

---

### M7 — Telemetry + finance aggregator → Finance/Notifications panel

**Objective:** Real infrastructure health and real (read-only) account balances. Read-only aggregation via official APIs with your own credentials — no \"steal/transfer\" mechanics exist in the codebase.

**Prerequisite:** M4. Accounts declared in `accounts[]`, hosts in `hosts[]` (M2).

**Telemetry — the panel is fed by `server/adapters/hosts.js`, whose live branch scrapes Prometheus (`node_exporter`) or SSHes a registry host:**

```bash
# Drop-in that actually feeds hosts.js: node_exporter + Prometheus.
sudo apt -y install prometheus-node-exporter prometheus
# (Optional standalone view — NOT wired into hosts.js: Uptime Kuma.)
# sudo docker run -d --restart=unless-stopped -p 3001:3001 \
#   -v uptime-kuma:/app/data --name uptime-kuma louislam/uptime-kuma:1
```

`hosts.js` ships with its live branch stubbed at the swap point (`/api/v1/query` to Prometheus, or `ssh <host>` for `uptime`/`df`/`systemctl`) — implement it there.

**Finance:** `server/adapters/finance.js` also ships with an empty live branch at the swap point; implement the aggregator call there. The code comment marks `PLAID_CLIENT_ID` / `PLAID_SECRET` / `PLAID_ACCESS_TOKEN` as the env the live path should read — secrets live in env, never in the registry. Start in **sandbox**, then flip to live:

```bash
cat >> ~/ctos/.env <<'EOF'
PLAID_CLIENT_ID=<id>
PLAID_SECRET=<sandbox-secret>
PLAID_ACCESS_TOKEN=<token-from-link-flow>
PLAID_ENV=sandbox
EOF
set -a && . ~/ctos/.env && set +a
INTEGRATION_MODE=live npm start
```

Teller / TrueLayer / GoCardless (Nordigen) are drop-in alternatives per the provider set in `accounts[].provider`. Move `PLAID_ENV` to `development`/`production` only after the sandbox panel renders correctly.

**Checkpoint:** After the swap points are wired, the Finance panel shows live (sandbox first) balances for `acct:checking`, and Notifications surfaces uptime/host-down events for hosts in `hosts[]`. A `read finance` for an account not in `accounts[]` is denied.

---

### M8 — Registry hardening + signed audit chain

**Objective:** Make the audit log cryptographically tamper-evident and lock down the files that define scope. Do this before you expose the box beyond localhost.

**Prerequisite:** M2 (registry exists). `server/audit.js` HMAC-signs the chain when `AUDIT_KEY` is set (SHA-256 hash-chain otherwise); `data/audit.log`, `config/owned-assets.yaml`, `config/jurisdiction.yaml`, `config/audit.key`, and `.env` are already gitignored.

**Do it:**

```bash
# Generate and persist a signing key (referenced via AUDIT_KEY):
openssl rand -hex 32 > ~/ctos/config/audit.key
chmod 600 ~/ctos/config/audit.key
echo "AUDIT_KEY=$(cat ~/ctos/config/audit.key)" >> ~/ctos/.env
# Tighten registry/secret perms:
chmod 600 ~/ctos/config/owned-assets.yaml ~/ctos/config/jurisdiction.yaml ~/ctos/.env
set -a && . ~/ctos/.env && set +a
npm run check        # chain now verifies under HMAC
```

**Checkpoint:** `verifyChain()` passes with signing enabled; hand-editing any line in `data/audit.log` makes the next `npm run check` **fail** at the mutated entry (`brokenAt` points to it). Registry and key files are `600`, owned by the service user.

---

### M9 — Rice into a desktop shell / kiosk

**Objective:** The rig boots straight into fullscreen ctOS — the always-on wall display and the portable thin client both. Pure presentation; changes no scope logic.

**Prerequisite:** M1 (UI runs). For the portable thin client, WireGuard/Tailscale back to the brain (set up fully in M10) so it renders the same `:7050`.

**Do it:** Run the server as a service, then a kiosk browser against it.

```bash
# Service unit for the brain:
sudo tee /etc/systemd/system/ctos.service >/dev/null <<'EOF'
[Unit]
Description=ctOS
After=network-online.target
[Service]
WorkingDirectory=/home/USER/ctos
EnvironmentFile=/home/USER/ctos/.env
ExecStart=/usr/bin/node server/index.js
Restart=always
User=USER
[Install]
WantedBy=multi-user.target
EOF
sudo systemctl enable --now ctos

# Kiosk display (Wayland/Hyprland or X/i3):
sudo apt -y install hyprland chromium plymouth plymouth-themes
# Autostart in hyprland.conf:  exec-once = chromium --kiosk --app=http://localhost:7050
sudo plymouth-set-default-theme -R spinner   # swap in a ctOS-glitch splash
```

Add a themed lock screen (`swaylock`/`hyprlock` on Wayland, `i3lock -i ctos.png` on X). Match the glitch/HUD palette to the web UI.

**Checkpoint:** Power on → Plymouth ctOS splash → Chromium `--kiosk` fills the screen with the live dashboard, no desktop chrome. The portable client shows the identical view over the tunnel.

---

### M10 — Hardening + remote kill-switch

**Objective:** Admin surface reachable only over WireGuard; brute-force blocked; a one-command remote wipe of scope-defining secrets if a device is lost. Final milestone — it depends on the signed audit (M8) and the running service (M9).

**Prerequisite:** M8, M9.

**Do it:**

```bash
# 1. WireGuard-only admin surface.
sudo apt -y install wireguard fail2ban
# server/index.js calls server.listen(PORT) with NO host arg, so it binds every
# interface (0.0.0.0) — there is no HOST env knob. Constrain reach with the
# firewall (allow :7050 only on the wg0 tunnel). For a hard localhost bind,
# edit that one line to  server.listen(PORT, '127.0.0.1', ...).
sudo ufw default deny incoming
sudo ufw allow 51820/udp            # WireGuard
sudo ufw allow in on wg0 to any port 7050
sudo ufw allow 22/tcp               # or restrict SSH to wg0 too
sudo ufw enable

# 2. fail2ban on SSH (and any exposed auth):
sudo systemctl enable --now fail2ban

# 3. Remote kill-switch. NOTE: server/config.js FALLS BACK to config/*.example.yaml
#    when the private files are absent — so wiping only the private registry would
#    restart into the EXAMPLE scope (fail OPEN). To fail CLOSED, also mask the
#    service and shred the examples so loadConfig() throws and the server won't boot.
sudo tee /usr/local/sbin/ctos-wipe >/dev/null <<'EOF'
#!/bin/bash
set -e
systemctl stop ctos
systemctl mask ctos                 # cannot be restarted into any fallback config
shred -u /home/USER/ctos/config/owned-assets.yaml \
         /home/USER/ctos/config/jurisdiction.yaml \
         /home/USER/ctos/config/audit.key \
         /home/USER/ctos/.env
# Remove the committed fallbacks too, so config.js has nothing to load:
shred -u /home/USER/ctos/config/owned-assets.example.yaml \
         /home/USER/ctos/config/jurisdiction.example.yaml
sync; echo 3 > /proc/sys/vm/drop_caches   # flush filesystem page caches
logger -t ctos "REMOTE WIPE executed"
EOF
sudo chmod 700 /usr/local/sbin/ctos-wipe
```

Trigger `ctos-wipe` over the WireGuard-only SSH channel from the portable client. With both the private and example configs gone AND the unit masked, a restart makes `loadConfig()` throw at startup — the rig refuses to run rather than falling back to example scope, so it fails **closed**. Combined with LUKS (M0), a powered-off stolen brain is already opaque; the wipe covers the running-and-lost case.

**Checkpoint:** `:7050` is unreachable from the LAN and answers only through the tunnel. `fail2ban-client status sshd` shows the jail active. Running `ctos-wipe` shreds the private registry, jurisdiction profile, `.env`, audit key, AND the example fallbacks, masks the service, and logs the event — after which the server cannot start until the encrypted config is restored and the unit unmasked.

---

## 8. Risks & Failure Points (register)

Top risks at a glance; the adversarial deep-dive is §9.

| # | Risk | Likelihood | Impact | Mitigation (built or planned) |
| --- | --- | --- | --- | --- |
| 1 | Registry lists a CIDR you don't actually control (VPN/hotel LAN looks "local") | Med | High | Gate only scans registry CIDRs; keep the registry to CIDRs you administer; audit log shows every scan target |
| 2 | Secrets (HA/aggregator tokens, SSH keys) leak from the box | Med | High | Secrets in env, never in YAML; `config/*.yaml` + `data/audit.log` gitignored; LUKS at rest; WireGuard-only admin |
| 3 | AMBER feature enabled without checking local law | Med | High | AMBER capabilities (TX, emulation, camera) ship **off** by default — enable each deliberately per verified law; jurisdiction profile flags the US 433 MHz trap; ERP power cap enforced; RTL-SDR is RX-only hardware |
| 4 | RTL-SDR won't initialize (kernel claims it as a DVB device) | High | Low | Documented udev rule + `dvb_usb_rtl28xxu` blacklist in the build sequence |
| 5 | Home Assistant cloud dependency / breaking API change | Med | Med | Use the local REST/WS API + long-lived token, not Nabu Casa cloud; pin HA version, read release notes |
| 6 | Aggregator (Plaid/Teller) rate limits or token expiry breaks the finance panel | Med | Low | Cache balances, backoff, scheduled token refresh; sandbox before production |
| 7 | Portable unit lost/stolen with live credentials | Low | High | Thin client only (no secrets on it); remote kill-switch; screen lock; the brain stays at home base |
| 8 | Audit log tampered to hide an action | Low | Med | Hash-chain + optional HMAC (`AUDIT_KEY`); `verifyChain()` in CI and on the dashboard header |
| 9 | Mock data mistaken for real state | Low | Med | Demo banner + `stage` field in `/api/system`; `demo:true` until a real registry loads |
| 10 | Scope creep over time (adding "just one" out-of-scope asset) | Med | High | Registry edits are the only path and are auditable; no override; review the registry like a firewall rule |

---

## 9. Stress-Test Findings

Every axis below assumes an attacker whose goal is to make *your own build* do something out-of-scope, unreliable, or illegal. The scope gate (`server/scope-gate.js`) and the two config files are the primary mitigations; where they *don't* cover a hole, it is called out and fixed. Findings are ranked most-dangerous-first inside each subsection.

---

### 1. SCOPE CREEP — features pointable at a non-owned target

**Conclusion: the gate is sound; the network adapter is not. There is one live scope-escape bug in the shipped code, plus two config-level traps.**

| # | Failure mode | Why it breaks | Fix |
|---|---|---|---|
| 1 | **`arp-scan --localnet` ignores the authorized CIDR** | `server/adapters/network.js` `liveDiscover()` (the `execFile` on line 42) runs `arp-scan --localnet`. The CIDR is threaded all the way in (`command-bus.js` calls `network.discover(cmd.target)` with the gate-authorized CIDR, and `discover` passes it to `liveDiscover`), but `--localnet` ignores that argument and scans whatever subnet the NIC is physically on — **not** the CIDR the gate authorized. The gate says "you may scan `192.168.1.0/24`"; the adapter scans whatever wire it's plugged into. On a matching LAN they coincide; on any other they diverge silently. | Change live transport to `arp-scan <cidr>` (or `nmap -sn <cidr>`) using the exact `cidr` argument already threaded into the function. Never use `--localnet`. Add a post-scan assertion: drop any returned IP where `ipInCidr(ip, cidr)` (exported from `scope-gate.js` via `_internals`) is false before it reaches the UI. |
| 2 | **VPN / foreign LAN collision on `192.168.1.0/24`** | The registry ships with `192.168.1.0/24` — the single most common home range on earth. Roam onto a hotel/coffee-shop/friend's network that *also* uses it, or bring up a VPN that lands you on a foreign `192.168.1.0/24`, and a `--localnet`-style scan (see #1) hits **someone else's devices that look local**. The CIDR label "home-lan" is now a lie. | Fix #1 (scan the CIDR, not the wire) is necessary but not sufficient. Additionally: bind the scan to the **home-base interface only** on the always-on brain; on the portable thin client, do **not** run discovery locally — it issues commands over WireGuard to the brain, which scans *its* owned wire. Optionally pin owned networks to a gateway MAC so a colliding subnet with a different router MAC is refused. |
| 3 | **Mistyped CIDR that is a *superset*** | Typing `192.168.0.0/16` instead of `192.168.1.0/24` would authorize 65k hosts including neighbors on an apartment `/16`. | **Already mitigated:** `cidrSubsetOf()` (enforced at `scope-gate.js` line 77) requires the scanned range to be a *subset* of an owned CIDR, and network→host targets use `ipInCidr` (line 81). A superset typo in the *command* is denied. **Residual risk:** a superset typo in the **registry itself** widens scope — the registry is trusted input. Fix: a `check` assertion that flags any registry CIDR wider than `/22` for manual confirmation. |
| 4 | **IPv6 / mDNS / IoT-cloud side channels** | The gate parses IPv4 only; a bare IPv6 target returns `unknown` from `parseTarget` and is denied, and an IPv6 CIDR falls through to `cidrSubsetOf`, which returns null and is also denied — good. But HA and IoT vendor clouds can reach devices by name over IPv6/mDNS *outside* the CIDR model entirely. | Keep IPv6 denied by default (it already is). Route all device control through the HA adapter keyed on `entity_id` in `devices[]`, never by raw IPv6. Do not add IPv6 CIDR support until a subset check equivalent to `cidrSubsetOf` exists for v6. |

**Net:** one code fix (kill `--localnet`, scan the passed CIDR, re-filter results), one deployment rule (portable client never scans; only the brain scans its own wire), one registry lint (superset CIDR warning). After these, no default and no feature can be aimed off owned space.

---

### 2. FIELD RELIABILITY — demo-vs-reality gaps

**Conclusion: everything green in `INTEGRATION_MODE=mock` will have a first-attempt failure in `live`. The dangerous ones are the *silent* fallbacks that make a broken integration look healthy.**

| Integration | What breaks going live | Fix |
|---|---|---|
| **RTL-SDR won't claim the device** | The `dvb_usb_rtl28xxu` kernel driver grabs the dongle on plug-in; `rtl_tcp`/`rtl_power` then fail with "usb_claim_interface error -6". | Blacklist it: `/etc/modprobe.d/rtl-sdr.conf` → `blacklist dvb_usb_rtl28xxu`, then a udev rule granting the SDR group access to the USB device, `usermod -aG` the service user, reboot. Document this in the Stage B runbook — it is the #1 "my waterfall is dead" cause. |
| **Silent mock fallback masks a dead radio/scan** | ~~`network.js` falls back to `mockDiscover(cidr)` on any `arp-scan` error~~ — **fixed.** `liveDiscover()` now returns an empty list and records `{ok:false, reason}`, exposed on `/api/devices` as `scan` and rendered as `SCAN UNAVAILABLE · <reason>` instead of a blank grid; the watcher skips the sweep entirely rather than recording every device as having left. `sdr.js` still returns synthetic FFT rows under `MODE=live` (the live branch is an empty placeholder that falls through to the generator). | Remaining work is `sdr.js`: give it the same `{ok:false, reason}` treatment so a dead radio is never indistinguishable from a quiet band. Fake data must never be indistinguishable from real data. |
| **arp-scan needs raw-socket privilege** | `network.js` (line 41 comment) notes `arp-scan` "requires CAP_NET_RAW or sudo." Run as an unprivileged service user, `arp-scan`/`nmap -sn` fail with a permission error — and, per the row above, the adapter then silently falls back to mock, so the map looks healthy while nothing was actually scanned. | Grant the capability, not root: `setcap cap_net_raw+ep $(command -v arp-scan)` (or run `nmap -sn <cidr>` with the same cap), and confirm the scan actually ran before trusting the map. Device/AP visibility comes **only** from arp-scan of the **owned** CIDR plus the router/HA integration for owned APs — there is deliberately **no** Wi-Fi monitor-mode / packet-capture path in the build, because monitor mode receives non-owned frames and no gate can scope it to "yours." Do not add one. |
| **HA cloud vs local API** | Nabu Casa cloud, reverse proxies, and HA's deprecated legacy `api_password` auth are all dead ends. Long-lived tokens expire/revoke; the WS API needs the local URL. | Point `HA_URL` at the **local** `http://homeassistant.local:8123` (or LAN IP), use a Long-Lived Access Token in `HA_TOKEN`, prefer the WebSocket API for state stream + REST for service calls (the adapter already POSTs `/api/services/<domain>/<service>` with a Bearer token). Keep it on-LAN so the rig works when the internet is down. |
| **Plaid/Teller rate limits + token refresh** | Sandbox works forever; **production** enforces item re-auth (banks force re-login ~90 days), webhook-driven refresh, and per-endpoint rate caps. Polling balances on a timer will 429 and then the token will silently go stale. | Cache balances, refresh on webhook not on a tight poll, implement the `ITEM_LOGIN_REQUIRED` re-auth flow, back off on 429. Treat Teller/Plaid **sandbox** creds as demo-only — production access requires an application and is gated. For Stage A, `provider: "self"` (already in the example registry as `acct:cloud-vps`) + read-only is the reliable path. |
| **Aggregator sandbox ≠ production** | Sandbox institutions and test creds do not exist in prod; the OAuth redirect URIs, product scopes, and approval state differ. A demo that works in sandbox is not evidence the prod path works. | Keep the finance adapter on mock/sandbox for Stage A and mark the swap point clearly. Do not promise live bank data until a production key is approved. |
| **Flipper firmware/CLI drift** | The serial CLI (`/dev/ttyACM0`) command surface changes across OFW/Unleashed/RogueMaster releases; a firmware bump can rename subcommands and break your parser. `/dev/ttyACM0` also isn't stable across replug. | Pin a firmware version, wrap the CLI behind a thin adapter with a version check on connect, and address the device by udev `SYMLINK` (e.g. `/dev/flipper`) not `ttyACM0` — the adapter already reads the port from `FLIPPER_PORT`, so point that at the symlink. Read-only card ops first; emulation of your own cards later. |

---

### 3. RIG SECURITY — the box is now a high-value target

**Conclusion: the moment you go `live`, the rig holds HA tokens, aggregator tokens, SSH keys, and the owned-asset map. It is now worth stealing. The portable unit is the weakest link because it can be physically lost.**

Threat: someone who steals the portable thin client, or pops the always-on brain, gets the keys to your house, your servers, and a map of your bank accounts.

| Control | Requirement | Why |
|---|---|---|
| **Encryption at rest** | LUKS full-disk on both units; the portable unit **must** be LUKS with a strong passphrase, not just a screen lock. | A lost portable client is otherwise a plaintext dump of every token and the registry. |
| **Secrets out of YAML** | Tokens/keys in environment or a secret store (systemd `LoadCredential`, `age`/`sops`-encrypted env, or a real secrets manager) — **never** in `owned-assets.yaml`. The example registry already states secrets live in env vars (`PLAID_*`, `HA_TOKEN`, `AUDIT_KEY`); enforce it. | The registry is gitignored but is designed to be human-edited and copied around; it must stay secret-free so a leaked registry leaks scope, not credentials. |
| **Network segmentation** | Put the rig on its own VLAN; reach it only over WireGuard/Tailscale. The portable client holds **no** long-lived HA/aggregator tokens — it authenticates to the brain, and the brain holds the real secrets. | Compromise of the portable unit then costs the attacker a revocable device key, not your bank tokens. |
| **Least-privilege tokens** | HA token scoped to needed entities; SSH keys per-host with `command=`/`from=` restrictions; aggregator in read-only mode. | Blast radius reduction when (not if) one token leaks. |
| **Remote wipe / revocation** | Portable unit enrolled so its WireGuard key and device token can be revoked centrally; a kill path that wipes the LUKS header. | Turns "lost device" from a breach into an inconvenience. |
| **Audit integrity** | Set `AUDIT_KEY` so `server/audit.js` HMAC-signs the hash chain; run `verifyChain()` on boot and on a timer. | Without the key the chain is only tamper-**evident** to someone who doesn't control the file; with it, forging history requires the key. |
| **Physical** | Portable unit: no auto-login, BIOS/boot password, USB data-port discipline. Brain: locked location. | The Flipper/SDR make this look like a pentest kit; treat it like one. |

---

### 4. LEGAL EXPOSURE — US / FCC specifics

**Conclusion: the registry-plus-jurisdiction gate is the correct legal mitigation and it holds for the *classes* of action. The residual risk is in the RF **power/band numbers**, which are optimistic, and in what counts as "your own" card.**

The gate already enforces the boundaries: TX only inside `registry.rf.tx_bands` **and** `jurisdiction.rf.tx_allowed` (scope-gate.js 113-122); RFID emulation only of UIDs in `registry.rfid` **and** `rfid_emulation_allowed` (128-133); camera/mic behind an explicit `params.confirmed` flag (143-146). Those are the right controls. Named residual traps:

| Trap | Detail | Fix |
|---|---|---|
| **Part 15 field-strength limits are stricter than the registry's dBm** | The registry lists `915 MHz @ 30 dBm ERP` and `433.92 MHz @ 10 dBm`. 30 dBm (1 W) at 915 MHz is only lawful for **digital/frequency-hopping** systems under §15.247; a plain continuous narrowband carrier at 915 falls under §15.249 with a field-strength cap far below that. **433.92 MHz in the US is not a general continuous-TX band** — it's governed by §15.231 (periodic control-signal operation, restricted duty cycle) / §15.240, not free-running carriers. | Treat the `max_erp_dbm` numbers as **ceilings to be re-derived per emission type**, not licenses to key up at 1 W. This is moot in Stage A / Tier 2: **RTL-SDR is RX-only**, so TX cannot physically happen. The trap goes live only if you add a HackRF in Stage B — at which point re-verify each band against the specific Part 15 subpart for your modulation before enabling TX. Add a comment in `owned-assets.yaml` distinguishing FHSS vs narrowband limits. |
| **"Own card" ≠ "authorized to clone"** | The gate confirms a UID is in `registry.rfid` (the example ships `my-office-badge` and `my-apartment-fob`). But an **employer-issued** badge or apartment fob may be the property of the employer/landlord, and cloning it can violate policy or access-control terms even though you physically hold it. | Registry membership proves possession, not authorization. Keep emulation limited to cards you truly own (hotel-style test cards, your own blanks); for employer/landlord credentials, get written authorization before adding the UID — the LOCKED scope is "own OR authorized in writing." Add an `authorization_note` field per rfid entry, mirroring how `jurisdiction.yaml` carries `consent_rule`. |
| **Audio all-party-consent states** | `jurisdiction.yaml` `consent_rule` already enumerates CA, FL, IL, PA, WA, MD, MA, MT, NH, CT, DE, OR as all-party-consent for audio, and `require_confirmation: true` forces a confirm step. | Correct as-is. Keep `require_confirmation: true`. The confirm dialog must state your state's rule, and audio (not just video) must be independently gated — verify the camera adapter doesn't enable a mic silently. |
| **FAA drones** | Not wired to the rig (`drone` block is reference-only in `jurisdiction.yaml`). Recreational flight is 49 USC 44809; >250 g requires registration; commercial is Part 107. | Keep drones out of the automated command path in Stage A. If ever integrated, gate on registration number the same way RF gates on band. |

**The mitigation to state plainly:** the owned-asset registry + jurisdiction profile is what converts "this could be illegal" into "this is denied and logged unless it's provably yours and provably in a permitted band/state." That is the legal architecture; the traps above are parameter-tuning within it, not holes in it.

---

### 5. COST / EFFORT vs a Stage-A user at Tier 2 (~$300–500)

**Conclusion: the full UI on mock data is a first-weekend deliverable — it already runs with `npm install && npm start`. Live hardware integration is a first-month effort, and Tier 2 buys RX + NFC, not TX.**

**Realistic Tier 2 bill of materials (~$300–500):**

| Item | ~Price | Role |
|---|---|---|
| Raspberry Pi 5 (8 GB) + PSU + NVMe hat/SSD | ~$120 | Always-on brain |
| RTL-SDR Blog V4 + antenna kit | ~$40 | RX spectrum (RX-only, legal everywhere) |
| Flipper Zero | ~$169 | Own-card RFID/NFC read + emulate |
| Used mini-PC or second Pi Zero 2 W / phone browser | ~$0–80 | Portable thin client |
| Misc (microSD/boot media, cables, connectors) | ~$30 | — |

That lands inside Tier 2. **HackRF (TX-capable, ~$150+) is Tier 3** — do not recommend it at Stage A; the gate keeps TX dormant anyway, and RTL-SDR cannot transmit regardless.

| Horizon | Realistic outcome |
|---|---|
| **First weekend** | Clone repo, `npm install && npm start`, full ctOS UI live on **mock** data at `localhost:7050`. Fill in `owned-assets.yaml` and `jurisdiction.yaml`. Run `npm run check` and watch all **57** checks pass — in-scope ALLOW, conservative AMBER-off DENY, out-of-scope DENY, deliberately-enabled AMBER ALLOW/DENY, plus the audit-chain verify (the harness prints "57 passed"). Stand up the Pi as the brain, WireGuard/Tailscale to a phone browser as the thin client. Zero hardware integration — pure aesthetic/simulation Stage A, fully working. |
| **First month** | One integration per weekend, in ascending pain order: (1) **network** live (`arp-scan <cidr>` on the brain — after the `--localnet` fix and the `cap_net_raw` grant); (2) **HA** live via local token; (3) **RTL-SDR** RX (the udev/blacklist fight is the real time sink); (4) **Flipper** read-then-emulate of own cards; (5) **finance** on `provider:self` / sandbox. Do **not** expect production bank data or any TX in month one. |

Effort reality: the code is done. The month is spent on **drivers, tokens, and udev rules**, not application logic. Budget the RTL-SDR blacklist/udev step and the HA token step as the two things most likely to eat an evening each.

---

### 6. MAINTENANCE — what rots, and the upkeep cadence

**Conclusion: the mock/simulation core is stable and won't rot; every *live* integration is on someone else's release train and will break on their schedule, not yours. Budget ~1–2 hrs/month steady-state, with two hard annual events (aggregator re-auth, cert/token expiry).**

| Component | Rot mode | Cadence / mitigation |
|---|---|---|
| **Home Assistant** | Monthly breaking releases; auth flows, WS API shapes, and entity IDs change. Auto-updating HA will eventually break the adapter. | Pin HA, read release notes before upgrading, keep the adapter behind a thin interface. **Cadence: monthly** review, upgrade deliberately. |
| **Aggregator APIs (Plaid/Teller/TrueLayer/GoCardless-Nordigen)** | Endpoint/version deprecations; **bank-forced re-auth ~every 90 days** (`ITEM_LOGIN_REQUIRED`); GoCardless/Nordigen consent expiry. | Implement the re-auth webhook flow now, not later. **Cadence: quarterly** forced re-consent + watch deprecation emails. |
| **RTL / SoapySDR drivers** | Kernel updates can re-introduce the `dvb_usb_rtl28xxu` claim or move udev behavior; `librtlsdr` V3/V4 differences. | Keep the blacklist/udev files in version control; re-verify after any kernel upgrade. **Cadence: after every OS kernel bump.** |
| **Flipper firmware** | CLI command surface drifts across OFW/Unleashed/RogueMaster; `ttyACM` enumeration changes. | Pin firmware, version-check on connect, udev symlink via `FLIPPER_PORT`. **Cadence: only upgrade firmware deliberately, then re-test the adapter.** |
| **Certs / tokens / keys** | HA long-lived token revocation, WireGuard key rotation, TLS certs, SSH key expiry. Silent expiry = silent dead panel. | Track expiry dates; rotate on a schedule; alert before expiry. **Cadence: WireGuard/SSH keys rotated ~annually; watch token validity.** |
| **Node / deps** | `express`/`ws`/`js-yaml` security advisories. | `npm audit` and dependency review. **Cadence: quarterly**, or on advisory. |
| **The gate + audit core** | Does **not** rot — pure logic, no external API. This is by design: the legal boundary has no upstream that can deprecate it. | Re-run `npm run check` (65 checks: gate assertions, results confinement, sweep range, voice-vocab confinement, + the audit-chain verify) after **any** change to adapters or config. It is the regression net; keep it green. |

**Standing rule:** treat `npm run check` as the pre-flight for every maintenance touch. The self-test proving the gate ALLOWS in-scope and DENIES out-of-scope is the one thing that must never go red — if a dependency bump or refactor breaks it, stop and fix the gate before anything else ships.

---

## 10. Final Refined Version

This is the version to act on. It is the Stage-A system already in this repository, hardened by the
adversarial stress test. **Struck (RED) mechanics stay struck** — they are absent from the code and
cannot be enabled.

**What you have.** A runnable ctOS command dashboard (`npm install && npm start`, `localhost:7050`)
whose every action is a `{verb, class, target, params}` command routed through
`authorize()` → `record()` → adapter. In Stage A every adapter returns mock data; wiring real
hardware is `INTEGRATION_MODE=live` + a filled registry, not a rewrite. The scope gate, audit chain,
and 26-check proof are real and run today. Recommended hardware path: **Tier 2 (~$300–500)** — Pi 5
home base + RTL-SDR (RX) + Flipper (own cards) + a Zigbee/Matter coordinator + a few owned smart
devices, with a phone browser over WireGuard/Tailscale as the portable thin client (the "Both" form
factor at $0 extra).

**Changes forced by the stress test (all applied):**

1. **Conservative-by-default jurisdiction profile.** TX, RFID/NFC emulation, and camera/mic now ship
   **off**. A fresh boot is RX-only and demonstrates the gate *denying* those actions. Enable each
   deliberately, per verified state law. (Was: everything on — a permissive default the docs wrongly
   called conservative.)
2. **ERP power cap enforced.** An `sdr transmit` carrying `power_dbm` above the band's `max_erp_dbm`
   is denied. The claimed legal guarantee is now code, not a comment.
3. **433 MHz correctly flagged.** The registry and profile mark 433.92 MHz as US-restricted (Part
   15.231/15.240), distinct from the broad 902–928 MHz / 2.4 GHz Part 15.247 bands, and ship it
   disabled.
4. **Honest scoping.** Docs now state precisely what is registry-bound (all *acting* verbs) versus
   jurisdiction-bound (SDR receive; reading a card in your hand) — no over-claim that "nothing runs
   without a registry entry."
5. **No RF packet-capture surface.** Wi-Fi monitor mode / injection and any "sniff nearby networks"
   framing were removed from the architecture, BOM, and build sequence — there is no scope-gate class
   for promiscuous RF capture, and it cannot be fenced to "yours," so it is not provisioned. Owned-CIDR
   active discovery (`arp-scan`/`nmap`) is what the network adapter actually does and what the gate
   authorizes.
6. **Fail-closed wipe.** The remote kill-switch shreds the private *and* example configs and masks the
   service, so a wiped rig refuses to boot rather than silently falling back to the example (demo)
   scope.

**The invariants — keep these true or the project loses its point:**

- Deny is the default; the only way to authorize an *acting* verb is a deliberate registry edit.
- Every attempt is written to the append-only, hash-chained (optionally HMAC-signed) audit log.
- `npm run check` stays green (CI gates it). If a change reddens it, fix the gate before shipping.
- No exploit code, third-party attack, or non-consensual capture ever enters the tree. RED stays RED.

## 11. One-Page Quick-Start

**Goal:** ctOS UI live on your own network in an afternoon; hardware later. Jurisdiction US/FCC,
Tier 2, "Both" form factor.

### Today — the aesthetic system, zero hardware (Milestones 0–1)

```bash
git clone <this repo> ctos && cd ctos
npm install
npm run check          # 65 checks: gate allow/deny, AMBER defaults, ERP cap, results confinement, sweep range, voice vocab, audit chain
npm start              # → http://localhost:7050
```

You now have the full ctOS HUD on mock data: Network Map, Device Grid, Profiler, Control Panel,
RX-only Spectrum Waterfall, Finance feed, Live Feed, a live Scope-Gate demo, and the Audit Log. Press
the red buttons in the Scope Gate panel — they come back **DENIED** and hit the audit log.

### This week — make it yours (Milestones 2–4)

```bash
cp config/owned-assets.example.yaml config/owned-assets.yaml   # gitignored
cp config/jurisdiction.example.yaml  config/jurisdiction.yaml  # gitignored, US/FCC, RX-only default
# Edit owned-assets.yaml: set owner, your real networks[].cidr, device MACs / ha: entity IDs, hosts[].
export AUDIT_KEY="$(head -c32 /dev/urandom | base64)"          # sign the audit chain
INTEGRATION_MODE=live npm start
```

- **Real network discovery:** grant capture to arp-scan (`sudo setcap cap_net_raw+ep $(command -v arp-scan)`); the Device Grid + Map now show your real LAN. *(Gate scans only registry CIDRs.)*
- **Home Assistant control:** install HA, mint a long-lived token, set `HA_URL`/`HA_TOKEN`; Control Panel toggles real owned entities.

### Stage B — Tier-2 hardware (Milestones 5–7, ~$300–500)

| Buy | Unlocks | Turn on |
| --- | --- | --- |
| RTL-SDR Blog V4 (~$40) | real Spectrum Waterfall (**RX-only**) | udev rule + blacklist `dvb_usb_rtl28xxu`; `rf.rx_allowed` already true |
| Flipper Zero (~$169) | read **your own** cards → register UIDs; then emulate | set `rfid_emulation_allowed: true` **only** for cards in `registry.rfid[]` |
| Pi 5 8GB + NVMe + cooler (~$150) | always-on home base | LUKS full-disk encryption |
| Zigbee/Matter coordinator (~$30) + a few owned devices | more of the Control Panel | add each to `registry.devices[]` |

Portable unit = your phone browser over WireGuard/Tailscale to the Pi. No separate computer needed.

### Hardening before it holds real keys (Milestones 8–10)

- Secrets in env, never in YAML. `config/*.yaml` + `data/audit.log` are gitignored.
- Bind admin to WireGuard only; `ufw` default-deny; `fail2ban` on SSH.
- `AUDIT_KEY` set → signed audit chain; re-run `npm run check` after any change.
- Remote kill-switch shreds the private **and** example configs so a wiped rig refuses to boot.

**Enable an AMBER capability only after you have confirmed it against current law for your state.**
Everything RED (steal-money, drain-bank, mass-hack strangers, public-infra/traffic control,
police/gang dispatch, signal jammer, covert third-party cameras) is struck and cannot be enabled.
