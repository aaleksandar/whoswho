// Invite / intent landing. Event copy comes from /api/event (src/event.js).

import { h, $ } from './dom.js';
import { api } from './api.js';

const root = $('#land');
const params = new URLSearchParams(location.search);

function countsLine(counts) {
  const bits = [];
  if (counts.going) bits.push(`${counts.going} coming`);
  if (counts.maybe) bits.push(`${counts.maybe} maybe`);
  return bits.length ? bits.join(' · ') : 'Be the first to say you are coming';
}

function rsvpCard(event) {
  const name = h('input', {
    type: 'text', name: 'name', maxLength: 40, required: true, autocomplete: 'nickname',
    placeholder: 'Your name', value: '',
  });
  let status = 'going';
  const choices = h('div.gf-vibe-suggestions');
  const options = [
    ['going', "I'll be there"],
    ['maybe', 'Maybe'],
    ['no', "Can't make it"],
  ];
  const draw = () => {
    choices.replaceChildren(...options.map(([id, label]) => h(status === id ? 'button.gf-chip.on' : 'button.gf-chip', {
      type: 'button',
      onclick: () => { status = id; draw(); },
    }, label)));
  };
  draw();
  const error = h('p.gf-error', { hidden: true });
  const counts = h('p.land-counts', countsLine(event.counts || {}));
  const form = h('form.gf-card', {
    onsubmit: async (e) => {
      e.preventDefault();
      error.hidden = true;
      if (!name.value.trim()) { error.hidden = false; error.textContent = 'A name is enough.'; name.focus(); return; }
      try {
        const saved = await api('POST', '/api/rsvp', { name: name.value.trim(), status });
        sessionStorage.setItem('ww.rsvp', JSON.stringify({ name: saved.name, status: saved.status }));
        counts.textContent = countsLine(saved.counts);
        form.replaceWith(h('section.gf-card',
          h('h2.land-sub', saved.status === 'no' ? 'We will miss you.' : 'You are on the list.'),
          h('p', saved.status === 'no'
            ? 'If you still want a card on the board, you can leave one. You will not show on the screen.'
            : 'If you are coming, tell the room who you are. A few minutes on your phone, most of it optional.'),
          event.invited || !event.gated
            ? h('a.land-btn', { href: '/hi' }, 'Introduce yourself')
            : h('p.gf-hint', 'Use the invite link Aleksandar sent you, then introduce yourself.'),
        ));
      } catch (err) {
        error.hidden = false;
        error.textContent = err.message;
      }
    },
  },
    h('h2.land-sub', 'RSVP'),
    counts,
    name,
    choices,
    error,
    h('button.land-btn', { type: 'submit' }, "That's me"),
  );
  return form;
}

function inviteCard(event) {
  if (!event.gated || event.invited) {
    return h('section.gf-card.land-enter',
      h('h2.land-sub', 'Come as you are'),
      h('p', 'Tell the room the chapter you are in, what you need, what you can offer. Then on the night, see who you should meet.'),
      h('a.land-btn', { href: '/hi' }, 'Introduce yourself'),
    );
  }
  const next = params.get('next') || '';
  return h('section.gf-card',
    h('h2.land-sub', 'Got the invite?'),
    params.get('bad') ? h('p.gf-error', "That code didn't work. Try the link again.") : null,
    h('p', 'The guest list stays behind the link Aleksandar sent. The time and place above are the only public part.'),
    h('form', { action: '/', method: 'get' },
      next && next.startsWith('/') && !next.startsWith('//') ? h('input', { type: 'hidden', name: 'next', value: next }) : null,
      h('input', { type: 'text', name: 'invite', placeholder: 'Invite code', autocomplete: 'off', autocapitalize: 'none', required: true }),
      h('button.land-btn', { type: 'submit' }, 'Come in'),
    ),
  );
}

function render(event) {
  document.title = event.title;
  root.replaceChildren(
    h('p.land-kicker', event.kicker),
    h('h1.land-title', event.title),
    h('p.land-hook', event.hook),
    h('section.gf-card',
      h('h2.land-sub', 'When & where'),
      h('p.land-when', `${event.when} · ${event.time}`),
      h('p', event.place),
      h('p', event.neighbourhood),
      h('a.land-btn.ghost', { href: event.mapsUrl, target: '_blank', rel: 'noopener noreferrer' }, 'Open in maps'),
    ),
    h('section.gf-card',
      h('h2.land-sub', 'The point'),
      ...event.intent.map((line) => h('p', line)),
    ),
    h('section.gf-card',
      h('h2.land-sub', 'Bring a little'),
      ...event.bring.map((item) => h('div.land-bring', h('b', item.title), h('p', item.text))),
    ),
    rsvpCard(event),
    inviteCard(event),
    h('p.land-foot', 'Not a networking thing.'),
  );
}

api('GET', '/api/event').then(render).catch(() => {
  root.replaceChildren(h('p', 'The page did not load. Refresh in a moment.'));
});
