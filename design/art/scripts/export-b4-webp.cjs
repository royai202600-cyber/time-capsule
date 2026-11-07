#!/usr/bin/env node
// Export only B4 art; parallel batches' WebP bytes remain untouched.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const artRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(artRoot, '..', '..');
const ids = new Set(['vinyl', 'vhs', 'photo-strip', 'arcade', 'pager', 'rotary-phone',
  'umbrella', 'love-padlock', 'lucky-stars', 'paper-plane']);
const manifest = JSON.parse(fs.readFileSync(path.join(artRoot, 'manifest.json'), 'utf8'));

async function main() {
  let count = 0;
  for (const entry of manifest) {
    const match = /^design\/art\/vessels\/vessel-(.+?)\.png$/.exec(entry.path);
    if (!match || !entry.web_export) continue;
    const id = [...ids].find(candidate => match[1] === candidate || match[1].startsWith(candidate + '-'));
    if (!id) continue;
    const output = path.join(repoRoot, entry.web_export);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    await sharp(path.join(repoRoot, entry.path))
      .resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85, effort: 5 }).toFile(output);
    count++;
  }
  console.log(`Exported ${count} B4 WebP assets.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
