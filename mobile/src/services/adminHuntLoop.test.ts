import { describe, expect, it, vi } from 'vitest';
vi.mock('./supabase', () => ({ supabase: {} }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn(), setItem: vi.fn() } }));
import { addDays, canPublish, hasPlace, huntCity, poolProblems, usdOf, type PoolSave } from './adminHuntLoop';
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
