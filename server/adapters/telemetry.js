// Real telemetry for the machine ctOS is running on. No mock, no hardware —
// this is your own box, so it is always in scope.
import os from 'node:os';
import fs from 'node:fs';
import { execFile } from 'node:child_process';

let lastCpu = null;

function cpuUsage() {
  const cpus = os.cpus();
  const agg = cpus.reduce((a, c) => {
    for (const k of Object.keys(c.times)) a[k] = (a[k] || 0) + c.times[k];
    return a;
  }, {});
  const idle = agg.idle;
  const total = Object.values(agg).reduce((a, b) => a + b, 0);
  let pct = 0;
  if (lastCpu) {
    const dIdle = idle - lastCpu.idle;
    const dTotal = total - lastCpu.total;
    if (dTotal > 0) pct = Math.max(0, Math.min(100, (1 - dIdle / dTotal) * 100));
  }
  lastCpu = { idle, total };
  return { pct: Number(pct.toFixed(1)), cores: cpus.length, model: cpus[0]?.model?.trim() || 'unknown' };
}

function diskFree() {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      execFile('wmic', ['logicaldisk', 'get', 'size,freespace,caption'], { windowsHide: true, timeout: 6000 }, (e, out) => {
        if (e) return resolve(null);
        const rows = out.split('\n').map((l) => l.trim().match(/^(\w:)\s+(\d+)\s+(\d+)/)).filter(Boolean);
        const tot = rows.reduce((a, r) => a + Number(r[3]), 0);
        const free = rows.reduce((a, r) => a + Number(r[2]), 0);
        resolve(tot ? { totalGb: +(tot / 1e9).toFixed(1), freeGb: +(free / 1e9).toFixed(1), usedPct: +(((tot - free) / tot) * 100).toFixed(1) } : null);
      });
    } else {
      execFile('df', ['-kP', '/'], { timeout: 6000 }, (e, out) => {
        if (e) return resolve(null);
        const m = out.split('\n')[1]?.split(/\s+/);
        if (!m) return resolve(null);
        const tot = Number(m[1]) * 1024, used = Number(m[2]) * 1024, free = Number(m[3]) * 1024;
        resolve({ totalGb: +(tot / 1e9).toFixed(1), freeGb: +(free / 1e9).toFixed(1), usedPct: +((used / tot) * 100).toFixed(1) });
      });
    }
  });
}

// WAN reachability + latency, measured against a host you choose (default
// Cloudflare DNS). This is an ordinary connectivity check of YOUR OWN link.
function wanCheck(host = process.env.CTOS_WAN_PROBE || '1.1.1.1') {
  return new Promise((resolve) => {
    const win = process.platform === 'win32';
    const args = win ? ['-n', '1', '-w', '2000', host] : ['-c', '1', '-W', '2', host];
    const t0 = Date.now();
    execFile('ping', args, { windowsHide: true, timeout: 6000 }, (err, out) => {
      if (err) return resolve({ up: false, ms: null, host });
      const m = String(out).match(/[=<]\s*([\d.]+)\s*ms/i);
      resolve({ up: true, ms: m ? Number(m[1]) : Date.now() - t0, host });
    });
  });
}

function loadAvg() {
  const [a, b, c] = os.loadavg();
  return process.platform === 'win32' ? null : { 1: +a.toFixed(2), 5: +b.toFixed(2), 15: +c.toFixed(2) };
}

export async function snapshot() {
  const total = os.totalmem(), free = os.freemem();
  const [disk, wan] = await Promise.all([diskFree(), wanCheck()]);
  return {
    host: os.hostname(),
    platform: `${os.type()} ${os.release()}`,
    arch: os.arch(),
    uptimeHours: +(os.uptime() / 3600).toFixed(1),
    cpu: cpuUsage(),
    mem: { totalGb: +(total / 1e9).toFixed(1), usedPct: +(((total - free) / total) * 100).toFixed(1) },
    disk,
    load: loadAvg(),
    wan,
  };
}
