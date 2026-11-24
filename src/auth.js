// Optional HTTP Basic auth for admin routes. Enabled only when ADMIN_PASSWORD is set.

import { timingSafeEqual, createHash } from 'node:crypto';

const digest = (s) => createHash('sha256').update(String(s)).digest();

export function adminAuth(password = process.env.ADMIN_PASSWORD) {
  if (!password) return (_req, _res, next) => next();
  const expected = digest(password);
  return (req, res, next) => {
    const [scheme, encoded] = (req.headers.authorization || '').split(' ');
    if (scheme === 'Basic' && encoded) {
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      const pass = decoded.slice(decoded.indexOf(':') + 1);
      if (timingSafeEqual(digest(pass), expected)) return next();
    }
    res.set('WWW-Authenticate', 'Basic realm="abu admin", charset="UTF-8"');
    res.status(401).json({ error: 'Admin password required' });
  };
}
