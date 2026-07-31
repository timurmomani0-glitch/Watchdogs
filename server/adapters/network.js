// Owned-network discovery → feeds the Device Grid and Network Map.
//
// LIVE (INTEGRATION_MODE=live): sweep a CIDR the scope gate has already
// authorized. Two guarantees hold on that path:
//   1. Results are filtered through inCidr() — authorizing a target is
//      meaningless if the output can come from a network you never registered.
//   2. Nothing is ever fabricated. If the scanner is missing or fails, live
//      discovery returns an empty list and says so; it does not fall back to
//      mock hosts, which would poison the sighting store and fire intrusion
//      alerts for devices that do not exist.
import { execFile } from 'node:child_process';
import os from 'node:os';

const MODE = process.env.INTEGRATION_MODE || 'mock';

const VENDORS = ['Raspberry Pi', 'Ubiquiti', 'Espressif', 'Shelly', 'Synology', 'Apple', 'Intel', 'Sonoff'];
const KINDS = ['host', 'iot', 'camera', 'sensor', 'phone', 'ap'];

function fakeMac(seed) {
  const h = (n) => (((seed * 2654435761) >>> (n * 4)) & 0xff).toString(16).padStart(2, '0');
  return [h(0), h(1), h(2), h(3), h(4), h(5)].join(':');
}

function mockDiscover(cidr = '192.168.1.0/24') {
  const base = cidr.split('/')[0].split('.').slice(0, 3).join('.');
  const count = 9;
  const hosts = [];
  for (let i = 0; i < count; i++) {
    const seed = i + 3;
    hosts.push({
      ip: `${base}.${10 + i}`,
      mac: fakeMac(seed),
      hostname: `node-${(10 + i).toString(16)}`,
      vendor: VENDORS[seed % VENDORS.length],
      kind: KINDS[seed % KINDS.length],
      openPorts: [22, 80, 443, 8123, 554].filter((_, k) => (seed >> k) & 1),
      lastSeen: 'now',
      online: seed % 7 !== 0,
    });
  }
  return hosts;
}

export function parseArpScan(stdout) {
  // Linux `arp-scan --localnet`: "192.168.1.10  aa:bb:cc:dd:ee:ff  Vendor"
  return stdout.split('\n')
    .map((l) => l.match(/^(\d+\.\d+\.\d+\.\d+)\s+([0-9a-f:]{17})\s+(.*)$/i))
    .filter(Boolean)
    .map((m) => ({ ip: m[1], mac: m[2].toLowerCase(), vendor: m[3].trim(), kind: 'host', online: true }))
    .filter((h) => !isBogusArp(h.ip, h.mac));
}

function isBogusArp(ip, mac) {
  if (mac === 'ff:ff:ff:ff:ff:ff' || mac === '00:00:00:00:00:00') return true; // broadcast / invalid
  if (mac.startsWith('01:00:5e') || mac.startsWith('33:33')) return true;       // IPv4 / IPv6 multicast
  const o = ip.split('.').map(Number);
  return o[0] >= 224 || ip.endsWith('.255') || ip === '255.255.255.255';        // multicast / broadcast IPs
}

export function parseWindowsArp(stdout) {
  // Windows `arp -a`: "  192.168.1.10   aa-bb-cc-dd-ee-ff   dynamic". Match on
  // IP + MAC ONLY — the trailing Type column ("dynamic"/"static") is localized
  // (e.g. Russian/CJK) and must not be part of the match. `arp -a` is IPv4-only
  // (ARP has no IPv6); IPv6 neighbours are not discovered on this path. The ARP
  // cache also holds multicast/broadcast entries, which isBogusArp drops.
  return stdout.split('\n')
    .map((l) => l.match(/^\s*(\d+\.\d+\.\d+\.\d+)\s+([0-9a-f]{2}(?:-[0-9a-f]{2}){5})/i))
    .filter(Boolean)
    .map((m) => ({ ip: m[1], mac: m[2].replace(/-/g, ':').toLowerCase(), vendor: '', kind: 'host', online: true }))
    .filter((h) => !isBogusArp(h.ip, h.mac));
}

// ── CIDR containment ────────────────────────────────────────────────────────
// Results MUST be confined to the CIDR the gate authorized. `arp -a` dumps the
// whole ARP cache across every interface, so without this a scan of your LAN
// could return hosts from an unrelated network (a phone hotspot, a VPN, a
// second NIC) that you never registered. Authorizing a target is meaningless if
// the results can come from somewhere else.
//
// Everything here fails CLOSED. A missing, empty or malformed CIDR matches
// NOTHING rather than everything — the state where the operator has registered
// no network is exactly the state where the scope gate denies every command,
// so it must not be the state where the adapter hands back the whole LAN.
function ipToInt(ip) {
  const p = String(ip).split('.');
  if (p.length !== 4) return null;
  let n = 0;
  for (const o of p) {
    // No leading zeros: "010" is 8 to a C resolver and 10 to Number(), and a
    // scope filter that disagrees with the OS about which host an address means
    // is a hole. Reject the ambiguity outright.
    if (!/^(0|[1-9]\d{0,2})$/.test(o)) return null;
    const v = Number(o);
    if (v > 255) return null;
    n = (n << 8) + v;
  }
  return n >>> 0;
}

// Parse a CIDR into {base, bits, mask, first, last} — or null if it is not a
// well-formed range. `base` is masked to the true network address, so a
// registry entry written as the operator's own address ("192.168.1.5/24",
// which is how ipconfig and `ip -o -4 addr` print it) does not shift the range
// off the end of the subnet.
export function parseCidr(cidr) {
  if (!cidr) return null;
  const parts = String(cidr).split('/');
  if (parts.length !== 2) return null;
  const [net, bitsRaw] = parts;
  if (!/^\d{1,2}$/.test(bitsRaw)) return null;   // rejects "", "1e1", "-1", "033"
  const bits = Number(bitsRaw);
  if (bits > 32) return null;                     // rejects /33 (the shift wraps to /1)
  const addr = ipToInt(net);
  if (addr === null) return null;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  const base = (addr & mask) >>> 0;
  return { base, bits, mask, first: base, last: (base | (~mask >>> 0)) >>> 0 };
}

export function inCidr(ip, cidr) {
  const r = parseCidr(cidr);
  if (!r) return false;                           // fail closed
  const a = ipToInt(ip);
  if (a === null) return false;
  return ((a & r.mask) >>> 0) === r.base;
}

// Is this machine actually ON the network it is about to scan?
//
// Without this check a laptop registered to 192.168.1.0/24 that wakes up on
// café Wi-Fi still runs a discovery sweep — and on Linux `arp-scan --localnet`
// would enumerate the café's hosts. The result filter then drops every one of
// them, so the operator sees an empty grid and never learns their machine
// spent the afternoon ARP-scanning a network they do not own. Filtering the
// output cannot un-send the packets; the sweep itself has to be refused.
export function localAddressIn(cidr) {
  const ifaces = os.networkInterfaces();
  for (const [name, addrs] of Object.entries(ifaces || {})) {
    for (const a of addrs || []) {
      const fam = a.family === 'IPv4' || a.family === 4;
      if (fam && !a.internal && inCidr(a.address, cidr)) return { iface: name, address: a.address };
    }
  }
  return null;
}

// Active sweep: `arp -a` only reports hosts Windows has recently talked to, so a
// quiet LAN looks empty. Pinging the range first populates the ARP cache, which
// turns a passive cache dump into an actual discovery scan. Bounded concurrency
// keeps it from spawning hundreds of processes.
function primeArpCache(cidr, budgetMs = 9000) {
  return new Promise((resolve) => {
    const r = parseCidr(cidr);
    if (!r) return resolve();
    if (r.bits < 22) {
      console.warn(`network: ${cidr} is too large to sweep — falling back to the passive ARP cache.`);
      return resolve();
    }
    // Every target is derived from the MASKED base and clamped to `last`, so a
    // sweep can never walk past the end of the authorized range into a
    // neighbouring subnet.
    const usable = Math.max(0, r.last - r.first - 1);
    const count = Math.min(254, usable);
    // No silent truncation: say so when the sweep does not cover the whole range.
    if (count < usable) console.warn(`network: sweeping the first ${count} of ${usable} addresses in ${cidr}.`);
    const targets = [];
    for (let i = 1; i <= count; i++) {
      const n = (r.base + i) >>> 0;
      if (n >= r.last) break;                       // never touch or pass the broadcast address
      targets.push(intToIp(n));
    }

    const win = process.platform === 'win32';
    let idx = 0, active = 0, done = false;
    const deadline = setTimeout(() => { done = true; resolve(); }, budgetMs);
    const CONC = 24;

    const next = () => {
      if (done) return;
      if (idx >= targets.length && active === 0) { clearTimeout(deadline); done = true; return resolve(); }
      while (active < CONC && idx < targets.length) {
        const ip = targets[idx++];
        active++;
        const args = win ? ['-n', '1', '-w', '250', ip] : ['-c', '1', '-W', '1', ip];
        execFile('ping', args, { timeout: 2000, windowsHide: true }, () => {
          active--;
          next();
        });
      }
    };
    next();
  });
}
export function intToIp(n) {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
}

// Last discovery outcome, so callers can tell "the LAN is quiet" apart from
// "the scanner is broken". An empty array meant both before, which made a
// failed sweep look like every device leaving at once.
let lastStatus = { ok: true, reason: null, at: null };
export function status() { return { ...lastStatus, mode: MODE }; }

function fail(reason, { quiet = false } = {}) {
  const changed = lastStatus.ok || lastStatus.reason !== reason;
  lastStatus = { ok: false, reason, at: new Date().toISOString() };
  // Warn on every transition into a new failure, not once per process — a
  // permanent latch hides a scanner that breaks hours into a run.
  if (changed && !quiet) console.error(`network: ${reason}`);
  return [];
}

// Short cache so the Device Grid and a profiler card opened right after it
// share one sweep instead of each spawning their own 254-address ping run.
let cache = { cidr: null, at: 0, hosts: [] };
const CACHE_MS = Number(process.env.CTOS_DISCOVER_CACHE_MS || 5000);

async function liveDiscover(cidr) {
  const r = parseCidr(cidr);
  if (!r) return fail(`no valid owned network to scan (got ${JSON.stringify(cidr)}) — run: npm run setup`);

  // Refuse to sweep a network this machine is not attached to. See the note
  // above localAddressIn(): filtering results cannot un-send probe packets.
  const local = localAddressIn(cidr);
  if (!local) {
    return fail(`this machine has no address in ${cidr} — not scanning. ` +
      'Connect to your registered network, or register the one you are on.');
  }

  const now = Date.now();
  if (cache.cidr === cidr && now - cache.at < CACHE_MS) return cache.hosts;

  const win = process.platform === 'win32';
  // Windows has no active scanner built in — prime the cache ourselves first.
  if (win) await primeArpCache(cidr);
  return new Promise((resolve) => {
    const cmd = win ? 'arp' : 'arp-scan';
    // Linux: scan the AUTHORIZED range explicitly. `--localnet` derives its
    // target from the interface, which is a different thing entirely the
    // moment those two disagree.
    const args = win ? ['-a'] : ['--interface', local.iface, '--quiet', '--ignoredups', cidr];
    execFile(cmd, args, { timeout: 15000, windowsHide: true }, (err, stdout) => {
      if (err) {
        // Fail loud, never fabricate. Returning mock hosts here would put nine
        // invented MACs into the sighting store and fire "unregistered device"
        // alerts for devices that do not exist.
        return resolve(fail(`live discovery failed (${cmd}: ${err.message.trim()}) — returning no hosts.` +
          (win ? '' : ' Install arp-scan, or run with INTEGRATION_MODE=mock for the demo.')));
      }
      // Confine to the authorized CIDR — see the note above ipToInt().
      const hosts = (win ? parseWindowsArp(stdout) : parseArpScan(stdout))
        .filter((h) => inCidr(h.ip, cidr));
      lastStatus = { ok: true, reason: null, at: new Date().toISOString() };
      cache = { cidr, at: Date.now(), hosts };
      resolve(hosts);
    });
  });
}

export function discover(cidr) {
  if (MODE !== 'live') {
    lastStatus = { ok: true, reason: null, at: new Date().toISOString() };
    // Mock hosts are generated inside the requested range, but filter anyway so
    // the demo cannot demonstrate behaviour the live path would refuse.
    return Promise.resolve(mockDiscover(cidr).filter((h) => inCidr(h.ip, cidr)));
  }
  return liveDiscover(cidr);
}

// Profiler card for a single device (own metadata only — no third-party PII).
// In live mode this reports what discovery actually saw; it never invents a
// card for a host that isn't there, and never for an address outside the
// authorized CIDR.
export async function profile(ip, cidr) {
  // Out of scope is checked FIRST, before mode, so the demo can never show a
  // card for an address the live path would refuse.
  if (!inCidr(ip, cidr)) {
    return {
      ip, online: false, tags: ['out-of-scope'],
      notes: parseCidr(cidr)
        ? `${ip} is outside the authorized range ${cidr}.`
        : `No owned network is registered, so ${ip} is not in scope. Run: npm run setup`,
    };
  }
  if (MODE !== 'live') {
    const host = mockDiscover(cidr).find((h) => h.ip === ip) || mockDiscover(cidr)[0];
    return {
      ...host,
      firstSeen: '2026-01-04',
      trafficMbps: Number((Math.abs(Math.sin(ip.length)) * 40).toFixed(1)),
      tags: [host.kind, host.vendor, host.online ? 'online' : 'offline'],
      notes: 'Owned asset. Data synthesized in mock mode.',
    };
  }
  const host = (await liveDiscover(cidr)).find((h) => h.ip === ip);
  if (!host) {
    return lastStatus.ok
      ? { ip, online: false, notes: 'Not seen in the last scan of your network.', tags: ['offline'] }
      : { ip, online: false, notes: `Scan unavailable: ${lastStatus.reason}`, tags: ['scan-failed'] };
  }
  return {
    ...host,
    tags: [host.kind, host.vendor, 'online'].filter(Boolean),
    notes: 'Owned asset. Observed on your registered network.',
  };
}
