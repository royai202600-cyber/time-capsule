import { useMemo } from 'react';
import { characters } from '../../art/manifest';
import { huntStatus, keeperMark, type Hunt } from '../../services/cityHunt';
import { HUNT_QUESTS } from '../../services/cityHuntQuests';
import type { Quest } from '../../services/quests';
import { distanceMeters } from '../../services/data';
import { keeperPortrait } from '../hunt/HuntViews';
import { assetUri, type LivePin } from './live/types';

/** The open City Hunt, if any. The Letter Keeper stands only at its starting point. */
export const openCityHunt = (huntList: Hunt[]) => huntList.find((x) => huntStatus(x) === "open") ?? null;

/** The Keeper's pin. His ✓ follows the run's located quests (`cityQuests`) once those are on. */
export function useCityHuntPins(activeHunt: Hunt | null, cityQuests: Quest[], you: {lat: number; lng: number} | null) {
  const metersTo = (lat: number, lng: number) => you ? distanceMeters(you.lat, you.lng, lat, lng) : Infinity;
  const mark = activeHunt ? keeperMark(activeHunt, HUNT_QUESTS ? cityQuests : null) : null;
  const keeperMeters = activeHunt ? metersTo(activeHunt.keeper.lat, activeHunt.keeper.lng) : Infinity;
  const showKeeper = !!activeHunt && (!!activeHunt.joined_at || keeperMeters <= 1500);
  const questDot = !!activeHunt && (!activeHunt.joined_at || mark === "✓");
  const huntPins = useMemo<LivePin[]>(() => activeHunt && showKeeper ? [{
    id: `keeper-${activeHunt.id}`, lat: activeHunt.keeper.lat, lng: activeHunt.keeper.lng, kind: "keeper", vessel: "",
    portrait: assetUri(keeperPortrait), figure: assetUri(characters.keeper), mark,
  }] : [], [activeHunt, showKeeper, mark]);

  return { keeperMeters, questDot, huntPins };
}
