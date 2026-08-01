// Defensive ctOS — intrusion detection on YOUR OWN network.
//
// Periodically scans the registered CIDR, folds results into the store, and
// raises an alert when a device that is NOT in your owned-asset registry appears
// on your LAN. This is the legal reframe of the game's "find hidden nodes":
// passive observation of your own network for your own security.
//
// It is deliberately NOT surveillance tooling: it records device identifiers on
// your LAN, never identities, never anything off your network.
import * as network from './adapters/network.js';
import * as store from './store.js';
import { vendorOf } from './oui.js';
import { push } from './notify.js';
import { record } from './audit.js';

const INTERVAL_MS = Number(process.env.CTOS_WATCH_INTERVAL_MS || 60000);

function registeredMacs(registry) {
  const set = new Set();
  for (const d of registry.devices || []) {
    const id = String(d.id || '').toLowerCase();
    if (/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/.test(id)) set.add(id);
  }
  return set;
}

let timer = null;
let lastResult = { ran: false };

export async function sweep(config, broadcast) {
  const cidr = config.registry.networks?.[0]?.cidr;
  if (!cidr) return { ran: false, reason: 'no owned network registered' };

  const found = await network.discover(cidr);
  const scan = network.status();
  // A scan that FAILED returns the same empty array as a quiet network. Folding
  // that into the store would mark every device as having left and flip
  // presence to "nobody home" because arp-scan timed out once.
  if (!scan.ok) {
    lastResult = { ran: false, at: new Date().toISOString(), cidr, error: scan.reason };
    return lastResult;
  }

  const hosts = found.map((h) => ({ ...h, vendor: h.vendor || vendorOf(h.mac) || null }));

  const reg = registeredMacs(config.registry);
  const { joined, left, unregistered } = store.observe(hosts, reg);

  // Alert only on genuinely new unregistered devices, not every sweep.
  const fresh = joined.filter((d) => !d.registered);
  for (const d of fresh) {
    const msg = `${d.ip}  ${d.mac}${d.vendor ? '  (' + d.vendor + ')' : ''}`;
    record({
      actor: 'watch', verb: 'detect', class: 'network', target: d.ip,
      result: 'allow', reason: 'unregistered device on owned network',
    });
    await push('ctOS · unregistered device', msg, { priority: 'high', tags: ['warning'] });
    broadcast?.({ stream: 'alert', payload: { kind: 'unregistered', ...d } });
  }
  for (const d of joined.filter((x) => x.registered)) {
    broadcast?.({ stream: 'alert', payload: { kind: 'join', ...d } });
  }
  for (const d of left) broadcast?.({ stream: 'alert', payload: { kind: 'leave', ...d } });

  lastResult = {
    ran: true, at: new Date().toISOString(), cidr, error: null,
    seen: hosts.length, joined: joined.length, left: left.length,
    unregistered: unregistered.length,
  };
  return lastResult;
}

export function start(config, broadcast) {
  if (timer) return;
  store.load();
  sweep(config, broadcast).catch(() => {});
  timer = setInterval(() => sweep(config, broadcast).catch(() => {}), INTERVAL_MS);
  timer.unref?.();
  return { started: true, intervalMs: INTERVAL_MS };
}

export function stop() { if (timer) { clearInterval(timer); timer = null; } }
export function status() { return { ...lastResult, intervalMs: INTERVAL_MS }; }

// ── Presence: derived from YOUR OWN registered devices only ─────────────────
// An unregistered device never counts as "someone home" — that would be
// tracking strangers. Only assets you have explicitly registered are presence
// signals, and only as "this device of mine is on the network".
export function presence(config) {
  const reg = registeredMacs(config.registry);
  const all = store.list();
  const mine = all.filter((d) => reg.has(d.mac));
  const online = mine.filter((d) => d.online);
  const labels = new Map((config.registry.devices || []).map((d) => [String(d.id).toLowerCase(), d.label]));
  return {
    home: online.length > 0,
    devices: mine.map((d) => ({
      mac: d.mac, label: labels.get(d.mac) || d.ip, online: d.online, lastSeen: d.lastSeen,
    })),
    onlineCount: online.length,
    totalRegistered: mine.length,
  };
}
