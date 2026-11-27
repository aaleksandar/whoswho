// Fetch helpers + live updates over Server-Sent Events.

export async function api(method, url, body, headers = {}) {
  const res = await fetch(url, {
    method,
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.field = data.field;
    err.status = res.status;
    throw err;
  }
  return data;
}

/**
 * Subscribe to server events. `onResync` fires after every (re)connect so the
 * page can refetch anything it may have missed while disconnected.
 */
export function live({ guests, secrets, settings, onResync } = {}) {
  const es = new EventSource('/api/events');
  if (guests) es.addEventListener('guests', (e) => guests(JSON.parse(e.data)));
  if (secrets) es.addEventListener('secrets', (e) => secrets(JSON.parse(e.data)));
  if (settings) es.addEventListener('settings', (e) => settings(JSON.parse(e.data)));
  let connectedBefore = false;
  es.addEventListener('open', () => {
    if (connectedBefore) onResync?.();
    connectedBefore = true;
  });
  return es;
}
