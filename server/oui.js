// Offline MAC → vendor lookup. A compact table of the OUI prefixes you actually
// meet on a home LAN — no network call, no third-party database dependency.
// Unknown prefixes simply return null rather than guessing.
const OUI = {
  // networking
  '00:1a:11': 'Google', '00:1d:7e': 'Cisco-Linksys', '00:0c:29': 'VMware',
  '00:50:56': 'VMware', '08:00:27': 'VirtualBox', '52:54:00': 'QEMU/KVM',
  '00:15:5d': 'Microsoft Hyper-V', 'dc:a6:32': 'Raspberry Pi', 'b8:27:eb': 'Raspberry Pi',
  'e4:5f:01': 'Raspberry Pi', '28:cd:c1': 'Raspberry Pi', '2c:cf:67': 'Raspberry Pi',
  '00:1b:44': 'SanDisk', 'f4:f5:d8': 'Google', '3c:5a:b4': 'Google', '18:b4:30': 'Nest',
  '00:17:88': 'Philips Hue', 'ec:b5:fa': 'Philips Hue', '00:24:e4': 'Withings',
  // Ubiquiti / MikroTik / TP-Link / Netgear
  '24:a4:3c': 'Ubiquiti', 'fc:ec:da': 'Ubiquiti', '78:8a:20': 'Ubiquiti', '68:d7:9a': 'Ubiquiti',
  '4c:5e:0c': 'MikroTik', '48:8f:5a': 'MikroTik', 'dc:2c:6e': 'MikroTik',
  '50:c7:bf': 'TP-Link', 'a4:2b:b0': 'TP-Link', '14:cc:20': 'TP-Link', 'c0:06:c3': 'TP-Link',
  '00:14:6c': 'Netgear', '20:4e:7f': 'Netgear', 'a0:40:a0': 'Netgear',
  '00:18:0a': 'Meraki', '2c:3a:fd': 'Meraki',
  // Apple
  '00:1c:b3': 'Apple', '3c:07:54': 'Apple', 'f0:18:98': 'Apple', 'a4:83:e7': 'Apple',
  '90:72:40': 'Apple', 'd0:81:7a': 'Apple', '04:d3:cf': 'Apple', 'ac:bc:32': 'Apple',
  // Samsung / phones
  '00:12:fb': 'Samsung', '5c:0a:5b': 'Samsung', '78:1f:db': 'Samsung', 'e8:50:8b': 'Samsung',
  '00:26:37': 'Samsung', '40:4e:36': 'HTC', '00:ee:bd': 'HTC',
  '18:f0:e4': 'Xiaomi', '64:09:80': 'Xiaomi', '28:6c:07': 'Xiaomi', '3c:bd:3e': 'Xiaomi',
  '00:9a:cd': 'Huawei', '48:46:fb': 'Huawei', 'c0:70:09': 'Huawei',
  // IoT / smart home
  '2c:f4:32': 'Espressif (ESP32)', '24:6f:28': 'Espressif (ESP32)', '30:ae:a4': 'Espressif (ESP32)',
  '84:cc:a8': 'Espressif (ESP32)', '80:7d:3a': 'Espressif (ESP32)', 'a4:cf:12': 'Espressif (ESP32)',
  'b4:e6:2d': 'Espressif (ESP32)', '10:52:1c': 'Espressif (ESP32)', '3c:61:05': 'Espressif (ESP32)',
  'd8:f1:5b': 'Espressif (ESP32)', 'bc:dd:c2': 'Espressif (ESP32)', 'cc:50:e3': 'Espressif (ESP32)',
  '68:c6:3a': 'Espressif (ESP32)', '2c:3a:e8': 'Espressif (ESP32)',
  '50:02:91': 'Sonoff/ITEAD', '00:1a:22': 'eQ-3/Homematic', '54:ef:44': 'Aqara/Lumi',
  '04:cf:8c': 'Xiaomi/Aqara', '7c:49:eb': 'Shelly', '8c:aa:b5': 'Shelly', '3c:61:05': 'Shelly',
  'b0:b2:1c': 'Espressif/Shelly', '98:cd:ac': 'Espressif',
  // NAS / servers / storage
  '00:11:32': 'Synology', '00:08:9b': 'ICP Electronics', '24:5e:be': 'QNAP', '00:1b:21': 'Intel',
  '00:e0:4c': 'Realtek', '00:1e:06': 'WIBRAIN', '1c:69:7a': 'EliteGroup',
  // TVs / media
  '00:24:be': 'Sony', 'ac:9b:0a': 'Sony', '18:17:25': 'Cameo/LG', '00:1c:62': 'LG',
  'cc:b1:1a': 'Roku', 'b8:3e:59': 'Roku', 'd8:31:34': 'Roku',
  '74:c2:46': 'Amazon', 'f0:27:2d': 'Amazon', '68:37:e9': 'Amazon',
  // printers
  '00:15:99': 'Samsung', '00:1b:a9': 'Brother', '30:05:5c': 'Brother', '00:80:77': 'Brother',
  '9c:93:4e': 'Xerox', '00:1e:8f': 'Canon', '00:00:48': 'Epson', 'a4:5d:36': 'HP',
};

export function vendorOf(mac) {
  if (!mac) return null;
  const p = mac.toLowerCase().split(':').slice(0, 3).join(':');
  if (OUI[p]) return OUI[p];
  // locally-administered / randomised MAC (privacy addressing on modern phones)
  const first = parseInt(mac.split(':')[0], 16);
  if (!Number.isNaN(first) && (first & 0x02)) return 'randomised MAC';
  return null;
}

export const ouiCount = Object.keys(OUI).length;
