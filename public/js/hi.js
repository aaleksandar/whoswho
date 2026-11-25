import { h, $ } from './dom.js';
import { api } from './api.js';
import { mountGuestForm } from './guest-form.js';
import { loadMe, saveMe, clearMe } from './me-store.js';

const main = $('#hi-main');
const params = new URLSearchParams(location.search);

api('GET', '/api/event')
  .then((event) => { if (event?.title) document.title = event.title; })
  .catch(() => {});

function authHeaders() {
  const me = loadMe();
  return me?.token ? { 'x-guest-token': me.token } : {};
}

function afterSave(guest) {
  const token = guest.editToken || loadMe()?.token;
  saveMe({ token, id: guest.id, name: guest.name });
  const door = params.get('door') ? '&door=1' : '';
  location.assign(`/night?welcome=1${door}#t=${encodeURIComponent(token)}`);
}

function showForm(initial, editing) {
  const slot = h('div');
  main.replaceChildren(slot);
  mountGuestForm(slot, {
    initial,
    submitLabel: 'Done',
    onSubmit: async (value) => {
      const guest = editing
        ? await api('PUT', '/api/me', value, authHeaders())
        : await api('POST', '/api/guests', value);
      afterSave(guest);
    },
  });
}

function showPicker(open) {
  const slot = h('div');
  main.replaceChildren(
    h('section.gf-card',
      h('div.gf-label', 'Your name'),
      h('div.gf-vibe-suggestions', ...open.map((row) => h('button.gf-chip', {
        type: 'button',
        onclick: () => claim(row.id),
      }, row.name))),
      h('button.land-btn.ghost', { type: 'button', onclick: () => showForm(null, false) }, 'Not on the list'),
    ),
    slot,
  );
}

async function claim(id) {
  const guest = await api('POST', '/api/claim', { id });
  saveMe({ token: guest.editToken, id: guest.id, name: guest.name });
  showForm(guest, true);
}

async function boot() {
  const me = loadMe();
  if (me?.token) {
    try {
      const guest = await api('GET', '/api/me', undefined, authHeaders());
      showForm(guest, true);
      return;
    } catch {
      clearMe();
    }
  }
  try {
    const open = await api('GET', '/api/open');
    if (open?.length) { showPicker(open); return; }
  } catch { /* invite gate or empty */ }
  showForm(null, false);
}

boot();
