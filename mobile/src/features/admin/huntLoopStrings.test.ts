import { describe, expect, it, vi } from 'vitest';
vi.mock('../../i18n', () => ({ useLanguage: () => ({ language: 'zh' }) }));
vi.mock('../../services/supabase', () => ({ supabase: {} }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn(), setItem: vi.fn() } }));
import { huntLoopStrings } from './huntLoopStrings';

const shape = (o: object): string[] => Object.entries(o).flatMap(([k, v]) =>
  v && typeof v === 'object' ? shape(v).map((s) => `${k}.${s}`) : [k]).sort();

describe('hunt-loop admin strings', () => {
  it('has every key in both languages', () => expect(shape(huntLoopStrings.zh)).toEqual(shape(huntLoopStrings.en)));
});
