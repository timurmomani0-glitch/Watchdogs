// Proof harness for the scope gate. It must: ALLOW in-scope GREEN actions, keep
// AMBER capabilities OFF under the conservative default profile, DENY every
// out-of-scope target, ALLOW AMBER actions only when the jurisdiction profile is
// deliberately enabled (and still deny out-of-scope / over-power ones), confine
// scan RESULTS to the authorized range, and the audit chain must verify.
// Run with `npm run check`. Exits non-zero on any failure.
import { authorize } from './scope-gate.js';
import { loadConfig } from './config.js';
import { record, verifyChain } from './audit.js';
import { inCidr, parseCidr, intToIp, localAddressIn, parseWindowsArp, parseArpScan } from './adapters/network.js';
import { buildVocab } from './voice.js';

// Always test against the committed example fixtures, so this proof stays
// stable regardless of the operator's private registry (npm run setup).
const config = loadConfig({ forceExample: true });
// A copy of the profile with the AMBER capabilities deliberately switched on,
// to prove the jurisdiction gate opens AND still constrains.
const amberOn = {
  registry: config.registry,
  jurisdiction: {
    ...config.jurisdiction,
    rf: { ...config.jurisdiction.rf, tx_allowed: true },
    rfid_emulation_allowed: true,
    camera_mic: { ...config.jurisdiction.camera_mic, recording_allowed: true },
  },
};

let pass = 0, fail = 0;
function expect(name, cmd, wantAllowed, cfg = config) {
  const v = authorize(cmd, cfg);
  const ok = v.allowed === wantAllowed;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(48)} allowed=${v.allowed}${v.reason ? '  · ' + v.reason : ''}`);
  ok ? pass++ : fail++;
}

console.log('── GREEN · in-scope (must ALLOW) ───────────────────────────');
expect('scan owned CIDR', { verb: 'scan', class: 'network', target: '192.168.1.0/24' }, true);
expect('scan owned subnet', { verb: 'scan', class: 'network', target: '192.168.1.0/28' }, true);
expect('profile owned host', { verb: 'read', class: 'host', target: '192.168.1.10' }, true);
expect('toggle owned HA device', { verb: 'control', class: 'homeassistant', target: 'ha:switch.office_lamp', params: { action: 'toggle' } }, true);
expect('read owned account', { verb: 'read', class: 'finance', target: 'acct:checking' }, true);
expect('SDR receive (RX, always on)', { verb: 'view', class: 'sdr', target: 'rf:433920000' }, true);
expect('read own NFC card (physical possession)', { verb: 'read', class: 'flipper', target: 'nfc:04A1B2C3' }, true);

console.log('── AMBER OFF by default (conservative profile → DENY) ───────');
expect('TX denied (tx_allowed=false)', { verb: 'transmit', class: 'sdr', target: 'rf:915000000' }, false);
expect('emulate denied (emulation off)', { verb: 'emulate', class: 'flipper', target: 'nfc:04A1B2C3' }, false);
expect('camera denied (recording off)', { verb: 'view', class: 'camera', target: 'ha:camera.front_porch', params: { confirmed: true } }, false);

expect('wake owned device (WoL)', { verb: 'control', class: 'wol', target: 'mac:aa:bb:cc:dd:ee:01' }, true);

console.log('── out-of-scope (must all DENY) ────────────────────────────');
expect('wake UNOWNED device (WoL)', { verb: 'control', class: 'wol', target: 'mac:de:ad:be:ef:00:01' }, false);
expect('wol with non-mac target', { verb: 'control', class: 'wol', target: '192.168.1.10' }, false);
expect('scan neighbour CIDR', { verb: 'scan', class: 'network', target: '10.0.0.0/24' }, false);
expect('scan public host', { verb: 'scan', class: 'network', target: '8.8.8.8' }, false);
expect('control unlisted host', { verb: 'control', class: 'host', target: '192.168.1.99' }, false);
expect('toggle unlisted HA device', { verb: 'control', class: 'homeassistant', target: 'ha:lock.neighbour_door' }, false);
expect('emulate unlisted card', { verb: 'emulate', class: 'flipper', target: 'nfc:DEADBEEF' }, false, amberOn);
expect('read unlisted account', { verb: 'read', class: 'finance', target: 'acct:someone-else' }, false);
expect('unknown class', { verb: 'read', class: 'traffic-lights', target: 'city' }, false);

console.log('── AMBER ON (deliberately enabled → ALLOW in-scope only) ────');
expect('TX inside registry band', { verb: 'transmit', class: 'sdr', target: 'rf:915000000' }, true, amberOn);
expect('TX outside registry band', { verb: 'transmit', class: 'sdr', target: 'rf:462562500' }, false, amberOn);
expect('TX over power cap (>30 dBm)', { verb: 'transmit', class: 'sdr', target: 'rf:915000000', params: { power_dbm: 40 } }, false, amberOn);
expect('TX within power cap (≤30 dBm)', { verb: 'transmit', class: 'sdr', target: 'rf:915000000', params: { power_dbm: 20 } }, true, amberOn);
expect('emulate owned card', { verb: 'emulate', class: 'flipper', target: 'nfc:04A1B2C3' }, true, amberOn);
expect('camera view (owned + consent confirmed)', { verb: 'view', class: 'camera', target: 'ha:camera.front_porch', params: { confirmed: true } }, true, amberOn);
expect('camera view (owned, NOT confirmed)', { verb: 'view', class: 'camera', target: 'ha:camera.front_porch' }, false, amberOn);
expect('camera view (unowned camera)', { verb: 'view', class: 'camera', target: 'ha:camera.neighbour', params: { confirmed: true } }, false, amberOn);

// Authorizing a target is meaningless if the RESULTS can come from somewhere
// else. `arp -a` dumps the whole ARP cache across every interface, so a scan of
// the owned LAN can otherwise hand back hosts from a phone hotspot, a VPN or a
// second NIC. These checks prove the adapter confines what it returns.
console.log('── results confinement (scan output must stay in range) ────');
function check(name, got, want) {
  const ok = got === want;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(48)} ${got}`);
  ok ? pass++ : fail++;
}
// FAIL CLOSED. A missing or malformed CIDR must match NOTHING. The state where
// no network is registered is exactly the state where the gate denies every
// command — it must not be the state where the adapter returns the whole LAN.
check('undefined cidr matches nothing', inCidr('172.20.10.1', undefined), false);
check('null cidr matches nothing', inCidr('172.20.10.1', null), false);
check('empty cidr matches nothing', inCidr('172.20.10.1', ''), false);
check('empty prefix "1.0/" matches nothing', inCidr('8.8.8.8', '192.168.1.0/'), false);
check('/33 does not widen to /1', inCidr('200.1.1.1', '192.168.1.0/33'), false);
check('/99 rejected', inCidr('10.0.0.1', '10.0.0.0/99'), false);
check('bare IP (no prefix) rejected', inCidr('10.0.0.1', '10.0.0.0'), false);
check('non-numeric prefix rejected', inCidr('10.0.0.1', '10.0.0.0/abc'), false);
check('octal-ish octet rejected', inCidr('010.0.0.1', '10.0.0.0/8'), false);

check('in-range host kept', inCidr('192.168.1.10', '192.168.1.0/24'), true);
check('hotspot gateway rejected', inCidr('172.20.10.1', '192.168.1.0/24'), false);
check('neighbour /24 rejected', inCidr('192.168.2.10', '192.168.1.0/24'), false);
check('public address rejected', inCidr('8.8.8.8', '192.168.1.0/24'), false);
check('supernet contains subnet host', inCidr('192.168.1.200', '192.168.0.0/16'), true);
check('/28 boundary respected', inCidr('192.168.1.20', '192.168.1.0/28'), false);
check('malformed address rejected', inCidr('192.168.1.999', '192.168.1.0/24'), false);

// A realistic Windows ARP cache: owned LAN + an iPhone hotspot on another NIC,
// plus the multicast/broadcast junk Windows always keeps in the table.
const winArp = [
  'Interface: 192.168.1.5 --- 0xc',
  '  Internet Address      Physical Address      Type',
  '  192.168.1.1           aa-bb-cc-dd-ee-01     dynamic',
  '  192.168.1.10          aa-bb-cc-dd-ee-02     dynamic',
  '  192.168.1.255         ff-ff-ff-ff-ff-ff     static',
  '  224.0.0.22            01-00-5e-00-00-16     static',
  'Interface: 172.20.10.2 --- 0x7',
  '  172.20.10.1           82-96-98-80-e3-64     dynamic',
].join('\n');
const winAll = parseWindowsArp(winArp);
const winScoped = winAll.filter((h) => inCidr(h.ip, '192.168.1.0/24'));
check('windows arp: junk entries dropped', winAll.length, 3);
check('windows arp: confined to owned /24', winScoped.length, 2);
check('windows arp: hotspot host gone', winScoped.some((h) => h.ip === '172.20.10.1'), false);

const lnxArp = [
  '192.168.1.1\taa:bb:cc:dd:ee:01\tUbiquiti Inc',
  '192.168.1.10\taa:bb:cc:dd:ee:02\tRaspberry Pi Trading',
  '10.8.0.1\taa:bb:cc:dd:ee:03\tWireGuard peer',
].join('\n');
check('arp-scan: confined to owned /24',
  parseArpScan(lnxArp).filter((h) => inCidr(h.ip, '192.168.1.0/24')).length, 2);

// The sweep itself must stay in range. Filtering results cannot un-send a
// packet, so a CIDR written as the operator's own address ("192.168.1.5/24" —
// how ipconfig prints it) must not walk the ping sweep into the next subnet.
console.log('── sweep range (probes must stay in the owned range) ───────');
const r5 = parseCidr('192.168.1.5/24');
check('base masked to network address', intToIp(r5.base), '192.168.1.0');
check('last address is the broadcast', intToIp(r5.last), '192.168.1.255');
check('/33 is not a range at all', parseCidr('192.168.1.0/33'), null);
check('empty prefix is not a range', parseCidr('192.168.1.0/'), null);
check('/32 base equals last', parseCidr('10.0.0.7/32').base, parseCidr('10.0.0.7/32').last);
const r24 = parseCidr('192.168.1.0/24');
check('sweep never reaches broadcast', (r24.base + 254) >>> 0 < r24.last, true);
// localAddressIn() gates the sweep on actually being attached to the network.
check('not attached to an unrelated /24', localAddressIn('203.0.113.0/24'), null);
check('no valid cidr → never attached', localAddressIn(undefined), null);

// The voice layer is an input, not a capability. Its vocabulary must be a pure
// projection of the registry — every target it can name must already be an owned
// target, and a spoken command for it must survive authorize() identically to a
// typed one. Prove both: the vocab only names owned things, and each named
// target is authorized while an out-of-scope look-alike is denied.
console.log('── voice = input, not capability (vocab ⊆ registry) ────────');
const vocab = buildVocab(config);
const regDevIds = new Set((config.registry.devices || []).map((d) => String(d.id).toLowerCase()));
const haOwned = vocab.ha.every((x) => regDevIds.has(String(x.target).toLowerCase()));
check('every HA voice target is an owned device', haOwned, true);
const wolOwned = vocab.wol.every((x) => regDevIds.has(x.target.replace(/^mac:/, '')));
check('every wake target is an owned MAC', wolOwned, true);
check('vocab cidr equals the registry cidr', vocab.cidr, config.registry.networks?.[0]?.cidr || null);
// AMBER targets are hidden unless the profile enables them (default: off).
check('TX not offered while profile TX is off', vocab.tx, null);
check('card emulation not offered while off', vocab.rfid, null);
// A spoken command routes through the SAME gate. Prove a voice-shaped command
// for an owned HA device is allowed, and for an unowned one is denied.
if (vocab.ha[0]) {
  expect('spoken toggle of owned device (via gate)',
    { verb: 'control', class: 'homeassistant', target: vocab.ha[0].target, params: { action: 'toggle' } }, true);
}
expect('spoken toggle of UNOWNED device (via gate)',
  { verb: 'control', class: 'homeassistant', target: 'ha:switch.someone_elses', params: { action: 'toggle' } }, false);
expect('spoken "scan the neighbour" (via gate)',
  { verb: 'scan', class: 'network', target: '203.0.113.0/24' }, false);

console.log('── audit chain ─────────────────────────────────────────────');
record({ actor: 'selftest', verb: 'scan', class: 'network', target: '192.168.1.0/24', result: 'allow' });
record({ actor: 'selftest', verb: 'scan', class: 'network', target: '10.0.0.0/24', result: 'deny', reason: 'out of scope' });
const chain = verifyChain();
console.log(`${chain.ok ? 'PASS' : 'FAIL'}  audit chain intact (checked ${chain.checked})`);
chain.ok ? pass++ : fail++;

console.log('────────────────────────────────────────────────────────────');
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
