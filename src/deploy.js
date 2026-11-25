// Public URL vs LAN, and the rule that a non-LAN deploy must set ADMIN_PASSWORD.

export function isPrivateHost(host) {
  const h = String(host || '').trim().toLowerCase().replace(/\.$/, '');
  if (!h || h === 'localhost' || h === '::1' || h.endsWith('.local') || h.endsWith('.lan')) return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10 || a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

/** 'lan' when the advertised host is loopback or a private IP. Anything else is public. */
export function deploymentMode({ publicBaseUrl = '', publicHost = '' } = {}) {
  const base = String(publicBaseUrl || '').trim();
  if (base) {
    try {
      return isPrivateHost(new URL(base).hostname) ? 'lan' : 'public';
    } catch {
      return 'public';
    }
  }
  const host = String(publicHost || '').trim();
  if (host) return isPrivateHost(host) ? 'lan' : 'public';
  return 'lan';
}

export function assertSafeToListen(env = process.env) {
  const mode = deploymentMode({
    publicBaseUrl: env.PUBLIC_BASE_URL,
    publicHost: env.PUBLIC_HOST,
  });
  if (mode === 'public' && !String(env.ADMIN_PASSWORD || '').trim()) {
    const err = new Error(
      'ADMIN_PASSWORD is required when whoswho is not running on a LAN. Set ADMIN_PASSWORD before starting, or unset PUBLIC_BASE_URL and PUBLIC_HOST to stay on the local network.',
    );
    err.code = 'ADMIN_PASSWORD_REQUIRED';
    throw err;
  }
  return mode;
}

/** Base URL used in QR codes and copied links. PUBLIC_BASE_URL wins; otherwise the LAN host. */
export function resolvePublicBase({ publicBaseUrl = '', publicHost = '', port, lan }) {
  const raw = String(publicBaseUrl || '').trim().replace(/\/+$/, '');
  if (raw) return raw;
  const host = String(publicHost || '').trim() || lan || 'localhost';
  return `http://${host}:${port}`;
}
