/** Pre-migration catalogues omit earned_place; zero price never unlocks a reward. */
export type VesselAccess = { price_mop: number; earned_place?: string | null };
export const isEarnedVessel = (v: VesselAccess) => v.earned_place != null;
export const canUseVessel = (v: VesselAccess, owned: boolean) => owned || (v.price_mop === 0 && !isEarnedVessel(v));
export const showVesselInShop = (v: VesselAccess, owned: boolean) => owned || !isEarnedVessel(v);
