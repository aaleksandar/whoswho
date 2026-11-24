// Work out which IPv4 address other devices on the LAN can reach us on.

import os from 'node:os';

const SKIP_IFACE = /^(lo|utun|ipsec|bridge|docker|veth|vboxnet|vmnet|awdl|llw|gif|stf|anpi|ap\d|tailscale|zt|wg)/i;
const PREFERRED_IFACE = /^(en\d|eth\d|wlan\d|wl|Wi-?Fi|Ethernet)/i;

function isPrivate(ip) {
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

/** All candidate addresses, best first. */
export function lanAddresses(ifaces = os.networkInterfaces()) {
  const out = [];
  for (const [name, addrs] of Object.entries(ifaces)) {
    for (const a of addrs || []) {
      const v4 = a.family === 'IPv4' || a.family === 4;
      if (!v4 || a.internal || a.address.startsWith('169.254.')) continue;
      const score =
        (isPrivate(a.address) ? 4 : 0) +
        (PREFERRED_IFACE.test(name) ? 2 : 0) +
        (SKIP_IFACE.test(name) ? -10 : 0) +
        (a.address.startsWith('192.168.') ? 1 : 0);
      out.push({ name, address: a.address, score });
    }
  }
  return out.sort((x, y) => y.score - x.score || x.name.localeCompare(y.name, 'en', { numeric: true }));
}

/** Host other devices should use. PUBLIC_HOST overrides detection. */
export function lanHost() {
  if (process.env.PUBLIC_HOST) return process.env.PUBLIC_HOST;
  return lanAddresses()[0]?.address || 'localhost';
}
