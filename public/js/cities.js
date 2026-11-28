// City picker for the landing page and /hax0r: type-ahead over the bundled
// world cities (public/data/cities.json, GeoNames), and "near me" from the
// browser's location. Nothing leaves the browser: the lookup is local.

import { cityLabel, distanceKm } from './city.js';

let data = null;
export function loadCities() {
  data ||= fetch('/data/cities.json').then((r) => {
    if (!r.ok) throw new Error('cities');
    return r.json();
  }).then(({ countries, cities }) => cities.map(([name, region, cc, lat, lng, pop]) => ({
    name, region, cc, country: countries[cc] || cc, lat, lng, pop, key: fold(name),
  }))).catch((e) => { data = null; throw e; });
  return data;
}

const fold = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').trim();

/** Best matches for what was typed, biggest first: "spring" or "springfield, ill". */
export async function searchCities(q, limit = 8) {
  const list = await loadCities();
  const [head, ...rest] = fold(q.replace(/,/g, ' , ')).split(' , ').map((s) => s.trim());
  if (!head) return [];
  const more = rest.join(' ');
  const out = [];
  for (const pass of [(c) => c.key.startsWith(head), (c) => !c.key.startsWith(head) && c.key.includes(head)]) {
    for (const c of list) {
      if (out.length >= limit) return out;
      if (!pass(c)) continue;
      if (more && !fold(`${c.region} ${c.country} ${c.cc}`).includes(more)) continue;
      out.push(c);
    }
  }
  return out;
}

/** Cities for where you are: the biggest one close by (Brooklyn → New York), and the nearest. */
export async function citiesNear(pos) {
  const list = await loadCities();
  let nearest = null;
  let nearestD = Infinity;
  let big = null;
  for (const c of list) {
    const d = distanceKm(pos, c);
    if (d < nearestD) { nearest = c; nearestD = d; }
    if (d < 25 && (!big || c.pop > big.pop)) big = c;
  }
  if (nearestD > 150) return [];
  return [...new Set([big, nearest].filter(Boolean))];
}

/** The browser's location, without asking: only if the page already may use it. */
export async function locationIfAllowed() {
  try {
    const p = await navigator.permissions?.query({ name: 'geolocation' });
    return p?.state === 'granted' ? await askLocation() : null;
  } catch { return null; }
}

/** Ask for the browser's location (shows the permission prompt). Coarse is plenty. */
export function askLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Your browser can’t share its location'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(new Error(e.code === 1 ? 'Location is off for this page. Type your city instead.' : 'Couldn’t find you. Type your city instead.')),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 10 * 60_000 },
    );
  });
}

const el = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids.filter((k) => k != null));
  return e;
};

/**
 * Turn a text input into a city combobox. Returns {get(), set(city)}.
 * @param {HTMLInputElement} input
 * @param {object} o
 * @param {(city: object|null) => void} [o.onChange]
 * @param {HTMLElement} [o.nearBtn] a "use my location" button
 * @param {HTMLElement} [o.hint] where to say what happened
 * @param {boolean} [o.auto] suggest from the location already allowed, on load
 */
export function cityPicker(input, { onChange, nearBtn, hint, auto = true } = {}) {
  let city = null;
  let opts = [];
  let active = -1;
  const id = `${input.id || 'city'}-list`;
  const list = el('ul', { id, className: 'city-list', hidden: true });
  list.setAttribute('role', 'listbox');
  input.after(list);
  Object.entries({ role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false', 'aria-controls': id, autocomplete: 'off' })
    .forEach(([k, v]) => input.setAttribute(k, v));
  const say = (t, kind = '') => { if (hint) { hint.textContent = t; hint.className = `${hint.className.replace(/\s*(ok|bad)\b/g, '')} ${kind}`.trim(); } };

  const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1; };
  const pick = (c, how) => {
    city = c && { name: c.name, region: c.region, country: c.country, cc: c.cc, lat: c.lat, lng: c.lng };
    if (c) input.value = cityLabel(c);
    close();
    if (c && how) say(how, 'ok');
    onChange?.(city);
  };
  const show = (cs, title) => {
    opts = cs;
    active = -1;
    list.replaceChildren(
      ...(title ? [el('li', { className: 'city-title', textContent: title })] : []),
      ...cs.map((c, i) => {
        const li = el('li', { className: 'city-opt', id: `${id}-${i}` },
          el('b', { textContent: c.name }), el('span', { textContent: [c.region !== c.name && c.region, c.country].filter(Boolean).join(', ') }));
        li.setAttribute('role', 'option');
        li.addEventListener('pointerdown', (e) => { e.preventDefault(); pick(c); });
        return li;
      }),
    );
    list.hidden = !cs.length;
    input.setAttribute('aria-expanded', String(!!cs.length));
  };
  const mark = () => {
    [...list.querySelectorAll('.city-opt')].forEach((li, i) => li.classList.toggle('on', i === active));
    if (active >= 0) input.setAttribute('aria-activedescendant', `${id}-${active}`);
    else input.removeAttribute('aria-activedescendant');
  };

  let n = 0;
  input.addEventListener('focus', () => { loadCities().catch(() => {}); });
  input.addEventListener('input', async () => {
    if (city) { city = null; onChange?.(null); }
    const mine = ++n;
    try {
      const found = await searchCities(input.value);
      if (mine === n) show(found);
    } catch { if (mine === n) say('Couldn’t load the list of cities. Check your connection and try again.', 'bad'); }
  });
  input.addEventListener('keydown', (e) => {
    if (list.hidden) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length;
      mark();
    } else if (e.key === 'Enter' && (active >= 0 || opts.length === 1)) {
      e.preventDefault();
      pick(opts[Math.max(0, active)]);
    } else if (e.key === 'Escape') close();
  });
  input.addEventListener('blur', () => {
    setTimeout(close, 100);
    // typed it out in full: take the first match
    if (!city && opts.length && input.value.trim() && fold(input.value).startsWith(opts[0].key)) pick(opts[0]);
  });

  const near = async (pos, how) => {
    const cs = await citiesNear(pos);
    if (!cs.length) { say('We couldn’t place you near a city. Type yours instead.', 'bad'); return; }
    pick(cs[0], how);
    if (cs.length > 1) {
      say(`${how} Or did you mean ${cs[1].name}?`, 'ok');
      offerOther(cs[1]);
    }
  };
  const offerOther = (c) => {
    if (!hint) return;
    const b = el('button', { type: 'button', className: 'city-alt', textContent: `Use ${c.name}` });
    b.addEventListener('click', () => { pick(c, `Picked ${c.name}.`); b.remove(); });
    hint.append(' ', b);
  };
  nearBtn?.addEventListener('click', async () => {
    nearBtn.disabled = true;
    say('Finding you…');
    try { await near(await askLocation(), 'Found you.'); } catch (e) { say(e.message, 'bad'); }
    nearBtn.disabled = false;
  });
  if (auto && !input.value) {
    locationIfAllowed().then((pos) => { if (pos && !city && !input.value) near(pos, 'Picked from your location.'); }).catch(() => {});
  }

  return {
    get: () => city,
    set(c) { city = c; input.value = c ? cityLabel(c) : ''; },
  };
}
