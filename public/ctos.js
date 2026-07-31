'use strict';
const $ = (s) => document.querySelector(s);
const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };

// ── WebSocket command bus ───────────────────────────────────────────────────
let ws;
function connect() {
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  ws.onmessage = (ev) => {
    const { stream, payload } = JSON.parse(ev.data);
    if (stream === 'waterfall') pushWaterfall(payload);
    else if (stream === 'feed') pushFeed(payload);
    else if (stream === 'result') showResult(payload);
  };
  ws.onclose = () => setTimeout(connect, 1500);
}
function send(cmd) {
  cmd.id = 'c' + Math.random().toString(36).slice(2, 8);
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(cmd));
  return cmd.id;
}

// ── System header ────────────────────────────────────────────────────────────
async function loadSystem() {
  const s = await (await fetch('/api/system')).json();
  $('#sysline').textContent =
    `owner ${s.owner}   ·   stage ${s.stage}\njur ${s.jurisdiction.country}/${s.jurisdiction.regulator}   TX:${s.jurisdiction.rf_tx ? 'on' : 'off'}  NFC-emu:${s.jurisdiction.rfid_emulation ? 'on' : 'off'}  AMBER:${s.jurisdiction.amber_enabled ? 'on' : 'off'}`;
  if (s.demo) $('#demoBanner').hidden = false;
  const tag = $('#chainTag');
  tag.textContent = s.audit.ok ? `chain ✓ ${s.audit.checked}` : `chain ✗ @${s.audit.brokenAt}`;
  tag.className = 'tag ' + (s.audit.ok ? 'green' : '');
  if (!s.audit.ok) tag.style.color = 'var(--red)';
}

// ── Device Grid + Network Map ────────────────────────────────────────────────
let mapNodes = [];
async function loadDevices() {
  const d = await (await fetch('/api/devices')).json();
  const grid = $('#devices'); grid.innerHTML = '';
  d.hosts.forEach((h) => {
    const c = el('div', 'dev');
    c.innerHTML = `<div><span class="dot ${h.online ? 'on' : 'off'}"></span><span class="ip">${h.ip}</span></div>
      <div class="meta">${h.vendor} · ${h.kind} · ${(h.openPorts || []).join(',') || '—'}</div>`;
    c.onclick = () => loadProfile(h.ip);
    grid.appendChild(c);
  });
  buildMap(d.hosts);
  buildControls(d.ha);
}

async function loadProfile(ip) {
  const p = await (await fetch('/api/profile/' + ip)).json();
  const rows = [
    ['ip', p.ip], ['mac', p.mac], ['hostname', p.hostname], ['vendor', p.vendor],
    ['kind', p.kind], ['first seen', p.firstSeen], ['traffic', p.trafficMbps + ' Mbps'],
    ['ports', (p.openPorts || []).join(', ') || '—'],
  ];
  $('#profiler').classList.remove('muted');
  $('#profiler').innerHTML =
    rows.map(([k, v]) => `<div class="row"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('') +
    `<div class="chips">${(p.tags || []).map((t) => `<span class="chip">${t}</span>`).join('')}</div>`;
  send({ verb: 'read', class: 'network', target: ip }); // logged to audit
}

// ── Control Panel ────────────────────────────────────────────────────────────
function buildControls(haDevices) {
  const scenes = $('#scenes'); scenes.innerHTML = '';
  ['arrive-home', 'sleep', 'away', 'ctos-mode'].forEach((sc) => {
    const b = el('button', null, '❖ ' + sc);
    b.onclick = () => send({ verb: 'control', class: 'homeassistant', target: 'ha:scene.' + sc.replace('-', '_'), params: { action: 'turn_on' } });
    scenes.appendChild(b);
  });
  const wrap = $('#controls'); wrap.innerHTML = '';
  (haDevices || []).forEach((dv) => {
    const b = el('button', dv.state === 'on' ? 'on' : null, `${dv.state === 'on' ? '◉' : '○'} ${dv.label}`);
    b.onclick = () => {
      send({ verb: 'control', class: 'homeassistant', target: dv.id, params: { action: 'toggle' } });
      dv.state = dv.state === 'on' ? 'off' : 'on';
      b.className = dv.state === 'on' ? 'on' : '';
      b.textContent = `${dv.state === 'on' ? '◉' : '○'} ${dv.label}`;
    };
    wrap.appendChild(b);
  });
  if (!haDevices || !haDevices.length) wrap.innerHTML = '<span class="muted small">no owned HA devices in registry — add them to config/owned-assets.yaml</span>';
}

// ── Finance / Notifications ──────────────────────────────────────────────────
async function loadFinance() {
  const f = await (await fetch('/api/finance')).json();
  $('#finance').innerHTML = f.balances.map((b) => {
    const up = b.delta24h >= 0;
    return `<div class="acct"><div class="lbl">${b.label}</div>
      <div class="bal">$${b.balance.toLocaleString()}</div>
      <div class="d ${up ? 'up' : 'down'}">${up ? '▲' : '▼'} ${Math.abs(b.delta24h)} 24h</div></div>`;
  }).join('');
  $('#notes').innerHTML = f.notifications.map((n) =>
    `<div class="n"><span class="t">${n.t}</span><span class="${n.level === 'ok' ? 'ok' : n.level === 'warn' ? 'amber' : ''}">${n.msg}</span></div>`).join('');
}

// ── Audit ────────────────────────────────────────────────────────────────────
async function loadAudit() {
  const a = await (await fetch('/api/audit')).json();
  $('#audit').innerHTML = a.entries.slice().reverse().map((e) =>
    `<div class="a"><span class="t">${e.ts.slice(11, 19)}</span><span class="${e.result}">${e.result.toUpperCase()}</span> ${e.verb}/${e.class} → ${e.target}${e.reason ? ' · ' + e.reason : ''}</div>`).join('') || '<span class="muted">no entries yet</span>';
}

// ── Live feed + gate results ─────────────────────────────────────────────────
function pushFeed(p) {
  const f = el('div', 'f', `<span class="t">${(p.ts || '').slice(11, 19)}</span>${p.msg}`);
  const box = $('#feed'); box.prepend(f); while (box.children.length > 40) box.lastChild.remove();
}
function showResult(r) {
  const cls = r.denied ? 'deny' : r.amber ? 'amber' : 'ok';
  const label = r.denied ? 'DENIED' : r.amber ? 'ALLOWED·AMBER' : 'ALLOWED';
  const line = el('div', 'line', `<span class="${cls}">${label}</span> ${r.reason || (r.data ? JSON.stringify(r.data).slice(0, 90) : 'ok')}`);
  const box = $('#gateOut'); box.prepend(line); while (box.children.length > 12) box.lastChild.remove();
  loadAudit();
}
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-cmd]');
  if (btn) send(JSON.parse(btn.dataset.cmd));
});

// ── Network Map (canvas spring layout) ───────────────────────────────────────
function buildMap(hosts) {
  const cv = $('#map'), w = cv.width, h = cv.height;
  mapNodes = [{ x: w / 2, y: h / 2, vx: 0, vy: 0, router: true, label: 'gateway', online: true }];
  hosts.forEach((hst, i) => {
    const a = (i / hosts.length) * Math.PI * 2;
    mapNodes.push({ x: w / 2 + Math.cos(a) * 120, y: h / 2 + Math.sin(a) * 90, vx: 0, vy: 0, label: hst.ip.split('.').pop(), online: hst.online });
  });
}
function stepMap() {
  const cv = $('#map'); if (!cv) return;
  const ctx = cv.getContext('2d'), w = cv.width, h = cv.height, router = mapNodes[0];
  if (router) { router.x = w / 2; router.y = h / 2; }
  for (let i = 1; i < mapNodes.length; i++) {
    const n = mapNodes[i];
    // spring to router
    let dx = router.x - n.x, dy = router.y - n.y, dist = Math.hypot(dx, dy) || 1;
    n.vx += (dx / dist) * (dist - 130) * 0.002;
    n.vy += (dy / dist) * (dist - 130) * 0.002;
    // repel other nodes
    for (let j = 1; j < mapNodes.length; j++) {
      if (i === j) continue;
      const m = mapNodes[j]; let ex = n.x - m.x, ey = n.y - m.y, d2 = ex * ex + ey * ey + 0.1;
      if (d2 < 6000) { n.vx += (ex / d2) * 12; n.vy += (ey / d2) * 12; }
    }
    n.vx *= 0.9; n.vy *= 0.9; n.x += n.vx; n.y += n.vy;
    n.x = Math.max(16, Math.min(w - 16, n.x)); n.y = Math.max(16, Math.min(h - 16, n.y));
  }
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = '#0e8f8c55'; ctx.lineWidth = 1;
  for (let i = 1; i < mapNodes.length; i++) {
    ctx.beginPath(); ctx.moveTo(router.x, router.y); ctx.lineTo(mapNodes[i].x, mapNodes[i].y); ctx.stroke();
  }
  mapNodes.forEach((n) => {
    ctx.beginPath(); ctx.arc(n.x, n.y, n.router ? 9 : 5, 0, Math.PI * 2);
    ctx.fillStyle = n.router ? '#1fd6cf' : n.online ? '#1fd6cf' : '#ff7a1a';
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#566e74'; ctx.font = '9px monospace'; ctx.fillText(n.label, n.x + 8, n.y + 3);
  });
  requestAnimationFrame(stepMap);
}

// ── Spectrum Waterfall ───────────────────────────────────────────────────────
function powerColor(dbfs) {
  // DedSec spectrum: dark → teal → orange peaks (WD1 ctOS scan).
  const t = Math.max(0, Math.min(1, (dbfs + 110) / 100));
  if (t < 0.5) { const k = t * 2; return `rgb(${5 + k * 26 | 0},${8 + k * 206 | 0},${11 + k * 196 | 0})`; }
  const k = (t - 0.5) * 2; return `rgb(${31 + k * 224 | 0},${214 - k * 92 | 0},${207 - k * 181 | 0})`;
}
function pushWaterfall(p) {
  const cv = $('#waterfall'), ctx = cv.getContext('2d'), w = cv.width, h = cv.height;
  ctx.drawImage(cv, 0, 1); // scroll down 1px
  const cw = w / p.bins;
  for (let i = 0; i < p.bins; i++) { ctx.fillStyle = powerColor(p.row[i]); ctx.fillRect(i * cw, 0, cw + 1, 1); }
}

// ── HUD clock (desktop-shell feel) ───────────────────────────────────────────
function tickClock() {
  const c = $('#clock');
  if (c) c.textContent = new Date().toLocaleTimeString([], { hour12: false });
}
setInterval(tickClock, 1000); tickClock();

// ── Boot ─────────────────────────────────────────────────────────────────────
connect();
loadSystem(); loadDevices(); loadFinance(); loadAudit();
requestAnimationFrame(stepMap);
setInterval(loadFinance, 15000);
