// Needs: avatar + comic speech bubble for everyone who said what they need.
// Pages through the list if it doesn't fit on one screen.

import { h, hash01 } from '../dom.js';
import { avatarDataUri } from '../avatar.js';
import { missingLine } from '../catalog.js';

const MIN_PAGE_SECONDS = 8;

export function createNeedsView(root) {
  const grid = h('div.needs-grid');
  const dots = h('div.needs-dots');
  root.append(h('h2.needs-title', "What's missing right now?"), grid, dots);

  let items = [];
  let pages = [[]];
  let page = 0;
  let timer = null;
  let visible = false;
  let cols = 1;
  let slotMs = 20000;
  let renderedKey = '';
  let itemsKey = '';

  // Start from a generous estimate, then actually render each page and drop a
  // row until every page fits (bubble heights vary with text length).
  function paginate() {
    const W = root.clientWidth || window.innerWidth;
    const H = root.clientHeight || window.innerHeight;
    cols = Math.max(1, Math.floor((W - 60) / 470));
    grid.style.setProperty('--cols', cols);
    for (let rows = Math.max(1, Math.floor((H - 120) / 150)); rows >= 1; rows--) {
      split(cols * rows);
      if (rows === 1 || pages.every(fits)) break;
    }
    page = Math.min(page, pages.length - 1);
    renderedKey = '';
  }

  function split(per) {
    pages = [];
    for (let i = 0; i < items.length; i += per) pages.push(items.slice(i, i + per));
    if (!pages.length) pages = [[]];
  }

  function fits(list) {
    grid.replaceChildren(...list.map(card));
    const limit = root.clientHeight - 56; // leave room for the page dots
    return [...grid.children].every((el) => el.offsetTop + el.offsetHeight <= limit);
  }

  function card(g, i) {
    const len = g.need.length;
    const tilt = (hash01(g.id) - 0.5) * 4;
    return h('figure.need-card', {
      class: `need-card${i % 2 ? ' flip' : ''}`,
      style: { '--tilt': `${tilt.toFixed(2)}deg`, '--delay': `${i * 70}ms` },
    },
      h('div.need-who', h('img.avatar-img', { src: avatarDataUri(g.avatar), alt: '' }), h('figcaption', g.name)),
      h('blockquote.need-bubble', { class: `need-bubble${len < 40 ? ' short' : len > 100 ? ' long' : ''}` }, g.need),
    );
  }

  function render(force = false) {
    const list = pages[page] || [];
    const key = `${page}|${cols}|` + list.map((g) => `${g.id}:${g.need}:${g.name}:${JSON.stringify(g.avatar)}`).join('|');
    if (key === renderedKey && !force) return;
    renderedKey = key;
    grid.replaceChildren(...list.map(card));
    dots.replaceChildren(...(pages.length > 1 ? pages.map((_, i) => h('span', { class: i === page ? 'on' : '' })) : []));
  }

  function startPaging(totalMs) {
    clearInterval(timer);
    if (pages.length < 2) return;
    timer = setInterval(() => {
      page = (page + 1) % pages.length;
      render();
    }, totalMs / pages.length);
  }

  return {
    hasData: (gs) => gs.some((g) => missingLine(g)),
    duration: (base) => Math.max(base, pages.length * MIN_PAGE_SECONDS),
    update(gs) {
      const next = gs.map((g) => ({ ...g, need: missingLine(g) })).filter((g) => g.need).sort((a, b) => b.id - a.id);
      const key = JSON.stringify(next.map((g) => [g.id, g.name, g.need, g.avatar]));
      if (key === itemsKey) return; // nothing on this board changed
      itemsKey = key;
      items = next;
      const before = pages.length;
      paginate();
      render();
      if (visible && pages.length !== before) startPaging(slotMs);
    },
    show(totalMs) {
      visible = true;
      slotMs = totalMs;
      page = 0;
      paginate();
      render(true);
      startPaging(totalMs);
    },
    hide() {
      visible = false;
      clearInterval(timer);
    },
    resize() {
      paginate();
      render(true);
    },
  };
}
