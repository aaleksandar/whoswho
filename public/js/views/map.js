// Location map: London inside the M25. Guests sit at their postcode district,
// then get nudged apart in screen space (with a leader line back to the real
// spot) so nobody hides behind anybody else.
/* global L, d3 */

import { h } from '../dom.js';
import { avatarDataUri } from '../avatar.js';

const M25_BOUNDS = [[51.285, -0.51], [51.69, 0.31]];
const ZOOM_IN = 1.1; // show the map 10% closer than a snug fit of the M25
const ZOOM_RANGE = { out: 1, in: 3 }; // zoom levels the buttons allow either side of that view
const RESET_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';

// Plain shaded-relief terrain: land, water (Thames, reservoirs), no roads, no
// labels. The only names on the map are the ones we draw below.
const TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}';
const TILE_ATTRIBUTION = 'Relief © Esri · Boundaries: ONS (OGL)';

// Avatar sizes by crowd size (px).
const PIN_SIZES = { few: 44, some: 34, many: 27 };

// Best-known large districts / town centres that aren't already borough names.
const DISTRICTS = [
  ['West End', 51.5133, -0.1340],
  ['Canary Wharf', 51.5054, -0.0235],
  ['Stratford', 51.5413, -0.0034],
  ['Shoreditch', 51.5265, -0.0798],
  ['Camden Town', 51.5392, -0.1426],
  ['Brixton', 51.4613, -0.1156],
  ['Clapham', 51.4618, -0.1384],
  ['Wimbledon', 51.4214, -0.2064],
  ['Wembley', 51.5524, -0.2967],
  ['Ilford', 51.5590, 0.0741],
  ['Romford', 51.5750, 0.1820],
  ['Uxbridge', 51.5463, -0.4786],
  ['Watford', 51.6565, -0.3903],
  ['Epsom', 51.3360, -0.2670],
  ['Dartford', 51.4462, 0.2167],
];

const shortBorough = (name) =>
  name === 'City of London' ? 'City' : name.replace(' upon Thames', '').replace(' and ', ' & ');

/**
 * @param {HTMLElement} root
 * @param {{onInteract?: () => void}} opts  called when someone zooms or drags the map
 */
export function createMapView(root, { onInteract = () => {} } = {}) {
  const mapEl = h('div.map-canvas');
  const labels = h('div.map-labels');
  const leaders = d3.create('svg').attr('class', 'map-leaders');
  const people = h('div.map-people');
  const statsMain = h('p.map-stat');
  const hotList = h('ol.hot-list');
  const stats = h('aside.map-side.panel', h('h3', 'Where from'), statsMain, hotList);
  const zoomInBtn = h('button.map-zoom-btn', {
    type: 'button', title: 'Zoom in', 'aria-label': 'Zoom in',
    onclick: () => { map.zoomIn(1); onInteract(); },
  }, '+');
  const zoomOutBtn = h('button.map-zoom-btn', {
    type: 'button', title: 'Zoom out', 'aria-label': 'Zoom out',
    onclick: () => { map.zoomOut(1); onInteract(); },
  }, '−');
  const resetBtn = h('button.map-zoom-btn', {
    type: 'button', title: 'Show all of London', 'aria-label': 'Show all of London', html: RESET_ICON,
    onclick: () => { fit(true); onInteract(); },
  });
  const zoomBox = h('div.map-zoom', zoomInBtn, zoomOutBtn, resetBtn);
  root.append(mapEl, labels, leaders.node(), people, stats, zoomBox);

  // Screen-space boxes of the things floating over the map (relative to root).
  function overlayBoxes() {
    const base = root.getBoundingClientRect();
    return [stats, zoomBox, document.getElementById('qr-corner')]
      .filter(Boolean)
      .map((el) => el.getBoundingClientRect())
      .filter((b) => b.width && b.height)
      .map((b) => ({ x0: b.left - base.left, y0: b.top - base.top, x1: b.right - base.left, y1: b.bottom - base.top }));
  }

  const map = L.map(mapEl, {
    zoomControl: false,
    attributionControl: true,
    dragging: true, // pan around once zoomed in
    maxBounds: L.latLngBounds(M25_BOUNDS).pad(0.6),
    maxBoundsViscosity: 1,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false,
    touchZoom: false,
    zoomSnap: 0, // allow the exact fractional zoom computed in fit()
    fadeAnimation: true,
  });
  map.attributionControl.setPrefix(false);
  // Relief tiles need internet. Borough outlines + names are bundled and always
  // render, so the map still reads as London offline.
  L.tileLayer(TILE_URL, { maxNativeZoom: 13, maxZoom: 19, attribution: TILE_ATTRIBUTION }).addTo(map);

  // [{name, lat, lng, kind, el}] — positioned in screen space by placeLabels()
  const placeNames = DISTRICTS.map(([name, lat, lng]) => ({ name, lat, lng, kind: 'district' }));
  fetch('/data/london-boroughs.geojson')
    .then((r) => r.json())
    .then((gj) => {
      L.geoJSON(gj, {
        interactive: false,
        style: { color: '#5b4a9e', weight: 1.4, opacity: 0.55, fillColor: '#ffffff', fillOpacity: 0.12 },
      }).addTo(map);
      const boroughs = gj.features
        .map((f) => {
          const [lng, lat] = d3.geoCentroid(f);
          return { name: shortBorough(f.properties.name), lat, lng, kind: 'borough', area: d3.geoArea(f) };
        })
        .sort((a, b) => b.area - a.area);
      placeNames.unshift(...boroughs); // boroughs win label collisions
      placeLabels();
    })
    .catch(() => {});

  // Screen-space boxes of avatars + name tags; labels never peek out from under them.
  let pinBoxes = [];

  // Draw place names, then drop any that would overlap an avatar, a panel or a
  // name already placed (boroughs first, biggest first).
  function placeLabels() {
    for (const p of placeNames) {
      if (!p.el) {
        p.el = h(`span.map-label.${p.kind}`, p.name);
        labels.append(p.el);
      }
      const pt = map.latLngToContainerPoint([p.lat, p.lng]);
      p.el.style.left = `${pt.x}px`;
      p.el.style.top = `${pt.y}px`;
      p.el.hidden = false;
    }
    const placed = [...pinBoxes, ...overlayBoxes()];
    const pad = 4;
    for (const p of placeNames) {
      const w = p.el.offsetWidth;
      const hgt = p.el.offsetHeight;
      const x = p.el.offsetLeft - w / 2;
      const y = p.el.offsetTop - hgt / 2;
      const box = { x0: x - pad, y0: y - pad, x1: x + w + pad, y1: y + hgt + pad };
      const clash = placed.some((b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0);
      p.el.hidden = clash;
      if (!clash) placed.push(box);
    }
  }

  let guests = [];
  const pins = new Map(); // id -> element

  // The default view: all of London inside the M25. Zoom limits hang off it.
  let home = null; // {zoom, center}
  function fit(animate = false) {
    map.invalidateSize(false);
    const bounds = L.latLngBounds(M25_BOUNDS);
    const zoom = map.getBoundsZoom(bounds, false, L.point(20, 20)) + Math.log2(ZOOM_IN);
    home = { zoom, center: bounds.getCenter() };
    map.setMinZoom(zoom - ZOOM_RANGE.out);
    map.setMaxZoom(zoom + ZOOM_RANGE.in);
    map.setView(home.center, zoom, { animate });
  }
  fit();

  function updateZoomButtons() {
    const z = map.getZoom();
    zoomInBtn.disabled = z >= map.getMaxZoom() - 0.01;
    zoomOutBtn.disabled = z <= map.getMinZoom() + 0.01;
    resetBtn.disabled = Math.abs(z - home.zoom) < 0.01 && map.getCenter().distanceTo(home.center) < 250;
  }

  // Pins and labels live in screen space, so re-place them whenever the map
  // moves: hidden during a zoom animation, following along live while panning.
  let zooming = false;
  let frame = 0;
  const layoutSoon = () => {
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; layout(); });
  };
  map.on('movestart', () => root.classList.add('panning'));
  map.on('zoomstart', () => {
    zooming = true;
    root.classList.add('zooming');
  });
  map.on('move', () => {
    if (!zooming) layoutSoon();
  });
  map.on('zoomend', () => {
    zooming = false;
    layout();
    requestAnimationFrame(() => root.classList.remove('zooming'));
  });
  map.on('moveend', () => {
    layout();
    root.classList.remove('panning');
    updateZoomButtons();
  });
  map.on('dragend', onInteract);
  updateZoomButtons();

  function layout() {
    const located = guests.filter((g) => g.lat != null && g.lng != null);
    const size = located.length > 60 ? PIN_SIZES.many : located.length > 30 ? PIN_SIZES.some : PIN_SIZES.few;
    const W = root.clientWidth;
    const H = root.clientHeight;
    // Only guests inside the current view (zoomed in, the rest are off-screen).
    const pts = located
      .map((g) => {
        const p = map.latLngToContainerPoint([g.lat, g.lng]);
        return { g, x0: p.x, y0: p.y, x: p.x, y: p.y };
      })
      .filter((p) => p.x0 >= -4 && p.x0 <= W + 4 && p.y0 >= -4 && p.y0 <= H + 4);

    // Keep avatars (and their name tags) out from under the panels and QR code;
    // the leader line still points at the real spot.
    const overlays = overlayBoxes();
    const settle = () => {
      for (const p of pts) {
        p.x = Math.max(size / 2, Math.min(W - size / 2, p.x));
        p.y = Math.max(size / 2, Math.min(H - size / 2 - 16, p.y));
        for (const o of overlays) {
          const x0 = o.x0 - size / 2 - 6, x1 = o.x1 + size / 2 + 6, y0 = o.y0 - size / 2 - 6, y1 = o.y1 + size / 2 + 22;
          if (p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1) {
            const d = [p.x - x0, x1 - p.x, p.y - y0, y1 - p.y];
            const m = Math.min(...d);
            if (m === d[0]) p.x = x0;
            else if (m === d[1]) p.x = x1;
            else if (m === d[2]) p.y = y0;
            else p.y = y1;
          }
        }
      }
    };
    const sim = d3.forceSimulation(pts)
      .force('x', d3.forceX((d) => d.x0).strength(0.25))
      .force('y', d3.forceY((d) => d.y0).strength(0.25))
      .force('collide', d3.forceCollide(size / 2 + 14).strength(1).iterations(3))
      .stop();
    for (let i = 0; i < 220; i++) {
      sim.tick();
      settle();
    }

    leaders.attr('viewBox', `0 0 ${W} ${H}`);
    leaders.selectAll('g.leader')
      .data(pts, (d) => d.g.id)
      .join((enter) => {
        const g = enter.append('g').attr('class', 'leader');
        g.append('line');
        g.append('circle').attr('r', 3.5);
        return g;
      })
      .call((g) => g.select('line')
        .attr('x1', (d) => d.x0).attr('y1', (d) => d.y0)
        .attr('x2', (d) => d.x).attr('y2', (d) => d.y)
        .attr('opacity', (d) => (Math.hypot(d.x - d.x0, d.y - d.y0) > size * 0.4 ? 0.7 : 0)))
      .call((g) => g.select('circle').attr('cx', (d) => d.x0).attr('cy', (d) => d.y0));

    const shown = new Set();
    for (const p of pts) {
      shown.add(p.g.id);
      let el = pins.get(p.g.id);
      if (!el) {
        el = h('div.pin', h('img.avatar-img', { alt: '' }), h('span.pin-name'));
        pins.set(p.g.id, el);
        people.append(el);
      }
      el.hidden = false;
      el.style.setProperty('--size', `${size}px`);
      el.style.transform = `translate(${p.x}px, ${p.y}px)`;
      el.querySelector('img').src = avatarDataUri(p.g.avatar);
      el.querySelector('.pin-name').textContent = p.g.name;
    }
    const locatedIds = new Set(located.map((g) => g.id));
    for (const [id, el] of pins) {
      if (!locatedIds.has(id)) {
        el.remove(); // deleted, or no longer on the map
        pins.delete(id);
      } else {
        el.hidden = !shown.has(id); // off-screen while zoomed in
      }
    }

    pinBoxes = pts.map((p) => {
      const nameEl = pins.get(p.g.id).querySelector('.pin-name');
      const half = Math.max(size, nameEl.offsetWidth) / 2;
      return { x0: p.x - half, y0: p.y - size / 2, x1: p.x + half, y1: p.y + size / 2 + nameEl.offsetHeight + 2 };
    });
    placeLabels();
  }

  function renderStats() {
    const located = guests.filter((g) => g.lat != null);
    statsMain.textContent = `${located.length} of ${guests.length} on the map`;
    const counts = new Map();
    for (const g of located) if (g.area) counts.set(g.area, (counts.get(g.area) || 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5);
    hotList.replaceChildren(...top.map(([area, n]) => h('li', h('span', area), h('b', n))));
  }

  return {
    hasData: (gs) => gs.some((g) => g.lat != null),
    update(gs) {
      guests = gs;
      renderStats();
      layout();
    },
    show() {
      fit();
      layout();
    },
    hide() {},
    resize() {
      fit();
      layout();
    },
    highlight(id) {
      const el = pins.get(id);
      if (!el) return;
      el.classList.add('fresh');
      setTimeout(() => el.classList.remove('fresh'), 15000);
    },
  };
}
