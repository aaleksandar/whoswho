// This phone's guest token. The server only shows the token once, at registration.

const KEY = 'whoswho.guest';

export function loadMe() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveMe(value) {
  const next = { token: value.token, id: value.id || null, name: value.name || '' };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function clearMe() {
  localStorage.removeItem(KEY);
}

/** `#t=` (recovery link) or `?t=`. Hash is not sent to the server. */
export function tokenFromLocation() {
  const hash = new URLSearchParams((location.hash || '').replace(/^#/, ''));
  if (hash.get('t')) return hash.get('t');
  return new URLSearchParams(location.search).get('t') || '';
}

export function rememberFromLocation(extra = {}) {
  const token = tokenFromLocation();
  if (!token) return loadMe();
  const saved = saveMe({ ...(loadMe() || {}), ...extra, token });
  const url = new URL(location.href);
  url.hash = '';
  url.searchParams.delete('t');
  history.replaceState(null, '', url.pathname + url.search + url.hash);
  return saved;
}

export function personalPath(token, path = '/me') {
  return `${path}#t=${encodeURIComponent(token)}`;
}
