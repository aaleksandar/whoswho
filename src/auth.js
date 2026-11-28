// HTTP Basic auth for admin routes, with Web Crypto only (runs on Node and on
// Cloudflare Workers). A "verifier" is an async (password) => boolean; no
// verifier means the admin is open (a laptop party with no ADMIN_PASSWORD).

const enc = new TextEncoder();
const sha256 = async (s) => new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(String(s))));
const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

/** Constant-time compare of two equal-length byte arrays. */
function equal(x, y) {
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/** A verifier for a plain password (from .env or a Worker secret). */
export function passwordVerifier(password) {
  if (!password) return null;
  return async (pass) => equal(await sha256(pass), await sha256(password));
}

/** Salted PBKDF2-SHA256, for passwords people choose when they create a party. */
export async function hashPassword(pass, saltHex = hex(crypto.getRandomValues(new Uint8Array(16)))) {
  const salt = Uint8Array.from(saltHex.match(/../g), (h) => parseInt(h, 16));
  const key = await crypto.subtle.importKey('raw', enc.encode(String(pass)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 }, key, 256);
  return { salt: saltHex, hash: hex(new Uint8Array(bits)) };
}

/** A verifier for a stored {salt, hash}. */
export function hashVerifier({ salt, hash }) {
  return async (pass) => equal(enc.encode((await hashPassword(pass, salt)).hash), enc.encode(hash));
}

/** @returns {Promise<boolean>} whether this Authorization header may use admin routes */
export async function checkAdmin(header, verify) {
  if (!verify) return true;
  const [scheme, encoded] = (header || '').split(' ');
  if (scheme !== 'Basic' || !encoded) return false;
  let decoded;
  try {
    decoded = new TextDecoder().decode(Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)));
  } catch {
    return false;
  }
  return verify(decoded.slice(decoded.indexOf(':') + 1));
}
