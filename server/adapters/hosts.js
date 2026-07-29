// Self-hosted service status + host telemetry.
//
// LIVE: scrape Prometheus node_exporter, or SSH to a registry host and read
// uptime/df/systemctl. `control` (restart a service) requires an explicit
// hosts[] entry in the registry — the scope gate enforces that separately.
const MODE = process.env.INTEGRATION_MODE || 'mock';

export async function status(hosts = []) {
  if (MODE === 'live') {
    // Placeholder: query Prometheus /api/v1/query or ssh <host> for metrics.
  }
  return hosts.map((h, i) => ({
    host: h.host,
    label: h.label || h.host,
    up: i % 5 !== 0,
    cpu: [8, 22, 3, 51, 14][i % 5],
    memPct: [34, 61, 28, 77, 45][i % 5],
    uptimeDays: [38, 121, 7, 2, 400][i % 5],
    services: ['sshd', 'nginx', 'home-assistant', 'wireguard'].slice(0, (i % 4) + 1),
  }));
}
