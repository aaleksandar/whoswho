import { h, $ } from './dom.js';
import { api } from './api.js';
import { mountGuestForm } from './guest-form.js';
import { clearMe, loadMe, rememberFromLocation, saveMe } from './me-store.js';

const main = $('#me-main');
rememberFromLocation();

function headers() {
  const me = loadMe();
  return me?.token ? { 'x-guest-token': me.token } : null;
}

function pasteToken() {
  const input = h('input', { type: 'text', placeholder: 'Paste your personal link or token', autocomplete: 'off' });
  const error = h('p.gf-error', { hidden: true });
  main.replaceChildren(h('section.gf-card',
    h('h2', 'This phone does not have your card yet'),
    h('p', 'Open the personal link from the phone you registered on, or paste it here.'),
    input,
    error,
    h('button.land-btn', {
      type: 'button',
      onclick: () => {
        const raw = input.value.trim();
        const hash = raw.includes('#t=') ? decodeURIComponent(raw.split('#t=')[1]) : raw;
        if (!hash) { error.hidden = false; error.textContent = 'Paste the link first.'; return; }
        saveMe({ token: hash });
        load();
      },
    }, 'Open my card'),
    h('p', h('a', { href: '/hi' }, 'Or register again')),
  ));
}

async function load() {
  const tokenHeaders = headers();
  if (!tokenHeaders) return pasteToken();
  let me;
  try {
    me = await api('GET', '/api/me', undefined, tokenHeaders);
  } catch (err) {
    if (err.code === 'token' || err.status === 401) return pasteToken();
    main.replaceChildren(h('p', err.message));
    return;
  }
  saveMe({ token: loadMe().token, id: me.id, name: me.name });
  mountGuestForm(main, {
    initial: me,
    submitLabel: 'Save my card',
    onCancel: () => { location.href = '/night'; },
    onDelete: async () => {
      if (!confirm('Delete your card? This takes you off the board.')) return;
      await api('DELETE', '/api/me', undefined, headers());
      clearMe();
      location.href = '/';
    },
    onSubmit: async (value) => {
      const saved = await api('PUT', '/api/me', value, headers());
      saveMe({ token: loadMe().token, id: saved.id, name: saved.name });
      location.href = '/night?saved=1';
    },
  });
}

load();
