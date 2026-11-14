import { useMemo } from "react";
import { crackOverlays } from "../../art/crackOverlays";
import { gameArt } from "../../art/manifest";
import { distanceMeters } from "../../services/data";
import { GAME_ACTION_RADIUS_M, type CorruptedCapsule, type Nearby, type Waypost } from "../../services/game";
import { MONUMENTS, monumentTop } from "./live/mapHtml";
import { assetUri, type LivePin } from "./live/types";

import { vesselUri } from "./journeyModel";

export function useGamePins(nearby: Nearby, throwing: CorruptedCapsule | null, you: { lat: number; lng: number } | null) {
  const metersTo = (lat: number, lng: number) => you ? distanceMeters(you.lat, you.lng, lat, lng) : Infinity;
  const cooling = (w: Waypost) => !!w.cooldown_until && new Date(w.cooldown_until).getTime() > Date.now();
  const gamePins = useMemo<LivePin[]>(() => [
    // Only what's inside the pickup circle shows, so capsules never crowd the map.
    ...nearby.corrupted.filter((c) => c.id !== throwing?.id && metersTo(c.lat, c.lng) <= GAME_ACTION_RADIUS_M).map<LivePin>((c) => (
      { id: `corrupted-${c.id}`, lat: c.lat, lng: c.lng, kind: "corrupted", vessel: vesselUri(c.vessel), cracks: assetUri(crackOverlays[c.vessel]) ?? undefined, rarity: c.rarity, near: true }
    )),
    ...nearby.wayposts.map<LivePin>((w) => {
      // A Landmark with a monument is the building itself: its seal floats on top, at the real spot.
      const monument = w.kind === "landmark" ? MONUMENTS.find((m) => m.id === w.place) : undefined;
      return {
      id: `way-${w.id}`, lat: monument?.lat ?? w.lat, lng: monument?.lng ?? w.lng, lift: monument ? monumentTop(monument) + 4 : undefined, kind: w.kind === "landmark" ? "landmark" : "waypost", vessel: assetUri(w.kind === "landmark" ? gameArt.landmarkGem : cooling(w) ? gameArt.waypostGem : gameArt.waypostGemBlue) ?? "",
      done: cooling(w),
      near: metersTo(w.lat, w.lng) <= GAME_ACTION_RADIUS_M,
    }; }),
  ], [nearby, throwing?.id, you?.lat, you?.lng]);

  return gamePins;
}
