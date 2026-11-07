#!/usr/bin/env node
// Export web-ready copies without changing the app's dependency list.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require(process.env.SHARP_MODULE_DIR || 'sharp');

const artRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(artRoot, '..', '..');
const manifest = JSON.parse(fs.readFileSync(path.join(artRoot, 'manifest.json'), 'utf8'));

function maxEdge(relativePath) {
  if (/^(vessels|stamps|portraits)\//.test(relativePath) || relativePath === 'seal-wax.png') return 512;
  if (relativePath === 'fx/fx-glint.png') return 512;
  if (relativePath === 'map-asia.png') return 1600;
  if (relativePath === 'app-icon.png') return 512;
  return null;
}

async function main() {
  let count = 0;
  for (const entry of manifest) {
    if (!entry.web_export) continue;
    const relativePath = entry.path.replace(/^design\/art\//, '');
    const output = path.join(repoRoot, entry.web_export);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    let pipeline = sharp(path.join(repoRoot, entry.path));
    const limit = maxEdge(relativePath);
    if (limit) pipeline = pipeline.resize({ width: limit, height: limit, fit: 'inside', withoutEnlargement: true });
    await pipeline.webp({ quality: 85, effort: 5 }).toFile(output);
    count++;
  }
  const iconRoot = path.join(repoRoot, 'public', 'icons');
  fs.mkdirSync(iconRoot, { recursive: true });
  for (const [name, size] of [['icon-512.png', 512], ['icon-192.png', 192],
                              ['apple-touch-icon.png', 180], ['favicon-32.png', 32]]) {
    await sharp(path.join(artRoot, 'app-icon.png'))
      .flatten({ background: '#2F5D8A' })
      .resize(size, size, { fit: 'cover' })
      .png({ compressionLevel: 9 })
      .toFile(path.join(iconRoot, name));
  }
  console.log(`Exported ${count} WebP assets and 4 opaque PNG icons.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
