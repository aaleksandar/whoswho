// Guest form: name, spirit animal, about you, vibes, need, postcode.
// Shared by /hi (register) and /hax0r (edit dialog).

import { h, debounce } from './dom.js';
import { api } from './api.js';
import { AVATAR_DIMENSIONS, avatarDataUri, randomAvatar, normalizeAvatar } from './avatar.js';
import { normalizeVibe, MAX_VIBES, MAX_VIBE_LEN } from './vibes.js';

const LIMITS = { name: 40, need: 140, about: 500 };
const SUGGESTIONS_SHOWN = 18;

/**
 * @param {HTMLElement} root
 * @param {{initial?: object, submitLabel?: string, onSubmit: (value) => Promise<void>, onCancel?: () => void}} opts
 */
export function mountGuestForm(root, { initial = null, submitLabel = 'Add me to the board', onSubmit, onCancel }) {
  const state = {
    name: initial?.name || '',
    avatar: initial ? normalizeAvatar(initial.avatar) : randomAvatar(),
    about: initial?.about || '',
    vibes: [...(initial?.vibes || [])],
    need: initial?.need || '',
    postcode: initial?.postcode || '',
  };
  let suggestions = [];
  let showAllSuggestions = false;

  // ------------------------------------------------------------- name ---
  const nameInput = h('input#gf-name', {
    type: 'text', required: true, maxLength: LIMITS.name, autocomplete: 'nickname',
    placeholder: 'What should we call you?', value: state.name,
    oninput: (e) => { state.name = e.target.value; },
  });

  // --------------------------------------------------- spirit animal ---
  const preview = h('img.avatar-img.gf-preview', { alt: 'Your spirit animal', width: 168, height: 168 });
  const dimRows = new Map(); // key -> {row, buttons: Map(id -> button), dim}

  const dims = AVATAR_DIMENSIONS.map((dim) => {
    const buttons = new Map();
    const row = h(dim.type === 'animal' ? 'div.gf-animal-grid' : 'div.gf-dim-options', {
      role: 'radiogroup', 'aria-label': dim.label,
    });
    for (const opt of dim.options) {
      const btn =
        dim.type === 'swatch'
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
    return h('div.gf-dim', h('div.gf-dim-label', dim.label), row);
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

  // ------------------------------------------------------------ about ---
  const aboutCounter = h('span.gf-counter');
  const aboutInput = h('textarea#gf-about', {
    rows: 3, maxLength: LIMITS.about, value: state.about,
    placeholder: "A few lines about you: what you do, what you're into.",
    oninput: (e) => { state.about = e.target.value; updateAboutCounter(); },
  });
  const updateAboutCounter = () => { aboutCounter.textContent = `${state.about.length}/${LIMITS.about}`; };

  // ------------------------------------------------------------ vibes ---
  const selectedWrap = h('div.gf-vibes-selected', { 'aria-live': 'polite' });
  const suggestWrap = h('div.gf-vibe-suggestions');
  const moreBtn = h('button.gf-link', {
    type: 'button',
    onclick: () => { showAllSuggestions = !showAllSuggestions; renderVibes(); },
  });
  const vibeInput = h('input#gf-vibe', {
    type: 'text', maxLength: MAX_VIBE_LEN, placeholder: 'Add your own…', enterKeyHint: 'done',
    autocomplete: 'off', autocapitalize: 'none',
    onkeydown: (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addTyped();
      } else if (e.key === 'Backspace' && !vibeInput.value && state.vibes.length) {
        toggleVibe(state.vibes[state.vibes.length - 1]);
      }
    },
    oninput: () => { if (vibeInput.value.includes(',')) addTyped(); },
  });
  const vibeHint = h('div.gf-hint');

  function addTyped() {
    for (const part of vibeInput.value.split(',')) {
      const v = normalizeVibe(part);
      if (v && !state.vibes.includes(v) && state.vibes.length < MAX_VIBES) state.vibes.push(v);
    }
    vibeInput.value = '';
    renderVibes();
  }

  function toggleVibe(v) {
    const i = state.vibes.indexOf(v);
    if (i >= 0) state.vibes.splice(i, 1);
    else if (state.vibes.length < MAX_VIBES) state.vibes.push(v);
    renderVibes();
  }

  function renderVibes() {
    selectedWrap.replaceChildren(
      ...state.vibes.map((v) =>
        h('button.gf-chip.on', { type: 'button', onclick: () => toggleVibe(v), 'aria-label': `Remove ${v}` }, v, h('span.x', '×')),
      ),
    );
    const pool = suggestions.filter((s) => !state.vibes.includes(s.vibe));
    const shown = showAllSuggestions ? pool : pool.slice(0, SUGGESTIONS_SHOWN);
    suggestWrap.replaceChildren(
      ...shown.map((s) =>
        h('button.gf-chip', { type: 'button', onclick: () => toggleVibe(s.vibe) },
          '+ ', s.vibe, s.count ? h('span.gf-count', { title: `${s.count} here` }, `${s.count}`) : null),
      ),
    );
    moreBtn.hidden = pool.length <= SUGGESTIONS_SHOWN;
    moreBtn.textContent = showAllSuggestions ? 'Fewer ideas' : `More ideas (${pool.length - SUGGESTIONS_SHOWN})`;
    const full = state.vibes.length >= MAX_VIBES;
    vibeInput.disabled = full;
    vibeHint.textContent = full
      ? `That's the max (${MAX_VIBES}). Tap one to remove it.`
      : 'Numbers show how many people here share it. Shared vibes = connections on the big screen.';
  }

  api('GET', '/api/vibes')
    .then((list) => { suggestions = list; renderVibes(); })
    .catch(() => {});

  // ------------------------------------------------------------- need ---
  const needCounter = h('span.gf-counter');
  const needInput = h('textarea#gf-need', {
    rows: 3, maxLength: LIMITS.need, value: state.need,
    placeholder: 'e.g. a co-founder, a climbing buddy, more sleep',
    oninput: (e) => { state.need = e.target.value; updateNeedCounter(); },
  });
  const updateNeedCounter = () => { needCounter.textContent = `${state.need.length}/${LIMITS.need}`; };

  // --------------------------------------------------------- postcode ---
  const pcStatus = h('div.gf-pc-status', { 'aria-live': 'polite' });
  const checkPostcode = debounce(async () => {
    const v = state.postcode.trim();
    if (!v) { pcStatus.textContent = ''; pcStatus.className = 'gf-pc-status'; return; }
    try {
      const r = await api('GET', `/api/postcode/${encodeURIComponent(v)}`);
      if (v !== state.postcode.trim()) return;
      if (r.known) { pcStatus.textContent = `📍 ${r.outcode} · ${r.area}`; pcStatus.className = 'gf-pc-status ok'; }
      else if (r.valid) { pcStatus.textContent = `We can't place ${r.outcode} inside the M25, so you'll be off the map. That's fine.`; pcStatus.className = 'gf-pc-status warn'; }
      else { pcStatus.textContent = "That doesn't look like a UK postcode. Try just the first half, like E8 or SW11."; pcStatus.className = 'gf-pc-status warn'; }
    } catch { /* offline check is best-effort */ }
  }, 350);
  const pcInput = h('input#gf-postcode', {
    type: 'text', maxLength: 10, value: state.postcode, autocomplete: 'postal-code',
    autocapitalize: 'characters', spellcheck: 'false', placeholder: 'e.g. E8 or SW11 1AA',
    oninput: (e) => { state.postcode = e.target.value; checkPostcode(); },
  });

  // ----------------------------------------------------------- submit ---
  const errorBox = h('div.gf-error', { role: 'alert', hidden: true });
  const submitBtn = h('button.gf-submit', { type: 'submit' }, submitLabel);

  const form = h('form.gf', {
    novalidate: true,
    onsubmit: async (e) => {
      e.preventDefault();
      addTyped();
      errorBox.hidden = true;
      if (!state.name.trim()) return showError('Pop your name in first 🙂', nameInput);
      submitBtn.disabled = true;
      form.classList.add('busy');
      try {
        await onSubmit({
          name: state.name.trim(),
          avatar: state.avatar,
          about: state.about.trim(),
          vibes: state.vibes,
          need: state.need.trim(),
          postcode: state.postcode.trim(),
        });
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
    ),
    h('section.gf-card.gf-avatar',
      h('div.gf-label', 'Your spirit animal'),
      h('div.gf-preview-wrap', preview, shuffleBtn),
      h('div.gf-dims', dims),
    ),
    h('section.gf-card',
      h('label.gf-label', { for: 'gf-about' }, 'About you ', h('small', 'optional')),
      aboutInput,
      h('div.gf-row-end', h('span.gf-hint', 'Shown on your profile on the big screen.'), aboutCounter),
    ),
    h('section.gf-card',
      h('label.gf-label', { for: 'gf-vibe' }, 'Vibes ', h('small', 'optional · what are you into?')),
      selectedWrap,
      h('div.gf-vibe-input', vibeInput, h('button.gf-add', { type: 'button', onclick: addTyped }, 'Add')),
      suggestWrap,
      moreBtn,
      vibeHint,
    ),
    h('section.gf-card',
      h('label.gf-label', { for: 'gf-need' }, 'What you need in life ', h('small', 'optional')),
      needInput,
      h('div.gf-row-end', h('span.gf-hint', 'Shown in a speech bubble on the big screen.'), needCounter),
    ),
    h('section.gf-card',
      h('label.gf-label', { for: 'gf-postcode' }, 'Postcode ', h('small', 'optional · London')),
      pcInput,
      pcStatus,
      h('div.gf-hint', 'We only ever show your area (like E8), never your exact address.'),
    ),
    errorBox,
    h('div.gf-actions',
      onCancel ? h('button.gf-cancel', { type: 'button', onclick: onCancel }, 'Cancel') : null,
      submitBtn,
    ),
  );

  function showError(msg, focusEl) {
    errorBox.textContent = msg;
    errorBox.hidden = false;
    (focusEl || errorBox).scrollIntoView({ behavior: 'smooth', block: 'center' });
    focusEl?.focus({ preventScroll: true });
  }

  root.replaceChildren(form);
  renderAvatarUi(true);
  requestAnimationFrame(() => renderAvatarUi(true));
  renderVibes();
  updateAboutCounter();
  updateNeedCounter();
  if (state.postcode) checkPostcode();

  return { el: form };
}
