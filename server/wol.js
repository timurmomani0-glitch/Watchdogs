// Wake-on-LAN — boot YOUR OWN machines. The magic packet is a broadcast UDP
// frame containing the target MAC; it only wakes a machine you physically own
// and have configured to accept it. The scope gate (class 'wol') refuses any
// MAC that is not in your owned-asset registry, so this cannot be aimed
// elsewhere on the network.
import dgram from 'node:dgram';

function magicPacket(mac) {
  const clean = mac.replace(/[^0-9a-f]/gi, '');
  if (clean.length !== 12) throw new Error(`invalid MAC: ${mac}`);
  const bytes = Buffer.from(clean, 'hex');
  const pkt = Buffer.alloc(102);
  pkt.fill(0xff, 0, 6);                       // 6 x 0xFF preamble
  for (let i = 0; i < 16; i++) bytes.copy(pkt, 6 + i * 6); // MAC x16
  return pkt;
}

export function wake(mac, { broadcast = '255.255.255.255', port = 9 } = {}) {
  return new Promise((resolve, reject) => {
    let pkt;
    try { pkt = magicPacket(mac); } catch (e) { return reject(e); }
    const sock = dgram.createSocket('udp4');
    sock.once('error', (e) => { sock.close(); reject(e); });
    sock.bind(() => {
      sock.setBroadcast(true);
      sock.send(pkt, 0, pkt.length, port, broadcast, (err) => {
        sock.close();
        if (err) reject(err);
        else resolve({ woken: mac, broadcast, port, bytes: pkt.length });
      });
    });
  });
}
