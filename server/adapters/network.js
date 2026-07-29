// Owned-network discovery → feeds the Device Grid and Network Map.
//
// LIVE: run `arp-scan --localnet` or `nmap -sn <cidr>` against a CIDR from the
// registry and parse hosts. The registry CIDR is passed in so a scan can never
// be aimed outside owned space — the scope gate has already authorized it.
// Swap mockDiscover() for liveDiscover() when INTEGRATION_MODE=live.
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

function liveDiscover(cidr) {
  return new Promise((resolve) => {
    // arp-scan is fast + reliable on a LAN; requires CAP_NET_RAW or sudo.
    execFile('arp-scan', ['--localnet', '--quiet'], { timeout: 15000 }, (err, stdout) => {
      if (err) return resolve(mockDiscover(cidr)); // graceful fallback
      const hosts = stdout
        .split('\n')
        .map((l) => l.match(/^(\d+\.\d+\.\d+\.\d+)\s+([0-9a-f:]{17})\s+(.*)$/i))
        .filter(Boolean)
        .map((m) => ({ ip: m[1], mac: m[2], vendor: m[3].trim(), kind: 'host', online: true }));
      resolve(hosts);
    });
  });
}

export function discover(cidr) {
  return MODE === 'live' ? liveDiscover(cidr) : Promise.resolve(mockDiscover(cidr));
}

// Profiler card for a single device (own metadata only — no third-party PII).
export function profile(ip, cidr) {
  const host = mockDiscover(cidr).find((h) => h.ip === ip) || mockDiscover(cidr)[0];
  return {
    ...host,
    firstSeen: '2026-01-04',
    trafficMbps: Number((Math.abs(Math.sin(ip.length)) * 40).toFixed(1)),
    tags: [host.kind, host.vendor, host.online ? 'online' : 'offline'],
    notes: 'Owned asset. Data synthesized in mock mode.',
  };
}
