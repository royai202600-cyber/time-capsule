import { describe, expect, it } from 'vitest';
import { canUseVessel, isCollected, showVesselInShop } from './vesselAccess';
describe('earned vessel access across Shop, Create and Cabinet', () => {
  const reward = { price_mop: 0, earned_place: 'tst-clock' };
  it('keeps a zero-price landmark hidden and unusable before ownership', () => {
    expect(showVesselInShop(reward, false)).toBe(false);
    expect(canUseVessel(reward, false)).toBe(false);
  });
  it('reveals and enables an earned landmark only after ownership arrives', () => {
    expect(showVesselInShop(reward, true)).toBe(true);
    expect(canUseVessel(reward, true)).toBe(true);
  });
  it('preserves free, paid and pre-migration catalogue behavior', () => {
    for (const earned_place of [undefined, null]) {
      expect(canUseVessel({ price_mop: 0, earned_place }, false)).toBe(true);
      expect(showVesselInShop({ price_mop: 22, earned_place }, false)).toBe(true);
      expect(canUseVessel({ price_mop: 22, earned_place }, false)).toBe(false);
      expect(canUseVessel({ price_mop: 22, earned_place }, true)).toBe(true);
    }
  });
});

describe('isCollected', () => {
  const free = { id: 'hourglass', price_mop: 0, earned_place: null };
  const starter = { id: 'tin', price_mop: 0, earned_place: null };
  it('counts only starters and owned vessels once the game is on', () => {
    expect(isCollected(starter, false, true)).toBe(true);
    expect(isCollected(free, false, true)).toBe(false);
    expect(isCollected(free, true, true)).toBe(true);
  });
  it('keeps every free vessel until the game ships', () => {
    expect(isCollected(free, false, false)).toBe(true);
  });
});

describe('Shop once the game is on', () => {
  it('sells only brand and numbered editions', () => {
    expect(showVesselInShop({ price_mop: 12 }, false, true)).toBe(false);
    expect(showVesselInShop({ price_mop: 0, brand: 'Maison' }, false, true)).toBe(true);
    expect(showVesselInShop({ price_mop: 30, edition_total: 300 }, false, true)).toBe(true);
  });
  it('never sells an earned vessel, even a numbered one', () => {
    expect(showVesselInShop({ price_mop: 0, earned_place: 'merlion', edition_total: 10 }, false, true)).toBe(false);
  });
});
