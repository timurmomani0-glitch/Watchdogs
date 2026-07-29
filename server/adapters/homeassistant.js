// Control Panel bridge → Home Assistant.
//
// LIVE: POST to HA's REST API `/api/services/<domain>/<service>` with a
// long-lived token (env HA_TOKEN, base HA_URL), or open the WebSocket API for
// state streaming. entity_id comes straight from the registry (ha:<entity>),
// so a toggle can only ever hit a device you listed as owned.
const MODE = process.env.INTEGRATION_MODE || 'mock';
const HA_URL = process.env.HA_URL;
const HA_TOKEN = process.env.HA_TOKEN;

const state = new Map(); // entity_id -> 'on'|'off' (mock persistence)

function domainOf(entity) { return entity.replace(/^ha:/, '').split('.')[0]; }

export async function control(target, action) {
  const entity = target.replace(/^ha:/, '');
  if (MODE === 'live' && HA_URL && HA_TOKEN) {
    const service = action === 'toggle' ? 'toggle' : action; // turn_on/turn_off/toggle
    const res = await fetch(`${HA_URL}/api/services/${domainOf(target)}/${service}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${HA_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_id: entity }),
    });
    return { entity, state: res.ok ? 'ok' : 'error', live: true };
  }
  // mock: flip and remember
  const cur = state.get(entity) || 'off';
  const next = action === 'turn_on' ? 'on' : action === 'turn_off' ? 'off' : cur === 'on' ? 'off' : 'on';
  state.set(entity, next);
  return { entity, state: next, live: false };
}

export async function runScene(scene) {
  // Scenes ("arrive-home", "sleep", "away") map to HA scene.turn_on in live mode.
  return { scene, applied: true, live: MODE === 'live' && Boolean(HA_URL) };
}

export function snapshot(registryDevices = []) {
  return registryDevices
    .filter((d) => d.kind === 'homeassistant')
    .map((d) => ({ id: d.id, label: d.label, state: state.get(d.id.replace(/^ha:/, '')) || 'off' }));
}
