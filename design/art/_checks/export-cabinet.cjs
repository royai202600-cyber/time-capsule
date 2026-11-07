#!/usr/bin/env node
// Run the unchanged shared exporter in isolation, copying back only A3 WebPs.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const repo = path.resolve(__dirname, '../../..');
const art = path.join(repo, 'design/art');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'time-capsule-a3-'));
try {
  const entries = JSON.parse(fs.readFileSync(path.join(art, 'manifest.json'), 'utf8'))
    .filter(entry => /^design\/art\/cabinet\/cabinet-(crown|row|base)\.png$/.test(entry.path));
  if (entries.length !== 3) throw new Error('Expected exactly three A3 cabinet tiles');
  fs.mkdirSync(path.join(temporary, 'design/art/scripts'), { recursive: true });
  fs.writeFileSync(path.join(temporary, 'design/art/manifest.json'), JSON.stringify(entries));
  for (const relative of [...entries.map(entry => entry.path), 'design/art/app-icon.png', 'design/art/scripts/export-webp.cjs']) {
    const destination = path.join(temporary, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(repo, relative), destination);
  }
  execFileSync(process.execPath, [path.join(temporary, 'design/art/scripts/export-webp.cjs')], {
    env: process.env, stdio: 'inherit',
  });
  for (const entry of entries) {
    const destination = path.join(repo, entry.web_export);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(temporary, entry.web_export), destination);
    console.log(entry.web_export, fs.statSync(destination).size, 'bytes');
  }
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
