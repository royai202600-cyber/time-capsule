import { useMemo } from 'react';
import { characters } from '../../art/manifest';
import { huntStatus, keeperMark, type Hunt } from '../../services/cityHunt';
import { distanceMeters } from '../../services/data';
import { keeperPortrait } from '../hunt/HuntViews';
import { assetUri, type LivePin } from './live/types';

export function useCityHuntPins(huntList: Hunt[], you: {lat: number; lng: number} | null) {
  const metersTo = (lat: number, lng: number) => you ? distanceMeters(you.lat, you.lng, lat, lng) : Infinity;
  // The open City Hunt, if any. The Letter Keeper stands only at its starting point.
  const activeHunt = huntList.find((x) => huntStatus(x) === "open") ?? null;
  const keeperMeters = activeHunt ? metersTo(activeHunt.keeper.lat, activeHunt.keeper.lng) : Infinity;
  const showKeeper = !!activeHunt && (!!activeHunt.joined_at || keeperMeters <= 1500);
  const questDot = !!activeHunt && (!activeHunt.joined_at || keeperMark(activeHunt) === "✓");
  const huntPins = useMemo<LivePin[]>(() => activeHunt && showKeeper ? [{
    id: `keeper-${activeHunt.id}`, lat: activeHunt.keeper.lat, lng: activeHunt.keeper.lng, kind: "keeper", vessel: "",
    portrait: assetUri(keeperPortrait), figure: assetUri(characters.keeper), mark: keeperMark(activeHunt),
  }] : [], [activeHunt, showKeeper]);

  return { activeHunt, keeperMeters, questDot, huntPins };
}
