// Command bus: the single choke point between UI intent and real action.
//
// Message schema (client → server):
//   { id, verb, class, target, params }
//     verb   : scan | read | view | control | transmit | emulate
//     class  : network | host | homeassistant | sdr | flipper | camera | finance
//     target : "192.168.1.0/24" | "ha:switch.x" | "rf:433920000" | "nfc:04AB" | ...
// Result (server → client):
//   { id, ok, denied, reason, amber, data }
//
// EVERY command is authorized against the registry and written to the audit log
// before any adapter is touched. Denied commands never reach an adapter.
import { authorize } from './scope-gate.js';
import { record } from './audit.js';
import * as network from './adapters/network.js';
import * as ha from './adapters/homeassistant.js';
import * as sdr from './adapters/sdr.js';
import * as flipper from './adapters/flipper.js';
import * as finance from './adapters/finance.js';

export async function dispatch(cmd, config, actor = 'operator') {
  const verdict = authorize(cmd, config);

  record({
    actor,
    verb: cmd.verb,
    class: cmd.class,
    target: cmd.target,
    result: verdict.allowed ? 'allow' : 'deny',
    reason: verdict.reason,
  });

  if (!verdict.allowed) {
    return { id: cmd.id, ok: false, denied: true, reason: verdict.reason, amber: false, data: null };
  }

  let data = null;
  try {
    data = await execute(cmd, config);
  } catch (e) {
    record({ actor, verb: cmd.verb, class: cmd.class, target: cmd.target, result: 'error', reason: e.message });
    return { id: cmd.id, ok: false, denied: false, reason: e.message, amber: verdict.amber, data: null };
  }

  return { id: cmd.id, ok: true, denied: false, reason: null, amber: verdict.amber, data };
}

async function execute(cmd, config) {
  const cidr = config.registry.networks?.[0]?.cidr;
  switch (cmd.class) {
    case 'network':
      return cmd.verb === 'scan' ? { hosts: await network.discover(cmd.target) }
        : network.profile(cmd.target, cidr);
    case 'host':
      return { note: 'host action authorized (adapter stubbed in mock mode)', target: cmd.target };
    case 'homeassistant':
      return ha.control(cmd.target, cmd.params?.action || 'toggle');
    case 'sdr':
      return cmd.verb === 'transmit'
        ? { transmitted: true, target: cmd.target, note: 'authorized within registry TX band' }
        : sdr.sweepRow(Number(String(cmd.target).replace('rf:', '')) || 433920000, 96, 0);
    case 'flipper':
      return cmd.verb === 'emulate'
        ? flipper.emulate(cmd.target.split(':')[1])
        : flipper.read(cmd.params?.kind || 'nfc');
    case 'camera':
      return { view: 'stream-authorized', target: cmd.target, note: 'consent-confirmed' };
    case 'finance':
      return { account: cmd.target, refreshed: true };
    default:
      throw new Error(`no executor for class ${cmd.class}`);
  }
}
