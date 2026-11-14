import { useMemo } from "react";
import { distanceMeters } from "../../services/data";
import { GAME_ACTION_RADIUS_M } from "../../services/game";
import { huntStillOn, inOrder, locked as questLocked, type PrivateHunt } from "../../services/privateHunt";
import { questImageUri, useQuestImages } from "../hunt/questImage";
import { useHuntText } from "../hunt/strings";
import { type LivePin } from "./live/types";

export function usePrivateQuestPins(privateList: PrivateHunt[], you: { lat: number; lng: number } | null, h: ReturnType<typeof useHuntText>) {
  const metersTo = (lat: number, lng: number) => you ? distanceMeters(you.lat, you.lng, lat, lng) : Infinity;
  // A joined private hunt's quests: brass location pins, only ever visible to people who joined.
  const questPhotos = useQuestImages(privateList.flatMap((ph) => ph.quests.map((w) => w.image)));
  // Quest pins show only while the hunt is still on for you: gone once it closes, you finish, or your time runs out.
  const questPins = useMemo<LivePin[]>(() => privateList.filter(huntStillOn).flatMap((ph) => inOrder(ph).map<LivePin>((w) => ({
    id: `quest-${ph.id}-${w.id}`, lat: w.location_lat, lng: w.location_lng, kind: "quest", vessel: "",
    quest: w.quest_type, done: !!w.done_at, locked: questLocked(ph, w), photo: questImageUri(w.image),
    near: metersTo(w.location_lat, w.location_lng) <= GAME_ACTION_RADIUS_M,
    tag: w.done_at ? undefined : h.pointsShort(w.points),
  }))), [privateList, you?.lat, you?.lng, h, questPhotos]);

  return questPins;
}
