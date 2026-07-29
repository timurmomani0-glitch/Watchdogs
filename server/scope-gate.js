// ─────────────────────────────────────────────────────────────────────────────
// SCOPE GATE — the enforced legal boundary.
//
// Every command passes through authorize() BEFORE any adapter runs. A command
// whose target is not present in the owned-asset registry is DENIED. AMBER
// classes (RF transmit, RFID emulation, camera/mic) require the jurisdiction
// profile to permit them as well. Deny is the default; there is no override.
// ─────────────────────────────────────────────────────────────────────────────

// --- IPv4 CIDR helpers (IPv6 targets are denied until explicitly supported) ---
function ipToInt(ip) {
  const p = ip.split('.');
  if (p.length !== 4) return null;
  let n = 0;
  for (const o of p) {
    const v = Number(o);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = (n << 8) + v;
  }
  return n >>> 0;
}

function cidrRange(cidr) {
  const [ip, bitsRaw] = cidr.split('/');
  const bits = Number(bitsRaw);
  const base = ipToInt(ip);
  if (base === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return null;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return { lo: (base & mask) >>> 0, hi: (base | (~mask >>> 0)) >>> 0 };
}

function ipInCidr(ip, cidr) {
  const n = ipToInt(ip);
  const r = cidrRange(cidr);
  return n !== null && r !== null && n >= r.lo && n <= r.hi;
}

function cidrSubsetOf(inner, outer) {
  const a = cidrRange(inner);
  const b = cidrRange(outer);
  return a && b && a.lo >= b.lo && a.hi <= b.hi;
}

// --- Target parsing: "ha:switch.x" | "rf:433920000" | "nfc:04AB" | "acct:x"
//     | "192.168.1.0/24" | "192.168.1.10" -------------------------------------
export function parseTarget(target) {
  if (typeof target !== 'string') return { kind: 'invalid', value: target };
  if (target.startsWith('ha:')) return { kind: 'homeassistant', value: target };
  if (target.startsWith('rf:')) return { kind: 'rf', value: Number(target.slice(3)) };
  if (target.startsWith('nfc:') || target.startsWith('rfid:'))
    return { kind: 'card', value: target.split(':')[1]?.toUpperCase() };
  if (target.startsWith('acct:')) return { kind: 'account', value: target };
  if (target.includes('/')) return { kind: 'network', value: target };
  if (ipToInt(target) !== null) return { kind: 'host', value: target };
  return { kind: 'unknown', value: target };
}

const AMBER_CLASSES = new Set(['sdr', 'flipper', 'camera']);

function deny(reason) { return { allowed: false, amber: false, reason }; }
function allow(amber = false) { return { allowed: true, amber, reason: null }; }

// cmd: { verb, class, target, params }
export function authorize(cmd, config) {
  const { registry, jurisdiction } = config;
  const t = parseTarget(cmd.target);
  const amber = AMBER_CLASSES.has(cmd.class);

  // Global AMBER kill-switch.
  if (amber && jurisdiction.amber_enabled === false) {
    return deny(`AMBER disabled in jurisdiction profile (${jurisdiction.country})`);
  }

  switch (cmd.class) {
    case 'network': {
      if (t.kind === 'network') {
        const ok = (registry.networks || []).some((n) => cidrSubsetOf(t.value, n.cidr));
        return ok ? allow() : deny(`network ${t.value} is not a subset of any owned CIDR`);
      }
      if (t.kind === 'host') {
        const ok = (registry.networks || []).some((n) => ipInCidr(t.value, n.cidr));
        return ok ? allow() : deny(`host ${t.value} is outside every owned CIDR`);
      }
      return deny(`network class requires a CIDR or IP target, got ${t.kind}`);
    }

    case 'host': {
      if (t.kind !== 'host') return deny(`host class requires an IP target, got ${t.kind}`);
      const inNet = (registry.networks || []).some((n) => ipInCidr(t.value, n.cidr));
      if (!inNet) return deny(`host ${t.value} is outside every owned CIDR`);
      // Control (exec) requires an explicit hosts[] entry; read/view only needs the CIDR.
      if (cmd.verb === 'control') {
        const listed = (registry.hosts || []).some((h) => h.host === t.value);
        if (!listed) return deny(`host ${t.value} not in hosts[] — control requires explicit entry`);
      }
      return allow();
    }

    case 'homeassistant': {
      if (t.kind !== 'homeassistant') return deny(`expected ha: target, got ${t.kind}`);
      const ok = (registry.devices || []).some(
        (d) => d.id === t.value && d.kind === 'homeassistant'
      );
      return ok ? allow() : deny(`${t.value} not in owned devices registry`);
    }

    case 'sdr': {
      // RX (view/read) is unrestricted where the profile allows listening.
      if (cmd.verb === 'view' || cmd.verb === 'read') {
        return jurisdiction.rf?.rx_allowed ? allow(false)
          : deny('RX not permitted by jurisdiction profile');
      }
      if (cmd.verb === 'transmit') {
        if (!jurisdiction.rf?.tx_allowed) return deny('RF transmit not permitted in this jurisdiction');
        if (t.kind !== 'rf') return deny('transmit requires an rf:<hz> target');
        const band = (registry.rf?.tx_bands || []).find((b) => {
          const half = (b.bandwidth_hz || 0) / 2;
          return t.value >= b.center_hz - half && t.value <= b.center_hz + half;
        });
        if (!band) return deny(`${t.value} Hz outside every permitted TX band in the registry`);
        // Enforce the declared power against the band's ERP cap. Final ERP still
        // depends on the radio's gain setting; this gates the requested power.
        const req = cmd.params?.power_dbm;
        if (req != null && req > band.max_erp_dbm) {
          return deny(`requested ${req} dBm exceeds band cap ${band.max_erp_dbm} dBm`);
        }
        return allow(true);
      }
      return deny(`unsupported sdr verb ${cmd.verb}`);
    }

    case 'flipper': {
      if (cmd.verb === 'read') return allow(false); // reading your own card is benign
      if (cmd.verb === 'emulate') {
        if (!jurisdiction.rfid_emulation_allowed) return deny('RFID/NFC emulation not permitted here');
        if (t.kind !== 'card') return deny('emulate requires an nfc:<uid> target');
        const ok = (registry.rfid || []).some((c) => c.uid.toUpperCase() === t.value);
        return ok ? allow(true) : deny(`card ${t.value} not in owned rfid registry`);
      }
      return deny(`unsupported flipper verb ${cmd.verb}`);
    }

    case 'camera': {
      if (!jurisdiction.camera_mic?.recording_allowed) return deny('camera/mic disabled in profile');
      const owned = (registry.devices || []).some(
        (d) => d.id === t.value && d.kind === 'camera'
      );
      if (!owned) return deny(`${cmd.target} not an owned camera`);
      if (jurisdiction.camera_mic?.require_confirmation && !cmd.params?.confirmed) {
        return deny('camera/mic view requires explicit confirmation (consent check)');
      }
      return allow(true);
    }

    case 'finance': {
      if (t.kind !== 'account') return deny(`finance requires an acct: target, got ${t.kind}`);
      const ok = (registry.accounts || []).some((a) => a.id === t.value);
      return ok ? allow() : deny(`${t.value} not in owned accounts registry`);
    }

    default:
      return deny(`unknown command class "${cmd.class}"`);
  }
}

export const _internals = { ipToInt, ipInCidr, cidrSubsetOf };
