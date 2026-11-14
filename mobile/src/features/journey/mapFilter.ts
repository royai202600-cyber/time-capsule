// The map filter under the locate button: show only what you are out for right now.
import type { LivePin } from "./live/types";

export type MapFilter = "all" | "capsules" | "cityHunt" | "privateHunt";
export const MAP_FILTERS: MapFilter[] = ["all", "capsules", "cityHunt", "privateHunt"];

// City Hunt is everything its steps use: the Keeper, Wayposts, Corrupted Capsules and the Landmark.
const KINDS: Record<Exclude<MapFilter, "all">, LivePin["kind"][]> = {
  capsules: ["publicCapsule", "place"],
  cityHunt: ["keeper", "waypost", "corrupted", "landmark"],
  privateHunt: ["quest"],
};

export const shows = (filter: MapFilter, kind: LivePin["kind"]) => filter === "all" || KINDS[filter].includes(kind);

export const filterCounts = (pins: Pick<LivePin, "kind">[]) =>
  Object.fromEntries(MAP_FILTERS.map((f) => [f, pins.filter((p) => shows(f, p.kind)).length])) as Record<MapFilter, number>;
