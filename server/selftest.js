// Proof harness: the scope gate must ALLOW in-scope targets and DENY everything
// else, and the audit chain must verify. Run with `npm run check`. Exits non-zero
// on any failure so it can gate CI.
import { authorize } from './scope-gate.js';
import { loadConfig } from './config.js';
import { record, verifyChain } from './audit.js';

const config = loadConfig();
let pass = 0, fail = 0;

function expect(name, cmd, wantAllowed) {
  const v = authorize(cmd, config);
  const ok = v.allowed === wantAllowed;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(46)} allowed=${v.allowed}${v.reason ? '  · ' + v.reason : ''}`);
  ok ? pass++ : fail++;
}

console.log('── scope-gate ──────────────────────────────────────────────');
// In-scope (example registry uses 192.168.1.0/24 and the listed assets).
expect('scan owned CIDR', { verb: 'scan', class: 'network', target: '192.168.1.0/24' }, true);
expect('scan owned subnet', { verb: 'scan', class: 'network', target: '192.168.1.0/28' }, true);
expect('profile owned host', { verb: 'read', class: 'host', target: '192.168.1.10' }, true);
expect('toggle owned HA device', { verb: 'control', class: 'homeassistant', target: 'ha:switch.office_lamp', params: { action: 'toggle' } }, true);
expect('SDR receive (RX)', { verb: 'view', class: 'sdr', target: 'rf:433920000' }, true);
expect('TX inside registry band', { verb: 'transmit', class: 'sdr', target: 'rf:433920000' }, true);
expect('read own NFC card', { verb: 'read', class: 'flipper', target: 'nfc:04A1B2C3' }, true);
expect('emulate owned card', { verb: 'emulate', class: 'flipper', target: 'nfc:04A1B2C3' }, true);
expect('read owned account', { verb: 'read', class: 'finance', target: 'acct:checking' }, true);

console.log('── out-of-scope (must all DENY) ────────────────────────────');
expect('scan neighbour CIDR', { verb: 'scan', class: 'network', target: '10.0.0.0/24' }, false);
expect('scan public host', { verb: 'scan', class: 'network', target: '8.8.8.8' }, false);
expect('control unlisted host', { verb: 'control', class: 'host', target: '192.168.1.99' }, false);
expect('toggle unlisted HA device', { verb: 'control', class: 'homeassistant', target: 'ha:lock.neighbour_door' }, false);
expect('TX outside registry band', { verb: 'transmit', class: 'sdr', target: 'rf:462562500' }, false);
expect('emulate unlisted card', { verb: 'emulate', class: 'flipper', target: 'nfc:DEADBEEF' }, false);
expect('read unlisted account', { verb: 'read', class: 'finance', target: 'acct:someone-else' }, false);
expect('unknown class', { verb: 'read', class: 'traffic-lights', target: 'city' }, false);

console.log('── audit chain ─────────────────────────────────────────────');
record({ actor: 'selftest', verb: 'scan', class: 'network', target: '192.168.1.0/24', result: 'allow' });
record({ actor: 'selftest', verb: 'scan', class: 'network', target: '10.0.0.0/24', result: 'deny', reason: 'out of scope' });
const chain = verifyChain();
console.log(`${chain.ok ? 'PASS' : 'FAIL'}  audit chain intact (checked ${chain.checked})`);
chain.ok ? pass++ : fail++;

console.log('────────────────────────────────────────────────────────────');
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
