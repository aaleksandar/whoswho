// Invite. Four short blocks: who, when, bring, RSVP.

import { h, $ } from './dom.js';
import { api } from './api.js';
import { FOOD, BRING_VIBES } from './catalog.js';
import { saveMe } from './me-store.js';

const root = $('#land');
const params = new URLSearchParams(location.search);

function countsLine(counts) {
  const bits = [];
  if (counts?.going) bits.push(`${counts.going} coming`);
  if (counts?.maybe) bits.push(`${counts.maybe} maybe`);
  return bits.join(' · ');
}

function chipRow(options, get, set) {
  const box = h('div.gf-vibe-suggestions');
  const draw = () => {
    const current = get();
    box.replaceChildren(...options.map((opt) => h(current === opt.id ? 'button.gf-chip.on' : 'button.gf-chip', {
      type: 'button',
      onclick: () => { set(current === opt.id ? '' : opt.id); draw(); },
    }, opt.label)));
  };
  draw();
  return box;
}

function rsvpCard(event) {
  const name = h('input', {
    type: 'text', name: 'name', maxLength: 40, required: true, autocomplete: 'nickname',
    placeholder: 'Your name',
  });
  let status = 'going';
  const statusBox = chipRow(
    [{ id: 'going', label: 'Going' }, { id: 'maybe', label: 'Maybe' }, { id: 'no', label: "Can't" }],
    () => status,
    (id) => { status = id || 'going'; },
  );
  let bringingKind = '';
  let vibeKind = '';
  const foodBox = chipRow(FOOD, () => bringingKind, (id) => { bringingKind = id; });
  const vibeBox = chipRow(BRING_VIBES, () => vibeKind, (id) => { vibeKind = id; });
  const bringingText = h('input', { type: 'text', maxLength: 80, placeholder: 'Crisps, a bottle…', autocomplete: 'off' });
  const vibeText = h('input', { type: 'text', maxLength: 80, placeholder: 'A playlist, a deck…', autocomplete: 'off' });
  const error = h('p.gf-error', { hidden: true });
  const counts = h('p.land-counts', countsLine(event.counts));
  const form = h('form.gf-card', {
    onsubmit: async (e) => {
      e.preventDefault();
      error.hidden = true;
      if (!name.value.trim()) { error.hidden = false; error.textContent = 'A name.'; name.focus(); return; }
      try {
        const saved = await api('POST', '/api/rsvp', {
          name: name.value.trim(),
          status,
          bringingKind,
          bringingText: bringingText.value,
          vibeKind,
          vibeText: vibeText.value,
        });
        if (saved.editToken) saveMe({ token: saved.editToken, id: saved.guestId, name: saved.name });
        sessionStorage.setItem('ww.rsvp', JSON.stringify({ name: saved.name, status: saved.status }));
        counts.textContent = countsLine(saved.counts);
        form.replaceWith(h('section.gf-card',
          h('h2.land-sub', saved.status === 'no' ? 'Miss you.' : "You're on the list."),
          h('p.land-counts', countsLine(saved.counts)),
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
    statusBox,
    h('details.land-more',
      h('summary', 'Bringing something?'),
      h('p.gf-label.gf-sub', 'Snack or drink'),
      foodBox,
      bringingText,
      h('p.gf-label.gf-sub', 'Vibe'),
      vibeBox,
      vibeText,
    ),
    error,
    h('button.land-btn', { type: 'submit' }, "That's me"),
  );
  return form;
}

function codeCard() {
  const next = params.get('next') || '';
  return h('form.land-code', { action: '/', method: 'get' },
    params.get('bad') ? h('p.gf-error', 'Wrong code.') : null,
    next && next.startsWith('/') && !next.startsWith('//') ? h('input', { type: 'hidden', name: 'next', value: next }) : null,
    h('input', { type: 'text', name: 'invite', placeholder: 'Invite code', autocomplete: 'off', autocapitalize: 'none', required: true }),
    h('button.land-btn', { type: 'submit' }, 'In'),
  );
}

function render(event) {
  document.title = event.title;
  root.replaceChildren(
    h('p.land-kicker', event.kicker),
    h('h1.land-title', event.title),
    h('p.land-hook', event.hook),
    h('section.gf-card.land-tight',
      h('p.land-when', `${event.when} · ${event.time}`),
      h('p', event.place),
      h('a.land-btn.ghost', { href: event.mapsUrl, target: '_blank', rel: 'noopener noreferrer' }, 'Map'),
    ),
    h('section.gf-card.land-tight',
      h('p', event.bringLine),
      h('p.land-examples', (event.examples || []).join(' · ')),
      event.noWork ? h('p.land-note', event.noWork) : null,
    ),
    rsvpCard(event),
    event.gated && !event.invited ? codeCard() : null,
  );
}

api('GET', '/api/event').then(render).catch(() => {
  root.replaceChildren(h('p', 'Refresh in a moment.'));
});
