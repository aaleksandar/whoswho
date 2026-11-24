import { h, $ } from './dom.js';
import { api } from './api.js';
import { avatarDataUri } from './avatar.js';
import { mountGuestForm } from './guest-form.js';

const main = $('#hi-main');

api('GET', '/api/settings')
  .then((s) => {
    if (s.title) document.title = `Say hi 👋 · ${s.title}`;
  })
  .catch(() => {});

function showForm() {
  mountGuestForm(main, {
    submitLabel: 'Put me on the board!',
    onSubmit: async (value) => {
      const guest = await api('POST', '/api/guests', value);
      showDone(guest);
    },
  });
}

function showDone(guest) {
  main.replaceChildren(
    h('div.hi-done',
      h('img.avatar-img', { src: avatarDataUri(guest.avatar), alt: '' }),
      h('h2', `You're in, ${guest.name}!`),
      h('p', "Look at the big screen 👀 you're on the board."),
      h('button', { type: 'button', onclick: showForm }, '➕ Register someone else'),
    ),
  );
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

showForm();
