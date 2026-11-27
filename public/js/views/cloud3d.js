// The Cloud: every fun thing guests said is a 3D cloud whose weather comes
// from its words. One at a time, a cloud floats to the front and its words
// show big enough to read across the room. Anonymous: no names on this screen.

import { h } from '../dom.js';
import { VIBES, groups, forecast, dominant } from '../weather.js';

const MAX_CLOUDS = 35; // in the sky at once; older ones still count in the legend
const FOCUS_MS = 9000; // each fun thing's turn at the front
const HOLD_MS = 15000; // after someone taps a cloud, or a new one arrives

export function createCloudView(root, { geo, onInteract }) {
  const canvas = h('canvas', { width: 1920, height: 1080, 'aria-label': '3D sky of clouds, one per fun thing guests said, each with weather that matches its words' });
  const toast = h('div.cw-toast.off', { role: 'status' });
  const spotQ = h('q');
  const spotChip = h('span');
  const spot = h('section.cw-spot.off', { 'aria-live': 'polite' }, spotQ, h('p', '— someone in this room ', spotChip));
  const forecastEl = h('p');
  const chips = h('div.cw-chips');
  const countEl = h('b', '0');
  root.append(
    canvas, toast, spot,
    h('header.cw-top',
      h('div.paper-plate.cw-plate', h('h1', 'The Cloud'), forecastEl, chips),
      h('div.mz-stats',
        h('div.paper-stat', countEl, h('span', 'fun things')),
        h('div.paper-stat', h('b', '0'), h('span', 'names shown'))),
    ),
  );

  let clouds = []; // in the sky: {id, t, by, vibe}
  let all = []; // every fun thing, for the legend and forecast
  let spotId = null;
  let touched = 0;
  let engine = null;
  let visible = false;
  let timer = null;
  let toastT;

  function boot() {
    if (engine || !window.THREE || !window.WWCloud) return;
    engine = window.WWCloud.create(canvas, {
      vibes: VIBES,
      groups,
      boroughs: geo.boroughs,
      getSpot: () => spotId,
      onPick: (id) => { if (id) { touched = Date.now(); focus(id); onInteract?.(); } },
    });
    render();
    engine.snap();
  }

  function renderSpot() {
    const c = clouds.find((x) => x.id === spotId);
    spot.classList.toggle('off', !c);
    if (!c) return;
    const v = VIBES[c.vibe] || VIBES.mist;
    spotQ.textContent = c.t;
    // shorter words get bigger type
    spot.dataset.len = c.t.length > 90 ? 'long' : c.t.length > 45 ? 'mid' : 'short';
    spotChip.textContent = `${v.weather} · ${v.name}`;
    spotChip.style.background = v.cloud;
  }

  function focus(id) {
    spotId = id;
    // replay the card's entrance so each turn reads as new
    spot.classList.add('off');
    void spot.offsetWidth;
    renderSpot();
  }

  function next() {
    if (!clouds.length) return focus(null);
    const i = clouds.findIndex((c) => c.id === spotId);
    focus(clouds[(i + 1) % clouds.length].id);
  }

  function render() {
    const sky = (VIBES[dominant(all)] || VIBES.mist).sky;
    root.style.background = `linear-gradient(180deg, ${sky[0]} 0%, ${sky[1]} 70%, #F6E7D2 100%)`;
    forecastEl.textContent = forecast(all);
    countEl.textContent = all.length;
    chips.replaceChildren(
      ...groups(all, 'vibe').map((g) => h('span.cw-chip', h('i', { style: { background: g.color } }), g.label, ' ', h('b', g.count))),
    );
    renderSpot();
    if (engine) {
      engine.sync(clouds, 'drift');
      engine.setSky(sky[1]);
    }
  }

  function tick() {
    if (Date.now() - touched < HOLD_MS) return;
    next();
  }

  return {
    hasData: ({ secrets }) => secrets.length > 0,

    update({ secrets }) {
      all = secrets;
      clouds = secrets.slice(-MAX_CLOUDS).map((s) => ({ id: `s${s.id}`, t: s.text, by: s.by, vibe: s.vibe }));
      if (spotId && !clouds.some((c) => c.id === spotId)) spotId = null;
      if (!spotId && clouds.length) spotId = clouds[clouds.length - 1].id;
      render();
    },

    /** Something fun just arrived: toast it and bring it to the front. */
    highlight(secret) {
      if (!secret) return;
      const v = VIBES[secret.vibe] || VIBES.mist;
      toast.textContent = `Something fun just floated in: ${v.weather} · ${v.name}`;
      toast.classList.remove('off');
      clearTimeout(toastT);
      toastT = setTimeout(() => toast.classList.add('off'), 4000);
      touched = Date.now();
      focus(`s${secret.id}`);
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
      clearInterval(timer);
      timer = setInterval(tick, FOCUS_MS);
    },

    hide() {
      visible = false;
      clearInterval(timer);
      engine?.pause();
    },
  };
}
