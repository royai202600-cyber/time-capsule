/** Pre-migration catalogues omit earned_place; zero price never unlocks a reward. */
export type VesselAccess = { price_mop: number; earned_place?: string | null };
export const isEarnedVessel = (v: VesselAccess) => v.earned_place != null;
export const canUseVessel = (v: VesselAccess, owned: boolean) => owned || (v.price_mop === 0 && !isEarnedVessel(v));
export const showVesselInShop = (v: VesselAccess, owned: boolean) => owned || !isEarnedVessel(v);

/** What every new player starts with once the collecting game is on; everything else is found. */
export const STARTER_VESSELS = ['dome', 'bottle', 'envelope', 'tin'];
/** Until the game ships, every free vessel still counts as yours, as it does today. */
export const isCollected = (v: VesselAccess & { id: string }, owned: boolean, gameOn: boolean) =>
  owned || (gameOn ? STARTER_VESSELS.includes(v.id) : canUseVessel(v, false));
