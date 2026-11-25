// Optional invite gate. The code never goes in the public API.
// A valid link (?invite=CODE) sets an HttpOnly cookie holding an HMAC, not the code.

import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

const COOKIE = 'ww_invite';

export function inviteMac(code) {
  return createHmac('sha256', String(code)).update('whoswho-invite-v1').digest('base64url');
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function codeMatches(presented, code) {
  if (!code || presented == null || presented === '') return false;
  const mac = inviteMac(code);
  if (safeEqual(presented, mac)) return true;
  const digest = (s) => createHash('sha256').update(String(s)).digest();
  return timingSafeEqual(digest(presented), digest(code));
}

export function readCookie(req, name = COOKIE) {
  const raw = req.headers?.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) {
      try { return decodeURIComponent(rest.join('=')); } catch { return rest.join('='); }
    }
  }
  return '';
}

export function hasInvite(req, code) {
  if (!code) return true;
  if (codeMatches(readCookie(req), code)) return true;
  const header = req.get?.('x-invite-code') || req.headers?.['x-invite-code'];
  if (header && codeMatches(header, code)) return true;
  return false;
}

export function inviteCookie(code, { secure = false } = {}) {
  const bits = [
    `${COOKIE}=${inviteMac(code)}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${60 * 60 * 24 * 14}`,
  ];
  if (secure) bits.push('Secure');
  return bits.join('; ');
}

/** Local path only. Rejects protocol-relative and backslash tricks. */
export function safeNextPath(raw) {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return '';
  try {
    const url = new URL(raw, 'http://local');
    if (url.origin !== 'http://local') return '';
    if (!url.pathname.startsWith('/') || url.pathname.startsWith('//')) return '';
    return url.pathname + url.search;
  } catch {
    return '';
  }
}

export function destinationWithoutInvite(originalUrl) {
  const url = new URL(originalUrl, 'http://local');
  url.searchParams.delete('invite');
  const next = url.searchParams.get('next');
  const explicit = safeNextPath(next);
  if (explicit) return explicit;
  url.searchParams.delete('next');
  return url.pathname + url.search || '/';
}
