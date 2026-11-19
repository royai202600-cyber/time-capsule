import { describe, expect, it, vi } from 'vitest';
vi.mock('../../i18n', () => ({ useLanguage: () => ({ language: 'zh' }) }));
vi.mock('../../services/supabase', () => ({ supabase: {} }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn(), setItem: vi.fn() } }));
import { huntLoopStrings, sayError, type HuntLoopText, type Say } from './huntLoopStrings';

const shape = (o: object): string[] => Object.entries(o).flatMap(([k, v]) =>
  v && typeof v === 'object' ? shape(v).map((s) => `${k}.${s}`) : [k]).sort();

describe('hunt-loop admin strings', () => {
  it('has every key in both languages', () => expect(shape(huntLoopStrings.zh)).toEqual(shape(huntLoopStrings.en)));
});

describe('admin notices follow the language', () => {
  const zh = huntLoopStrings.zh as HuntLoopText, en = huntLoopStrings.en as HuntLoopText;
  it('says a refused write in whichever language is showing now', () => {
    const say = sayError(new Error('forbidden'));
    expect(say(zh)).toBe(zh.error.forbidden);
    expect(say(en)).toBe(en.error.forbidden);
    expect(say(zh)).not.toBe(say(en));
  });
  it('falls back to the general failure for an unknown error', () => {
    expect(sayError(new Error('???'))(en)).toBe(en.error.failed);
  });
  it('keeps a success notice as a way to say it, not frozen text', () => {
    const removed: Say = (t) => t.removed;
    expect(removed(zh)).toBe(zh.removed);
    expect(removed(en)).toBe(en.removed);
  });
});
