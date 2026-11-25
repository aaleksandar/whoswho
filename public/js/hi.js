import { h, $ } from './dom.js';
import { api } from './api.js';
import { mountGuestForm } from './guest-form.js';
import { loadMe, saveMe } from './me-store.js';

const main = $('#hi-main');

api('GET', '/api/event')
  .then((event) => {
    if (event?.title) document.title = event.title;
  })
  .catch(() => {});

function showForm() {
  const existing = loadMe();
  const banner = existing?.name
    ? h('p.hi-banner', `This phone already has ${existing.name}. `, h('a', { href: '/night' }, 'Tonight\'s page'), ' · ', h('a', { href: '/me' }, 'Edit your card'))
    : null;
  const slot = h('div');
  main.replaceChildren(banner, slot);
  mountGuestForm(slot, {
    submitLabel: 'Put me on the board',
    onSubmit: async (value) => {
      const guest = await api('POST', '/api/guests', value);
      saveMe({ token: guest.editToken, id: guest.id, name: guest.name });
      location.assign(`/night?welcome=1#t=${encodeURIComponent(guest.editToken)}`);
    },
  });
}

showForm();
