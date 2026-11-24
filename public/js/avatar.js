// Spirit-animal avatar composer. Pure ESM — used by the browser to render and
// by the server to validate. Every avatar is a cute animal face built from
// fixed, hand-made SVG parts, plus optional glasses, a hat and a background.
//
// renderAvatar(spec, size) -> '<svg …>' string (circular "bubble" avatar)

const uid = (() => {
  let n = 0;
  return () => `av${(n++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
})();

// ---------------------------------------------------------------- colours ---

const BG = [
  { id: 'peach', label: 'Peach', color: '#FFD6A5' },
  { id: 'lemon', label: 'Lemon', color: '#FDFFB6' },
  { id: 'mint', label: 'Mint', color: '#CAFFBF' },
  { id: 'sky', label: 'Sky', color: '#9BF6FF' },
  { id: 'blue', label: 'Blue', color: '#A0C4FF' },
  { id: 'lavender', label: 'Lavender', color: '#BDB2FF' },
  { id: 'pink', label: 'Pink', color: '#FFC6FF' },
  { id: 'coral', label: 'Coral', color: '#FFADAD' },
  { id: 'teal', label: 'Teal', color: '#5CC8B8' },
  { id: 'grape', label: 'Grape', color: '#9D7BD8' },
];

const GOLD = '#F2B705';
const INK = '#1F1A24';
const BLUSH = '#FF6B8B';

// ------------------------------------------------------------ face kit ---
// Geometry: viewBox 0 0 240 240. Every animal shares one face frame so glasses
// and hats fit them all: eyes at (99,126) & (141,126), crown at y≈64.

const HEAD = '<ellipse cx="120" cy="126" rx="72" ry="62"/>';

const eyes = {
  dot: () =>
    `<circle cx="99" cy="126" r="7.5" fill="${INK}"/><circle cx="141" cy="126" r="7.5" fill="${INK}"/>` +
    `<circle cx="101.6" cy="123.4" r="2.5" fill="#fff"/><circle cx="143.6" cy="123.4" r="2.5" fill="#fff"/>`,
  // white rim so the eye still reads on a dark patch (panda, raccoon, sloth)
  rimmed: () =>
    `<circle cx="99" cy="126" r="10.5" fill="#fff"/><circle cx="141" cy="126" r="10.5" fill="#fff"/>` +
    `<circle cx="99" cy="126" r="7" fill="${INK}"/><circle cx="141" cy="126" r="7" fill="${INK}"/>` +
    `<circle cx="101.4" cy="123.6" r="2.3" fill="#fff"/><circle cx="143.4" cy="123.6" r="2.3" fill="#fff"/>`,
};

const blush = (o = 0.38) =>
  `<ellipse cx="76" cy="150" rx="11" ry="6.5" fill="${BLUSH}" opacity="${o}"/>` +
  `<ellipse cx="164" cy="150" rx="11" ry="6.5" fill="${BLUSH}" opacity="${o}"/>`;

const stroke = (d, w = 3.5, c = INK) =>
  `<path d="${d}" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;

const mouthW = (y = 154) => stroke(`M109,${y} Q114.5,${y + 7} 120,${y} Q125.5,${y + 7} 131,${y}`);
const smile = (y = 154, w = 11) => stroke(`M${120 - w},${y} Q120,${y + w * 0.8} ${120 + w},${y}`);
const triNose = (fill, y = 141, w = 8) =>
  `<path d="M${120 - w},${y} L${120 + w},${y} L120,${y + w} Z" fill="${fill}" stroke="${fill}" stroke-width="4" stroke-linejoin="round"/>`;
const ovalNose = (fill = INK, y = 145, rx = 8, ry = 6) =>
  `<ellipse cx="120" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}"/><ellipse cx="117" cy="${y - 2}" rx="2.6" ry="1.6" fill="#fff" opacity="0.6"/>`;
const mirror = (svg) => `${svg}<g transform="matrix(-1 0 0 1 240 0)">${svg}</g>`;

// ---------------------------------------------------------------- animals ---
// Each animal: { label, fill, shape?, back?, marks?, front?, face, top?, eyes?,
// blush?, hatDy? }. Draw order: back → head(shape, fill) → marks (clipped to
// the head) → front → eyes → face → blush → glasses → hat → top.

const ANIMALS = {
  panda: {
    label: 'Panda',
    fill: '#FBFAF7',
    back: () => mirror('<circle cx="64" cy="76" r="25" fill="#2B2B33"/>'),
    marks: () =>
      mirror('<ellipse cx="96" cy="129" rx="17" ry="23" transform="rotate(28 96 129)" fill="#2B2B33"/>'),
    eyes: 'rimmed',
    face: () => ovalNose('#2B2B33', 147, 9, 6.5) + mouthW(156),
  },
  tiger: {
    label: 'Tiger',
    fill: '#F59A32',
    back: () =>
      mirror('<circle cx="66" cy="76" r="22" fill="#F59A32"/><circle cx="67" cy="78" r="11" fill="#FFF1DC"/>'),
    marks: () =>
      '<path d="M120,62 L111,90 L129,90 Z M98,66 L96,86 L106,82 Z M142,66 L144,86 L134,82 Z" fill="#2B2B33"/>' +
      mirror('<path d="M44,112 L76,118 L44,126 Z M46,136 L74,138 L48,148 Z" fill="#2B2B33"/>') +
      '<ellipse cx="107" cy="153" rx="17" ry="13" fill="#FFF6EA"/><ellipse cx="133" cy="153" rx="17" ry="13" fill="#FFF6EA"/>' +
      '<ellipse cx="120" cy="168" rx="16" ry="10" fill="#FFF6EA"/>',
    face: () => triNose('#E5677E', 139, 8) + mouthW(150),
    blush: false,
  },
  parrot: {
    label: 'Parrot',
    fill: '#E8433A',
    back: () =>
      '<path d="M108,74 C96,46 104,28 118,20 C114,40 120,56 128,72 Z" fill="#FFB703"/>' +
      '<path d="M120,72 C116,42 128,24 146,20 C134,38 136,56 138,74 Z" fill="#E8433A"/>' +
      '<path d="M96,80 C80,58 82,40 92,30 C94,50 104,64 112,76 Z" fill="#3A86FF"/>',
    marks: () =>
      '<ellipse cx="97" cy="129" rx="19" ry="16" fill="#FFF8F0"/><ellipse cx="143" cy="129" rx="19" ry="16" fill="#FFF8F0"/>' +
      stroke('M84,138 L90,136 M86,144 L93,141 M156,138 L150,136 M154,144 L147,141', 2.2, '#C9302C') +
      '<path d="M48,160 Q120,200 192,160 L200,200 L40,200 Z" fill="#2FB36B" opacity="0.9"/>',
    face: () =>
      '<path d="M108,150 Q120,168 132,154 Q127,170 116,168 Q108,162 108,150 Z" fill="#3A3036"/>' +
      `<path d="M102,142 C104,128 136,128 138,142 C138,158 131,168 122,175 C124,162 118,152 102,142 Z" fill="#F4E8C8" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`,
    blush: false,
  },
  koala: {
    label: 'Koala',
    fill: '#A9B1BC',
    back: () =>
      mirror(
        '<circle cx="54" cy="94" r="35" fill="#A9B1BC"/><circle cx="58" cy="98" r="21" fill="#F4E4EA"/>' +
          '<circle cx="30" cy="80" r="9" fill="#BEC5CE"/><circle cx="26" cy="100" r="8" fill="#BEC5CE"/><circle cx="40" cy="64" r="8" fill="#BEC5CE"/>',
      ),
    face: () =>
      '<ellipse cx="120" cy="152" rx="12.5" ry="18" fill="#3B3440"/><ellipse cx="116" cy="144" rx="3.5" ry="5" fill="#fff" opacity="0.45"/>' +
      smile(177, 7),
  },
  sloth: {
    label: 'Sloth',
    fill: '#B08D6E',
    marks: () =>
      '<ellipse cx="120" cy="134" rx="60" ry="50" fill="#F1DFC4"/>' +
      mirror('<ellipse cx="96" cy="131" rx="22" ry="11.5" transform="rotate(20 96 131)" fill="#5A4033"/>') +
      stroke('M106,68 Q110,78 108,86 M120,66 Q122,76 120,86 M134,68 Q130,78 132,86', 3, '#8C6D53'),
    eyes: 'rimmed',
    face: () => ovalNose('#4A3328', 147, 9.5, 6.5) + smile(158, 14),
  },
  fox: {
    label: 'Fox',
    fill: '#F28C38',
    back: () =>
      mirror('<path d="M54,100 L62,28 L108,72 Z" fill="#F28C38"/><path d="M66,86 L69,46 L95,72 Z" fill="#5C3B2E"/>'),
    marks: () =>
      '<path d="M40,134 Q78,124 102,146 Q120,162 138,146 Q162,124 200,134 L200,200 L40,200 Z" fill="#FFF6EC"/>',
    face: () => ovalNose(INK, 149, 8, 6) + mouthW(157),
  },
  redpanda: {
    label: 'Red panda',
    fill: '#C8572B',
    back: () =>
      mirror('<path d="M50,96 Q48,46 92,58 Q86,84 50,96 Z" fill="#FFF6EC"/><path d="M58,88 Q58,58 84,64 Q80,80 58,88 Z" fill="#5A2412"/>'),
    marks: () =>
      '<ellipse cx="120" cy="162" rx="34" ry="25" fill="#FFF6EC"/>' +
      mirror('<ellipse cx="95" cy="103" rx="10" ry="7" fill="#FFF6EC"/><ellipse cx="56" cy="142" rx="19" ry="24" fill="#FFF6EC"/>') +
      mirror(stroke('M98,136 Q94,152 90,170', 9, '#7A2E14')),
    face: () => ovalNose(INK, 150, 8, 6) + mouthW(158),
  },
  bunny: {
    label: 'Bunny',
    fill: '#F6F2F7',
    top: () =>
      mirror(
        '<ellipse cx="94" cy="42" rx="17" ry="44" transform="rotate(-9 94 42)" fill="#F6F2F7"/>' +
          '<ellipse cx="94" cy="44" rx="8" ry="31" transform="rotate(-9 94 44)" fill="#FFB3C8"/>',
      ),
    face: () => triNose('#FF8FAB', 141, 6) + stroke('M120,147 L120,152', 3) + mouthW(152),
    blush: 0.5,
  },
  cat: {
    label: 'Cat',
    fill: '#F4A259',
    back: () =>
      mirror('<path d="M52,104 L60,36 L108,74 Z" fill="#F4A259"/><path d="M64,90 L67,52 L94,74 Z" fill="#FFB3C8"/>'),
    marks: () => '<path d="M120,64 L113,86 L127,86 Z M100,68 L98,84 L108,80 Z M140,68 L142,84 L132,80 Z" fill="#D9792E"/>',
    face: () =>
      triNose('#FF8FAB', 141, 6) + mouthW(150) +
      mirror(stroke('M86,146 L58,140 M86,152 L56,154', 2.5, '#7A5A48')),
  },
  puppy: {
    label: 'Puppy',
    fill: '#E0B07A',
    marks: () =>
      '<ellipse cx="120" cy="156" rx="32" ry="24" fill="#FFF3E2"/>' +
      '<ellipse cx="143" cy="121" rx="21" ry="19" fill="#9B6743"/>',
    front: () =>
      mirror('<path d="M62,74 C32,74 22,132 36,162 C46,180 72,170 74,146 C76,118 76,92 62,74 Z" fill="#8B5A3C"/>'),
    face: () =>
      '<path d="M108,142 Q120,136 132,142 Q132,152 120,155 Q108,152 108,142 Z" fill="#2B2B33"/>' +
      '<path d="M114,162 Q120,176 126,162 Z" fill="#FF7A93"/>' +
      stroke('M108,158 Q114,165 120,158 Q126,165 132,158', 3.2),
  },
  owl: {
    label: 'Owl',
    fill: '#9C6B4E',
    back: () => mirror('<path d="M54,92 L58,44 L92,72 Z" fill="#7E5239"/>'),
    marks: () =>
      '<circle cx="98" cy="126" r="27" fill="#F3DDBF"/><circle cx="142" cy="126" r="27" fill="#F3DDBF"/>' +
      stroke('M104,90 L120,104 L136,90', 4, '#7E5239'),
    face: () =>
      '<circle cx="99" cy="126" r="9" fill="' + INK + '"/><circle cx="141" cy="126" r="9" fill="' + INK + '"/>' +
      '<circle cx="102" cy="123" r="3" fill="#fff"/><circle cx="144" cy="123" r="3" fill="#fff"/>' +
      `<path d="M112,142 L128,142 L120,158 Z" fill="#F2A93B" stroke="#C97F1C" stroke-width="2" stroke-linejoin="round"/>`,
    eyes: 'none',
    blush: 0.3,
  },
  penguin: {
    label: 'Penguin',
    fill: '#2B2D42',
    marks: () =>
      '<circle cx="99" cy="134" r="30" fill="#FBFAF7"/><circle cx="141" cy="134" r="30" fill="#FBFAF7"/>' +
      '<ellipse cx="120" cy="160" rx="48" ry="34" fill="#FBFAF7"/>',
    face: () => `<path d="M106,146 Q120,138 134,146 Q120,162 106,146 Z" fill="#F7A23B" stroke="#D9821A" stroke-width="2" stroke-linejoin="round"/>`,
    blush: 0.45,
  },
  frog: {
    label: 'Frog',
    fill: '#7BC96F',
    shape: '<path d="M42,150 C42,112 70,100 80,100 A23,23 0 0 1 120,108 A23,23 0 0 1 160,100 C170,100 198,112 198,150 C198,182 162,196 120,196 C78,196 42,182 42,150 Z"/>',
    marks: () => '<ellipse cx="120" cy="178" rx="50" ry="22" fill="#A7DE95"/>',
    face: () =>
      '<circle cx="99" cy="124" r="14" fill="#fff"/><circle cx="141" cy="124" r="14" fill="#fff"/>' +
      `<circle cx="99" cy="126" r="7.5" fill="${INK}"/><circle cx="141" cy="126" r="7.5" fill="${INK}"/>` +
      '<circle cx="101.5" cy="123.5" r="2.4" fill="#fff"/><circle cx="143.5" cy="123.5" r="2.4" fill="#fff"/>' +
      `<circle cx="113" cy="148" r="2.4" fill="#2E6B33"/><circle cx="127" cy="148" r="2.4" fill="#2E6B33"/>` +
      stroke('M88,160 Q120,184 152,160', 4),
    eyes: 'none',
    hatDy: -12,
  },
  raccoon: {
    label: 'Raccoon',
    fill: '#9AA0A8',
    back: () =>
      mirror('<path d="M50,98 Q46,50 90,60 Q84,86 50,98 Z" fill="#9AA0A8"/><path d="M58,88 Q58,62 82,66 Q78,80 58,88 Z" fill="#3B373F"/>'),
    marks: () =>
      '<path d="M120,62 L112,108 L128,108 Z" fill="#6E737B"/>' +
      mirror('<ellipse cx="90" cy="104" rx="19" ry="8" fill="#FBFAF7"/>') +
      '<path d="M46,122 Q68,108 99,114 Q120,120 141,114 Q172,108 194,122 L190,140 Q166,148 141,140 Q120,134 99,140 Q74,148 50,140 Z" fill="#2E2A30"/>' +
      '<ellipse cx="120" cy="160" rx="34" ry="24" fill="#FBFAF7"/>',
    eyes: 'rimmed',
    face: () => ovalNose(INK, 149, 8.5, 6) + mouthW(157),
  },
  axolotl: {
    label: 'Axolotl',
    fill: '#F9B8D0',
    back: () =>
      mirror(
        ['M58,110 Q40,92 26,78', 'M54,126 Q34,124 18,118', 'M58,142 Q40,152 26,166']
          .map((d) => stroke(d, 11, '#E8577E'))
          .join('') +
          '<circle cx="26" cy="78" r="7" fill="#E8577E"/><circle cx="18" cy="118" r="7" fill="#E8577E"/><circle cx="26" cy="166" r="7" fill="#E8577E"/>' +
          '<circle cx="38" cy="90" r="5" fill="#F27A9B"/><circle cx="32" cy="122" r="5" fill="#F27A9B"/><circle cx="38" cy="156" r="5" fill="#F27A9B"/>',
      ),
    face: () => smile(152, 22),
    blush: 0.55,
  },
};

// --------------------------------------------------------------- glasses ---

const ARMS = 'M82,121 L52,114 M158,121 L188,114';

const GLASSES = {
  none: { label: 'None' },
  round: {
    label: 'Round',
    svg: () =>
      `<g stroke="${INK}" stroke-width="4" fill="#FFFFFF" fill-opacity="0.25">` +
      `<circle cx="99" cy="126" r="17"/><circle cx="141" cy="126" r="17"/></g>` +
      stroke(`M116,124 Q120,119 124,124 ${ARMS}`, 4),
  },
  square: {
    label: 'Square',
    svg: () =>
      `<g stroke="${INK}" stroke-width="4.5" fill="#FFFFFF" fill-opacity="0.25">` +
      `<rect x="79" y="111" width="38" height="30" rx="6"/><rect x="123" y="111" width="38" height="30" rx="6"/></g>` +
      stroke('M117,122 L123,122 M79,120 L52,114 M161,120 L188,114', 4.5),
  },
  shades: {
    label: 'Shades',
    svg: () =>
      `<path d="M76,114 L118,114 L114,136 Q98,146 82,136 Z M122,114 L164,114 L158,136 Q142,146 126,136 Z" fill="${INK}"/>` +
      stroke('M84,120 L94,120 M128,120 L138,120', 3, 'rgba(255,255,255,0.6)') +
      stroke('M76,115 L52,111 M164,115 L188,111 M116,116 L124,116', 4),
  },
  hearts: {
    label: 'Hearts',
    svg: () => {
      const heart = (cx, cy) =>
        `<path d="M${cx},${cy + 16} C${cx - 30},${cy - 2} ${cx - 16},${cy - 26} ${cx},${cy - 11} C${cx + 16},${cy - 26} ${cx + 30},${cy - 2} ${cx},${cy + 16} Z" ` +
        `fill="#FF4FA3" fill-opacity="0.55" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>`;
      return heart(99, 126) + heart(141, 126) + stroke(`M115,120 L125,120 ${ARMS}`, 4);
    },
  },
  stars: {
    label: 'Party stars',
    svg: () => {
      const star = (cx, cy, r) => {
        const pts = [];
        for (let i = 0; i < 10; i++) {
          const a = (Math.PI / 5) * i - Math.PI / 2;
          const rr = i % 2 ? r * 0.5 : r;
          pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`);
        }
        return `<polygon points="${pts.join(' ')}" fill="#FF4FA3" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
      };
      return (
        star(97, 126, 24) + star(143, 126, 24) +
        `<circle cx="97" cy="128" r="6" fill="${INK}"/><circle cx="143" cy="128" r="6" fill="${INK}"/>` +
        stroke('M114,124 L126,124 M76,120 L52,114 M164,120 L188,114', 4)
      );
    },
  },
};

// ------------------------------------------------------------------ hats ---
// Drawn for a crown at y≈56 and stretched a touch to fit the wider animal heads.

const HATS = {
  none: { label: 'None' },
  beanie: {
    label: 'Beanie',
    svg: () =>
      `<path d="M58,100 C56,42 90,26 120,26 C150,26 184,42 182,100 Z" fill="#E63946"/>` +
      `<path d="M90,34 L92,96 M120,28 L120,96 M150,34 L148,96" stroke="#C1121F" stroke-width="3"/>` +
      `<rect x="52" y="88" width="136" height="24" rx="11" fill="#C1121F"/>` +
      `<circle cx="120" cy="22" r="13" fill="#FFF3E0" stroke="#C1121F" stroke-width="2"/>`,
  },
  cap: {
    label: 'Cap',
    svg: () =>
      `<path d="M60,102 C58,46 90,32 120,32 C150,32 182,46 180,102 Z" fill="#3A86FF"/>` +
      `<path d="M120,34 L120,98" stroke="#2667CC" stroke-width="3"/>` +
      `<circle cx="120" cy="33" r="5" fill="#2667CC"/>` +
      `<path d="M50,104 Q120,82 190,104 Q186,122 120,116 Q54,122 50,104 Z" fill="#2667CC"/>`,
  },
  bucket: {
    label: 'Bucket',
    svg: () =>
      `<path d="M68,100 C66,48 92,38 120,38 C148,38 174,48 172,100 Z" fill="#D4B483"/>` +
      `<path d="M68,88 Q120,80 172,88" stroke="#A98A5B" stroke-width="5" fill="none"/>` +
      `<path d="M34,108 Q120,82 206,108 Q196,124 120,116 Q44,124 34,108 Z" fill="#C1A26E"/>`,
  },
  beret: {
    label: 'Beret',
    svg: () =>
      `<ellipse cx="112" cy="64" rx="72" ry="26" transform="rotate(-10 112 64)" fill="#7B2D26"/>` +
      `<path d="M58,82 Q118,96 172,66" stroke="#5A1F1A" stroke-width="5" fill="none" stroke-linecap="round"/>` +
      `<path d="M120,40 L124,28" stroke="#7B2D26" stroke-width="5" stroke-linecap="round"/>`,
  },
  party: {
    label: 'Party hat',
    svg: () =>
      `<g transform="rotate(12 124 50)">` +
      `<path d="M92,78 L124,6 L156,78 Q124,88 92,78 Z" fill="#FFBE0B" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M106,48 L142,48 M99,64 L149,64 M114,30 L134,30" stroke="#FB5607" stroke-width="5"/>` +
      `<circle cx="124" cy="8" r="9" fill="#8338EC" stroke="${INK}" stroke-width="3"/></g>`,
  },
  crown: {
    label: 'Crown',
    svg: () =>
      `<path d="M78,86 L72,36 L98,60 L120,24 L142,60 L168,36 L162,86 Z" fill="${GOLD}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
      `<rect x="76" y="78" width="88" height="14" rx="5" fill="#E09E00" stroke="${INK}" stroke-width="3"/>` +
      `<circle cx="98" cy="85" r="4" fill="#E63946"/><circle cx="120" cy="85" r="4" fill="#3A86FF"/><circle cx="142" cy="85" r="4" fill="#2FB36B"/>` +
      `<circle cx="72" cy="34" r="5" fill="${GOLD}" stroke="${INK}" stroke-width="2.5"/><circle cx="120" cy="22" r="5" fill="${GOLD}" stroke="${INK}" stroke-width="2.5"/>` +
      `<circle cx="168" cy="34" r="5" fill="${GOLD}" stroke="${INK}" stroke-width="2.5"/>`,
  },
};

// -------------------------------------------------------------- dimensions ---

const opts = (obj) => Object.entries(obj).map(([id, v]) => ({ id, label: v.label }));

export const AVATAR_DIMENSIONS = [
  { key: 'animal', label: 'Animal', type: 'animal', options: opts(ANIMALS) },
  { key: 'glasses', label: 'Glasses', type: 'part', options: opts(GLASSES) },
  { key: 'hat', label: 'Hat', type: 'part', options: opts(HATS) },
  { key: 'bg', label: 'Background', type: 'swatch', options: BG },
];

export const DEFAULT_AVATAR = Object.freeze({ animal: 'panda', glasses: 'none', hat: 'none', bg: 'sky' });

const ANIMAL_IDS = Object.keys(ANIMALS);

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Keep only known ids; fill anything missing/invalid from DEFAULT_AVATAR.
 * Avatars from before spirit animals (skin/hair/…) have no `animal`: they get
 * one picked from a hash of the old spec, so each old guest keeps a stable one.
 */
export function normalizeAvatar(input) {
  const src = input && typeof input === 'object' ? input : {};
  const out = {};
  for (const dim of AVATAR_DIMENSIONS) {
    const v = src[dim.key];
    out[dim.key] = dim.options.some((o) => o.id === v) ? v : DEFAULT_AVATAR[dim.key];
  }
  if (!(src.animal in ANIMALS) && Object.keys(src).length) {
    out.animal = ANIMAL_IDS[hashString(JSON.stringify(src)) % ANIMAL_IDS.length];
  }
  return out;
}

/** Random combo. Accessories lean towards "none" so not everyone is decked out. */
export function randomAvatar(rng = Math.random) {
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const ids = (key) => AVATAR_DIMENSIONS.find((d) => d.key === key).options.map((o) => o.id);
  const accessory = (key, pNone) => (rng() < pNone ? 'none' : pick(ids(key).filter((id) => id !== 'none')));
  return {
    animal: pick(ids('animal')),
    glasses: accessory('glasses', 0.6),
    hat: accessory('hat', 0.55),
    bg: pick(ids('bg')),
  };
}

// ----------------------------------------------------------------- render ---

const colorOf = (list, id) => (list.find((o) => o.id === id) || list[0]).color;
const HAT_STRETCH = 1.07;
const FIG = 1.08; // figure scale inside the bubble

/**
 * @param {object} spec  avatar spec (normalised internally)
 * @param {number} size  rendered px size (width = height)
 * @returns {string} SVG markup
 */
export function renderAvatar(spec, size = 120) {
  const a = normalizeAvatar(spec);
  const id = uid();
  const an = ANIMALS[a.animal];
  const shape = an.shape || HEAD;
  const hat = HATS[a.hat].svg?.();
  const hatDy = an.hatDy || 0;
  const blushOpacity = an.blush === false ? 0 : an.blush ?? 0.38;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="${size}" height="${size}" role="img" aria-label="${an.label} avatar">`,
    `<defs><clipPath id="${id}c"><circle cx="120" cy="120" r="120"/></clipPath>`,
    `<clipPath id="${id}h">${shape}</clipPath></defs>`,
    `<g clip-path="url(#${id}c)">`,
    `<rect width="240" height="240" fill="${colorOf(BG, a.bg)}"/>`,
    `<g transform="matrix(${FIG} 0 0 ${FIG} ${(120 * (1 - FIG)).toFixed(2)} ${(132 * (1 - FIG)).toFixed(2)})">`,
    an.back?.() || '',
    `<g fill="${an.fill}">${shape}</g>`,
    an.marks ? `<g clip-path="url(#${id}h)">${an.marks()}</g>` : '',
    an.front?.() || '',
    an.eyes === 'none' ? '' : eyes[an.eyes || 'dot'](),
    an.face(),
    blushOpacity ? blush(blushOpacity) : '',
    GLASSES[a.glasses].svg?.() || '',
    hat ? `<g transform="matrix(${HAT_STRETCH} 0 0 1 ${(120 * (1 - HAT_STRETCH)).toFixed(2)} ${hatDy})">${hat}</g>` : '',
    an.top?.() || '',
    `</g></g></svg>`,
  ].join('');
}

const uriCache = new Map();
/** Avatar as a data: URI, for <img>/<image> (avoids SVG id clashes, caches per spec). */
export function avatarDataUri(spec) {
  const key = JSON.stringify(normalizeAvatar(spec));
  let uri = uriCache.get(key);
  if (!uri) {
    uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderAvatar(spec, 240))}`;
    if (uriCache.size > 500) uriCache.clear();
    uriCache.set(key, uri);
  }
  return uri;
}
