// Opening places beyond our landmark list: the sender's current spot or any searched address.
export const ANY_PLACE_BACKEND = true;

export type PointPlace = { name: string; detail: string; lat: number; lng: number };

/** OpenStreetMap search through the public Photon service. Phase 2 moves this behind our own Edge Function. */
export async function searchPlaces(query: string, near?: { lat: number; lng: number } | null): Promise<PointPlace[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const bias = near ? `&lat=${near.lat}&lon=${near.lng}` : '';
  const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6${bias}`);
  if (!res.ok) throw new Error(`place search ${res.status}`);
  const body = await res.json() as { features?: { geometry: { coordinates: [number, number] }; properties: Record<string, string | undefined> }[] };
  return (body.features ?? []).map(f => {
    const p = f.properties, [lng, lat] = f.geometry.coordinates;
    const detail = [p.street && [p.housenumber, p.street].filter(Boolean).join(' '), p.district, p.city, p.country].filter(Boolean).join(', ');
    return { name: p.name ?? p.street ?? detail, detail, lat, lng };
  }).filter(p => p.name);
}

/** Extra send_capsule arguments for a point place (only once the backend accepts them). */
export const pointPlaceArgs = (point: PointPlace) =>
  ({ p_place_lat: point.lat, p_place_lng: point.lng, p_place_name: point.name });
