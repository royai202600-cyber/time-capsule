#!/usr/bin/env node
// Audits every Corrupted Capsule crack overlay: coverage on the vessel, and contrast against the dark layer.
// Writes design/art/_checks/crack-overlay-audit.json and crack-overlay-sheet.png (each vessel at fight and map size).
// Run from the repo root: NODE_PATH=<folder with sharp>/node_modules node design/art/scripts/audit-crack-overlays.cjs
const fs = require('fs');
const sharp = require('sharp');

const SIZE = 512, CELL = 150, MAP = 56, COLUMNS = 8;
const manifest = fs.readFileSync('mobile/src/art/manifest.ts', 'utf8');
const vessels = [...manifest.matchAll(/['"]?([\w-]+)['"]?: \{\s*['"]?assembled['"]?: require\('[^']*\/(vessel-[\w-]+)\.webp'\)/g)].map((m) => ({ kind: m[1], file: m[2], name: m[2].replace('vessel-', '') }));
const quoted = new Set([...manifest.matchAll(/['"]?([\w-]+)['"]?: \{\s*"assembled": require/g)].map((m) => m[1]));
const lum = (r, g, b) => .2126 * r + .7152 * g + .0722 * b;
const darken = (input) => sharp(input).modulate({ saturation: .55, brightness: .8 }).png().toBuffer();

(async () => {
  const rows = [], cells = [];
  for (const [i, v] of vessels.entries()) {
    const art = await sharp(`public/art/vessels/${v.file}.webp`).resize(SIZE, SIZE).ensureAlpha().raw().toBuffer();
    const crackFile = `public/art/game/cracks/${v.name}.webp`;
    const crack = await sharp(crackFile).resize(SIZE, SIZE).ensureAlpha().raw().toBuffer();
    let body = 0, shown = 0, under = 0, ink = 0;
    for (let p = 0; p < art.length; p += 4) {
      if (art[p + 3] > 40) body++;
      if (crack[p + 3] > 128) { shown++; under += lum(art[p], art[p + 1], art[p + 2]) * .8; ink += lum(crack[p], crack[p + 1], crack[p + 2]); }
    }
    rows.push({ vessel: v.kind, format: quoted.has(v.kind) ? 'newest (quoted)' : 'original', overlayFile: crackFile, bytes: fs.statSync(crackFile).size, coveragePct: +(shown / body * 100).toFixed(2), contrast: +(((under / shown) - (ink / shown))).toFixed(1) });
    const base = await darken(await sharp(`public/art/vessels/${v.file}.webp`).resize(CELL, CELL).png().toBuffer());
    const top = await sharp(crackFile).resize(CELL, CELL).png().toBuffer();
    const fight = await sharp(base).composite([{ input: top }]).png().toBuffer();
    const small = await sharp(fight).resize(MAP, MAP).png().toBuffer();
    const x = (i % COLUMNS) * CELL, y = Math.floor(i / COLUMNS) * CELL;
    cells.push({ input: fight, left: x, top: y }, { input: small, left: x + CELL - MAP, top: y + CELL - MAP });
  }
  fs.writeFileSync('design/art/_checks/crack-overlay-audit.json', JSON.stringify({ vessels: rows.length, withOverlay: rows.filter((r) => r.bytes > 0).length, rows }, null, 2) + '\n');
  await sharp({ create: { width: COLUMNS * CELL, height: Math.ceil(vessels.length / COLUMNS) * CELL, channels: 3, background: '#DCE6CF' } }).composite(cells).png().toFile('design/art/_checks/crack-overlay-sheet.png');
  const low = [...rows].sort((a, b) => a.contrast - b.contrast).slice(0, 8), thin = [...rows].sort((a, b) => a.coveragePct - b.coveragePct).slice(0, 8);
  console.log(rows.length, 'audited'); console.log('lowest contrast', low.map((r) => `${r.vessel}:${r.contrast}`).join(' ')); console.log('least coverage', thin.map((r) => `${r.vessel}:${r.coveragePct}`).join(' '));
})();
