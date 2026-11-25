// The phone page for the night: check-in, matches, directory, icebreakers, playlist.

import { h, $ } from './dom.js';
import { api } from './api.js';
import { avatarDataUri } from './avatar.js';
import { NEEDS, OFFERS, FOOD, BRING_VIBES, needSummary, offerSummary, bringingSummary } from './catalog.js';
import { loadMe, personalPath, rememberFromLocation } from './me-store.js';

rememberFromLocation();
const params = new URLSearchParams(location.search);
const main = $('#night-main');

function authHeaders() {
  const me = loadMe();
  return me?.token ? { 'x-guest-token': me.token } : {};
}

function personFace(g, size = 64) {
  return h('img.avatar-img', { src: avatarDataUri(g.avatar), alt: '', width: size, height: size });
}

let guests = [];
let me = null;
let event = null;

function checkinButton() {
  const here = !!me?.checkedIn;
  return h('button.night-here', {
    type: 'button',
    class: here ? 'night-here on' : 'night-here',
    onclick: async (e) => {
      if (!loadMe()?.token) { location.href = '/hi'; return; }
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        const updated = await api('POST', '/api/me/checkin', { here: !here }, authHeaders());
        me = { ...me, ...updated };
        render();
      } catch (err) {
        btn.disabled = false;
        alert(err.message);
      }
    },
  }, here ? "You're here" : "I'm here");
}

function matchesBlock(matches) {
  if (!loadMe()?.token) {
    return h('section.night-block',
      h('h2', 'People you should meet'),
      h('p', 'Register on this phone and your top few show up here, with a reason.'),
      h('a.land-btn', { href: '/hi' }, 'Introduce yourself'),
    );
  }
  if (!matches?.length) {
    return h('section.night-block',
      h('h2', 'People you should meet'),
      h('p', 'Once a few more cards are in, your people show up here.'),
    );
  }
  return h('section.night-block',
    h('h2', 'People you should meet'),
    h('ol.night-matches', matches.map((row) => h('li.night-match',
      personFace(row.guest, 72),
      h('div',
        h('div.night-name', row.guest.name, row.checkedIn ? h('span.night-pill', 'Here') : null),
        h('p.night-reason', row.reason),
        row.guest.hiddenSide ? h('p.night-q', row.guest.hiddenSide) : null,
        row.guest.question ? h('p.night-q', `“${row.guest.question}”`) : null,
      ),
    ))),
  );
}

function icebreaker(list) {
  const deck = list.flatMap((g) => [
    g.question ? { g, kind: 'question', text: g.question } : null,
    g.hiddenSide ? { g, kind: 'side', text: g.hiddenSide } : null,
  ].filter(Boolean));
  if (!deck.length) return null;
  let i = 0;
  const card = h('div.night-ice');
  const draw = () => {
    const item = deck[i % deck.length];
    card.replaceChildren(
      personFace(item.g, 56),
      h('p.night-ask', item.kind === 'side' ? `${item.g.name} hasn't shown this in a while` : `${item.g.name} asks`),
      h('blockquote', item.text),
    );
  };
  draw();
  return h('section.night-block',
    h('h2', 'Borrow a question'),
    card,
    h('button.land-btn.ghost', {
      type: 'button',
      onclick: () => { i += 1; draw(); },
    }, deck.length > 1 ? 'Another one' : 'That is the only one'),
  );
}

function passes(g, filter) {
  if (filter.q && !`${g.name} ${g.question || ''} ${g.missing || ''} ${g.hiddenSide || ''} ${g.area || ''}`.toLowerCase().includes(filter.q)) return false;
  if (filter.area && (g.area || '') !== filter.area) return false;
  if (filter.need && !(g.needTags || []).includes(filter.need)) return false;
  if (filter.offer && !(g.offerTags || []).includes(filter.offer)) return false;
  if (filter.interest && !(g.interests || g.vibes || []).includes(filter.interest)) return false;
  if (filter.bringing.startsWith('food:') && g.bringingKind !== filter.bringing.slice(5)) return false;
  if (filter.bringing.startsWith('vibe:') && g.vibeKind !== filter.bringing.slice(5)) return false;
  return true;
}

function directory() {
  const filter = { q: '', area: '', need: '', offer: '', interest: '', bringing: '' };
  const list = h('div.night-dir');
  const areas = [...new Set(guests.map((g) => g.area).filter(Boolean))].sort();
  const interests = [...new Set(guests.flatMap((g) => g.interests || []))].sort();

  function draw() {
    const shown = guests.filter((g) => g.id !== me?.id && passes(g, filter));
    list.replaceChildren(...(shown.length ? shown.map(dirCard) : [h('p.gf-hint', 'Nobody matches that filter.')]));
  }

  function select(key, label, values) {
    return h('label.night-filter', label,
      h('select', {
        onchange: (e) => { filter[key] = e.target.value; draw(); },
      }, h('option', { value: '' }, 'Any'), ...values.map((v) => h('option', { value: v.id || v }, v.label || v))));
  }

  draw();
  return h('section.night-block',
    h('h2', 'The room'),
    h('input.night-search', {
      type: 'search',
      placeholder: 'Search names',
      oninput: (e) => { filter.q = e.target.value.trim().toLowerCase(); draw(); },
    }),
    h('div.night-filters',
      select('area', 'Area', areas.map((id) => ({ id, label: id }))),
      select('need', 'Needs', NEEDS.filter((n) => guests.some((g) => (g.needTags || []).includes(n.id)))),
      select('offer', 'Offers', OFFERS.filter((n) => guests.some((g) => (g.offerTags || []).includes(n.id)))),
      select('interest', 'Into', interests.map((id) => ({ id, label: id }))),
      select('bringing', 'Bringing', [
        ...FOOD.filter((f) => guests.some((g) => g.bringingKind === f.id)).map((f) => ({ id: `food:${f.id}`, label: f.label })),
        ...BRING_VIBES.filter((f) => guests.some((g) => g.vibeKind === f.id)).map((f) => ({ id: `vibe:${f.id}`, label: `Vibe · ${f.label}` })),
      ]),
    ),
    list,
  );
}

function dirCard(g) {
  const bring = bringingSummary(g);
  const bits = [g.area, needSummary(g) && `needs ${needSummary(g)}`, offerSummary(g) && `offers ${offerSummary(g)}`].filter(Boolean);
  return h('article.night-person',
    personFace(g, 56),
    h('div',
      h('div.night-name', g.name, g.checkedIn ? h('span.night-pill', 'Here') : null),
      bits.length ? h('p', bits.join(' · ')) : null,
      g.missing ? h('p.night-q', g.missing) : null,
      g.hiddenSide ? h('p', g.hiddenSide) : null,
      g.question ? h('p.night-q', g.question) : null,
      (bring.food || bring.vibe) ? h('p', [bring.food, bring.vibe].filter(Boolean).join(' / ')) : null,
      g.links ? h('p.night-links',
        g.links.instagram ? h('a', { href: g.links.instagram, target: '_blank', rel: 'noopener' }, 'Instagram') : null,
        g.links.notion ? h('a', { href: g.links.notion, target: '_blank', rel: 'noopener' }, 'Notion') : null,
        g.links.substack ? h('a', { href: g.links.substack, target: '_blank', rel: 'noopener' }, 'Substack') : null,
        g.links.site ? h('a', { href: g.links.site, target: '_blank', rel: 'noopener' }, 'Site') : null,
      ) : null,
    ),
  );
}

function render(matches) {
  const hereCount = guests.filter((g) => g.checkedIn).length;
  const token = loadMe()?.token;
  main.replaceChildren(
    h('header.night-head',
      h('p.land-kicker', event?.kicker || 'Tonight'),
      h('h1', event?.title || 'Tonight'),
      h('p', `${event?.when || ''} · ${event?.neighbourhood || ''}`.replace(/^ · | · $/g, '')),
      h('p.night-count', `${guests.length} on the board${hereCount ? ` · ${hereCount} here` : ''}`),
      checkinButton(),
      params.get('welcome') ? h('p.night-welcome', `You're on the board${me?.name ? `, ${me.name}` : ''}. This phone remembers you.`) : null,
      params.get('saved') ? h('p.night-welcome', 'Saved.') : null,
      params.get('door') && me?.checkedIn ? h('p.night-welcome', 'Checked in at the door.') : null,
    ),
    matchesBlock(matches),
    event?.playlistUrl
      ? h('section.night-block',
        h('h2', event.playlistLabel || 'Playlist'),
        h('a.land-btn', { href: event.playlistUrl, target: '_blank', rel: 'noopener noreferrer' }, 'Open the shared playlist'),
        h('p.gf-hint', 'Add a song if you want. No Spotify login in this app.'),
      )
      : h('section.night-block',
        h('h2', 'Playlist'),
        h('p', 'The shared playlist link is not up yet. It will show up here once it is set.'),
      ),
    icebreaker(guests) || '',
    directory(),
    h('p.night-foot',
      token ? h('a', { href: '/me' }, 'Edit your card') : h('a', { href: '/hi' }, 'Register'),
      ' · ',
      token ? h('a', { href: personalPath(token, '/me') }, 'Personal link') : null,
    ),
  );
}

async function boot() {
  try {
    event = await api('GET', '/api/event');
  } catch { event = null; }
  if (loadMe()?.token) {
    try { me = await api('GET', '/api/me', undefined, authHeaders()); } catch { me = null; }
  }
  if (params.get('door') && loadMe()?.token && me && !me.checkedIn) {
    try {
      me = { ...me, ...(await api('POST', '/api/me/checkin', { here: true }, authHeaders())) };
    } catch { /* stay on the page */ }
  }
  try {
    guests = await api('GET', '/api/guests');
  } catch (err) {
    if (err.code === 'invite') {
      main.replaceChildren(h('section.gf-card',
        h('h2', 'Invite first'),
        h('p', 'This page has people\'s answers on it. Open the invite link, then come back.'),
        h('a.land-btn', { href: `/?next=${encodeURIComponent('/night' + location.search)}` }, 'Enter the invite'),
      ));
      return;
    }
    main.replaceChildren(h('p', err.message || 'Could not load the room.'));
    return;
  }
  let matches = [];
  if (loadMe()?.token) {
    try { matches = (await api('GET', '/api/matches', undefined, authHeaders())).matches || []; }
    catch { matches = []; }
  }
  if (me) {
    const mine = guests.find((g) => g.id === me.id);
    if (mine) me = { ...mine, ...me };
  }
  render(matches);
  document.title = event?.title ? `Tonight · ${event.title}` : 'Tonight';
}

boot();
