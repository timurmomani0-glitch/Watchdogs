// ctOS-personal server: serves the dashboard, exposes owned-asset data over
// REST, and runs the WebSocket command bus + telemetry stream.
import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'node:http';
import path from 'node:path';
import url from 'node:url';
import { loadConfig } from './config.js';
import { dispatch } from './command-bus.js';
import { tail, verifyChain } from './audit.js';
import * as network from './adapters/network.js';
import * as ha from './adapters/homeassistant.js';
import * as sdr from './adapters/sdr.js';
import * as finance from './adapters/finance.js';
import * as hosts from './adapters/hosts.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const config = loadConfig();
const PORT = process.env.PORT || 7050;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// System summary: stage, jurisdiction, whether real assets are loaded.
app.get('/api/system', (req, res) => {
  res.json({
    name: 'ctOS · personal',
    stage: config.demo ? 'A (demo / mock data)' : 'wired',
    demo: config.demo,
    owner: config.registry.owner,
    jurisdiction: {
      country: config.jurisdiction.country,
      regulator: config.jurisdiction.regulator,
      amber_enabled: config.jurisdiction.amber_enabled,
      rf_tx: config.jurisdiction.rf?.tx_allowed,
      rfid_emulation: config.jurisdiction.rfid_emulation_allowed,
    },
    sources: config.sources,
    audit: verifyChain(),
  });
});

app.get('/api/devices', async (req, res) => {
  const cidr = config.registry.networks?.[0]?.cidr;
  res.json({ hosts: await network.discover(cidr), ha: ha.snapshot(config.registry.devices) });
});

app.get('/api/profile/:ip', (req, res) => {
  res.json(network.profile(req.params.ip, config.registry.networks?.[0]?.cidr));
});

app.get('/api/hosts', async (req, res) => res.json(await hosts.status(config.registry.hosts)));
app.get('/api/finance', async (req, res) => {
  res.json({ balances: await finance.balances(config.registry.accounts), notifications: await finance.notifications() });
});
app.get('/api/audit', (req, res) => res.json({ chain: verifyChain(), entries: tail(60) }));

// Capability map (GREEN/AMBER only — RED features never ship) drives the UI legend.
app.get('/api/capabilities', (req, res) => {
  res.json(capabilityLegend());
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ stream: 'hello', payload: { ts: new Date().toISOString(), demo: config.demo } }));

  ws.on('message', async (buf) => {
    let cmd;
    try { cmd = JSON.parse(buf.toString()); } catch { return; }
    const result = await dispatch(cmd, config, config.registry.owner || 'operator');
    ws.send(JSON.stringify({ stream: 'result', payload: result }));
  });
});

// Telemetry broadcast: waterfall rows + a live event feed.
let t = 0;
setInterval(() => {
  t++;
  const row = sdr.sweepRow(433920000, 96, t);
  const feed = t % 4 === 0
    ? { ts: new Date().toISOString(), kind: 'net', msg: `arp: ${config.registry.networks?.[0]?.cidr || 'lan'} steady` }
    : null;
  for (const ws of wss.clients) {
    if (ws.readyState !== ws.OPEN) continue;
    ws.send(JSON.stringify({ stream: 'waterfall', payload: row }));
    if (feed) ws.send(JSON.stringify({ stream: 'feed', payload: feed }));
  }
}, 600);

// Minimal capability legend the front-end colors panels with.
function capabilityLegend() {
  return {
    green: ['network.scan', 'network.profile', 'homeassistant.control', 'homeassistant.scene',
      'host.status', 'sdr.view', 'flipper.read', 'finance.read', 'audit.verify'],
    amber: ['sdr.transmit (US Part 15 bands only)', 'flipper.emulate (own cards only)',
      'camera.view (consent-confirmed)'],
  };
}

server.listen(PORT, () => {
  console.log(`ctOS-personal on http://localhost:${PORT}  [${config.demo ? 'DEMO/mock' : 'wired'}]  jurisdiction=${config.jurisdiction.country}`);
});
