/* Icons, vessel illustrations and illustrated profile pictures (ported from the prototype). */
/* ---------- Icons ---------- */
export const IC = {
  pin: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-7.2 7-12.5A7 7 0 0 0 5 9.5C5 14.8 12 22 12 22Z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="9.5" r="2.6" fill="currentColor"/></svg>',
  user: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="9.5" r="3.4" fill="currentColor"/><path d="M5.6 18.6c1.4-2.6 3.8-3.9 6.4-3.9s5 1.3 6.4 3.9" fill="currentColor"/></svg>',
  shop: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 9.5V20h17V9.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M2.5 9.5 4.5 4h15l2 5.5c0 1.4-1.1 2.4-2.4 2.4s-2.4-1-2.4-2.4c0 1.4-1.1 2.4-2.4 2.4S12 10.9 12 9.5c0 1.4-1.1 2.4-2.4 2.4S7.3 10.9 7.3 9.5c0 1.4-1.1 2.4-2.4 2.4S2.5 10.9 2.5 9.5Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><rect x="6" y="14" width="5" height="6" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="13.5" y="14" width="4.5" height="3.5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
  back: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  close: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  plus: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16M4 12h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  check: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor" opacity=".14"/><path d="m7 12.5 3.2 3.2L17 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lock: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
};

/* ---------- Vessel illustrations (viewBox 0 0 160 170) ---------- */
export const ART = {
  dome: `
  <ellipse cx="80" cy="163" rx="58" ry="4" fill="#1f2633" opacity=".08"/>
  <rect x="24" y="144" width="112" height="14" rx="7" fill="#ecd4a0" stroke="#6e2b3f" stroke-width="2"/>
  <ellipse cx="80" cy="145" rx="50" ry="6" fill="#f3e2bb" stroke="#6e2b3f" stroke-width="2"/>
  <path d="M80 82 C77 102 84 120 80 143" stroke="#3f6b3c" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M79 108 C66 99 56 104 53 111 C64 115 73 113 79 108Z" fill="#8dbb7a" stroke="#3f6b3c" stroke-width="1.6"/>
  <path d="M81 122 C94 113 104 117 107 124 C96 127 88 126 81 122Z" fill="#8dbb7a" stroke="#3f6b3c" stroke-width="1.6"/>
  <path d="M80 42 C99 39 111 53 105 69 C101 81 89 85 80 85 C70 85 57 79 55 67 C51 53 63 42 80 42Z" fill="#5a8fd0" stroke="#23426e" stroke-width="2"/>
  <path d="M66 60 C68 50 88 46 94 57 C98 66 88 73 79 69 C72 66 74 57 81 57" fill="none" stroke="#23426e" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M60 70 C68 80 92 80 101 66" fill="none" stroke="#23426e" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M88 141 C92 133 103 133 104 140 C98 143 92 143 88 141Z" fill="#5a8fd0" stroke="#23426e" stroke-width="1.4"/>
  <g class="v-lid">
    <path d="M38 145 L38 72 C38 38 57 20 80 20 C103 20 122 38 122 72 L122 145" fill="rgba(220,232,242,.35)" stroke="#6e2b3f" stroke-width="2.4"/>
    <path d="M48 120 L48 74 C48 52 56 38 68 31" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".9"/>
  </g>`,
  bottle: `
  <ellipse cx="80" cy="164" rx="56" ry="4" fill="#1f2633" opacity=".08"/>
  <path d="M14 158 q11 -7 22 0 t22 0 t22 0 t22 0 t22 0 t22 0" fill="none" stroke="#5a8fd0" stroke-width="2" stroke-linecap="round"/>
  <g transform="rotate(-16 80 95)">
    <rect x="62" y="84" width="36" height="54" rx="4" fill="#fbf6ea" stroke="#6e2b3f" stroke-width="1.6"/>
    <rect x="62" y="106" width="36" height="7" fill="#a3364f"/>
    <path d="M71 26 L89 26 L89 54 C107 60 114 74 114 90 L114 140 C114 148 108 152 100 152 L60 152 C52 152 46 148 46 140 L46 90 C46 74 53 60 71 54 Z" fill="rgba(156,205,196,.35)" stroke="#2f5d8a" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M55 96 L55 136" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".9"/>
    <rect class="v-lid" x="68" y="12" width="24" height="16" rx="3" fill="#c9a15a" stroke="#6e2b3f" stroke-width="1.8"/>
  </g>`,
  envelope: `
  <ellipse cx="80" cy="152" rx="62" ry="5" fill="#1f2633" opacity=".08"/>
  <g transform="rotate(-6 80 95)">
    <path d="M106 58 L124 20" stroke="#3f6b3c" stroke-width="2" stroke-linecap="round"/>
    <g fill="#8a76b8"><ellipse cx="121" cy="27" rx="3" ry="5" transform="rotate(25 121 27)"/><ellipse cx="117" cy="35" rx="3" ry="5" transform="rotate(25 117 35)"/><ellipse cx="114" cy="43" rx="3" ry="5" transform="rotate(25 114 43)"/></g>
    <rect x="20" y="52" width="120" height="84" rx="6" fill="#fbf6ea" stroke="#6e2b3f" stroke-width="2.2"/>
    <path d="M20 132 L66 94 M140 132 L94 94" stroke="#6e2b3f" stroke-width="1.4" opacity=".45"/>
    <path d="M22 56 L80 100 L138 56" fill="#f4ecd9" stroke="#6e2b3f" stroke-width="2.2" stroke-linejoin="round"/>
    <g class="v-lid">
      <circle cx="80" cy="100" r="16" fill="#a3364f" stroke="#6e2b3f" stroke-width="1.6"/>
      <circle cx="80" cy="100" r="10" fill="none" stroke="#f1c6cf" stroke-width="1.4"/>
      <path d="M80 93 L82 98 L87 98 L83 101 L84.5 106 L80 103 L75.5 106 L77 101 L73 98 L78 98Z" fill="#f1c6cf"/>
    </g>
  </g>`,
  tin: `
  <ellipse cx="80" cy="157" rx="54" ry="5" fill="#1f2633" opacity=".08"/>
  <rect x="34" y="62" width="92" height="90" rx="8" fill="#9cc0d8" stroke="#2f5d8a" stroke-width="2.2"/>
  <rect x="50" y="88" width="60" height="40" rx="3" fill="#fbf6ea" stroke="#2f5d8a" stroke-width="1.6"/>
  <path d="M58 100 H102 M58 108 H96 M58 116 H88" stroke="#9aa6b5" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M41 72 V140" stroke="#fff" stroke-width="3" opacity=".7" stroke-linecap="round"/>
  <g class="v-lid"><rect x="28" y="48" width="104" height="20" rx="6" fill="#c9a15a" stroke="#6e2b3f" stroke-width="2"/><path d="M36 58 H124" stroke="#6e2b3f" stroke-width="1" opacity=".4"/></g>`,
  lantern: `
  <line x1="80" y1="6" x2="80" y2="30" stroke="#6e2b3f" stroke-width="2"/>
  <rect class="v-lid" x="60" y="28" width="40" height="10" rx="3" fill="#c9a15a" stroke="#6e2b3f" stroke-width="1.8"/>
  <ellipse cx="80" cy="84" rx="46" ry="48" fill="#d9534f" stroke="#6e2b3f" stroke-width="2.2"/>
  <ellipse cx="80" cy="84" rx="30" ry="34" fill="#ffd27a" opacity=".35"/>
  <ellipse cx="80" cy="84" rx="24" ry="48" fill="none" stroke="#6e2b3f" stroke-width="1.4" opacity=".55"/>
  <line x1="80" y1="36" x2="80" y2="132" stroke="#6e2b3f" stroke-width="1.4" opacity=".55"/>
  <rect x="60" y="130" width="40" height="10" rx="3" fill="#c9a15a" stroke="#6e2b3f" stroke-width="1.8"/>
  <path d="M72 140 V160 M80 140 V165 M88 140 V160" stroke="#c9a15a" stroke-width="2.4" stroke-linecap="round"/>`,
  musicbox: `
  <ellipse cx="80" cy="156" rx="58" ry="5" fill="#1f2633" opacity=".08"/>
  <path d="M24 40 V22 L36 18 V36" fill="none" stroke="#2f5d8a" stroke-width="2"/><circle cx="21" cy="40" r="4" fill="#2f5d8a"/><circle cx="33" cy="36" r="4" fill="#2f5d8a"/>
  <g class="v-lid"><path d="M30 94 L42 44 L142 44 L130 94 Z" fill="#b8835a" stroke="#6e2b3f" stroke-width="2"/><path d="M40 88 L49 52 L134 52 L124 88Z" fill="#f3e2bb" stroke="#6e2b3f" stroke-width="1.2"/><circle cx="88" cy="70" r="9" fill="none" stroke="#6e2b3f" stroke-width="1.2" opacity=".6"/></g>
  <rect x="30" y="94" width="100" height="56" rx="4" fill="#a5714a" stroke="#6e2b3f" stroke-width="2"/>
  <path d="M30 108 H130" stroke="#6e2b3f" stroke-width="1.2" opacity=".5"/>
  <rect x="72" y="118" width="16" height="10" rx="2" fill="#c9a15a" stroke="#6e2b3f" stroke-width="1.2"/>
  <path d="M130 124 H142 V114" fill="none" stroke="#6e2b3f" stroke-width="2.2" stroke-linecap="round"/><circle cx="142" cy="112" r="4" fill="#c9a15a" stroke="#6e2b3f" stroke-width="1.4"/>`,
  maison: `
  <ellipse cx="80" cy="156" rx="58" ry="5" fill="#1f2633" opacity=".1"/>
  <g class="v-lid"><path d="M32 92 L40 42 Q41 36 47 36 L113 36 Q119 36 120 42 L128 92 Z" fill="#26406a" stroke="#c9a15a" stroke-width="2"/><path d="M42 86 L48 46 L112 46 L118 86Z" fill="#f3ead8"/><text x="80" y="68" text-anchor="middle" font-family="Georgia,serif" font-size="9" fill="#9a7a3a" letter-spacing="1.5">AURÈLE</text></g>
  <rect x="28" y="92" width="104" height="58" rx="6" fill="#1f3554" stroke="#c9a15a" stroke-width="2"/>
  <rect x="38" y="98" width="84" height="22" rx="10" fill="#2b4a78"/>
  <circle cx="80" cy="94" r="12" fill="none" stroke="#c9a15a" stroke-width="4"/>
  <path d="M80 66 L89 75 L80 84 L71 75Z" fill="#eaf3fb" stroke="#8aa7c4" stroke-width="1.4"/>
  <path d="M28 136 H132" stroke="#c9a15a" stroke-width="1" opacity=".6"/>`,
};
export const vessel = (k, cls = '') => `<div class="vessel ${cls}"><svg viewBox="0 0 160 170" aria-hidden="true">${ART[k]}</svg></div>`;

/* ---------- Profile pictures (illustrated portraits, viewBox 0 0 40 40) ---------- */
/* A portrait is { bg, shirt, hair, style, beard?, glasses? }, stored on the profile.
   PORTRAITS are the choices offered when setting up a profile. */
export const PORTRAITS = [
  { bg: '#dce8f2', shirt: '#2f5d8a', hair: '#2a2420', style: 'short' },
  { bg: '#fde4d6', shirt: '#5a8fd0', hair: '#3a2a22', style: 'long' },
  { bg: '#e6e0f0', shirt: '#6e2b3f', hair: '#c9a15a', style: 'spiky', beard: true },
  { bg: '#f6e1e6', shirt: '#a3364f', hair: '#4a4048', style: 'bun' },
  { bg: '#e1f0e4', shirt: '#3f6b3c', hair: '#2a2420', style: 'bob' },
  { bg: '#f3ead2', shirt: '#16263f', hair: '#1f1a18', style: 'short', glasses: true },
  { bg: '#e8eef6', shirt: '#c9a15a', hair: '#6b4a32', style: 'long', glasses: true },
  { bg: '#efe6dc', shirt: '#4a5466', hair: '#8a8f99', style: 'short', beard: true },
  { bg: '#e4eef0', shirt: '#2f5d8a', hair: '#7a3b2a', style: 'bob', glasses: true },
];
const HAIR = {
  short: 'M12.5 16.5 C12 9.5 28 9.5 27.5 16.5 C26 12.5 14 12.5 12.5 16.5Z',
  spiky: 'M12.5 16 L13 10.5 L16 12 L18 8 L21 11 L24 8.5 L25.5 12 L27.5 11 L27.5 16 C25 12.5 15 12.5 12.5 16Z',
  fringe: 'M12.6 17 C13 10.5 27 10.5 27.4 17 C25 13 15 13 12.6 17Z',
  bun: 'M12.5 17 C12 10 28 10 27.5 17 C26 12.5 14 12.5 12.5 17Z',
  bob: 'M11.5 22 C10.5 9 29.5 9 28.5 22 L26.5 22 C26.5 15 13.5 15 13.5 22Z',
};
/* future: adds the small clock badge used for 未來的自己. */
export function face(cfg, future = false) {
  // Portraits come from the database, so only known styles and #rrggbb colours get into the SVG.
  const d = PORTRAITS[0], c = cfg && typeof cfg === 'object' ? cfg : {};
  const col = (v, def) => (/^#[0-9a-f]{6}$/i.test(v) ? v : def);
  const f = {
    bg: col(c.bg, d.bg), shirt: col(c.shirt, d.shirt), hair: col(c.hair, d.hair),
    style: ['short', 'spiky', 'long', 'bun', 'bob'].includes(c.style) ? c.style : 'short',
    beard: !!c.beard, glasses: !!c.glasses,
  };
  return `<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" fill="${f.bg}"/>
  ${f.style === 'long' ? `<path d="M12 19 C10.5 8 29.5 8 28 19 L29.5 30 C27 28.5 26.5 24 26.5 19 C25 13.5 15 13.5 13.5 19 C13.5 24 13 28.5 10.5 30Z" fill="${f.hair}"/>` : ''}
  <path d="M5 41 C6 31 12.5 28 20 28 C27.5 28 34 31 35 41Z" fill="${f.shirt}"/>
  <rect x="17.5" y="22" width="5" height="7" rx="2" fill="#eac4a5"/>
  <circle cx="20" cy="17.5" r="7.5" fill="#f2d3b8"/>
  <path d="${HAIR[f.style === 'long' ? 'fringe' : f.style]}" fill="${f.hair}"/>
  ${f.style === 'bun' ? `<circle cx="20" cy="8.5" r="3.6" fill="${f.hair}"/>` : ''}
  ${f.beard ? `<path d="M13.5 19 C14 25.5 26 25.5 26.5 19 C24 23 16 23 13.5 19Z" fill="${f.hair}"/>` : ''}
  <g fill="#1f2633"><circle cx="17" cy="18.2" r=".9"/><circle cx="23" cy="18.2" r=".9"/></g>
  ${f.glasses ? '<g fill="none" stroke="#1f2633" stroke-width="1"><circle cx="17" cy="18.2" r="2.5"/><circle cx="23" cy="18.2" r="2.5"/><path d="M19.5 18.2 H20.5"/></g>' : ''}
  <path d="M18 21.6 Q20 23 22 21.6" fill="none" stroke="#b5735a" stroke-width=".9" stroke-linecap="round"/>
  ${future ? '<circle cx="31" cy="31" r="6.5" fill="#fff" stroke="#2f5d8a" stroke-width="1.2"/><path d="M31 27.5 V31 L33.5 32.5" fill="none" stroke="#2f5d8a" stroke-width="1.3" stroke-linecap="round"/>' : ''}
  </svg>`;
}
