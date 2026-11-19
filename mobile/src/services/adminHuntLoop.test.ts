import { describe, expect, it, vi } from 'vitest';
vi.mock('./supabase', () => ({ supabase: {} }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn(), setItem: vi.fn() } }));
import { addDays, afterSave, canPublish, hasPlace, huntCity, mergePoolEntry, needsRecheck, poolProblems, samplePool, usdOf, type PoolEntry, type PoolSave } from './adminHuntLoop';
import { sample as adminSample } from './adminSample';
import { undoable } from './admin';

const question = (over: Partial<PoolSave> = {}): PoolSave => ({
  type: 'question', kind: 'choice', place_zh: '店', place_en: 'Shop', prompt_zh: '問', prompt_en: 'Q',
  choices: [{ zh: '一', en: 'one' }, { zh: '二', en: 'two' }], answer: 1, ...over,
});

describe('hunt-loop admin rules', () => {
  it('maps the admin region ids to hunt cities', () => {
    expect(huntCity('hong-kong')).toBe('hongkong');
    expect(huntCity('taipei')).toBe('taipei');
  });
  it('rounds the US dollar price to cents like the server', () => expect(usdOf(85, 32.4)).toBe(2.62));
  it('counts calendar days across a month end', () => expect(addDays('2026-11-30', 1)).toBe('2026-12-01'));
  it('needs a place on the map, and a source and date to publish', () => {
    expect(hasPlace({ location_lat: null, location_lng: null })).toBe(false);
    expect(canPublish({ source_url: 'https://x.test', checked_on: null })).toBe(false);
    expect(canPublish({ source_url: 'https://x.test', checked_on: '2026-11-19' })).toBe(true);
  });
  it('lists what a new question still needs', () => {
    expect(poolProblems(question(), true)).toEqual([]);
    expect(poolProblems(question({ answer: undefined }), true)).toEqual(['answer']);
    expect(poolProblems(question({ answer: 2 }), true)).toEqual(['answer']);
    expect(poolProblems(question({ choices: [{ zh: '一', en: '' }, { zh: '二', en: 'two' }] }), true)).toContain('choices');
    expect(poolProblems(question({ place_en: ' ' }), true)).toContain('place');
    expect(poolProblems(question({ source_url: 'http://x.test' }), true)).toContain('source');
  });
  it('keeps the saved answer when editing leaves it blank', () => {
    expect(poolProblems(question({ answer: undefined }), false)).toEqual([]);
    expect(poolProblems({ ...question(), kind: 'text', choices: null, answer: undefined }, false)).toEqual([]);
  });
  it('needs a local price, currency and rate for a new price', () => {
    const price: PoolSave = { type: 'price', place_zh: '店', place_en: 'Shop', prompt_zh: '問', prompt_en: 'Q', currency: 'TWD', rate: 32.4 };
    expect(poolProblems(price, true)).toEqual(['price']);
    expect(poolProblems({ ...price, local_amount: 85 }, true)).toEqual([]);
    expect(poolProblems(price, false)).toEqual([]);
  });
  it('offers Undo for the new admin writes', () => {
    for (const a of ['question_pool.edit', 'todays_hunt.swap', 'vessel.unlimited', 'vessel.player_copies', 'rack.remove']) expect(undoable(a)).toBe(true);
    expect(undoable('rack.list')).toBe(false);
  });
});

describe('question pool save and status results (no `uses`)', () => {
  const entry = (id: string, uses: PoolEntry['uses']): PoolEntry => ({
    id, city: 'taipei', type: 'question', place_zh: '店', place_en: 'Shop', location_lat: 25, location_lng: 121, prompt_zh: '問', prompt_en: 'Q',
    kind: 'choice', choices: null, currency: null, rate: null, photo: null, photo_credit: null, photo_license: null, photo_link: null, vessel: null,
    source_url: null, checked_on: null, status: 'draft', needs_recheck: false, uses,
  } as PoolEntry);
  const used = entry('a', [{ context: 'city_puzzle', id: 4 }]);
  it('keeps the usage the list showed when an edit comes back without uses', () => {
    const { uses: _u, ...result } = { ...used, prompt_en: 'Edited' };
    const { list, entry: merged } = mergePoolEntry([used, entry('b', [])], result);
    expect(merged).toMatchObject({ prompt_en: 'Edited', uses: [{ context: 'city_puzzle', id: 4 }] });
    expect(list.map((e) => e.id)).toEqual(['a', 'b']);
    expect(list[0]!.uses).toHaveLength(1);
  });
  it('gives a new entry no uses and puts it first', () => {
    const { uses: _u, ...fresh } = entry('new', []);
    const { list, entry: merged } = mergePoolEntry([used], fresh);
    expect(merged.uses).toEqual([]);
    expect(list.map((e) => e.id)).toEqual(['new', 'a']);
  });
});

describe('question pool: create, save, edit, save again (sheet stays open)', () => {
  const price = (over: Partial<PoolSave> = {}): PoolSave => ({
    city: 'taipei', type: 'price', place_zh: '店', place_en: 'Shop', prompt_zh: '多少？', prompt_en: 'How much?', location_lat: 25.03, location_lng: 121.56,
    currency: 'TWD', rate: 32.5, source_url: null, checked_on: null, ...over,
  });
  for (const [kind, first] of [['choice', question({ city: 'taipei', location_lat: 25.03, location_lng: 121.56 })], ['price', price({ local_amount: 65 })]] as const) {
    it(`${kind}: the second save updates the same row and keeps the grading data`, async () => {
      adminSample.viewAs('owner');
      const before = samplePool.rows();
      const out = await samplePool.save(first);
      const graded = samplePool.grading(out.id);
      // The form after the first save, edited, then saved without re-entering the answer or price.
      const { answer: _a, local_amount: _l, ...form } = afterSave(first, out);
      expect(form.id).toBe(out.id);
      expect(poolProblems(form, false)).toEqual([]);
      const again = await samplePool.save({ ...form, prompt_en: 'Edited' });
      expect(again.id).toBe(out.id);
      expect(again.prompt_en).toBe('Edited');
      expect(samplePool.rows()).toBe(before + 1);
      expect(samplePool.grading(out.id)).toEqual(graded);
    });
  }
  it('works out the re-check flag from the saved checked date', () => {
    expect(needsRecheck('2026-05-18', '2026-11-19')).toBe(true);
    expect(needsRecheck('2026-05-19', '2026-11-19')).toBe(false);
    expect(needsRecheck(null, '2026-11-19')).toBe(false);
    const stale = { ...({} as PoolEntry), id: 'x', checked_on: '2025-01-01', needs_recheck: true, uses: [] };
    const { needs_recheck: _n, uses: _u, ...rechecked } = { ...stale, checked_on: '2026-11-19' };
    expect(mergePoolEntry([stale], rechecked, '2026-11-19').entry.needs_recheck).toBe(false);
  });
});
