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
  const body = await res.json() as { features?: Feature[] };
  return (body.features ?? []).map(asPlace).filter(p => p.name);
}

type Feature = { geometry: { coordinates: [number, number] }; properties: Record<string, string | undefined> };
function asPlace(f: Feature): PointPlace {
  const p = f.properties, [lng, lat] = f.geometry.coordinates;
  const detail = [p.street && [p.housenumber, p.street].filter(Boolean).join(' '), p.district, p.city, p.country].filter(Boolean).join(', ');
  return { name: p.name ?? p.street ?? p.district ?? p.city ?? detail, detail, lat, lng };
}

/**
 * What is at a point, so a dropped pin and "where I am" can say a place name instead of coordinates.
 * Returns null when nothing is known there; callers fall back to their own wording.
 */
export async function reversePlace(at: { lat: number; lng: number }, language: 'zh' | 'en' = 'zh'): Promise<PointPlace | null> {
  // "default" is the place's own local name (台北市民廣場), which Chinese readers in our cities want.
  const res = await fetch(`https://photon.komoot.io/reverse?lat=${at.lat}&lon=${at.lng}&lang=${language === 'en' ? 'en' : 'default'}`);
  if (!res.ok) return null;
  const body = await res.json() as { features?: Feature[] };
  const first = body.features?.[0];
  if (!first) return null;
  // Keep the tapped point, not the matched building's centre.
  const place = asPlace(first);
  return place.name ? { ...place, lat: at.lat, lng: at.lng } : null;
}

/** Extra send_capsule arguments for a point place (only once the backend accepts them). */
export const pointPlaceArgs = (point: PointPlace) =>
  ({ p_place_lat: point.lat, p_place_lng: point.lng, p_place_name: point.name });
