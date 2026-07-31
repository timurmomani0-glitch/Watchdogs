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
    else if (stream === 'alert') pushAlert(payload);
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
  if (r.denied) { noiseBurst(0.18, 0.05, 620); fireTear(); }
  else if (r.amber) blip(420, 0.06);
  else blip(760, 0.05);
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
  ctx.strokeStyle = '#33393b66'; ctx.lineWidth = 1;
  for (let i = 1; i < mapNodes.length; i++) {
    ctx.beginPath(); ctx.moveTo(router.x, router.y); ctx.lineTo(mapNodes[i].x, mapNodes[i].y); ctx.stroke();
  }
  mapNodes.forEach((n) => {
    ctx.beginPath(); ctx.arc(n.x, n.y, n.router ? 9 : 5, 0, Math.PI * 2);
    ctx.fillStyle = n.router ? '#eef1f2' : n.online ? '#aeb4b6' : '#4c5254';
    ctx.shadowColor = '#ffffff40'; ctx.shadowBlur = n.online || n.router ? 7 : 0; ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#4c5254'; ctx.font = '9px monospace'; ctx.fillText(n.label, n.x + 8, n.y + 3);
  });
  requestAnimationFrame(stepMap);
}

// ── Spectrum Waterfall ───────────────────────────────────────────────────────
function powerColor(dbfs) {
  // Monochrome spectrum: dark → white (greyscale surveillance).
  const t = Math.max(0, Math.min(1, (dbfs + 110) / 100));
  const v = 10 + (t * 228) | 0;
  return `rgb(${v},${v},${v + 3})`;
}
function pushWaterfall(p) {
  const cv = $('#waterfall'), ctx = cv.getContext('2d'), w = cv.width, h = cv.height;
  ctx.drawImage(cv, 0, 1); // scroll down 1px
  const cw = w / p.bins;
  for (let i = 0; i < p.bins; i++) { ctx.fillStyle = powerColor(p.row[i]); ctx.fillRect(i * cw, 0, cw + 1, 1); }
}

// ── Watch / telemetry / history / presence ──────────────────────────────────
async function loadWatch() {
  const w = await (await fetch('/api/watch')).json();
  const tag = $('#watchTag');
  if (tag) {
    tag.textContent = w.ran ? `${w.unregistered} unregistered` : 'idle';
    tag.className = 'tag ' + (w.unregistered > 0 ? '' : 'green');
    if (w.unregistered > 0) tag.style.color = 'var(--skull-red)', tag.style.borderColor = 'var(--skull-red)';
  }
  const meta = $('#watchMeta');
  if (meta) meta.textContent = w.ran
    ? `${w.cidr} · ${w.seen} seen · every ${(w.intervalMs / 1000) | 0}s` +
      (w.notify?.configured ? ` · push:${w.notify.providers.join('+')}` : ' · push:off')
    : 'register your network (npm run setup) to enable';
}

async function loadHistory() {
  const h = await (await fetch('/api/history')).json();
  const t = $('#histTag');
  if (t) t.textContent = `${h.stats.online}/${h.stats.total} online · ${h.stats.retentionDays}d`;
  const box = $('#hist');
  if (box) {
    box.innerHTML = h.events.slice(0, 14).map((e) => {
      const cls = e.kind === 'device.unregistered' ? 'deny' : e.kind === 'device.leave' ? 'muted' : 'ok';
      const label = { 'device.join': 'JOIN', 'device.leave': 'LEFT', 'device.return': 'BACK',
                      'device.unregistered': 'UNKNOWN' }[e.kind] || e.kind;
      return `<div class="a"><span class="t">${(e.ts || '').slice(11, 19)}</span>` +
             `<span class="${cls}">${label}</span> ${e.ip || ''} ${e.vendor ? '· ' + e.vendor : ''}</div>`;
    }).join('') || '<span class="muted">no device events yet</span>';
  }
  const p = await (await fetch('/api/presence')).json();
  const pb = $('#presence');
  if (pb) pb.innerHTML = p.totalRegistered
    ? `<div class="pres ${p.home ? 'on' : 'off'}">${p.home ? '◉ HOME' : '○ AWAY'}` +
      `<span class="muted small"> · ${p.onlineCount}/${p.totalRegistered} of your devices online</span></div>`
    : '<span class="muted small">register device MACs to enable presence</span>';
}

async function loadTelemetry() {
  const t = await (await fetch('/api/telemetry')).json();
  const box = $('#tele'); if (!box) return;
  box.classList.remove('muted');
  const bar = (pct) => `<span class="bar"><i style="width:${Math.max(2, Math.min(100, pct))}%"></i></span>`;
  const rows = [
    ['host', t.host], ['os', t.platform],
    ['cpu', `${t.cpu.pct}% ${bar(t.cpu.pct)} <span class="muted">${t.cpu.cores} cores</span>`],
    ['mem', `${t.mem.usedPct}% ${bar(t.mem.usedPct)} <span class="muted">${t.mem.totalGb} GB</span>`],
  ];
  if (t.disk) rows.push(['disk', `${t.disk.usedPct}% ${bar(t.disk.usedPct)} <span class="muted">${t.disk.freeGb} GB free</span>`]);
  rows.push(['uptime', `${t.uptimeHours} h`]);
  rows.push(['wan', t.wan.up ? `<span class="ok">up</span> ${t.wan.ms} ms <span class="muted">${t.wan.host}</span>`
                             : `<span class="deny">down</span> <span class="muted">${t.wan.host}</span>`]);
  box.innerHTML = rows.map(([k, v]) => `<div class="row"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('');
}

$('#sweepNow')?.addEventListener('click', async () => {
  const out = $('#watchOut');
  if (out) out.innerHTML = '<span class="muted">sweeping…</span>';
  const r = await (await fetch('/api/watch/sweep', { method: 'POST' })).json();
  if (out) out.innerHTML = r.ran
    ? `<div class="line"><span class="ok">SWEEP</span> ${r.seen} device(s) · ` +
      `<span class="${r.unregistered ? 'deny' : 'ok'}">${r.unregistered} unregistered</span></div>`
    : `<div class="line muted">${r.reason || 'not available'}</div>`;
  loadWatch(); loadHistory(); loadDevices();
});

// live alerts from the watcher
function pushAlert(a) {
  const out = $('#watchOut'); if (!out) return;
  const cls = a.kind === 'unregistered' ? 'deny' : a.kind === 'leave' ? 'muted' : 'ok';
  const label = { unregistered: 'UNREGISTERED', join: 'JOINED', leave: 'LEFT' }[a.kind] || a.kind;
  const el2 = el('div', 'line', `<span class="${cls}">${label}</span> ${a.ip || ''} ${C_mac(a.mac)} ${a.vendor ? '· ' + a.vendor : ''}`);
  out.prepend(el2);
  while (out.children.length > 10) out.lastChild.remove();
  if (a.kind === 'unregistered') { fireTear(); noiseBurst(0.2, 0.05, 520); }
  loadHistory();
}
const C_mac = (m) => m ? `<span class="muted">${m}</span>` : '';

// ── HUD clock (desktop-shell feel) ───────────────────────────────────────────
function tickClock() {
  const c = $('#clock');
  if (c) c.textContent = new Date().toLocaleTimeString([], { hour12: false });
}
setInterval(tickClock, 1000); tickClock();

// ── Sound (Web Audio, synthesized — unlocked on first user gesture) ──────────
let actx = null;
let muted = localStorage.getItem('ctosMuted') === '1';
function audioCtx() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (actx && actx.state === 'suspended') actx.resume();
  return actx;
}
function blip(freq = 640, dur = 0.05, type = 'square', gain = 0.03) {
  if (muted) return; const a = audioCtx(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = freq; o.connect(g); g.connect(a.destination);
  const t = a.currentTime; g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t); o.stop(t + dur);
}
function noiseBurst(dur = 0.14, gain = 0.04, freq = 1100) {
  if (muted) return; const a = audioCtx(); if (!a) return;
  const n = (a.sampleRate * dur) | 0, buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = a.createBufferSource(); s.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq;
  const g = a.createGain(); g.gain.value = gain;
  s.connect(f); f.connect(g); g.connect(a.destination); s.start();
}
function setMuted(m) {
  muted = m; localStorage.setItem('ctosMuted', m ? '1' : '0');
  const b = $('#sndToggle'); if (b) { b.classList.toggle('muted', m); b.textContent = m ? '♪ MUTE' : '♪ SND'; }
}
$('#sndToggle')?.addEventListener('click', () => { const m = !muted; setMuted(m); if (!m) blip(720, 0.05); });
setMuted(muted);
// keystroke + button blips
document.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (btn && btn.id !== 'sndToggle') blip(btn.classList.contains('danger') ? 300 : 620, 0.045);
});
document.addEventListener('keydown', () => blip(520, 0.02, 'square', 0.014));

// ── Glitch: monochrome RGB-tear sweep (red stays on the skull) ───────────────
function fireTear() {
  const t = $('#tear'); if (t) { t.classList.remove('fire'); void t.offsetWidth; t.classList.add('fire'); }
  document.body.classList.add('glitching');
  setTimeout(() => document.body.classList.remove('glitching'), 320);
  noiseBurst(0.09, 0.022, 1700);
}
function scheduleTear() {
  const delay = 9000 + Math.random() * 9000;
  setTimeout(() => { if (!$('#boot').offsetParent) fireTear(); scheduleTear(); }, delay);
}
scheduleTear();

// ── Boot intro ("we are dedsec / you are being watched") ─────────────────────
function runBoot() {
  const b = $('#boot'); if (!b) return;
  b.style.display = 'flex'; b.classList.remove('out'); void b.offsetWidth;
  let done = false;
  const finish = () => {
    if (done) return; done = true;
    audioCtx(); noiseBurst(0.25, 0.05, 500); blip(880, 0.08, 'sawtooth', 0.025);
    b.classList.add('out'); b.removeEventListener('click', finish);
    setTimeout(() => { b.style.display = 'none'; }, 650);
  };
  b.addEventListener('click', finish);
  clearTimeout(b._t); b._t = setTimeout(finish, 6200);
}
$('#replayIntro')?.addEventListener('click', runBoot);
runBoot();

// ── Boot ─────────────────────────────────────────────────────────────────────
connect();
loadSystem(); loadDevices(); loadFinance(); loadAudit();
loadWatch(); loadHistory(); loadTelemetry();
setInterval(loadTelemetry, 5000);
setInterval(() => { loadWatch(); loadHistory(); }, 20000);

// PWA — installable on your phone
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
requestAnimationFrame(stepMap);
setInterval(loadFinance, 15000);
