/**
 * What sits on a Corrupted Capsule on top of the dark layer. Change this one word to switch everywhere.
 * "anger" is Roy's black comic anger mark, which he likes; "cracks" is the final Crack A art he is trying.
 */
export const CORRUPTED_MARK: "cracks" | "anger" = "cracks";

/** The anger mark's exact placement, kept so it can always come back unchanged. */
export const ANGER_MARK = {
  /** Catch screen: fractions of the vessel's drawn size, inside its top right. */
  throw: { top: .3, left: .53, size: .19 },
  /** Map pin: pixels inside the 80 px vessel box. */
  map: { left: 42, bottom: 41, size: 17 },
} as const;
