// Display screen: rotates graph → map → needs, live-updates over SSE.

import { h, $ } from './dom.js';
import { api, live } from './api.js';
import { avatarDataUri } from './avatar.js';
import { createGraphView } from './views/graph.js';
import { createMapView } from './views/map.js';
import { createNeedsView } from './views/needs.js';
import { createBringingView } from './views/bringing.js';

const LABELS = { graph: 'Connections', map: 'Map', needs: 'Needs', bringing: 'Tonight' };
const views = {
  graph: createGraphView($('#view-graph'), { onInteract: () => restartTimer('graph') }),
  map: createMapView($('#view-map'), { onInteract: () => restartTimer('map') }),
  needs: createNeedsView($('#view-needs')),
  bringing: createBringingView($('#view-bringing')),
};
const sections = Object.fromEntries([...document.querySelectorAll('.view')].map((el) => [el.dataset.view, el]));
const bar = $('#progress');

let guests = [];
let bringingPeople = [];
let settings = { title: "Until I'm back", rotateSeconds: 20, views: ['graph', 'map', 'needs', 'bringing'] };
let current = null;
let startedAt = 0;
let duration = 0;
let pausedAt = null;

const mod = (n, m) => ((n % m) + m) % m;
const available = () => settings.views.filter((id) => views[id].hasData(id === 'bringing' ? bringingPeople : guests));

function nextId(dir) {
  const list = available();
  if (!list.length) return 'splash';
  const order = settings.views;
  const i = order.indexOf(current);
  const start = i === -1 ? (dir > 0 ? -1 : order.length) : i;
  for (let k = 1; k <= order.length; k++) {
    const cand = order[mod(start + dir * k, order.length)];
    if (list.includes(cand)) return cand;
  }
  return 'splash';
}

function activate(id) {
  const prev = current;
  current = id;
  const base = settings.rotateSeconds;
  duration = (views[id]?.duration?.(base) ?? base) * 1000;
  startedAt = performance.now();
  if (pausedAt != null) pausedAt = startedAt;
  if (prev !== id) {
    for (const [vid, el] of Object.entries(sections)) el.classList.toggle('active', vid === id);
    if (views[prev]) views[prev].hide();
  }
  views[id]?.show(duration);
  document.body.dataset.view = id;
  renderTabs();
}

const step = (dir = 1) => activate(nextId(dir));

// Someone is exploring the view (graph clicks, map zoom): give it a fresh full
// slot on screen without re-showing it, so their zoom/selection stays put.
function restartTimer(id) {
  if (current !== id) return;
  startedAt = performance.now();
  if (pausedAt != null) pausedAt = startedAt;
}

function frame(now) {
  if (views[current]) {
    const t = pausedAt ?? now;
    const p = Math.min(1, (t - startedAt) / duration);
    bar.style.transform = `scaleX(${p})`;
    if (p >= 1 && pausedAt == null) step(1);
  } else {
    bar.style.transform = 'scaleX(0)';
  }
  requestAnimationFrame(frame);
}

// Tabs double as manual controls: clicking jumps to that view and restarts its
// timer, so auto-rotation carries on from there.
function renderTabs() {
  const avail = available();
  $('#tabs').replaceChildren(
    ...settings.views.map((id) =>
      h('button.tab', {
        type: 'button',
        class: `tab${id === current ? ' on' : ''}${avail.includes(id) ? '' : ' off'}`,
        disabled: !avail.includes(id),
        'aria-pressed': String(id === current),
        title: avail.includes(id) ? `Show ${LABELS[id]}` : `Nothing to show on ${LABELS[id]} yet`,
        onclick: () => activate(id),
      }, LABELS[id]),
    ),
  );
}

function renderCount() {
  $('#count').textContent = guests.length;
  $('#count-label').textContent = guests.length === 1 ? 'person' : 'people';
}

function welcome(guest) {
  const toast = h('div.toast',
    h('img.avatar-img', { src: avatarDataUri(guest.avatar), alt: '', width: 64, height: 64 }),
    h('div', h('small', 'Welcome!'), h('b', guest.name)),
  );
  $('#toasts').append(toast);
  setTimeout(() => toast.classList.add('out'), 6000);
  setTimeout(() => toast.remove(), 6800);
}

async function loadGuests(event) {
  const [cards, everyone] = await Promise.all([
    api('GET', '/api/guests'),
    api('GET', '/api/guests?all=1'),
  ]);
  guests = cards.filter((g) => g.rsvp !== 'no' && g.hasCard !== false);
  bringingPeople = everyone.filter((g) => g.rsvp !== 'no');
  renderCount();
  for (const [id, view] of Object.entries(views)) view.update(id === 'bringing' ? bringingPeople : guests);
  if (event?.type === 'created' && event.guest) {
    welcome(event.guest);
    for (const v of Object.values(views)) v.highlight?.(event.guest.id);
  }
  if (!views[current] || !available().includes(current)) step(1);
  else renderTabs();
}

function applySettings(s) {
  const viewsChanged = JSON.stringify(s.views) !== JSON.stringify(settings.views);
  const timingChanged = s.rotateSeconds !== settings.rotateSeconds;
  settings = s;
  $('#title').textContent = s.title;
  document.title = s.title;
  if (viewsChanged || !settings.views.includes(current)) step(1);
  else if (timingChanged && views[current]) activate(current);
  else renderTabs();
}

async function loadInfo() {
  const info = await api('GET', '/api/info');
  const short = (info.nightUrl || info.joinUrl).replace(/^https?:\/\//, '');
  document.querySelectorAll('.hi-url').forEach((el) => { el.textContent = short; });
  document.querySelectorAll('img[src^="/api/qr.svg"]').forEach((img) => { img.src = `/api/qr.svg?t=${Date.now()}`; });
}

async function resync() {
  applySettings(await api('GET', '/api/settings'));
  await loadGuests();
  loadInfo().catch(() => {});
}

// --------------------------------------------------------------- controls
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') step(1);
  else if (e.key === 'ArrowLeft') step(-1);
  else if (e.key === ' ') {
    e.preventDefault();
    if (pausedAt == null) pausedAt = performance.now();
    else { startedAt += performance.now() - pausedAt; pausedAt = null; }
    $('#paused').hidden = pausedAt == null;
  } else if (e.key === 'f' || e.key === 'F') {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }
});

let idle;
document.addEventListener('mousemove', () => {
  document.body.classList.remove('idle');
  clearTimeout(idle);
  idle = setTimeout(() => document.body.classList.add('idle'), 3000);
});

let resizeT;
window.addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => Object.values(views).forEach((v) => v.resize?.()), 200);
});

// ------------------------------------------------------------------ boot
// Keep retrying until the server answers, so a display left on a TV recovers
// by itself if it was opened before the server started.
async function boot() {
  try {
    await resync();
  } catch {
    setTimeout(boot, 3000);
    return;
  }
  requestAnimationFrame(frame);
  live({ guests: (e) => loadGuests(e).catch(() => {}), settings: applySettings, onResync: () => resync().catch(() => {}) });
  setInterval(() => loadInfo().catch(() => {}), 5 * 60_000);
}
boot();
