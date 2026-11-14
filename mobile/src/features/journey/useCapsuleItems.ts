import { useMemo } from 'react';
import { distanceMeters } from '../../services/data';
import type { Tables } from '../../services/database.types';
import type { PublicCapsule } from '../../services/publicCapsule';
import { pointOpeningPlace } from '../capsule/model';
import type { Item, JourneyPin } from './journeyModel';

/** Received capsule locations and public capsules, ordered by distance, plus Passport visits. */
export function useCapsuleItems(places: Tables<'places'>[], capsules: Tables<'capsules'>[], publicCapsules: PublicCapsule[], you: {lat: number; lng: number} | null, passportStamps: Record<string, string>) {
  const pins = useMemo<JourneyPin[]>(() => places.map((place) => {
    const here = capsules.filter((capsule) => capsule.place === place.id);
    const visited = here.some((capsule) => !!capsule.opened_at);
    const waiting = here.find((capsule) => !capsule.opened_at);
    return { place, kind: visited ? "visited" : waiting ? "waiting" : "other", vessel: waiting?.vessel, waiting: !!waiting };
  }), [places, capsules]);
  const stampRows = useMemo(() => places.map((place) => {
    const openedAt = capsules.filter((capsule) => capsule.place === place.id && capsule.opened_at).map((capsule) => capsule.opened_at!).sort().at(-1) ?? passportStamps[place.id] ?? null;
    return { place, openedAt };
  }), [places, capsules, passportStamps]);

  // Nearby Public capsules and every received place capsule, including distant/opened ones.
  const items = useMemo<Item[]>(() => {
    if (!you) return [];
    const m = (lat: number, lng: number) => distanceMeters(you.lat, you.lng, lat, lng);
    const publicCapsuleItems: Item[] = publicCapsules.map((b) => ({ kind: "publicCapsule", id: b.id, lat: b.lat, lng: b.lng, meters: m(b.lat, b.lng), publicCapsule: b }));
    const placeItems: Item[] = capsules.flatMap((capsule) => {
      const point = pointOpeningPlace(capsule);
      const pin: JourneyPin | undefined = point
        ? { place: point, kind: capsule.opened_at ? "visited" : "waiting" }
        : pins.find((p) => p.place.id === capsule.place);
      return pin ? [{ kind: "place" as const, id: `place-${capsule.id}`, lat: pin.place.lat, lng: pin.place.lng,
        meters: m(pin.place.lat, pin.place.lng), pin: { ...pin, vessel: capsule.vessel }, capsuleId: capsule.id }] : [];
    });
    return [...publicCapsuleItems, ...placeItems].sort((a, b) => a.meters - b.meters);
  }, [publicCapsules, pins, capsules, you?.lat, you?.lng]);

  return { items, stampRows };
}
