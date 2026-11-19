// Quest pins played at the pin on Journey: the stops of routes on capsules sent to me (brass) and, after the
// Keeper check-in, the open City Hunt's quests (blue). Both use the shared quest object and quest card.
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Hunt } from "../../services/cityHunt";
import { cityHuntQuests, HUNT_QUESTS } from "../../services/cityHuntQuests";
import type { Tables } from "../../services/database.types";
import { distanceMeters } from "../../services/data";
import { GAME_ACTION_RADIUS_M } from "../../services/game";
import type { Quest } from "../../services/quests";
import { onRouteChange, routes, ROUTES } from "../../services/routes";
import { questPinFace } from "../quests/questArt";
import type { LivePin } from "./live/types";

export type PinQuest = { kind: "route"; capsuleId: string; quest: Quest } | { kind: "city"; hunt: Hunt; quest: Quest };

export function usePinQuests(capsules: Tables<"capsules">[], activeHunt: Hunt | null, you: { lat: number; lng: number } | null) {
  const [routeQuests, setRouteQuests] = useState<Record<string, Quest[]>>({});
  const [cityQuests, setCityQuests] = useState<Quest[]>([]);
  const waiting = capsules.filter((c) => !c.opened_at).map((c) => c.id).join(",");

  const loadRoutes = useCallback(async () => {
    if (!ROUTES) return;
    await routes.load();
    const withRoute = capsules.filter((c) => !c.opened_at && routes.info(c as never));
    const pairs = await Promise.all(withRoute.map(async (c) => [c.id, await routes.progress(c.id).catch(() => [])] as const));
    setRouteQuests(Object.fromEntries(pairs));
  }, [waiting]);
  const loadCity = useCallback(async () => {
    if (!HUNT_QUESTS || !activeHunt) { setCityQuests([]); return; }
    setCityQuests(await cityHuntQuests.list(activeHunt).catch(() => []));
  }, [activeHunt?.id, activeHunt?.checked_in_at, activeHunt?.finished_at]);
  useEffect(() => { void loadRoutes(); }, [loadRoutes]);
  useEffect(() => { void loadCity(); }, [loadCity]);
  useEffect(() => onRouteChange(() => void loadRoutes()), [loadRoutes]);
  const refresh = useCallback(() => { void loadRoutes(); void loadCity(); }, [loadRoutes, loadCity]);

  const near = (q: Quest) => !!you && distanceMeters(you.lat, you.lng, q.location_lat, q.location_lng) <= GAME_ACTION_RADIUS_M;
  const pinQuestPins = useMemo<LivePin[]>(() => [
    ...Object.entries(routeQuests).flatMap(([capsuleId, qs]) => qs.map<LivePin>((q) => ({
      id: `route-${capsuleId}-${q.quest_id}`, lat: q.location_lat, lng: q.location_lng, kind: "quest", vessel: "",
      quest: q.type, done: q.done, locked: q.locked, near: near(q), tag: q.done ? undefined : String(q.ordinal),
      ...questPinFace(q.type, "brass", q.done, null),
    }))),
    ...cityQuests.map<LivePin>((q) => ({
      id: `cityq-${q.quest_id}`, lat: q.location_lat, lng: q.location_lng, kind: "quest", vessel: "", blue: true,
      quest: q.type, done: q.done, locked: q.locked, near: near(q), tag: q.done ? undefined : String(q.ordinal),
      ...questPinFace(q.type, "blue", q.done, null),
    })),
  ], [routeQuests, cityQuests, you?.lat, you?.lng]);

  const findPinQuest = (id: string): PinQuest | null => {
    if (id.startsWith("cityq-") && activeHunt) {
      const quest = cityQuests.find((q) => `cityq-${q.quest_id}` === id);
      return quest ? { kind: "city", hunt: activeHunt, quest } : null;
    }
    for (const [capsuleId, qs] of Object.entries(routeQuests)) {
      const quest = qs.find((q) => `route-${capsuleId}-${q.quest_id}` === id);
      if (quest) return { kind: "route", capsuleId, quest };
    }
    return null;
  };
  /** The next stop of a capsule's route, to send the map there from the capsule pages. */
  const nextStop = (capsuleId: string) => routeQuests[capsuleId]?.find((q) => !q.done) ?? null;

  return { pinQuestPins, findPinQuest, nextStop, refresh, routeQuests, cityQuests };
}
