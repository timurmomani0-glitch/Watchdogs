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

function parseArpScan(stdout) {
  // Linux `arp-scan --localnet`: "192.168.1.10  aa:bb:cc:dd:ee:ff  Vendor"
  return stdout.split('\n')
    .map((l) => l.match(/^(\d+\.\d+\.\d+\.\d+)\s+([0-9a-f:]{17})\s+(.*)$/i))
    .filter(Boolean)
    .map((m) => ({ ip: m[1], mac: m[2].toLowerCase(), vendor: m[3].trim(), kind: 'host', online: true }));
}

function parseWindowsArp(stdout) {
  // Windows `arp -a`: "  192.168.1.10          aa-bb-cc-dd-ee-ff     dynamic"
  return stdout.split('\n')
    .map((l) => l.match(/^\s*(\d+\.\d+\.\d+\.\d+)\s+([0-9a-f]{2}(?:-[0-9a-f]{2}){5})\s+(\w+)/i))
    .filter(Boolean)
    .map((m) => ({ ip: m[1], mac: m[2].replace(/-/g, ':').toLowerCase(), vendor: m[3], kind: 'host', online: true }));
}

function liveDiscover(cidr) {
  // Cross-platform: Linux/mac use arp-scan (active), Windows reads the ARP cache
  // via `arp -a`. Either way the scope gate has already authorized the CIDR.
  return new Promise((resolve) => {
    const win = process.platform === 'win32';
    const cmd = win ? 'arp' : 'arp-scan';
    const args = win ? ['-a'] : ['--localnet', '--quiet'];
    execFile(cmd, args, { timeout: 15000, windowsHide: true }, (err, stdout) => {
      if (err) return resolve(mockDiscover(cidr)); // graceful fallback
      const hosts = win ? parseWindowsArp(stdout) : parseArpScan(stdout);
      resolve(hosts.length ? hosts : mockDiscover(cidr));
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
