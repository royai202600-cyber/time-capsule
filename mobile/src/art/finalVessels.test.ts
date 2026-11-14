import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { shopStrings } from '../features/shop/strings';

const root = resolve(import.meta.dirname, '../../..');
const ids = ['hot-air-balloon', 'bubble-tea', 'dim-sum-steamer', 'bento', 'paper-cranes', 'heart-locket', 'suitcase', 'postbox', 'camp-lantern', 'treasure-chest', 'spellbook', 'escape-pod', 'crystal-ball', 'wishing-lamp', 'potion', 'pocket-watch', 'diploma-tube', 'baby-shoes', 'memorial-candle', 'rocket-tin'];
const masters = JSON.parse(readFileSync(resolve(root, 'design/art/manifest.json'), 'utf8'));
const compiled = ts.transpileModule(readFileSync(resolve(root, 'mobile/src/art/manifest.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exports: any = {};
runInNewContext(compiled, { exports, require: (path: string) => path });
const asset = (file: string) => '../../../public/art/vessels/' + file.replace(/\.png$/, '.webp');

describe('final 20 vessel release contract', () => {
  it.each(ids)('%s reproduces the approved art metadata and has every export', (id) => {
    const master = masters.find((entry: any) => entry.vessel?.id === id);
    const { id: _, layers, glint, ...rest } = master.vessel;
    const expected: any = Object.fromEntries(Object.entries(rest).filter(([, value]) => value != null));
    expected.assembled = asset(master.path.split('/').pop());
    expected.layers = layers.map(({ file, ...layer }: any) => ({ ...layer, source: asset(file) }));
    if (glint) expected.glint = asset(glint);
    expect(exports.vesselParts[id]).toEqual(expected);
    for (const source of [expected.assembled, ...expected.layers.map((layer: any) => layer.source), ...(glint ? [expected.glint] : [])]) {
      expect(existsSync(resolve(root, 'mobile/src/art', source))).toBe(true);
    }
    expect(expected.layers.some((layer: any) => layer.ground)).toBe(false);
  });

  it('keeps the bento draw order and the two opening glows', () => {
    expect(exports.vesselParts.bento.layers.map((layer: any) => layer.name)).toEqual(['box', 'lid', 'knot']);
    for (const id of ['camp-lantern', 'memorial-candle']) {
      const glow = exports.vesselParts[id].layers.find((layer: any) => layer.name === 'glow');
      expect(glow.open.map((key: any) => key.opacity)).toEqual([1, 1]);
    }
  });

  it('has short names and descriptions in both languages', () => {
    for (const lang of ['zh', 'en'] as const) for (const id of ids) {
      expect((shopStrings[lang] as any)[`shop.vessel.${id}`]).toBeTruthy();
      expect((shopStrings[lang] as any)[`shop.desc.${id}`]).toBeTruthy();
    }
  });

  it('appends ordinary catalogue items with the memorial candle free', () => {
    const sql = readFileSync(resolve(root, 'supabase/migrations/20261108065552_add_b5_b6_vessels.sql'), 'utf8');
    const rows = [...sql.matchAll(/\('([^']+)', (\d+), null, null, (\d+), null\)/g)];
    expect(rows.map(row => row[1])).toEqual(ids);
    rows.forEach((row, index) => {
      expect(Number(row[3])).toBe(48 + index);
      if (row[1] === 'memorial-candle') expect(Number(row[2])).toBe(0);
      else expect(Number(row[2])).toBeGreaterThanOrEqual(6);
      expect(Number(row[2])).toBeLessThanOrEqual(28);
    });
  });
});
