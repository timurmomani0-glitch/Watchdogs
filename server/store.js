// Device sighting store — the memory behind history, presence and intrusion
// detection. Append-only JSONL on disk + an in-memory index.
//
// PRIVACY BOUNDARY: this records device *identifiers* seen on YOUR OWN network,
// for defensive alerting on that network. It deliberately does NOT associate
// devices with people, build behavioural profiles, or track anything off your
// LAN. Sightings age out (RETENTION_DAYS) and `purge()` wipes them on demand.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', 'data');
const DEVICES = path.join(DATA, 'devices.json');
const EVENTS = path.join(DATA, 'events.jsonl');

const RETENTION_DAYS = Number(process.env.CTOS_RETENTION_DAYS || 30);
const MAX_EVENTS = 5000;

// mac -> { mac, ip, hostname, vendor, firstSeen, lastSeen, registered, seenCount }
let devices = new Map();
let events = [];

function ensure() { fs.mkdirSync(DATA, { recursive: true }); }

export function load() {
  ensure();
  try {
    if (fs.existsSync(DEVICES)) {
      const raw = JSON.parse(fs.readFileSync(DEVICES, 'utf8'));
      devices = new Map(raw.map((d) => [d.mac, d]));
    }
  } catch { devices = new Map(); }
  try {
    if (fs.existsSync(EVENTS)) {
      events = fs.readFileSync(EVENTS, 'utf8').trim().split('\n').filter(Boolean)
        .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    }
  } catch { events = []; }
  prune();
  return { devices: devices.size, events: events.length };
}

function saveDevices() {
  ensure();
  fs.writeFileSync(DEVICES, JSON.stringify([...devices.values()], null, 0));
}

export function addEvent(ev) {
  ensure();
  const row = { ts: new Date().toISOString(), ...ev };
  events.push(row);
  fs.appendFileSync(EVENTS, JSON.stringify(row) + '\n');
  if (events.length > MAX_EVENTS) events = events.slice(-MAX_EVENTS);
  return row;
}

function prune() {
  const cutoff = Date.now() - RETENTION_DAYS * 864e5;
  let dropped = 0;
  for (const [mac, d] of devices) {
    if (new Date(d.lastSeen).getTime() < cutoff) { devices.delete(mac); dropped++; }
  }
  events = events.filter((e) => new Date(e.ts).getTime() >= cutoff);
  if (dropped) saveDevices();
  return dropped;
}

// Fold one scan into the store. Returns { joined, left, unregistered }.
// `registeredMacs` is the set from the owned-asset registry.
export function observe(hosts, registeredMacs = new Set()) {
  const now = new Date().toISOString();
  const seen = new Set();
  const joined = [];

  for (const h of hosts) {
    const mac = (h.mac || '').toLowerCase();
    if (!mac) continue;
    seen.add(mac);
    const known = devices.get(mac);
    const registered = registeredMacs.has(mac);
    if (!known) {
      const rec = {
        mac, ip: h.ip, hostname: h.hostname || null, vendor: h.vendor || null,
        firstSeen: now, lastSeen: now, registered, seenCount: 1, online: true,
      };
      devices.set(mac, rec);
      joined.push(rec);
      addEvent({ kind: registered ? 'device.join' : 'device.unregistered', mac, ip: h.ip, vendor: h.vendor || null });
    } else {
      known.lastSeen = now;
      known.ip = h.ip || known.ip;
      known.vendor = h.vendor || known.vendor;
      known.registered = registered;
      known.seenCount = (known.seenCount || 0) + 1;
      if (!known.online) { known.online = true; addEvent({ kind: 'device.return', mac, ip: known.ip }); }
    }
  }

  const left = [];
  for (const [mac, d] of devices) {
    if (!seen.has(mac) && d.online) {
      d.online = false;
      left.push(d);
      addEvent({ kind: 'device.leave', mac, ip: d.ip });
    }
  }

  prune();
  saveDevices();
  return {
    joined,
    left,
    unregistered: [...devices.values()].filter((d) => d.online && !d.registered),
  };
}

export function list() { return [...devices.values()].sort((a, b) => a.ip?.localeCompare(b.ip) || 0); }
export function recentEvents(n = 60) { return events.slice(-n).reverse(); }
export function stats() {
  const all = [...devices.values()];
  return {
    total: all.length,
    online: all.filter((d) => d.online).length,
    unregistered: all.filter((d) => d.online && !d.registered).length,
    retentionDays: RETENTION_DAYS,
  };
}
export function purge() {
  devices = new Map(); events = [];
  ensure();
  for (const f of [DEVICES, EVENTS]) if (fs.existsSync(f)) fs.unlinkSync(f);
  return { purged: true };
}
