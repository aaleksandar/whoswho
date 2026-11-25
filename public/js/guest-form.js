// Heart-first guest card. Shared by /hi (register), /me (self-edit) and /hax0r.

import { h, debounce } from './dom.js';
import { api } from './api.js';
import { AVATAR_DIMENSIONS, avatarDataUri, randomAvatar, normalizeAvatar } from './avatar.js';
import { normalizeVibe, MAX_VIBE_LEN } from './vibes.js';
import {
  LIMITS, CHAPTERS, NEEDS, OFFERS, INTERESTS, MUSIC, FOOD, BRING_VIBES, AREAS,
} from './catalog.js';

const MAX_INTERESTS = 12;

/**
 * @param {HTMLElement} root
 * @param {{initial?: object, submitLabel?: string, onSubmit: (value) => Promise<void>, onCancel?: () => void, onDelete?: () => Promise<void>}} opts
 */
export function mountGuestForm(root, { initial = null, submitLabel = 'Put me on the board', onSubmit, onCancel, onDelete }) {
  let prefill = {};
  try { prefill = JSON.parse(sessionStorage.getItem('ww.rsvp') || '{}'); } catch { /* ignore */ }

  const state = {
    name: initial?.name || prefill.name || '',
    rsvp: initial?.rsvp || (prefill.status && prefill.status !== 'no' ? prefill.status : '') || 'going',
    avatar: initial ? normalizeAvatar(initial.avatar) : randomAvatar(),
    chapter: [...(initial?.chapter || [])],
    chapterNote: initial?.chapterNote || '',
    needTags: [...(initial?.needTags || [])],
    need: initial?.need || '',
    offerTags: [...(initial?.offerTags || [])],
    offer: initial?.offer || '',
    interests: [...(initial?.interests || initial?.vibes || [])],
    question: initial?.question || '',
    music: [...(initial?.music || [])],
    soundtrack: initial?.soundtrack || '',
    postcode: initial?.postcode || '',
    areaChip: initial?.areaChip || '',
    links: {
      notion: initial?.links?.notion || '',
      instagram: initial?.links?.instagram || '',
      substack: initial?.links?.substack || '',
      site: initial?.links?.site || '',
    },
    linksConsent: !!initial?.linksConsent,
    bringingKind: initial?.bringingKind || '',
    bringingText: initial?.bringingText || '',
    vibeKind: initial?.vibeKind || '',
    vibeText: initial?.vibeText || '',
  };

  const errorBox = h('div.gf-error', { role: 'alert', hidden: true });

  function chipButtons(options, { get, toggle, single = false }) {
    const box = h('div.gf-vibe-suggestions');
    const draw = () => {
      const current = get();
      box.replaceChildren(...options.map((opt) => {
        const id = typeof opt === 'string' ? opt : opt.id;
        const label = typeof opt === 'string' ? opt : opt.label;
        const on = single ? current === id : current.includes(id);
        return h(on ? 'button.gf-chip.on' : 'button.gf-chip', {
          type: 'button',
          'aria-pressed': String(on),
          onclick: () => { toggle(id); draw(); },
        }, on ? label : `+ ${label}`);
      }));
    };
    draw();
    return { el: box, draw };
  }

  function multi(listName, options, max) {
    return chipButtons(options, {
      get: () => state[listName],
      toggle: (id) => {
        const list = state[listName];
        const i = list.indexOf(id);
        if (i >= 0) list.splice(i, 1);
        else if (list.length < max) list.push(id);
      },
    });
  }

  function single(key, options, after) {
    return chipButtons(options, {
      single: true,
      get: () => state[key],
      toggle: (id) => {
        state[key] = state[key] === id ? '' : id;
        after?.(state[key]);
      },
    });
  }

  function field(id, label, control, hint) {
    return h('section.gf-card',
      h('label.gf-label', { for: id }, label),
      control,
      hint ? h('p.gf-hint', hint) : null,
    );
  }

  function lineInput(id, key, { max, placeholder, type = 'text' }) {
    return h(`input#${id}`, {
      type,
      maxLength: max,
      value: state[key],
      placeholder,
      autocomplete: 'off',
      oninput: (e) => { state[key] = e.target.value; },
    });
  }

  function areaInput(id, key, { max, placeholder, rows = 2 }) {
    return h(`textarea#${id}`, {
      rows,
      maxLength: max,
      value: state[key],
      placeholder,
      oninput: (e) => { state[key] = e.target.value; },
    });
  }

  // ---------------------------------------------------------------- name + rsvp
  const nameInput = h('input#gf-name', {
    type: 'text', required: true, maxLength: LIMITS.name, autocomplete: 'nickname',
    placeholder: 'What should we call you?', value: state.name,
    oninput: (e) => { state.name = e.target.value; },
  });
  const rsvp = single('rsvp', [
    { id: 'going', label: "I'll be there" },
    { id: 'maybe', label: 'Maybe' },
    { id: 'no', label: "Can't make it" },
  ]);
  const rsvpHint = h('p.gf-hint', "Can't make it still lets you leave a card. You just won't be on the big screen.");

  // ------------------------------------------------------------- spirit animal
  const preview = h('img.avatar-img.gf-preview', { alt: 'Your spirit animal', width: 168, height: 168 });
  const dimRows = new Map();
  const dimBlocks = AVATAR_DIMENSIONS.map((dim) => {
    const buttons = new Map();
    const row = h(dim.type === 'animal' ? 'div.gf-animal-grid' : 'div.gf-dim-options', {
      role: 'radiogroup', 'aria-label': dim.label,
    });
    for (const opt of dim.options) {
      const btn = dim.type === 'swatch'
        ? h('button.gf-swatch', {
          type: 'button', role: 'radio', title: opt.label, 'aria-label': opt.label,
          style: { '--c': opt.color },
          onclick: () => setAvatar({ [dim.key]: opt.id }),
        })
        : h('button.gf-opt', {
          type: 'button', role: 'radio', 'aria-label': opt.label,
          onclick: () => setAvatar({ [dim.key]: opt.id }),
        }, h('img.avatar-img', { alt: '', width: 56, height: 56 }), h('span', opt.label));
      buttons.set(opt.id, btn);
      row.append(btn);
    }
    dimRows.set(dim.key, { row, buttons, dim });
    return { dim, el: h('div.gf-dim', h('div.gf-dim-label', dim.label), row) };
  });

  function renderAvatarUi(scrollSelected = false) {
    preview.src = avatarDataUri(state.avatar);
    for (const { row, buttons, dim } of dimRows.values()) {
      for (const [id, btn] of buttons) {
        const on = state.avatar[dim.key] === id;
        btn.setAttribute('aria-checked', String(on));
        btn.classList.toggle('on', on);
        if (dim.type !== 'swatch') btn.querySelector('img').src = avatarDataUri({ ...state.avatar, [dim.key]: id });
        if (on && scrollSelected && dim.type !== 'animal') {
          row.scrollLeft = btn.offsetLeft - row.clientWidth / 2 + btn.clientWidth / 2;
        }
      }
    }
  }
  function setAvatar(patch, scrollSelected = false) {
    state.avatar = { ...state.avatar, ...patch };
    renderAvatarUi(scrollSelected);
  }
  const shuffleBtn = h('button.gf-shuffle', {
    type: 'button',
    onclick: () => {
      setAvatar(randomAvatar(), true);
      preview.classList.remove('spin');
      void preview.offsetWidth;
      preview.classList.add('spin');
    },
  }, '🔀 Shuffle');

  // ---------------------------------------------------------------- chapter / need / offer
  const chapter = multi('chapter', CHAPTERS, 3);
  const needs = multi('needTags', NEEDS, 4);
  const offers = multi('offerTags', OFFERS, 4);

  // ---------------------------------------------------------------- interests
  const interestBox = h('div.gf-vibes-selected', { 'aria-live': 'polite' });
  const interestSuggest = h('div.gf-vibe-suggestions');
  let interestCounts = new Map();
  const interestInput = h('input#gf-interest', {
    type: 'text', maxLength: MAX_VIBE_LEN, placeholder: 'Add your own…', enterKeyHint: 'done',
    autocomplete: 'off', autocapitalize: 'none',
    onkeydown: (e) => {
      if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addInterest(); }
    },
  });
  function addInterest() {
    for (const part of interestInput.value.split(',')) {
      const v = normalizeVibe(part);
      if (v && !state.interests.includes(v) && state.interests.length < MAX_INTERESTS) state.interests.push(v);
    }
    interestInput.value = '';
    drawInterests();
  }
  function drawInterests() {
    interestBox.replaceChildren(...state.interests.map((v) => h('button.gf-chip.on', {
      type: 'button',
      onclick: () => { state.interests.splice(state.interests.indexOf(v), 1); drawInterests(); },
      'aria-label': `Remove ${v}`,
    }, v, h('span.x', '×'))));
    const pool = INTERESTS.filter((v) => !state.interests.includes(v));
    interestSuggest.replaceChildren(...pool.map((v) => {
      const count = interestCounts.get(v) || 0;
      return h('button.gf-chip', {
        type: 'button',
        onclick: () => { if (state.interests.length < MAX_INTERESTS) state.interests.push(v); drawInterests(); },
      }, '+ ', v, count ? h('span.gf-count', String(count)) : null);
    }));
    interestInput.disabled = state.interests.length >= MAX_INTERESTS;
  }
  api('GET', '/api/vibes')
    .then((list) => { interestCounts = new Map(list.map((row) => [row.vibe, row.count])); drawInterests(); })
    .catch(() => {});

  // ---------------------------------------------------------------- music
  const music = multi('music', MUSIC, 6);

  // ---------------------------------------------------------------- location
  const pcStatus = h('div.gf-pc-status', { 'aria-live': 'polite' });
  const pcWrap = h('div');
  const checkPostcode = debounce(async () => {
    const v = state.postcode.trim();
    if (!v || state.areaChip === 'visiting') { pcStatus.textContent = ''; pcStatus.className = 'gf-pc-status'; return; }
    try {
      const r = await api('GET', `/api/postcode/${encodeURIComponent(v)}`);
      if (v !== state.postcode.trim()) return;
      if (r.known) { pcStatus.textContent = `📍 ${r.outcode} · ${r.area}`; pcStatus.className = 'gf-pc-status ok'; }
      else if (r.valid) { pcStatus.textContent = `Can't place ${r.outcode} inside the M25. You'll be off the map, which is fine.`; pcStatus.className = 'gf-pc-status warn'; }
      else { pcStatus.textContent = 'Try the first half, like E8 or SW11, or tap an area below.'; pcStatus.className = 'gf-pc-status warn'; }
    } catch { /* best effort */ }
  }, 350);
  const pcInput = h('input#gf-postcode', {
    type: 'text', maxLength: 10, value: state.postcode, autocomplete: 'postal-code',
    autocapitalize: 'characters', spellcheck: 'false', placeholder: 'e.g. E8 or N16',
    oninput: (e) => { state.postcode = e.target.value; checkPostcode(); },
  });
  pcWrap.append(pcInput, pcStatus);
  const areas = single('areaChip', AREAS, (id) => {
    pcWrap.hidden = id === 'visiting';
    if (id === 'visiting') { state.postcode = ''; pcInput.value = ''; pcStatus.textContent = ''; }
  });

  // ---------------------------------------------------------------- links
  const linkInputs = {};
  for (const key of ['notion', 'instagram', 'substack', 'site']) {
    linkInputs[key] = h('input', {
      type: 'text',
      maxLength: LIMITS.link,
      value: state.links[key],
      placeholder: key === 'instagram' ? '@handle or link' : 'https://',
      autocomplete: 'off',
      spellcheck: 'false',
      oninput: (e) => { state.links[key] = e.target.value; },
    });
  }
  const consent = h('input', {
    type: 'checkbox',
    checked: state.linksConsent,
    onchange: (e) => { state.linksConsent = e.target.checked; },
  });

  // ---------------------------------------------------------------- bringing + tally
  const food = single('bringingKind', FOOD);
  const vibeBring = single('vibeKind', BRING_VIBES);
  const tally = h('div.gf-tally');
  async function loadTally() {
    try {
      const t = await api('GET', '/api/bringing');
      const lines = [];
      for (const row of [...(t.food || []), ...(t.vibe || [])]) {
        lines.push(h('li', h('b', `${row.count} × ${row.label}`), row.items?.length ? ` — ${row.items.slice(0, 4).join(', ')}` : ''));
      }
      tally.replaceChildren(
        h('p.gf-label', 'Already on the table'),
        lines.length
          ? h('ul.gf-tally-list', lines)
          : h('p.gf-hint', 'Nothing claimed yet. Bring whatever is easy.'),
      );
    } catch {
      tally.replaceChildren();
    }
  }
  loadTally();
  const tallyTimer = setInterval(loadTally, 15000);

  // ---------------------------------------------------------------- submit
  const submitBtn = h('button.gf-submit', { type: 'submit' }, submitLabel);
  const form = h('form.gf', {
    novalidate: true,
    onsubmit: async (e) => {
      e.preventDefault();
      addInterest();
      errorBox.hidden = true;
      if (!state.name.trim()) return showError('Pop your name in first.', nameInput);
      const anyLink = Object.values(state.links).some((v) => v.trim());
      if (anyLink && !state.linksConsent) {
        return showError('Tick the box if you want those links on your card. Or leave the links blank.', consent);
      }
      submitBtn.disabled = true;
      form.classList.add('busy');
      try {
        await onSubmit(payload());
        clearInterval(tallyTimer);
      } catch (err) {
        showError(err.message || 'Something went wrong. Try again?', err.field === 'name' ? nameInput : null);
      } finally {
        submitBtn.disabled = false;
        form.classList.remove('busy');
      }
    },
  },
    h('section.gf-card',
      h('label.gf-label', { for: 'gf-name' }, 'Name'),
      nameInput,
      h('div.gf-label.gf-sub', 'Are you coming?'),
      rsvp.el,
      rsvpHint,
    ),
    h('section.gf-card.gf-avatar',
      h('div.gf-label', 'Your spirit animal'),
      h('div.gf-preview-wrap', preview, shuffleBtn),
      dimBlocks.find((d) => d.dim.key === 'animal').el,
      h('details.gf-more', h('summary', 'Glasses, hat, colour'), ...dimBlocks.filter((d) => d.dim.key !== 'animal').map((d) => d.el)),
    ),
    field('gf-chapter', 'The chapter you are in ', chapter.el, 'Tap what fits. Add a line if you want.'),
    h('section.gf-card', areaInput('gf-chapter-note', 'chapterNote', { max: LIMITS.chapterNote, placeholder: 'In your words, if the chips miss it', rows: 2 })),
    field('gf-need', 'What you need right now ', needs.el),
    h('section.gf-card', areaInput('gf-need-text', 'need', { max: LIMITS.need, placeholder: 'A spare room in Hackney, a clearer next step, someone to talk to…' })),
    field('gf-offer', 'What you can offer someone ', offers.el),
    h('section.gf-card', areaInput('gf-offer-text', 'offer', { max: LIMITS.offer, placeholder: 'A Sunday roast, a spare sofa for a month, a long walk…' })),
    h('section.gf-card',
      h('label.gf-label', { for: 'gf-interest' }, 'Rabbit holes ', h('small', 'optional')),
      interestBox,
      h('div.gf-vibe-input', interestInput, h('button.gf-add', { type: 'button', onclick: addInterest }, 'Add')),
      interestSuggest,
      h('p.gf-hint', 'The things you would stay up talking about. Not your job.'),
    ),
    h('section.gf-card',
      h('label.gf-label', { for: 'gf-question' }, 'A question for tonight ', h('small', 'optional')),
      lineInput('gf-question', 'question', { max: LIMITS.question, placeholder: 'What would you love to ask someone in this room?' }),
      h('p.gf-hint', 'It might get pulled as an icebreaker. Keep it one you actually want to be asked.'),
    ),
    h('section.gf-card',
      h('div.gf-label', 'Soundtrack ', h('small', 'optional')),
      music.el,
      lineInput('gf-soundtrack', 'soundtrack', { max: LIMITS.soundtrack, placeholder: '2 or 3 artists or tracks on repeat' }),
    ),
    h('section.gf-card',
      h('label.gf-label', { for: 'gf-postcode' }, 'London ', h('small', 'optional')),
      pcWrap,
      areas.el,
      h('p.gf-hint', 'A postcode is placed at the district only, with a small offset. The full code stays off the board. Visiting pins you near the party, not a home.'),
    ),
    h('details.gf-card.gf-more',
      h('summary', 'Links you are happy to share'),
      h('label.gf-inline', 'Notion ', linkInputs.notion),
      h('label.gf-inline', 'Instagram ', linkInputs.instagram),
      h('label.gf-inline', 'Substack ', linkInputs.substack),
      h('label.gf-inline', 'A site ', linkInputs.site),
      h('label.gf-check', consent, h('span', 'Show these on my card. Only because I said yes.')),
      h('p.gf-hint', 'Nothing is scraped. No LinkedIn, no automatic lookup. Leave them blank and you are still fully here.'),
    ),
    h('section.gf-card',
      h('div.gf-label', 'Something for the table ', h('small', 'optional')),
      food.el,
      lineInput('gf-bring', 'bringingText', { max: LIMITS.bringing, placeholder: 'Clementines, a bottle of red, a bag of crisps…' }),
      h('div.gf-label.gf-sub', 'A piece of your vibe'),
      vibeBring.el,
      lineInput('gf-vibe-bring', 'vibeText', { max: LIMITS.bringing, placeholder: 'A 20-minute DJ set, a tarot deck, a game…' }),
      tally,
    ),
    errorBox,
    h('div.gf-actions',
      onCancel ? h('button.gf-cancel', { type: 'button', onclick: onCancel }, 'Cancel') : null,
      onDelete ? h('button.gf-cancel.danger', { type: 'button', onclick: () => onDelete() }, 'Delete my card') : null,
      submitBtn,
    ),
  );

  function payload() {
    return {
      name: state.name.trim(),
      rsvp: state.rsvp || 'going',
      avatar: state.avatar,
      chapter: state.chapter,
      chapterNote: state.chapterNote.trim(),
      needTags: state.needTags,
      need: state.need.trim(),
      offerTags: state.offerTags,
      offer: state.offer.trim(),
      interests: state.interests,
      question: state.question.trim(),
      music: state.music,
      soundtrack: state.soundtrack.trim(),
      postcode: state.areaChip === 'visiting' ? '' : state.postcode.trim(),
      areaChip: state.areaChip,
      links: { ...state.links },
      linksConsent: state.linksConsent,
      bringingKind: state.bringingKind,
      bringingText: state.bringingText.trim(),
      vibeKind: state.vibeKind,
      vibeText: state.vibeText.trim(),
    };
  }

  function showError(msg, focusEl) {
    errorBox.textContent = msg;
    errorBox.hidden = false;
    (focusEl || errorBox).scrollIntoView({ behavior: 'smooth', block: 'center' });
    focusEl?.focus?.({ preventScroll: true });
  }

  root.replaceChildren(form);
  renderAvatarUi(true);
  requestAnimationFrame(() => renderAvatarUi(true));
  drawInterests();
  if (state.areaChip === 'visiting') pcWrap.hidden = true;
  if (state.postcode) checkPostcode();
  return { el: form };
}
