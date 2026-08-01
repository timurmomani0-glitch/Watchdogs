// Voice vocabulary — the speakable command surface, derived ENTIRELY from the
// owned-asset registry.
//
// The voice layer is a new INPUT, not a new capability. Everything a spoken
// command can do is something the typed command bus can already do: each phrase
// is turned into the same { verb, class, target } and passes through the same
// scope gate. This module exists so the browser's grammar can resolve a spoken
// label ("living room lights", "the nas") to a target — and it can ONLY ever
// resolve to targets that are already in the registry. There is no path here by
// which speech names something you do not own; buildVocab reads the registry
// and nothing else. An out-of-scope target can still be spoken verbatim, but it
// is denied by the gate exactly as a typed one would be.
//
// buildVocab is a pure function so the selftest can prove that property.

const isMac = (s) => /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(String(s || ''));

export function buildVocab(config) {
  const reg = config.registry || {};
  const jur = config.jurisdiction || {};
  const devices = reg.devices || [];

  const ha = devices
    .filter((d) => d.kind === 'homeassistant' && String(d.id).startsWith('ha:'))
    .map((d) => ({ label: d.label || d.id, target: d.id }));

  // Wake-on-LAN: only devices whose id IS a MAC. That is exactly what the wol
  // branch of the scope gate matches on, so a label can never resolve to a MAC
  // that is not registered.
  const wol = devices
    .filter((d) => isMac(d.id))
    .map((d) => ({ label: d.label || d.id, target: 'mac:' + String(d.id).toLowerCase() }));

  const cameras = devices
    .filter((d) => d.kind === 'camera' && String(d.id).startsWith('ha:'))
    .map((d) => ({ label: d.label || d.id, target: d.id }));

  const accounts = (reg.accounts || [])
    .map((a) => ({ label: a.label || a.id, target: a.id }));

  const txBand = (reg.rf?.tx_bands || [])[0]?.center_hz || null;
  const rfid = (reg.rfid || [])[0]?.uid || null;

  // The global AMBER kill-switch dominates the per-capability flags, exactly as
  // the scope gate treats it: if amber_enabled is false, NO amber target is
  // offered even if tx_allowed / rfid_emulation_allowed are (stale-)true. Without
  // this the assistant would offer to key up a radio the gate then refuses.
  const amberOn = jur.amber_enabled !== false;

  return {
    cidr: reg.networks?.[0]?.cidr || null,
    ha,
    wol,
    cameras,
    accounts,
    // AMBER targets are surfaced only when the jurisdiction profile enables the
    // capability AND the global kill-switch is on — so the assistant never offers
    // an action the gate would refuse.
    tx: (amberOn && jur.rf?.tx_allowed && txBand) ? { target: 'rf:' + txBand, hz: txBand } : null,
    rfid: (amberOn && jur.rfid_emulation_allowed && rfid) ? { target: 'nfc:' + rfid, uid: rfid } : null,
    amber_enabled: amberOn,
  };
}
