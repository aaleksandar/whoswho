// Admin: list / edit / delete guests, display settings, reset.

import { h, $ } from './dom.js';
import { api, live } from './api.js';
import { avatarDataUri } from './avatar.js';
import { mountGuestForm } from './guest-form.js';

let guests = [];
let confirmingId = null;
const dialog = $('#edit-dialog');

// ------------------------------------------------------------------ guests
async function loadGuests() {
  guests = await api('GET', '/api/admin/guests');
  renderGuests();
}

const fmtTime = (iso) => {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

function renderGuests() {
  const q = $('#filter').value.trim().toLowerCase();
  const shown = [...guests]
    .reverse()
    .filter((g) => !q || [g.name, g.about, g.need, g.postcode, g.area, ...g.vibes].some((v) => v && v.toLowerCase().includes(q)));
  $('#guest-count').textContent = guests.length;
  $('#empty').hidden = guests.length > 0;
  $('#guest-rows').replaceChildren(
    ...shown.map((g) =>
      h('tr', { dataset: { id: g.id } },
        h('td', h('img.avatar-img', { src: avatarDataUri(g.avatar), alt: '', width: 44, height: 44 })),
        h('td.ad-name', g.name, g.about ? h('small.ad-about', { title: g.about }, g.about) : null),
        h('td', h('div.ad-vibes', g.vibes.map((v) => h('span.ad-vibe', v)))),
        h('td.ad-need', g.need || h('span.ad-dim', '—')),
        h('td.ad-loc',
          g.postcode ? h('span', g.postcode) : h('span.ad-dim', '—'),
          g.postcode ? h('small', g.area || 'not on map') : null),
        h('td.ad-dim', fmtTime(g.createdAt)),
        h('td.ad-actions',
          confirmingId === g.id
            ? [
                h('span.ad-sure', 'Sure?'),
                h('button.ad-btn.danger', { type: 'button', onclick: () => remove(g) }, 'Yes, delete'),
                h('button.ad-btn', { type: 'button', onclick: () => { confirmingId = null; renderGuests(); } }, 'No'),
              ]
            : [
                h('button.ad-btn', { type: 'button', onclick: () => edit(g) }, 'Edit'),
                h('button.ad-btn.danger-ghost', { type: 'button', onclick: () => { confirmingId = g.id; renderGuests(); } }, 'Delete'),
              ],
        ),
      ),
    ),
  );
}

async function remove(g) {
  try {
    await api('DELETE', `/api/admin/guests/${g.id}`);
  } catch (e) {
    if (e.status !== 404) alertInline(e.message);
  }
  confirmingId = null;
  await loadGuests();
}

function edit(g) {
  $('#edit-title').textContent = `Edit ${g.name}`;
  mountGuestForm($('#edit-body'), {
    initial: g,
    submitLabel: 'Save changes',
    onCancel: () => dialog.close(),
    onSubmit: async (value) => {
      await api('PUT', `/api/admin/guests/${g.id}`, value);
      dialog.close();
      await loadGuests();
    },
  });
  dialog.showModal();
  $('#edit-body').scrollTop = 0;
}
dialog.addEventListener('click', (e) => {
  if (e.target === dialog) dialog.close(); // click on backdrop
});

function alertInline(msg) {
  const s = $('#reset-status');
  s.textContent = msg;
  s.className = 'ad-status err';
}

$('#filter').addEventListener('input', renderGuests);

// ---------------------------------------------------------------- settings
const sf = $('#settings-form');

function fillSettings(s) {
  sf.title.value = s.title;
  sf.rotateSeconds.value = s.rotateSeconds;
  for (const cb of sf.querySelectorAll('input[name=views]')) cb.checked = s.views.includes(cb.value);
}

function flash(el, msg, ok = true) {
  el.textContent = msg;
  el.className = `ad-status ${ok ? 'ok' : 'err'}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.textContent = ''; }, 4000);
}

sf.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const s = await api('PUT', '/api/settings', {
      title: sf.title.value,
      rotateSeconds: Number(sf.rotateSeconds.value),
      views: [...sf.querySelectorAll('input[name=views]:checked')].map((cb) => cb.value),
    });
    fillSettings(s);
    flash($('#settings-status'), 'Saved ✓ — display updated');
  } catch (err) {
    flash($('#settings-status'), err.message, false);
  }
});

// ------------------------------------------------------------------- reset
$('#reset-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = e.target.confirm;
  if (input.value !== 'DELETE') return flash($('#reset-status'), 'Type DELETE (in capitals) to confirm', false);
  try {
    const r = await api('DELETE', '/api/admin/guests', { confirm: 'DELETE' });
    input.value = '';
    flash($('#reset-status'), `Deleted ${r.deleted} guest${r.deleted === 1 ? '' : 's'}`);
    await loadGuests();
  } catch (err) {
    flash($('#reset-status'), err.message, false);
  }
});

// ---------------------------------------------------------------- network
async function loadInfo() {
  const info = await api('GET', '/api/info');
  const row = (label, url) =>
    [h('dt', label), h('dd', h('a', { href: url, target: '_blank' }, url),
      h('button.ad-btn.small', { type: 'button', onclick: (e) => copy(url, e.target) }, 'Copy'))];
  $('#urls').replaceChildren(...row('Display', info.homeUrl), ...row('Register', info.hiUrl), ...row('Admin', info.adminUrl));
}

async function copy(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = 'Copied';
  } catch {
    btn.textContent = 'Select & copy';
  }
  setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
}

// -------------------------------------------------------------------- boot
const boot = async () => {
  fillSettings(await api('GET', '/api/settings'));
  await loadGuests();
  loadInfo().catch(() => {});
};
await boot();
live({
  guests: () => { if (!dialog.open) loadGuests(); },
  settings: fillSettings,
  onResync: boot,
});
dialog.addEventListener('close', () => loadGuests());
