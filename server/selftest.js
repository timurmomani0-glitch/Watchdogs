// Proof harness for the scope gate. It must: ALLOW in-scope GREEN actions, keep
// AMBER capabilities OFF under the conservative default profile, DENY every
// out-of-scope target, ALLOW AMBER actions only when the jurisdiction profile is
// deliberately enabled (and still deny out-of-scope / over-power ones), and the
// audit chain must verify. Run with `npm run check`. Exits non-zero on any failure.
import { authorize } from './scope-gate.js';
import { loadConfig } from './config.js';
import { record, verifyChain } from './audit.js';

const config = loadConfig();
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

console.log('── out-of-scope (must all DENY) ────────────────────────────');
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

console.log('── audit chain ─────────────────────────────────────────────');
record({ actor: 'selftest', verb: 'scan', class: 'network', target: '192.168.1.0/24', result: 'allow' });
record({ actor: 'selftest', verb: 'scan', class: 'network', target: '10.0.0.0/24', result: 'deny', reason: 'out of scope' });
const chain = verifyChain();
console.log(`${chain.ok ? 'PASS' : 'FAIL'}  audit chain intact (checked ${chain.checked})`);
chain.ok ? pass++ : fail++;

console.log('────────────────────────────────────────────────────────────');
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
