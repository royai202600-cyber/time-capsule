#!/usr/bin/env node
// Export only B5 balloon files; other batches' WebP bytes remain untouched.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require(process.env.SHARP_MODULE_DIR || 'sharp');
const root = path.resolve(__dirname, '../../..');
const names = ['vessel-hot-air-balloon', 'vessel-hot-air-balloon-basket', 'vessel-hot-air-balloon-balloon'];
async function main() {
  for (const name of names) {
    const input = path.join(root, 'design/art/vessels', `${name}.png`);
    const output = path.join(root, 'public/art/vessels', `${name}.webp`);
    fs.mkdirSync(path.dirname(output), {recursive: true});
    await sharp(input).resize({width: 512, height: 512, fit: 'inside', withoutEnlargement: true})
      .webp({quality: 85, effort: 5}).toFile(output);
  }
  console.log(`Exported ${names.length} B5 balloon WebP assets.`);
}
main().catch(error => {console.error(error); process.exitCode = 1;});
