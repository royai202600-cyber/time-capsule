#!/usr/bin/env node
// Export only B5 files; other batches' WebP bytes remain untouched.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require(process.env.SHARP_MODULE_DIR || 'sharp');
const root = path.resolve(__dirname, '../../..');
const ids = ['hot-air-balloon','bubble-tea','dim-sum-steamer','bento','paper-cranes','heart-locket','suitcase','postbox','camp-lantern','treasure-chest'];
const names = fs.readdirSync(path.join(root, 'design/art/vessels')).filter(name => ids.some(id => name === `vessel-${id}.png` || name.startsWith(`vessel-${id}-`))).map(name => name.replace(/\.png$/, ''));
async function main() {
  for (const name of names) {
    const input = path.join(root, 'design/art/vessels', `${name}.png`);
    const output = path.join(root, 'public/art/vessels', `${name}.webp`);
    fs.mkdirSync(path.dirname(output), {recursive: true});
    await sharp(input).resize({width: 512, height: 512, fit: 'inside', withoutEnlargement: true})
      .webp({quality: 85, effort: 5}).toFile(output);
  }
  console.log(`Exported ${names.length} B5 WebP assets.`);
}
main().catch(error => {console.error(error); process.exitCode = 1;});
