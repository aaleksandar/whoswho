// The Cloud: every secret is a 3D cloud whose weather comes from its words.
// Anonymous: no names anywhere on this screen. Clouds drift, or cluster by
// vibe or by voice (said about themselves vs. overheard by friends).

import { h } from '../dom.js';
import { VIBES, groups, forecast, dominant } from '../weather.js';

const MODES = [['drift', 'Drift'], ['vibe', 'By vibe'], ['voice', 'By voice']];
const MAX_CLOUDS = 35; // the drift layout holds 7 × 5; older secrets still count in the legend
const SPOT_MS = 4500;
const MODE_MS = 20000;
const HOLD_MS = 12000;
const MODE_HOLD_MS = 40000;

export function createCloudView(root, { geo, onInteract }) {
  const canvas = h('canvas', { width: 1920, height: 1080, 'aria-label': '3D sky of clouds, one per secret, each with weather that matches what the secret is about' });
  const labelsEl = h('div.cw-lbls', { 'aria-label': 'Secrets in the cloud' });
  const groupsEl = h('div', { 'aria-hidden': 'true' });
  const toast = h('div.cw-toast.off', { role: 'status' });
  const spotQ = h('q');
  const spotChip = h('span');
  const spot = h('section.cw-spot.off', { 'aria-live': 'polite' }, spotQ, h('p', '— someone in this room ', spotChip));
  const forecastEl = h('p');
  const chips = h('div.cw-chips');
  const countEl = h('b', '0');
  const seg = h('div.cw-seg', { role: 'group', 'aria-label': 'Arrange clouds' });
  root.append(
    canvas, labelsEl, groupsEl, toast, spot,
    h('header.cw-top',
      h('div.paper-plate.cw-plate', h('h1', 'The Cloud'), forecastEl, chips),
      h('div.mz-stats',
        h('div.paper-stat', countEl, h('span', 'secrets')),
        h('div.paper-stat', h('b', '0'), h('span', 'names shown'))),
    ),
    h('div.cw-ctl', h('small', 'Arrange the sky'), seg),
  );

  let clouds = []; // shown in 3D: {id, t, by, vibe}
  let all = []; // every secret, for legend + forecast
  let mode = 'drift';
  let spotId = null;
  let touched = 0;
  let modeTouched = 0;
  let engine = null;
  let visible = false;
  let timers = [];
  let toastT;
  const labelEls = {};
  const groupEls = {};

  const setMode = (m, byHand) => {
    if (byHand) { modeTouched = Date.now(); onInteract?.(); }
    mode = m;
    render();
  };

  function boot() {
    if (engine || !window.THREE || !window.WWCloud) return;
    engine = window.WWCloud.create(canvas, {
      vibes: VIBES,
      groups,
      boroughs: geo.boroughs,
      labelTop: 300,
      labels: () => labelEls,
      groupEls: () => groupEls,
      getSpot: () => spotId,
      onPick: (id) => { touched = Date.now(); spotId = id; renderSpot(); onInteract?.(); },
    });
    render();
    engine.snap();
  }

  function renderLabels() {
    const ids = new Set(clouds.map((c) => c.id));
    for (const id of Object.keys(labelEls)) if (!ids.has(id)) { labelEls[id].remove(); delete labelEls[id]; }
    for (const c of clouds) {
      if (!labelEls[c.id]) {
        labelEls[c.id] = h('p.cw-lbl', c.t);
        labelsEl.append(labelEls[c.id]);
      }
    }
  }

  function renderGroups() {
    const list = mode === 'drift' ? [] : groups(clouds, mode);
    for (const k of Object.keys(groupEls)) { groupEls[k].remove(); delete groupEls[k]; }
    for (const g of list) {
      groupEls[g.key] = h('div.cw-grp', h('i', { style: { background: g.color } }), g.label, h('b', g.count));
      groupsEl.append(groupEls[g.key]);
    }
  }

  function renderSpot() {
    const c = clouds.find((x) => x.id === spotId);
    spot.classList.toggle('off', !c);
    if (!c) return;
    const v = VIBES[c.vibe] || VIBES.mist;
    spotQ.textContent = c.t;
    spotChip.textContent = `${v.weather} · ${v.name}`;
    spotChip.style.background = v.cloud;
  }

  function render() {
    const sky = (VIBES[dominant(all)] || VIBES.mist).sky;
    root.style.background = `linear-gradient(180deg, ${sky[0]} 0%, ${sky[1]} 70%, #F6E7D2 100%)`;
    forecastEl.textContent = forecast(all);
    countEl.textContent = all.length;
    chips.replaceChildren(
      ...groups(all, 'vibe').map((g) => h('span.cw-chip', h('i', { style: { background: g.color } }), g.label, ' ', h('b', g.count))),
    );
    seg.replaceChildren(
      ...MODES.map(([id, label]) =>
        h('button', { type: 'button', class: mode === id ? 'on' : '', 'aria-pressed': String(mode === id), onclick: () => setMode(id, true) }, label)),
    );
    renderLabels();
    renderGroups();
    renderSpot();
    if (engine) {
      engine.sync(clouds, mode);
      engine.setSky(sky[1]);
    }
  }

  function arrival(secret) {
    const v = VIBES[secret.vibe] || VIBES.mist;
    toast.textContent = `A new secret just floated in: ${v.weather} · ${v.name}`;
    toast.classList.remove('off');
    clearTimeout(toastT);
    toastT = setTimeout(() => toast.classList.add('off'), 4000);
    spotId = `s${secret.id}`;
    touched = Date.now();
    renderSpot();
  }

  function start() {
    let k = 0;
    timers.push(setInterval(() => {
      if (Date.now() - touched < HOLD_MS || !clouds.length) return;
      k++;
      spotId = k % 2 ? clouds[Math.floor(Math.random() * clouds.length)].id : null;
      renderSpot();
    }, SPOT_MS));
    timers.push(setInterval(() => {
      if (Date.now() - modeTouched < MODE_HOLD_MS) return;
      const order = MODES.map((m) => m[0]);
      setMode(order[(order.indexOf(mode) + 1) % order.length]);
    }, MODE_MS));
  }

  return {
    hasData: ({ secrets }) => secrets.length > 0,

    update({ secrets }) {
      all = secrets;
      clouds = secrets.slice(-MAX_CLOUDS).map((s) => ({ id: `s${s.id}`, t: s.text, by: s.by, vibe: s.vibe }));
      if (spotId && !clouds.some((c) => c.id === spotId)) spotId = null;
      render();
    },

    /** A secret just arrived: toast it and put it in the spotlight. */
    highlight(secret) {
      if (secret) arrival(secret);
    },

    /** Build the 3D scene early (compiles shaders), then sleep until shown. */
    prepare() {
      boot();
      setTimeout(() => { if (!visible) engine?.pause(); }, 3000);
    },

    show() {
      visible = true;
      boot();
      engine?.resume();
      timers.forEach(clearInterval);
      timers = [];
      start();
    },

    hide() {
      visible = false;
      timers.forEach(clearInterval);
      timers = [];
      engine?.pause();
    },
  };
}
