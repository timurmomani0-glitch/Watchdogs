// Flipper Zero bridge — read/emulate YOUR OWN cards and sub-GHz remotes.
//
// LIVE: the Flipper exposes a serial CLI over USB (/dev/ttyACM0). Commands like
// `nfc detect`, `rfid read`, `subghz rx` are issued over that port. Emulation is
// gated by the scope gate (uid must be in registry.rfid) and jurisdiction
// (rfid_emulation_allowed). Reading is always allowed; nothing here attacks a
// third-party credential.
const MODE = process.env.INTEGRATION_MODE || 'mock';
const PORT = process.env.FLIPPER_PORT || '/dev/ttyACM0';

export async function read(kind = 'nfc') {
  if (MODE === 'live') {
    // Placeholder: open serial to PORT, issue `${kind} read`, parse UID.
  }
  return { kind, uid: '04A1B2C3', tech: kind === 'nfc' ? 'ISO14443A' : 'EM4100', source: 'mock', port: PORT };
}

export async function emulate(uid) {
  if (MODE === 'live') {
    // Placeholder: `nfc emulate` / `rfid emulate` with the stored dump for UID.
  }
  return { uid, emulating: true, source: 'mock' };
}
