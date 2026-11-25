// Optional HTTP Basic auth for admin routes. Enabled only when ADMIN_PASSWORD is set.

import { timingSafeEqual, createHash } from 'node:crypto';

const digest = (s) => createHash('sha256').update(String(s)).digest();

export function checkAdmin(req, password = process.env.ADMIN_PASSWORD) {
  if (!password) return false;
  const expected = digest(password);
  const [scheme, encoded] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Basic' || !encoded) return false;
  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  const pass = decoded.slice(decoded.indexOf(':') + 1);
  const got = digest(pass);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export function adminAuth(password = process.env.ADMIN_PASSWORD) {
  if (!password) return (_req, _res, next) => next();
  return (req, res, next) => {
    if (checkAdmin(req, password)) return next();
    res.set('WWW-Authenticate', 'Basic realm="whoswho admin", charset="UTF-8"');
    res.status(401).json({ error: 'Admin password required' });
  };
}
