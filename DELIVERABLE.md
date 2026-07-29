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

<!-- WORKFLOW:capability-map -->

---

## 3. Beyond-Game Feature List

<!-- WORKFLOW:beyond-game -->

---

## 4. System Architecture

<!-- WORKFLOW:architecture -->

---

## 5. Bill of Materials (tiered)

<!-- WORKFLOW:bom -->

---

## 6. Authorization Model — the self-enforcing scope gate

This is the mechanism that makes the system **refuse out-of-scope action automatically.** It is fully
implemented in [`server/scope-gate.js`](server/scope-gate.js), [`server/audit.js`](server/audit.js),
and [`server/command-bus.js`](server/command-bus.js), and proven by
[`server/selftest.js`](server/selftest.js) (`npm run check`, 18 assertions).

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
        if verb in {view, read}: return jurisdiction.rf.rx_allowed ? ALLOW : DENY   # RX unrestricted
        if verb == transmit:
            return (jurisdiction.rf.tx_allowed
                    and t.hz within some registry.rf.tx_bands[]) ? ALLOW(amber) : DENY
      flipper:
        if verb == read:    return ALLOW                                    # reading your own card is benign
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

A target not in the registry is **denied, logged, and surfaced in the UI** (the Scope Gate panel
prints `DENIED · <reason>` in red; the Audit Log records it). The adapter is never reached — denial
happens before dispatch in `command-bus.js`. No convenience path re-enables a denied target; the only
way to make an action allowed is to add the asset to the registry, which is a deliberate, auditable
edit.

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
**US**:

| Feature | US default | Gate effect |
| --- | --- | --- |
| `rf.rx_allowed` | `true` | Receiving/decoding your own spectrum always allowed |
| `rf.tx_allowed` | `true` (Part 15 ISM only) | TX allowed only if the band is also in `registry.rf.tx_bands` |
| `rfid_emulation_allowed` | `true` | Emulation allowed only for UIDs in `registry.rfid` |
| `camera_mic.require_confirmation` | `true` | Camera/mic view demands an explicit `confirmed` param (consent) |
| `amber_enabled` | `true` | Master switch — `false` disables **all** AMBER features regardless of the above |

Change `country` and re-verify the toggles against local law before enabling any AMBER feature.

---

## 7. Phased Build Sequence

<!-- WORKFLOW:build-sequence -->

---

## 8. Risks & Failure Points (register)

Top risks at a glance; the adversarial deep-dive is §9.

| # | Risk | Likelihood | Impact | Mitigation (built or planned) |
| --- | --- | --- | --- | --- |
| 1 | Registry lists a CIDR you don't actually control (VPN/hotel LAN looks "local") | Med | High | Gate only scans registry CIDRs; keep the registry to CIDRs you administer; audit log shows every scan target |
| 2 | Secrets (HA/aggregator tokens, SSH keys) leak from the box | Med | High | Secrets in env, never in YAML; `config/*.yaml` + `data/audit.log` gitignored; LUKS at rest; WireGuard-only admin |
| 3 | AMBER feature enabled without checking local law | Med | High | `amber_enabled` master switch defaults conservative; jurisdiction profile documents the US traps; RTL-SDR is RX-only hardware |
| 4 | RTL-SDR won't initialize (kernel claims it as a DVB device) | High | Low | Documented udev rule + `dvb_usb_rtl28xxu` blacklist in the build sequence |
| 5 | Home Assistant cloud dependency / breaking API change | Med | Med | Use the local REST/WS API + long-lived token, not Nabu Casa cloud; pin HA version, read release notes |
| 6 | Aggregator (Plaid/Teller) rate limits or token expiry breaks the finance panel | Med | Low | Cache balances, backoff, scheduled token refresh; sandbox before production |
| 7 | Portable unit lost/stolen with live credentials | Low | High | Thin client only (no secrets on it); remote kill-switch; screen lock; the brain stays at home base |
| 8 | Audit log tampered to hide an action | Low | Med | Hash-chain + optional HMAC (`AUDIT_KEY`); `verifyChain()` in CI and on the dashboard header |
| 9 | Mock data mistaken for real state | Low | Med | Demo banner + `stage` field in `/api/system`; `demo:true` until a real registry loads |
| 10 | Scope creep over time (adding "just one" out-of-scope asset) | Med | High | Registry edits are the only path and are auditable; no override; review the registry like a firewall rule |

---

## 9. Stress-Test Findings

<!-- WORKFLOW:stress-test -->

---

## 10. Final Refined Version

<!-- ASSEMBLE:final -->

---

## 11. One-Page Quick-Start

<!-- ASSEMBLE:quickstart -->
