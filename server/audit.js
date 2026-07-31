// Append-only, tamper-evident audit log.
// Every action attempt — allowed OR denied — is written as one JSON line whose
// hash chains to the previous entry (blockchain-style). If AUDIT_KEY is set the
// chain hash is an HMAC, making the log signed rather than merely hash-linked.
// Rewriting any past line breaks every subsequent hash, so tampering is visible.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const LOG = path.join(__dirname, '..', 'data', 'audit.log');
const KEY = process.env.AUDIT_KEY || null;

function digest(input) {
  return KEY
    ? crypto.createHmac('sha256', KEY).update(input).digest('hex')
    : crypto.createHash('sha256').update(input).digest('hex');
}

function lastHash() {
  if (!fs.existsSync(LOG)) return 'GENESIS';
  const lines = fs.readFileSync(LOG, 'utf8').trim().split('\n').filter(Boolean);
  if (!lines.length) return 'GENESIS';
  try { return JSON.parse(lines[lines.length - 1]).hash; }
  catch { return 'GENESIS'; }
}

// entry: { actor, verb, class, target, result, reason }
export function record(entry) {
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  const prev = lastHash();
  const row = {
    ts: new Date().toISOString(),
    actor: entry.actor || 'unknown',
    verb: entry.verb,
    class: entry.class,
    target: entry.target,
    result: entry.result,          // 'allow' | 'deny' | 'error'
    reason: entry.reason || null,
    prev,
    signed: Boolean(KEY),
  };
  row.hash = digest(prev + JSON.stringify(row));
  fs.appendFileSync(LOG, JSON.stringify(row) + '\n');
  return row;
}

// Walk the chain and confirm every link. Returns {ok, checked, brokenAt}.
export function verifyChain() {
  if (!fs.existsSync(LOG)) return { ok: true, checked: 0, brokenAt: null };
  const lines = fs.readFileSync(LOG, 'utf8').trim().split('\n').filter(Boolean);
  let prev = 'GENESIS';
  for (let i = 0; i < lines.length; i++) {
    let row;
    try { row = JSON.parse(lines[i]); }
    catch { return { ok: false, checked: i, brokenAt: i, reason: 'unparseable entry' }; }
    const { hash, ...body } = row;
    if (body.prev !== prev) return { ok: false, checked: i, brokenAt: i };
    // Recompute exactly as record() did: hash over prev + JSON(row-without-hash).
    const expected = digest(prev + JSON.stringify(body));
    if (expected !== hash) return { ok: false, checked: i, brokenAt: i };
    prev = hash;
  }
  return { ok: true, checked: lines.length, brokenAt: null };
}

export function tail(n = 50) {
  if (!fs.existsSync(LOG)) return [];
  const lines = fs.readFileSync(LOG, 'utf8').trim().split('\n').filter(Boolean);
  // A truncated final line (server killed mid-append) must not take out the
  // whole endpoint — skip unparseable rows rather than throwing.
  return lines.slice(-n).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}
