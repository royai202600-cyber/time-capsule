// @ts-nocheck
export const PORTRAITS = [
  { bg: "#dce8f2", shirt: "#2f5d8a", hair: "#2a2420", style: "short" },
  { bg: "#fde4d6", shirt: "#5a8fd0", hair: "#3a2a22", style: "long" },
  {
    bg: "#e6e0f0",
    shirt: "#6e2b3f",
    hair: "#c9a15a",
    style: "spiky",
    beard: true,
  },
  { bg: "#f6e1e6", shirt: "#a3364f", hair: "#4a4048", style: "bun" },
  { bg: "#e1f0e4", shirt: "#3f6b3c", hair: "#2a2420", style: "bob" },
  {
    bg: "#f3ead2",
    shirt: "#16263f",
    hair: "#1f1a18",
    style: "short",
    glasses: true,
  },
  {
    bg: "#e8eef6",
    shirt: "#c9a15a",
    hair: "#6b4a32",
    style: "long",
    glasses: true,
  },
  {
    bg: "#efe6dc",
    shirt: "#4a5466",
    hair: "#8a8f99",
    style: "short",
    beard: true,
  },
  {
    bg: "#e4eef0",
    shirt: "#2f5d8a",
    hair: "#7a3b2a",
    style: "bob",
    glasses: true,
  },
];
const HAIR = {
  short: "M12.5 16.5 C12 9.5 28 9.5 27.5 16.5 C26 12.5 14 12.5 12.5 16.5Z",
  spiky:
    "M12.5 16 L13 10.5 L16 12 L18 8 L21 11 L24 8.5 L25.5 12 L27.5 11 L27.5 16 C25 12.5 15 12.5 12.5 16Z",
  fringe: "M12.6 17 C13 10.5 27 10.5 27.4 17 C25 13 15 13 12.6 17Z",
  bun: "M12.5 17 C12 10 28 10 27.5 17 C26 12.5 14 12.5 12.5 17Z",
  bob: "M11.5 22 C10.5 9 29.5 9 28.5 22 L26.5 22 C26.5 15 13.5 15 13.5 22Z",
};
/* future: adds the small clock badge used for 未來的自己. */
export function face(cfg, future = false) {
  // Portraits come from the database, so only known styles and #rrggbb colours get into the SVG.
  const d = PORTRAITS[0],
    c = cfg && typeof cfg === "object" ? cfg : {};
  const col = (v, def) => (/^#[0-9a-f]{6}$/i.test(v) ? v : def);
  const f = {
    bg: col(c.bg, d.bg),
    shirt: col(c.shirt, d.shirt),
    hair: col(c.hair, d.hair),
    style: ["short", "spiky", "long", "bun", "bob"].includes(c.style)
      ? c.style
      : "short",
    beard: !!c.beard,
    glasses: !!c.glasses,
  };
  return `<svg viewBox="0 0 40 40"><rect width="40" height="40" fill="${f.bg}"/>
  ${f.style === "long" ? `<path d="M12 19 C10.5 8 29.5 8 28 19 L29.5 30 C27 28.5 26.5 24 26.5 19 C25 13.5 15 13.5 13.5 19 C13.5 24 13 28.5 10.5 30Z" fill="${f.hair}"/>` : ""}
  <path d="M5 41 C6 31 12.5 28 20 28 C27.5 28 34 31 35 41Z" fill="${f.shirt}"/>
  <rect x="17.5" y="22" width="5" height="7" rx="2" fill="#eac4a5"/>
  <circle cx="20" cy="17.5" r="7.5" fill="#f2d3b8"/>
  <path d="${HAIR[f.style === "long" ? "fringe" : f.style]}" fill="${f.hair}"/>
  ${f.style === "bun" ? `<circle cx="20" cy="8.5" r="3.6" fill="${f.hair}"/>` : ""}
  ${f.beard ? `<path d="M13.5 19 C14 25.5 26 25.5 26.5 19 C24 23 16 23 13.5 19Z" fill="${f.hair}"/>` : ""}
  <g fill="#1f2633"><circle cx="17" cy="18.2" r=".9"/><circle cx="23" cy="18.2" r=".9"/></g>
  ${f.glasses ? '<g fill="none" stroke="#1f2633" stroke-width="1"><circle cx="17" cy="18.2" r="2.5"/><circle cx="23" cy="18.2" r="2.5"/><path d="M19.5 18.2 H20.5"/></g>' : ""}
  <path d="M18 21.6 Q20 23 22 21.6" fill="none" stroke="#b5735a" stroke-width=".9" stroke-linecap="round"/>
  ${future ? '<circle cx="31" cy="31" r="6.5" fill="#fff" stroke="#2f5d8a" stroke-width="1.2"/><path d="M31 27.5 V31 L33.5 32.5" fill="none" stroke="#2f5d8a" stroke-width="1.3" stroke-linecap="round"/>' : ""}
  </svg>`;
}
