// Push notifications to YOUR OWN phone. Opt-in and off unless configured.
//
//   ntfy      : CTOS_NTFY_TOPIC=my-secret-topic  [CTOS_NTFY_URL=https://ntfy.sh]
//   Pushover  : CTOS_PUSHOVER_TOKEN=... CTOS_PUSHOVER_USER=...
//
// Only ctOS's own events are sent (a device joined your LAN, the gate denied a
// command). Nothing about third parties is transmitted.
const NTFY_URL = process.env.CTOS_NTFY_URL || 'https://ntfy.sh';
const NTFY_TOPIC = process.env.CTOS_NTFY_TOPIC || null;
const PO_TOKEN = process.env.CTOS_PUSHOVER_TOKEN || null;
const PO_USER = process.env.CTOS_PUSHOVER_USER || null;

let lastSent = 0;
const MIN_GAP_MS = 4000; // simple rate limit so a noisy scan can't spam you

export function configured() {
  return Boolean(NTFY_TOPIC || (PO_TOKEN && PO_USER));
}

export function providers() {
  const p = [];
  if (NTFY_TOPIC) p.push('ntfy');
  if (PO_TOKEN && PO_USER) p.push('pushover');
  return p;
}

export async function push(title, message, { priority = 'default', tags = [] } = {}) {
  if (!configured()) return { sent: false, reason: 'not configured' };
  const now = Date.now();
  if (now - lastSent < MIN_GAP_MS) return { sent: false, reason: 'rate-limited' };
  lastSent = now;

  const results = [];
  if (NTFY_TOPIC) {
    try {
      const r = await fetch(`${NTFY_URL}/${NTFY_TOPIC}`, {
        method: 'POST',
        headers: {
          Title: title,
          Priority: priority === 'high' ? 'high' : 'default',
          ...(tags.length ? { Tags: tags.join(',') } : {}),
        },
        body: message,
      });
      results.push({ provider: 'ntfy', ok: r.ok });
    } catch (e) { results.push({ provider: 'ntfy', ok: false, error: e.message }); }
  }
  if (PO_TOKEN && PO_USER) {
    try {
      const r = await fetch('https://api.pushover.net/1/messages.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: PO_TOKEN, user: PO_USER, title, message, priority: priority === 'high' ? 1 : 0 }),
      });
      results.push({ provider: 'pushover', ok: r.ok });
    } catch (e) { results.push({ provider: 'pushover', ok: false, error: e.message }); }
  }
  return { sent: results.some((r) => r.ok), results };
}
