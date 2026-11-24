// Connection graph: one bubble per guest, an edge per shared vibe set.
// The more vibes two people share, the shorter and stronger their link.
// Click a bubble for that person's profile; click an edge (or any vibe) to
// pull everyone with that vibe together under its name.
/* global d3 */

import { h } from '../dom.js';
import { avatarDataUri } from '../avatar.js';
import { buildGraph, topVibes } from '../graph-model.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const LABEL_LIMIT = 25; // edge labels only while it stays readable
const idOf = (end) => (typeof end === 'object' ? end.id : end);

// "Check out https://www.linkedin.com/in/jane-doe/" -> "Check out linkedin.com/in/jane-doe"
const prettyText = (t) =>
  t.replace(/\bhttps?:\/\/(?:www\.)?([^\s?#]+)\S*/gi, (_, rest) => rest.replace(/\/+$/, '').slice(0, 42))
    .replace(/\bwww\.(\S)/gi, '$1');

/**
 * @param {HTMLElement} root
 * @param {{onInteract?: () => void}} opts  called whenever someone clicks something
 */
export function createGraphView(root, { onInteract = () => {} } = {}) {
  const svg = d3.select(root).append('svg').attr('class', 'graph-svg');
  const gGroups = svg.append('g').attr('class', 'groups');
  const gLinks = svg.append('g').attr('class', 'links');
  const gHits = svg.append('g').attr('class', 'link-hits');
  const gLabels = svg.append('g').attr('class', 'link-labels');
  const gNodes = svg.append('g').attr('class', 'nodes');

  const side = h('aside.graph-side.panel');
  const legend = h('div.graph-legend.panel',
    h('span.legend-line'), ' shared vibe', h('span.dot-sep', '·'), 'closer = more in common',
    h('span.dot-sep', '·'), 'tap a face or a line');
  root.append(side, legend);

  let W = 0;
  let H = 0;
  let r = 40;
  let nodes = [];
  let links = [];
  let guests = [];
  let byId = new Map();
  let vibeCount = new Map();
  let visible = false;
  let obstacles = [];
  let tickCount = 0;
  /** @type {null | {type: 'person', id: number} | {type: 'vibe', vibe: string, shared?: string[]}} */
  let selection = null;
  let members = null; // Set of guest ids in the focused vibe group

  const sim = d3.forceSimulation().alphaDecay(0.015).velocityDecay(0.38).on('tick', ticked).stop();

  // Slow, smooth wander so the board feels alive even when nothing changes.
  sim.force('wander', () => {
    tickCount++;
    for (const n of nodes) {
      n.vx += Math.cos(tickCount / 140 + n.phase) * 0.018;
      n.vy += Math.sin(tickCount / 170 + n.phase * 1.7) * 0.018;
    }
  });

  function measure() {
    W = root.clientWidth;
    H = root.clientHeight;
    svg.attr('viewBox', `0 0 ${W} ${H}`);
    const base = root.getBoundingClientRect();
    obstacles = [side, legend, document.getElementById('qr-corner')]
      .filter(Boolean)
      .map((el) => el.getBoundingClientRect())
      .filter((b) => b.width && b.height)
      .map((b) => ({ x0: b.left - base.left, y0: b.top - base.top, x1: b.right - base.left, y1: b.bottom - base.top }));
  }

  const groupCentre = () => ({ x: W * 0.4, y: H * 0.5 });

  function configureForces() {
    const n = Math.max(1, nodes.length);
    r = clamp(Math.sqrt((W * H) / n) * 0.17, 20, 56);
    const inGroup = (d) => members?.has(d.id);
    const { x: gx, y: gy } = groupCentre();
    sim
      .force('link', d3.forceLink(links).id((d) => d.id)
        .distance((l) => 2 * r + 200 / (l.shared.length + 0.4))
        .strength((l) => {
          const s = Math.min(1, 0.12 + 0.22 * l.shared.length);
          return members && !(members.has(idOf(l.source)) && members.has(idOf(l.target))) ? s * 0.25 : s;
        }))
      .force('charge', d3.forceManyBody().strength(-r * 15).distanceMax(Math.max(W, H) * 0.6))
      .force('collide', d3.forceCollide(r + 18).strength(0.9))
      .force('x', d3.forceX((d) => (inGroup(d) ? gx : W * 0.45)).strength((d) => (members ? (inGroup(d) ? 0.22 : 0) : 0.045)))
      .force('y', d3.forceY((d) => (inGroup(d) ? gy : H / 2)).strength((d) => (members ? (inGroup(d) ? 0.22 : 0) : 0.07)))
      .force('push', members
        ? d3.forceRadial((d) => (inGroup(d) ? 0 : Math.min(W, H) * 0.47), gx, gy).strength((d) => (inGroup(d) ? 0 : 0.09))
        : null);
  }

  // ----------------------------------------------------------- selection
  function setSelection(next, { user = true } = {}) {
    selection = next;
    members = selection?.type === 'vibe'
      ? new Set(guests.filter((g) => g.vibes.includes(selection.vibe)).map((g) => g.id))
      : null;
    renderSide();
    measure();
    configureForces();
    applyClasses();
    renderGroup();
    if (visible) sim.alpha(Math.max(sim.alpha(), user ? 0.8 : 0.4)).restart();
    if (user) onInteract();
  }

  const selectPerson = (id) => setSelection({ type: 'person', id });
  const focusVibe = (vibe, shared) => setSelection({ type: 'vibe', vibe, shared });
  const clear = () => selection && setSelection(null);

  // The most popular vibe on an edge is the one worth grouping by.
  const bestVibe = (shared) => [...shared].sort((a, b) => (vibeCount.get(b) || 0) - (vibeCount.get(a) || 0))[0];

  function applyClasses() {
    const person = selection?.type === 'person' ? selection.id : null;
    const near = new Set(person == null ? [] : [person]);
    if (person != null) {
      for (const l of links) {
        if (idOf(l.source) === person) near.add(idOf(l.target));
        if (idOf(l.target) === person) near.add(idOf(l.source));
      }
    }
    const linkHot = (l) => {
      const s = idOf(l.source), t = idOf(l.target);
      if (person != null) return s === person || t === person;
      if (members) return members.has(s) && members.has(t) && l.shared.includes(selection.vibe);
      return false;
    };
    svg.classed('has-sel', !!selection);
    gNodes.selectAll('g.node')
      .classed('sel', (d) => d.id === person)
      .classed('dim', (d) => (person != null ? !near.has(d.id) : members ? !members.has(d.id) : false));
    gLinks.selectAll('line').classed('hot', linkHot).classed('dim', (l) => !!selection && !linkHot(l));
    gLabels.selectAll('text').classed('dim', (l) => !!selection && !linkHot(l));
  }

  // ------------------------------------------------------------- render
  function update(gs) {
    guests = gs;
    byId = new Map(gs.map((g) => [g.id, g]));
    vibeCount = new Map(topVibes(gs, Infinity).map(({ vibe, count }) => [vibe, count]));
    measure();
    const model = buildGraph(gs);
    const old = new Map(nodes.map((n) => [n.id, n]));
    nodes = model.nodes.map((n) => {
      const prev = old.get(n.id);
      if (prev) return Object.assign(prev, n);
      return { ...n, x: W * 0.45 + (Math.random() - 0.5) * 60, y: H / 2 + (Math.random() - 0.5) * 60, phase: Math.random() * 6.28 };
    });
    links = model.links.map((l) => ({ ...l, key: `${l.source}-${l.target}` }));
    sim.nodes(nodes);
    configureForces();
    render();

    // Keep what's selected if it still exists after a live update.
    const stale =
      (selection?.type === 'person' && !byId.has(selection.id)) ||
      (selection?.type === 'vibe' && !gs.some((g) => g.vibes.includes(selection.vibe)));
    setSelection(stale ? null : selection, { user: false });
    if (visible) sim.alpha(Math.max(sim.alpha(), 0.6)).restart();
    else sim.alpha(0.6);
  }

  function render() {
    const strong = (l) => l.shared.length;
    gLinks.selectAll('line')
      .data(links, (d) => d.key)
      .join('line')
      .attr('stroke-width', (d) => 1.5 + 2.2 * (strong(d) - 1))
      .attr('stroke-opacity', (d) => Math.min(0.85, 0.28 + 0.16 * strong(d)));

    // Fat invisible lines on top make thin edges easy to hit.
    gHits.selectAll('line')
      .data(links, (d) => d.key)
      .join((enter) => {
        const line = enter.append('line')
          .on('click', (e, d) => {
            e.stopPropagation();
            focusVibe(bestVibe(d.shared), d.shared);
          })
          .on('mouseenter', (_e, d) => gLinks.selectAll('line').filter((l) => l.key === d.key).classed('hover', true))
          .on('mouseleave', () => gLinks.selectAll('line').classed('hover', false));
        line.append('title');
        return line;
      })
      .select('title')
      .text((d) => d.shared.join(' · '));

    const showLabels = nodes.length <= LABEL_LIMIT;
    gLabels.selectAll('text')
      .data(showLabels ? links : [], (d) => d.key)
      .join('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .text((d) => d.shared.slice(0, 2).join(' · ') + (d.shared.length > 2 ? ` +${d.shared.length - 2}` : ''))
      .each(function (d) { d.labelWidth = this.getComputedTextLength(); });

    const sel = gNodes.selectAll('g.node')
      .data(nodes, (d) => d.id)
      .join((enter) => {
        const g = enter.append('g').attr('class', 'node entering');
        g.append('circle').attr('class', 'halo');
        g.append('circle').attr('class', 'ring');
        g.append('image').attr('preserveAspectRatio', 'xMidYMid meet');
        g.append('text').attr('class', 'name').attr('text-anchor', 'middle');
        g.on('click', (e, d) => {
          e.stopPropagation();
          if (selection?.type === 'person' && selection.id === d.id) clear();
          else selectPerson(d.id);
        });
        setTimeout(() => g.classed('entering', false), 50);
        return g;
      });
    sel.select('circle.halo').attr('r', r + 10);
    sel.select('circle.ring').attr('r', r + 3);
    sel.select('image')
      .attr('href', (d) => avatarDataUri(d.avatar))
      .attr('x', -r).attr('y', -r).attr('width', 2 * r).attr('height', 2 * r);
    sel.select('text.name')
      .attr('y', r + 20)
      .style('font-size', `${clamp(r * 0.36, 12, 19)}px`)
      .text((d) => d.name);
  }

  // A soft circle behind the focused vibe's people, with the vibe's name on top.
  function renderGroup() {
    gGroups.selectAll('g.group')
      .data(members ? [selection.vibe] : [], (d) => d)
      .join((enter) => {
        const g = enter.append('g').attr('class', 'group');
        g.append('circle').attr('class', 'group-hull');
        g.append('text').attr('class', 'group-label').attr('text-anchor', 'middle');
        return g;
      })
      .select('text')
      .text((d) => d.toUpperCase());
    placeGroup();
  }

  function placeGroup() {
    if (!members) return;
    const ms = nodes.filter((n) => members.has(n.id));
    if (!ms.length) return;
    const cx = d3.mean(ms, (n) => n.x);
    const cy = d3.mean(ms, (n) => n.y);
    const rad = (d3.max(ms, (n) => Math.hypot(n.x - cx, n.y - cy)) || 0) + r + 30;
    const g = gGroups.select('g.group');
    g.select('circle').attr('cx', cx).attr('cy', cy).attr('r', rad);
    const above = cy - rad - 14;
    g.select('text').attr('x', cx).attr('y', above > 34 ? above : cy - rad + 44);
  }

  // ----------------------------------------------------------- side panel
  // (native replaceChildren would print a literal "null" for empty slots)
  const fillSide = (...kids) => side.replaceChildren(...kids.filter(Boolean));
  const closeBtn = () => h('button.panel-close', { type: 'button', 'aria-label': 'Close', onclick: clear }, '×');
  const vibeChip = (v, shared) =>
    h('button.vibe-chip', { type: 'button', onclick: () => focusVibe(v, shared) }, v);

  function renderSide() {
    side.classList.toggle('wide', selection?.type === 'person');
    if (selection?.type === 'person') renderProfile(byId.get(selection.id));
    else if (selection?.type === 'vibe') renderVibeGroup();
    else renderTop();
  }

  function renderTop() {
    const top = topVibes(guests, 8);
    const max = top[0]?.count || 1;
    const linkCount = links.length;
    fillSide(
      h('h3', 'Top vibes'),
      h('ol.vibe-list',
        top.length
          ? top.map(({ vibe, count }) =>
              h('li',
                h('span.bar', { style: { width: `${(count / max) * 100}%` } }),
                h('button.vibe-row', { type: 'button', onclick: () => focusVibe(vibe) }, h('span.v', vibe), h('span.c', count))))
          : h('li.empty', 'No vibes yet')),
      h('p.graph-stat',
        `${linkCount} connection${linkCount === 1 ? '' : 's'} between ${guests.length} ${guests.length === 1 ? 'person' : 'people'}`),
    );
  }

  function renderProfile(g) {
    fillSide(
      closeBtn(),
      h('div.profile',
        h('div.profile-head',
          h('img.avatar-img.profile-avatar', { src: avatarDataUri(g.avatar), alt: '' }),
          h('div',
            h('h3.profile-name', g.name),
            g.area ? h('p.profile-area', `📍 ${g.area}`) : null)),
        g.about ? h('p.profile-about', prettyText(g.about)) : null,
        g.vibes.length ? h('div.profile-vibes', g.vibes.map((v) => vibeChip(v))) : null,
        g.need ? h('div.profile-need', h('small', 'Needs in life'), h('p', g.need)) : null,
      ),
    );
  }

  function renderVibeGroup() {
    const people = guests.filter((g) => members.has(g.id));
    const also = (selection.shared || []).filter((v) => v !== selection.vibe);
    fillSide(
      closeBtn(),
      h('h3.group-title', selection.vibe),
      h('p.graph-stat', `${people.length} ${people.length === 1 ? 'person is' : 'people are'} into this`),
      also.length
        ? h('div.also', h('small', 'They also share'), h('div.profile-vibes', also.map((v) => vibeChip(v, selection.shared))))
        : null,
      h('ul.member-list',
        people.map((g) =>
          h('li', h('button.member', { type: 'button', onclick: () => selectPerson(g.id) },
            h('img.avatar-img', { src: avatarDataUri(g.avatar), alt: '', width: 32, height: 32 }),
            h('span', g.name))))),
    );
  }

  // -------------------------------------------------------------- ticks
  function ticked() {
    const padX = r + 10;
    const top = r + 12;
    const bottom = H - r - 30;
    for (const n of nodes) {
      n.x = clamp(n.x, padX, W - padX);
      n.y = clamp(n.y, top, bottom);
      // Keep bubbles out from under the side panel, legend and QR code.
      for (const o of obstacles) {
        const x0 = o.x0 - r - 6, x1 = o.x1 + r + 6, y0 = o.y0 - r - 6, y1 = o.y1 + r + 26;
        if (n.x > x0 && n.x < x1 && n.y > y0 && n.y < y1) {
          const d = [n.x - x0, x1 - n.x, n.y - y0, y1 - n.y];
          const m = Math.min(...d);
          if (m === d[0]) n.x = x0;
          else if (m === d[1]) n.x = x1;
          else if (m === d[2]) n.y = y0;
          else n.y = y1;
        }
      }
    }
    const ends = (sel) => sel
      .attr('x1', (d) => d.source.x).attr('y1', (d) => d.source.y)
      .attr('x2', (d) => d.target.x).attr('y2', (d) => d.target.y);
    ends(gLinks.selectAll('line'));
    ends(gHits.selectAll('line'));
    gLabels.selectAll('text')
      .attr('x', (d) => (d.source.x + d.target.x) / 2)
      .attr('y', (d) => (d.source.y + d.target.y) / 2)
      // only label edges long enough to hold the text between the two bubbles
      .attr('opacity', (d) => {
        const gap = Math.hypot(d.target.x - d.source.x, d.target.y - d.source.y) - 2 * r - 16;
        return gap > d.labelWidth ? 1 : 0;
      });
    gNodes.selectAll('g.node').attr('transform', (d) => `translate(${d.x},${d.y})`);
    placeGroup();
  }

  svg.on('click', clear); // empty canvas
  document.addEventListener('keydown', (e) => {
    if (visible && e.key === 'Escape') clear();
  });

  let stopTimer;
  return {
    hasData: (gs) => gs.length > 0,
    update,
    show() {
      visible = true;
      clearTimeout(stopTimer);
      measure();
      sim.alphaTarget(0.02).alpha(Math.max(sim.alpha(), 0.25)).restart();
    },
    hide() {
      visible = false;
      if (selection) setSelection(null, { user: false });
      sim.alphaTarget(0);
      stopTimer = setTimeout(() => sim.stop(), 1000);
    },
    resize() {
      measure();
      configureForces();
      render();
      if (visible) sim.alpha(0.5).restart();
    },
    highlight(id) {
      const g = gNodes.selectAll('g.node').filter((d) => d.id === id);
      g.classed('fresh', true);
      setTimeout(() => g.classed('fresh', false), 15000);
    },
  };
}
