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
export function inCidr(ip, cidr) {
  if (!cidr) return true;
  const [net, bitsRaw] = String(cidr).split('/');
  const bits = Number(bitsRaw);
  const a = ipToInt(ip), b = ipToInt(net);
  if (a === null || b === null || !Number.isInteger(bits)) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return ((a & mask) >>> 0) === ((b & mask) >>> 0);
}

// Active sweep: `arp -a` only reports hosts Windows has recently talked to, so a
// quiet LAN looks empty. Pinging the range first populates the ARP cache, which
// turns a passive cache dump into an actual discovery scan. Bounded concurrency
// keeps it from spawning hundreds of processes.
function primeArpCache(cidr, budgetMs = 9000) {
  return new Promise((resolve) => {
    const [net, bitsRaw] = String(cidr || '').split('/');
    const bits = Number(bitsRaw);
    if (!net || !Number.isInteger(bits) || bits < 22) {
      if (net) console.warn(`network: ${cidr} is too large to sweep — falling back to the passive ARP cache.`);
      return resolve();
    }
    const base = ipToInt(net);
    if (base === null) return resolve();
    const usable = 2 ** (32 - bits) - 2;
    const count = Math.min(254, usable);
    // No silent truncation: say so when the sweep does not cover the whole range.
    if (count < usable) console.warn(`network: sweeping the first ${count} of ${usable} addresses in ${cidr}.`);
    const targets = [];
    for (let i = 1; i <= count; i++) targets.push(intToIp(base + i));

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
function intToIp(n) {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
}

let warnedScanner = false;

async function liveDiscover(cidr) {
  const win = process.platform === 'win32';
  // Windows has no active scanner built in — prime the cache ourselves first.
  if (win) await primeArpCache(cidr);
  return new Promise((resolve) => {
    const cmd = win ? 'arp' : 'arp-scan';
    const args = win ? ['-a'] : ['--localnet', '--quiet'];
    execFile(cmd, args, { timeout: 15000, windowsHide: true }, (err, stdout) => {
      if (err) {
        // Fail loud, never fabricate. Returning mock hosts here would put nine
        // invented MACs into the sighting store and fire "unregistered device"
        // alerts for devices that do not exist.
        if (!warnedScanner) {
          warnedScanner = true;
          console.error(`network: live discovery failed (${cmd}: ${err.message.trim()}) — returning no hosts.` +
            (win ? '' : ' Install arp-scan, or run with INTEGRATION_MODE=mock for the demo.'));
        }
        return resolve([]);
      }
      // Confine to the authorized CIDR — see the note above ipToInt().
      const hosts = (win ? parseWindowsArp(stdout) : parseArpScan(stdout))
        .filter((h) => inCidr(h.ip, cidr));
      resolve(hosts);
    });
  });
}

export function discover(cidr) {
  return MODE === 'live' ? liveDiscover(cidr) : Promise.resolve(mockDiscover(cidr));
}

// Profiler card for a single device (own metadata only — no third-party PII).
// In live mode this reports what discovery actually saw; it never invents a
// card for a host that isn't there, and never for an address outside the
// authorized CIDR.
export async function profile(ip, cidr) {
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
  if (!inCidr(ip, cidr)) {
    return { ip, online: false, notes: `${ip} is outside the authorized range ${cidr}.`, tags: ['out-of-scope'] };
  }
  const host = (await liveDiscover(cidr)).find((h) => h.ip === ip);
  if (!host) return { ip, online: false, notes: 'Not seen in the last scan of your network.', tags: ['offline'] };
  return {
    ...host,
    tags: [host.kind, host.vendor, 'online'].filter(Boolean),
    notes: 'Owned asset. Observed on your registered network.',
  };
}
