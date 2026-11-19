// Vessel copies (docs/design/hunt-loop.md, "5. Vessel copies"): each catch gives copies, each send uses one.
// The contract is Codex's HL-C2 backend: `vessels.unlimited_copies`, and `owned_vessels.copies` meaning copies
// left to send. Until it ships, development builds use a sample; production shows no copies at all.
import { isEarnedVessel, STARTER_VESSELS, type VesselAccess } from "./vesselAccess";

/** Codex's HL-C2 backend is live. Switch on when `unlimited_copies` and the new `copies` meaning are applied. */
export const COPIES_BACKEND = true;
export const COPIES_SAMPLE = !COPIES_BACKEND && typeof __DEV__ !== "undefined" && __DEV__;
export const COPIES = COPIES_BACKEND || COPIES_SAMPLE;
/** What existing owners start with, and what the sample gives every collected vessel. */
export const STARTING_COPIES = 10;

type CopiesVessel = VesselAccess & { id: string; unlimited_copies?: boolean | null };
type CopiesRow = { vessel: string; copies?: number | null };

/** Copies left to send: a number, or null for unlimited. Starters and earned Landmark vessels are unlimited. */
export function copiesOf(v: CopiesVessel, owned: CopiesRow[] | null | undefined): number | null {
  if (COPIES_BACKEND) return v.unlimited_copies ? null : owned?.find((o) => o.vessel === v.id)?.copies ?? 0;
  if (STARTER_VESSELS.includes(v.id) || isEarnedVessel(v)) return null;
  return sample.get(v.id) ?? STARTING_COPIES;
}
/** A collected vessel at ×0 stays collected but can't be sent until it's caught again. */
export const canSend = (copies: number | null) => copies === null || copies > 0;

// ---- development sample ----
// One vessel starts at ×0 so the empty state can be seen; sending from Create uses one copy.
const sample = new Map<string, number>([["gashapon", 0], ["firefly-jar", 1]]);
/** Development only: a send of a counted vessel used one copy. */
export const sampleUseCopy = (id: string) => { if (COPIES_SAMPLE) sample.set(id, Math.max(0, (sample.get(id) ?? STARTING_COPIES) - 1)); };
