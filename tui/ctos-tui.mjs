#!/usr/bin/env node
// ctOS · terminal-native HUD. The whole dashboard inside your terminal — no
// browser. Talks to the same server (REST + WebSocket) and the same scope gate.
// Truecolor ANSI; built for Windows Terminal (fully VT-capable) but runs in any
// modern terminal. Run: `npm run tui`  (server must be up; `npm start`).
//   --once   render a single frame and exit (for smoke tests / screenshots)
import { WebSocket } from 'ws';

const PORT = process.env.PORT || 7050;
const BASE = `http://localhost:${PORT}`;
const WSURL = `ws://localhost:${PORT}/ws`;
const ONCE = process.argv.includes('--once');

// ── ANSI ─────────────────────────────────────────────────────────────────────
const E = '\x1b[';
const fg = (r, g, b) => `${E}38;2;${r};${g};${b}m`;
const RESET = `${E}0m`;
const C = {
  cyan: fg(0, 229, 255), dim: fg(10, 142, 163), amber: fg(255, 176, 32),
  red: fg(255, 59, 48), green: fg(34, 255, 167), text: fg(207, 238, 242),
  muted: fg(92, 125, 132), white: fg(234, 252, 255),
};
const at = (x, y) => `${E}${y + 1};${x + 1}H`;
const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');
const padEnd = (s, w) => { const v = strip(s); return v.length >= w ? s : s + ' '.repeat(w - v.length); };
const clip = (s, w) => { // truncate honoring width on plain text (no mid-code cuts here: inputs are plain)
  return s.length > w ? s.slice(0, w) : s;
};

// ── State ────────────────────────────────────────────────────────────────────
const S = {
  system: null, hosts: [], ha: [], finance: null, audit: [],
  feed: [], gate: [], waterfall: [], cidr: '192.168.1.0/24',
  cols: process.stdout.columns || 100, rows: process.stdout.rows || 30,
  status: 'connecting…',
};

let out = '';
const write = (x, y, s) => { out += at(x, y) + s; };

// ── Data ─────────────────────────────────────────────────────────────────────
async function j(path) { try { const r = await fetch(BASE + path); return await r.json(); } catch { return null; } }
async function refresh() {
  const [sys, dev, fin, aud] = await Promise.all([
    j('/api/system'), j('/api/devices'), j('/api/finance'), j('/api/audit'),
  ]);
  if (sys) S.system = sys;
  if (dev) { S.hosts = dev.hosts || []; S.ha = dev.ha || []; if (S.hosts[0]) S.cidr = S.hosts[0].ip.split('.').slice(0, 3).join('.') + '.0/24'; }
  if (fin) S.finance = fin;
  if (aud) S.audit = aud.entries || [];
}

// ── WebSocket (waterfall + feed + command results) ───────────────────────────
let ws;
function connect() {
  ws = new WebSocket(WSURL);
  ws.on('open', () => { S.status = 'linked'; });
  ws.on('close', () => { S.status = 'reconnecting…'; if (!ONCE) setTimeout(connect, 1500); });
  ws.on('error', () => {});
  ws.on('message', (buf) => {
    let m; try { m = JSON.parse(buf.toString()); } catch { return; }
    if (m.stream === 'waterfall') { S.waterfall.push(m.payload.row); if (S.waterfall.length > 64) S.waterfall.shift(); }
    else if (m.stream === 'feed') { S.feed.unshift(m.payload); if (S.feed.length > 30) S.feed.pop(); }
    else if (m.stream === 'result') {
      const r = m.payload;
      S.gate.unshift({ denied: r.denied, amber: r.amber, reason: r.reason, data: r.data });
      if (S.gate.length > 8) S.gate.pop();
      refresh(); // audit changed
    }
  });
}
function send(cmd) { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ id: 'c' + Math.random().toString(36).slice(2, 7), ...cmd })); }

const ACTIONS = {
  '1': { label: 'scan owned LAN', cmd: () => ({ verb: 'scan', class: 'network', target: S.cidr }) },
  '2': { label: 'toggle owned lamp', cmd: () => ({ verb: 'control', class: 'homeassistant', target: 'ha:switch.office_lamp', params: { action: 'toggle' } }) },
  '3': { label: 'TX in-band (AMBER)', cmd: () => ({ verb: 'transmit', class: 'sdr', target: 'rf:915000000' }) },
  '4': { label: 'scan neighbour  ✗', cmd: () => ({ verb: 'scan', class: 'network', target: '10.0.0.0/24' }) },
  '5': { label: 'emulate stranger ✗', cmd: () => ({ verb: 'emulate', class: 'flipper', target: 'nfc:DEADBEEF' }) },
};

// ── Drawing ──────────────────────────────────────────────────────────────────
function panel(x, y, w, h, title) {
  const t = ` ${title} `;
  const dashes = Math.max(0, w - 3 - t.length);
  write(x, y, C.cyan + '╭─' + C.white + t + C.cyan + '─'.repeat(dashes) + '╮' + RESET);
  for (let i = 1; i < h - 1; i++) { write(x, y + i, C.cyan + '│' + RESET); write(x + w - 1, y + i, C.cyan + '│' + RESET); }
  write(x, y + h - 1, C.cyan + '╰' + '─'.repeat(Math.max(0, w - 2)) + '╯' + RESET);
}
function line(x, y, s, w) { write(x, y, padEnd(s, w)); }

function powerColor(dbfs) {
  const t = Math.max(0, Math.min(1, (dbfs + 110) / 100));
  if (t < 0.5) { const k = t * 2; return fg(Math.round(4 - 4 * k), Math.round(8 + 221 * k), Math.round(10 + 245 * k)); }
  const k = (t - 0.5) * 2; return fg(Math.round(234 * k), Math.round(229 + 23 * k), 255);
}

function render() {
  out = `${E}H`; // home (no full clear → no flicker; panels fully overwrite their cells)
  const { cols, rows } = S;
  if (cols < 80 || rows < 24) {
    out += `${E}2J` + at(0, 0) + C.amber + `ctOS TUI needs ≥ 80×24 (have ${cols}×${rows}). Resize the terminal.` + RESET;
    process.stdout.write(out); return;
  }

  // Header
  const sys = S.system || {};
  const jur = sys.jurisdiction || {};
  const clock = new Date().toLocaleTimeString([], { hour12: false });
  const right = `${clock}  ·  ${sys.demo ? 'DEMO' : 'LIVE'}  ·  ${jur.country || '--'}/${jur.regulator || '--'}  TX:${jur.rf_tx ? 'on' : 'off'} NFC:${jur.rfid_emulation ? 'on' : 'off'} AMBER:${jur.amber_enabled ? 'on' : 'off'}  [${S.status}]`;
  const rightStart = Math.max(0, cols - right.length - 1);
  const brand = '▚ ctOS // personal · command your own domain';
  const leftClipped = brand.slice(0, Math.max(6, rightStart - 2)); // never overlap the status
  write(0, 0, C.cyan + '▚ ' + C.white + 'ctOS' + C.dim + leftClipped.slice(6) + RESET);
  write(rightStart, 0, C.cyan + clock + C.muted + right.slice(clock.length) + RESET);
  write(0, 1, C.dim + '─'.repeat(cols) + RESET);

  const top = 2, bottom = rows - 1;
  const bodyH = bottom - top;
  const lw = Math.floor((cols - 3) / 2);
  const rw = cols - 3 - lw;
  const lx = 1, rx = lx + lw + 1;

  // Left: Device Grid (top) + Audit (bottom)
  const gridH = Math.floor(bodyH * 0.5);
  const audH = bodyH - gridH;
  panel(lx, top, lw, gridH, 'DEVICE GRID');
  S.hosts.slice(0, gridH - 2).forEach((h, i) => {
    const dot = (h.online ? C.green + '●' : C.red + '●') + RESET;
    const s = `${dot} ${C.cyan}${clip(h.ip, 15).padEnd(15)}${C.muted} ${clip((h.vendor || '') + ' · ' + (h.kind || ''), lw - 22)}${RESET}`;
    line(lx + 1, top + 1 + i, s, lw - 2);
  });
  panel(lx, top + gridH, lw, audH, 'AUDIT LOG  (append-only, hash-chained)');
  if (!S.audit.length) line(lx + 1, top + gridH + 1, `${C.muted}— no entries yet · press [1-5] to fire a command —${RESET}`, lw - 2);
  S.audit.slice().reverse().slice(0, audH - 2).forEach((e, i) => {
    const col = e.result === 'allow' ? C.green : e.result === 'deny' ? C.red : C.amber;
    const s = `${C.dim}${(e.ts || '').slice(11, 19)}${RESET} ${col}${(e.result || '').toUpperCase().padEnd(5)}${RESET} ${C.text}${clip(`${e.verb}/${e.class} → ${e.target}`, lw - 18)}${RESET}`;
    line(lx + 1, top + gridH + 1 + i, s, lw - 2);
  });

  // Right: Scope Gate (top) + Waterfall (mid) + Finance (bottom)
  const gateH = 9, finH = 6;
  const wfH = bodyH - gateH - finH;
  panel(rx, top, rw, gateH, 'SCOPE GATE  (enforced)');
  Object.entries(ACTIONS).forEach(([k, a], i) => {
    const danger = a.label.includes('✗');
    line(rx + 1, top + 1 + i, `${C.cyan}[${k}]${RESET} ${danger ? C.red : C.text}${a.label}${RESET}`, rw - 2);
  });
  S.gate.slice(0, gateH - 7).forEach((g, i) => {
    const col = g.denied ? C.red : g.amber ? C.amber : C.green;
    const label = g.denied ? 'DENIED' : g.amber ? 'AMBER' : 'ALLOW';
    line(rx + 1, top + 6 + i, `${col}${label}${RESET} ${C.muted}${clip(g.reason || (g.data ? JSON.stringify(g.data) : 'ok'), rw - 12)}${RESET}`, rw - 2);
  });

  panel(rx, top + gateH, rw, wfH, 'SPECTRUM WATERFALL  (RX-only · 915 MHz ISM)');
  const wfInnerW = rw - 2, wfInnerH = wfH - 2;
  const shown = S.waterfall.slice(-wfInnerH);
  for (let r = 0; r < shown.length; r++) {
    const rowData = shown[shown.length - 1 - r];
    let s = '';
    for (let x = 0; x < wfInnerW; x++) {
      const bin = Math.floor((x / wfInnerW) * rowData.length);
      s += powerColor(rowData[bin]) + '█';
    }
    write(rx + 1, top + gateH + 1 + r, s + RESET);
  }

  panel(rx, top + gateH + wfH, rw, finH, 'FINANCE / NOTIFICATIONS  (own accounts)');
  const bals = (S.finance?.balances || []).slice(0, 2);
  bals.forEach((b, i) => {
    const up = b.delta24h >= 0;
    line(rx + 1, top + gateH + wfH + 1 + i, `${C.muted}${clip(b.label, 22).padEnd(22)}${C.green}$${String(b.balance).padStart(10)}${RESET} ${up ? C.green + '▲' : C.red + '▼'}${Math.abs(b.delta24h)}${RESET}`, rw - 2);
  });
  (S.finance?.notifications || []).slice(0, finH - 2 - bals.length).forEach((n, i) => {
    line(rx + 1, top + gateH + wfH + 1 + bals.length + i, `${C.dim}${n.t}${RESET} ${C.text}${clip(n.msg, rw - 10)}${RESET}`, rw - 2);
  });

  // Footer
  const hint = ' [1-5] run command   [r] refresh   [q] quit ';
  write(0, rows - 1, C.dim + '─'.repeat(Math.max(0, cols - strip(hint).length)) + C.muted + hint + RESET);

  process.stdout.write(out);
}

// ── Lifecycle ────────────────────────────────────────────────────────────────
function enter() { process.stdout.write(`${E}?1049h${E}?25l${E}2J`); }
function leave() { process.stdout.write(`${E}?25h${E}?1049l`); }

async function main() {
  await refresh();
  connect();
  if (ONCE) {
    await new Promise((r) => setTimeout(r, 1600)); // let a few waterfall rows arrive
    render();
    process.stdout.write('\n');
    process.exit(0);
  }
  enter();
  render();
  const timer = setInterval(render, 500);

  const quit = () => { clearInterval(timer); leave(); process.exit(0); };
  process.on('SIGINT', quit);
  process.stdout.on('resize', () => { S.cols = process.stdout.columns; S.rows = process.stdout.rows; process.stdout.write(`${E}2J`); render(); });

  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', (d) => {
    const key = d.toString();
    if (key === 'q' || key === '') return quit();
    if (key === 'r') return void refresh().then(render);
    const a = ACTIONS[key];
    if (a) send(a.cmd());
  });
}

main();
