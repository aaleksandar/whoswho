// Optional reason rewrite. Off unless LLM_API_KEY and LLM_BASE_URL are both set.
// The deterministic reason from match.js is always the fallback. Facts are not invented:
// the model only receives the existing one-line reason, and a bad response is discarded.

const cache = new Map();

function endpoint() {
  const base = String(process.env.LLM_BASE_URL || '').trim().replace(/\/$/, '');
  const key = String(process.env.LLM_API_KEY || '').trim();
  if (!base || !key) return null;
  return { url: `${base}/chat/completions`, key, model: process.env.LLM_MODEL || 'gpt-4o-mini' };
}

export function llmEnabled() {
  return !!endpoint();
}

/**
 * @param {string} viewerName
 * @param {{guest:{name:string}, reason:string}[]} matches
 */
export async function maybeRewriteReasons(viewerName, matches) {
  const cfg = endpoint();
  if (!cfg || !matches?.length) return matches;
  const key = JSON.stringify(matches.map((row) => [row.guest?.name, row.reason]));
  if (cache.has(key)) return cache.get(key);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(cfg.url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.key}` },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: 'Rewrite each party-match reason as one warm, concrete sentence for the viewer. Use only the facts in the reason. Do not mention jobs, employers, or status. Return JSON {"reasons":["..."]} in the same order and the same length.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              viewer: viewerName,
              reasons: matches.map((row) => ({ name: row.guest?.name, reason: row.reason })),
            }),
          },
        ],
      }),
    });
    if (!res.ok) return matches;
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || '';
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return matches;
    const parsed = JSON.parse(text.slice(start, end + 1));
    const reasons = parsed?.reasons;
    if (!Array.isArray(reasons) || reasons.length !== matches.length) return matches;
    const next = matches.map((row, i) => {
      const line = typeof reasons[i] === 'string' ? reasons[i].replace(/\s+/g, ' ').trim() : '';
      if (!line || line.length > 220) return row;
      return { ...row, reason: line };
    });
    cache.set(key, next);
    return next;
  } catch {
    return matches;
  } finally {
    clearTimeout(timer);
  }
}
