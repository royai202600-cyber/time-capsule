import { describe, expect, it } from 'vitest';
import { canUseVessel, showVesselInShop } from './vesselAccess';
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
