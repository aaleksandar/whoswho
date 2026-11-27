// Phone: join (name, postcode, spirit animal, your life as that animal) → read
// the story the storyteller makes of it → drop secrets and wishes, as often as
// you like. The phone remembers who it is with a token from the server.

import { h, $, debounce } from './dom.js';
import { api } from './api.js';
import { ANIMALS, PALETTE, COLORS, animalLabel } from './animals.js';
import { sticker } from './sticker.js';

const KEY = 'whoswho.token';
const main = $('#hi-main');

const store = {
  get: () => { try { return localStorage.getItem(KEY); } catch { return null; } },
  set: (t) => { try { localStorage.setItem(KEY, t); } catch { /* private mode: works until reload */ } },
  clear: () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } },
};

let token = store.get();
let me = null;
let people = [];
// Drop-screen draft survives switching tabs and coming back from "sent".
const draft = { mode: 'secret', text: '', wish: '', who: 'me', pick: null, q: '' };

const auth = () => ({ 'x-guest-token': token || '' });
const stickers = new Map();
const stickerFor = (animal) => {
  if (!stickers.has(animal)) stickers.set(animal, sticker(animal, 192));
  const c = stickers.get(animal);
  const copy = document.createElement('canvas');
  copy.width = copy.height = c.width;
  copy.getContext('2d').drawImage(c, 0, 0);
  return copy;
};

let screenNo = 0; // lets a slow poll tell whether its screen is still showing
let pollT;
function screen(...children) {
  screenNo++;
  clearTimeout(pollT);
  main.replaceChildren(h('div.scr', ...children));
  window.scrollTo({ top: 0 });
}

function bar() {
  return h('div.bar',
    h('span.mark', 'Who’s here?'),
    me
      ? h('button.me', { type: 'button', title: 'Not you? Join as someone else', onclick: notMe },
        h('i', { style: { background: PALETTE[me.avatar.color][0] } }, stickerFor(me.avatar.animal)),
        me.name, me.outcode ? ` · ${me.outcode}` : '')
      : null,
  );
}

function notMe() {
  if (!window.confirm('Join as someone else on this phone?')) return;
  store.clear();
  token = null;
  me = null;
  showJoin();
}

// --------------------------------------------------------------------- join
function showJoin() {
  const pick = { animal: ANIMALS[Math.floor(Math.random() * ANIMALS.length)], color: COLORS[Math.floor(Math.random() * COLORS.length)] };
  const name = h('input.inp#nm', { type: 'text', autocomplete: 'nickname', maxlength: 40, placeholder: 'What do people call you?', required: true });
  const pc = h('input.inp#pc', { type: 'text', autocomplete: 'postal-code', maxlength: 10, placeholder: 'E8, SW4, N16…', autocapitalize: 'characters' });
  const pcHelp = h('p.help', 'Just the first half is fine. We pin the district, never your street.');
  const err = h('p.err', { role: 'alert' });
  const go = h('button.go', { type: 'submit' }, 'Join the zoo');
  const grid = h('div.zoo', { role: 'radiogroup', 'aria-label': 'Spirit animal' });
  const swatches = h('div.sw', { role: 'radiogroup', 'aria-label': 'Token colour' });
  const preview = h('div.pick-preview');
  const lifeLabel = h('label', { for: 'lf' });
  const life = h('textarea.ta.life#lf', { maxlength: 280, rows: 4, placeholder: '…I’d live on a canal boat, steal chips from tourists and nap through every meeting' });

  function renderPick() {
    preview.replaceChildren(
      h('span.pick-art', { style: { background: PALETTE[pick.color][1] } }, stickerFor(pick.animal)),
      h('span', h('b', `The ${animalLabel(pick.animal).toLowerCase()}`), h('small', 'hops on the big map with your name')),
    );
    lifeLabel.textContent = `Your life as a ${animalLabel(pick.animal).toLowerCase()}`;
    grid.replaceChildren(...ANIMALS.map((a) =>
      h('button', {
        type: 'button', role: 'radio', class: a === pick.animal ? 'on' : '', 'aria-checked': String(a === pick.animal),
        'aria-label': animalLabel(a), onclick: () => { pick.animal = a; renderPick(); },
      }, stickerFor(a))));
    swatches.replaceChildren(...COLORS.map((c) =>
      h('button', {
        type: 'button', role: 'radio', class: c === pick.color ? 'on' : '', 'aria-checked': String(c === pick.color),
        'aria-label': c, style: { '--c1': PALETTE[c][0], '--c2': PALETTE[c][1] }, onclick: () => { pick.color = c; renderPick(); },
      }, h('i'))));
  }

  const checkPc = debounce(async () => {
    const v = pc.value.trim();
    if (!v) { pcHelp.textContent = 'Just the first half is fine. We pin the district, never your street.'; pcHelp.className = 'help'; return; }
    try {
      const r = await api('GET', `/api/postcode/${encodeURIComponent(v)}`);
      if (!r.valid) { pcHelp.textContent = 'That doesn’t look like a UK postcode.'; pcHelp.className = 'help warn'; }
      else if (!r.known) { pcHelp.textContent = `${r.outcode} isn’t on our London map, but you can still join the cloud.`; pcHelp.className = 'help warn'; }
      else { pcHelp.textContent = `${r.outcode} · ${r.area}. Your animal lands here.`; pcHelp.className = 'help ok'; }
    } catch { /* offline for a moment: no hint */ }
  }, 300);
  pc.addEventListener('input', checkPc);

  const form = h('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = '';
      if (!name.value.trim()) { err.textContent = 'Tell us your name first.'; name.focus(); return; }
      if (life.value.trim().length < 10) {
        err.textContent = `Tell us a little about your life as a ${animalLabel(pick.animal).toLowerCase()} first.`;
        life.focus();
        return;
      }
      go.disabled = true;
      try {
        const r = await api('POST', '/api/guests', { name: name.value, postcode: pc.value, avatar: pick, life: life.value });
        token = r.token;
        me = r.guest;
        store.set(token);
        showStory({ justJoined: true });
      } catch (ex) {
        err.textContent = ex.message;
        go.disabled = false;
      }
    },
  },
  h('h1', 'Join the ', h('span', 'zoo')),
  h('p.lede', 'Takes ten seconds. Your spirit animal pops up on the big map of London.'),
  h('div.field', h('label', { for: 'nm' }, 'Your name'), name),
  h('div.field', h('label', { for: 'pc' }, 'Postcode'), pc, pcHelp),
  h('div.field', h('label', 'Your spirit animal'), preview, grid),
  h('div.field', h('label', 'Token colour'), swatches),
  h('div.field', lifeLabel, life,
    h('p.help', 'Where would you live? What would you do all day? Who would you annoy? The storyteller takes it from there, and it goes up on the big screen.')),
  err,
  go);

  renderPick();
  screen(bar(), form);
}

// -------------------------------------------------------------------- story
const animalOf = () => animalLabel(me.avatar.animal).toLowerCase();

function showStory({ justJoined = false } = {}) {
  if (!me.life) return showLife();
  const head = h('h1', 'Your life as a ', h('span', animalOf()));
  const parts = [bar()];
  if (justJoined) parts.push(h('div.tick', { role: 'status' }, me.lat != null ? `You’re on the map over ${me.outcode}. Look at the screen!` : 'You’re in! Look at the screen.'));
  parts.push(head);

  if (me.storyPending) {
    parts.push(
      h('div.story.writing', { 'aria-live': 'polite' },
        h('p.quill', 'The storyteller is writing', h('span.dots', h('i'), h('i'), h('i'))),
        h('p.yours', h('q', me.life))),
      h('p.help', 'Takes a few seconds. It’ll pop up here and on the big screen.'),
    );
    pollStory();
  } else if (me.story) {
    parts.push(
      h('article.story', { 'aria-label': 'Your story' }, ...me.story.split(/\n+/).map((p) => h('p', p))),
      h('p.help', 'It’s on the big screen too, on your animal’s card.'),
    );
  } else {
    parts.push(
      h('div.story', h('p.yours', h('q', me.life)), h('small', 'In your words')),
      h('p.help', me.storiesOn
        ? 'The storyteller lost the thread on this one. Try again?'
        : 'Your words are on the big screen with your animal.'),
    );
  }

  parts.push(h('button.go', { type: 'button', onclick: () => showDrop() }, 'Drop a secret or a wish'));
  if (me.storiesOn && !me.storyPending && me.tellsLeft > 0) {
    parts.push(h('button.ghost', { type: 'button', onclick: retell }, me.story ? `Tell it again (${me.tellsLeft} left)` : 'Try again'));
  }
  parts.push(h('button.ghost', { type: 'button', onclick: showLife }, 'Change what I wrote'));
  screen(...parts);
}

// While the story is being written, check back until it's there.
function pollStory() {
  const at = screenNo;
  pollT = setTimeout(async () => {
    try {
      const g = await api('GET', '/api/me', undefined, auth());
      if (at !== screenNo) return;
      me = g;
      if (me.storyPending) return pollStory();
      showStory();
    } catch (ex) {
      if (ex.status === 401) return lostToken();
      if (at === screenNo) pollStory();
    }
  }, 2500);
}

async function retell() {
  try {
    me = await api('POST', '/api/me/story', undefined, auth());
  } catch (ex) {
    if (ex.status === 401) return lostToken();
    me = { ...me, tellsLeft: ex.status === 429 ? 0 : me.tellsLeft };
  }
  showStory();
}

function showLife() {
  const err = h('p.err', { role: 'alert' });
  const ta = h('textarea.ta.life#lf', { maxlength: 280, rows: 5, value: me.life || '', placeholder: '…I’d live on a canal boat, steal chips from tourists and nap through every meeting' });
  const go = h('button.go', { type: 'submit' }, me.storiesOn ? 'Tell my story' : 'Save');
  const form = h('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = '';
      if (ta.value.trim().length < 10) { err.textContent = 'A few more words, please.'; ta.focus(); return; }
      go.disabled = true;
      try {
        me = await api('PUT', '/api/me', { life: ta.value }, auth());
        showStory();
      } catch (ex) {
        if (ex.status === 401) return lostToken();
        err.textContent = ex.message;
        go.disabled = false;
      }
    },
  },
  h('h1', 'Your life as a ', h('span', animalOf())),
  h('p.lede', 'Where would you live? What would you do all day? Who would you annoy?'),
  h('div.field', h('label', { for: 'lf' }, 'In your words'), ta),
  err, go,
  me.life ? h('button.ghost', { type: 'button', onclick: () => showStory() }, 'Keep it as it was') : null);
  screen(bar(), form);
}

// --------------------------------------------------------------------- drop
async function loadPeople() {
  try {
    people = (await api('GET', '/api/guests')).filter((g) => g.id !== me?.id);
  } catch { /* keep what we had */ }
}

function showDrop() {
  const err = h('p.err', { role: 'alert' });
  const body = h('div.drop-body');
  const go = h('button.go', { type: 'submit' });

  const seg = h('div.seg', { role: 'tablist' });
  function renderSeg() {
    seg.replaceChildren(...[['secret', 'A secret'], ['wish', 'A wish']].map(([m, label]) =>
      h('button', {
        type: 'button', role: 'tab', class: draft.mode === m ? 'on' : '', 'aria-selected': String(draft.mode === m),
        onclick: () => { draft.mode = m; renderSeg(); renderBody(); },
      }, label)));
  }

  function canSend() {
    if (draft.mode === 'wish') return draft.wish.trim().length >= 2;
    return draft.text.trim().length >= 3 && (draft.who === 'me' || people.some((p) => p.id === draft.pick));
  }
  const refresh = () => { go.disabled = !canSend(); };

  function renderBody() {
    go.textContent = draft.mode === 'secret' ? 'Send to the cloud' : 'Send up a lantern';
    if (draft.mode === 'wish') {
      const ta = h('textarea.ta#wx', { maxlength: 140, placeholder: '…a tennis partner who won’t go easy', value: draft.wish, oninput: (e) => { draft.wish = e.target.value; refresh(); } });
      body.replaceChildren(
        h('label', { for: 'wx' }, 'What do you need in life right now?'), ta,
        h('p.help', 'It rises as a lantern with your name on it, so people can help. Send as many as you like: every wish is its own lantern.'),
      );
      refresh();
      return;
    }
    const ta = h('textarea.ta#tx', { maxlength: 140, placeholder: draft.who === 'me' ? '…lived on a boat for three winters' : '…can juggle five oranges', value: draft.text, oninput: (e) => { draft.text = e.target.value; refresh(); } });
    const who = h('div.who',
      h('button', { type: 'button', class: draft.who === 'me' ? 'on' : '', onclick: () => { draft.who = 'me'; renderBody(); } }, 'About me'),
      h('button', { type: 'button', class: draft.who === 'other' ? 'on' : '', onclick: async () => { draft.who = 'other'; renderBody(); await loadPeople(); renderBody(); } }, 'About someone here'),
    );
    const parts = [h('label', { for: 'tx' }, 'Something interesting'), ta, who];
    if (draft.who === 'other') {
      const chips = h('div.chips', { 'aria-label': 'People here' });
      const renderChips = () => {
        const q = draft.q.trim().toLowerCase();
        const list = people.filter((p) => !q || p.name.toLowerCase().includes(q));
        chips.replaceChildren(...(list.length ? list : []).slice(0, 40).map((p) =>
          h('button', {
            type: 'button', class: draft.pick === p.id ? 'on' : '', 'aria-pressed': String(draft.pick === p.id),
            onclick: () => { draft.pick = p.id; renderChips(); refresh(); },
          }, h('i', { style: { background: PALETTE[p.avatar.color][0] } }, stickerFor(p.avatar.animal)), p.name)));
        if (!list.length) chips.append(h('p.help', people.length ? 'Nobody by that name yet.' : 'Nobody else has joined yet.'));
      };
      const search = h('input.inp.small', { type: 'search', 'aria-label': 'Find someone', placeholder: 'Find someone…', value: draft.q, oninput: (e) => { draft.q = e.target.value; renderChips(); } });
      renderChips();
      parts.push(search, chips);
    }
    parts.push(h('p.help', 'Anonymous: the screen never shows who sent it.'));
    body.replaceChildren(...parts);
    refresh();
  }

  const form = h('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      if (!canSend()) return;
      err.textContent = '';
      go.disabled = true;
      try {
        if (draft.mode === 'wish') {
          const r = await api('POST', '/api/wishes', { text: draft.wish }, auth());
          me = r.me;
          draft.wish = '';
          showSent({ mode: 'wish', text: r.wish.text });
        } else {
          const about = draft.who === 'me' ? 'me' : draft.pick;
          const forName = draft.who === 'me' ? null : people.find((p) => p.id === draft.pick)?.name;
          const s = await api('POST', '/api/secrets', { text: draft.text, about }, auth());
          draft.text = '';
          draft.pick = null;
          draft.q = '';
          showSent({ mode: 'secret', text: s.text, forName });
        }
      } catch (ex) {
        if (ex.status === 401) return lostToken();
        err.textContent = ex.message;
        refresh();
      }
    },
  },
  seg, body, err, go,
  h('button.ghost', { type: 'button', onclick: () => showStory() }, `My life as a ${animalOf()}`));

  renderSeg();
  renderBody();
  screen(bar(), form);
  loadPeople();
}

function showSent({ mode, text, forName }) {
  const secret = mode === 'secret';
  // Something about themselves can go into their story.
  const weave = (!secret || !forName) && me?.storiesOn && me.tellsLeft > 0;
  screen(
    bar(),
    h('div.sent',
      h('div.float', text),
      h('h2', secret ? 'It’s in the cloud.' : 'Your lantern is rising.'),
      h('p', secret
        ? (forName ? `Nobody will know it came from you. On the map it’s tied to ${forName}.` : 'Nobody will know it came from you. On the map it floats with your animal.')
        : 'Watch the screen. If someone can help, they’ll come and find you.'),
    ),
    h('button.go', { type: 'button', onclick: () => { draft.mode = mode; showDrop(); } }, secret ? 'Drop another secret' : 'Send another lantern'),
    h('button.ghost', { type: 'button', onclick: () => { draft.mode = secret ? 'wish' : 'secret'; showDrop(); } }, secret ? 'Send up a lantern' : 'Drop a secret instead'),
    weave ? h('button.ghost', { type: 'button', onclick: retell }, 'Weave this into my story') : null,
  );
}

// The server was reset (or this guest deleted): start over.
function lostToken() {
  store.clear();
  token = null;
  me = null;
  showJoin();
}

// --------------------------------------------------------------------- boot
api('GET', '/api/settings')
  .then((s) => { if (s.title) document.title = `Join the zoo · ${s.title}`; })
  .catch(() => {});

// A phone that already joined goes straight to dropping secrets. If the
// server is briefly unreachable, retry rather than joining a second time.
function boot() {
  if (!token) return showJoin();
  api('GET', '/api/me', undefined, auth())
    .then((g) => { me = g; if (me.life) showDrop(); else showLife(); })
    .catch((e) => {
      if (e.status === 401) return lostToken();
      screen(bar(), h('p.lede', 'Can’t reach the party server. Trying again…'));
      setTimeout(boot, 2500);
    });
}
boot();
