import { useMemo, useRef } from "react";
import { characters } from "../../art/manifest";
import { distanceMeters } from "../../services/data";
import { GAME_ACTION_RADIUS_M } from "../../services/game";
import { collectAnywhere, guideSpot, guideStage, inOrder, locked as questLocked, placed, type PrivateHunt } from "../../services/privateHunt";
import { keeperPortrait } from "../hunt/HuntViews";
import { questImageUri, useQuestImages } from "../hunt/questImage";
import { useHuntText } from "../hunt/strings";
import { assetUri, type LivePin } from "./live/types";

type Spot = { lat: number; lng: number };
/** A guide who appears near you stays put until you wander this far from him, so he doesn't trail you. */
const GUIDE_STAYS_M = 80;

export function usePrivateQuestPins(privateList: PrivateHunt[], you: Spot | null, h: ReturnType<typeof useHuntText>) {
  const metersTo = (lat: number, lng: number) => you ? distanceMeters(you.lat, you.lng, lat, lng) : Infinity;
  // A joined private hunt's quests: brass location pins, only ever visible to people who joined.
  const questPhotos = useQuestImages(privateList.flatMap((ph) => ph.quests.map((w) => w.image)));
  // Quest pins show only while your run is on: not before you talk to the guide, and gone once it closes,
  // you finish, or your time runs out. Catch quests have no spot, so no pin.
  const questPins = useMemo<LivePin[]>(() => privateList.filter((ph) => guideStage(ph) === "playing").flatMap((ph) => inOrder(ph).filter(placed).map<LivePin>((w) => ({
    id: `quest-${ph.id}-${w.id}`, lat: w.location_lat, lng: w.location_lng, kind: "quest", vessel: "",
    quest: w.quest_type, done: !!w.done_at, locked: questLocked(ph, w), photo: questImageUri(w.image),
    near: metersTo(w.location_lat, w.location_lng) <= GAME_ACTION_RADIUS_M,
    tag: w.done_at ? undefined : h.pointsShort(w.points),
  }))), [privateList, you?.lat, you?.lng, h, questPhotos]);

  // Each hunt's guide (docs/design/city-orienteering.md, Part C): there to start you ("!") and to give the
  // stamp ("✓"). A fixed guide also waits at his spot during the run; one who appears near you only comes
  // when he is needed. After the hunt's end he has gone home, and the stamp is collected from the Quest sheet.
  const nearSpots = useRef<Record<string, Spot>>({});
  const guides = useMemo(() => privateList.flatMap((ph) => {
    const stage = guideStage(ph);
    const fixed = ph.guide_mode === "fixed";
    if (!(stage === "start" || (stage === "collect" && !collectAnywhere(ph)) || (stage === "playing" && fixed))) return [];
    let spot = guideSpot(ph, you);
    if (!fixed) {
      const kept = nearSpots.current[ph.id];
      const inArea = !!you && distanceMeters(you.lat, you.lng, ph.area.lat, ph.area.lng) <= ph.area.radius_m;
      if (kept && inArea && you && distanceMeters(you.lat, you.lng, kept.lat, kept.lng) <= GUIDE_STAYS_M) spot = kept;
      if (inArea) nearSpots.current[ph.id] = spot; else delete nearSpots.current[ph.id];
    }
    return [{ hunt: ph, stage, spot }];
  }), [privateList, you?.lat, you?.lng]);
  const guidePins = useMemo<LivePin[]>(() => guides.map(({ hunt, stage, spot }) => ({
    id: `guide-${hunt.id}`, lat: spot.lat, lng: spot.lng, kind: "keeper", filterAs: "quest", vessel: "",
    portrait: assetUri(keeperPortrait), figure: assetUri(characters.keeper),
    mark: stage === "start" ? "!" : stage === "collect" ? "✓" : null,
  })), [guides]);

  return { questPins, guidePins, guides };
}
