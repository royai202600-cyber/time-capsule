import { describe, expect, it, vi } from 'vitest';
vi.mock('../../i18n', () => ({ useLanguage: () => ({ language: 'zh' }) }));
import { questStrings } from './strings';

const shape = (o: object): string[] => Object.entries(o).flatMap(([k, v]) =>
  v && typeof v === 'object' ? shape(v).map((s) => `${k}.${s}`) : [k]).sort();

describe('quest strings', () => {
  it('has every key in both languages', () => expect(shape(questStrings.zh)).toEqual(shape(questStrings.en)));
});
