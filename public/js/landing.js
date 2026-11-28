// Landing page: create a party at whoswho.hypermaps.world/<slug>.

import { cityPicker } from './cities.js';

const $ = (s) => document.querySelector(s);
const form = $('#create-form');
const title = $('#title');
const slug = $('#slug');
const hint = $('#slug-hint');
const err = $('#err');
const go = $('#go');

const HINT = 'Lowercase letters, numbers and dashes.';

// The city: typed (from the bundled list), or found from this browser's
// location. If the page may already use it, the nearest city is filled in.
const heroCity = $('#hero-city');
const city = cityPicker($('#city'), {
  nearBtn: $('#near'),
  hint: $('#city-hint'),
  onChange: (c) => { heroCity.textContent = c ? c.name : 'your city'; },
});
let slugTouched = false;

const toSlug = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');

function setHint(text, kind = '') {
  hint.textContent = text;
  hint.className = `ld-hint ${kind}`;
}

let checkT;
let checking = 0;
function check() {
  clearTimeout(checkT);
  const v = slug.value;
  if (!v) return setHint(HINT);
  checkT = setTimeout(async () => {
    const n = ++checking;
    try {
      const r = await (await fetch(`/api/parties/${encodeURIComponent(v)}`)).json();
      if (n !== checking) return;
      if (r.available) setHint(`✓ whoswho.hypermaps.world/${v} is free`, 'ok');
      else setHint(r.error || 'That address is taken, try another', 'bad');
    } catch { /* offline for a moment: no hint */ }
  }, 250);
}

title.addEventListener('input', () => {
  if (slugTouched) return;
  slug.value = toSlug(title.value);
  check();
});
slug.addEventListener('input', () => {
  slugTouched = slug.value !== '';
  const clean = slug.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-{2,}/g, '-');
  if (clean !== slug.value) slug.value = clean;
  check();
});

// /?slug=… (from a "no party here" page) fills the link in.
const wanted = new URLSearchParams(location.search).get('slug');
if (wanted) {
  slug.value = toSlug(wanted);
  slugTouched = true;
  check();
}

function linkRow(label, url, note) {
  const dt = document.createElement('dt');
  dt.textContent = note ? `${label} · ${note}` : label;
  const dd = document.createElement('dd');
  const a = Object.assign(document.createElement('a'), { href: url, target: '_blank', rel: 'noopener', textContent: url.replace(/^https?:\/\//, '') });
  const copy = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Copy' });
  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(url); copy.textContent = 'Copied'; } catch { copy.textContent = 'Select it'; }
    setTimeout(() => { copy.textContent = 'Copy'; }, 1500);
  });
  dd.append(a, copy);
  return [dt, dd];
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  err.textContent = '';
  const body = { title: title.value.trim(), city: city.get(), slug: slug.value.replace(/^-+|-+$/g, ''), password: $('#password').value };
  if (!body.title) { err.textContent = 'Give your party a name.'; return title.focus(); }
  if (!body.city) { err.textContent = 'Pick your city from the list (or tap “Near me”).'; return $('#city').focus(); }
  if (!body.slug) { err.textContent = 'Choose your link.'; return slug.focus(); }
  if (body.password.length < 6) { err.textContent = 'The admin password needs at least 6 characters.'; return $('#password').focus(); }
  go.disabled = true;
  go.textContent = 'Creating…';
  try {
    const res = await fetch('/api/parties', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const r = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(r.error || 'Something went wrong, try again'), { field: r.field });
    const base = `${location.origin}/${r.slug}`;
    $('#links').replaceChildren(
      ...linkRow('Display', base, 'for the big screen'),
      ...linkRow('Guests', `${base}/hi`, 'or they scan the QR on the display'),
      ...linkRow('Admin', `${base}/hax0r`, 'your password'),
    );
    $('#open-display').href = base;
    form.hidden = true;
    $('#done').hidden = false;
    $('#done').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (ex) {
    err.textContent = ex.message;
    if (ex.field === 'slug') { slug.focus(); check(); }
    if (ex.field === 'city') $('#city').focus();
    go.disabled = false;
    go.textContent = 'Create party';
  }
});
