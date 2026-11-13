import { supabase } from "../../services/supabase";
import { capsules, distanceMeters } from "../../services/data";
import type { Database } from "../../services/database.types";

export type Row = Database["public"]["Tables"]["capsules"]["Row"];
export type Person = Pick<Database["public"]["Tables"]["profiles"]["Row"], "id" | "name" | "avatar">;
export type Place = Database["public"]["Tables"]["places"]["Row"];
export type VesselInfo = Database["public"]["Tables"]["vessels"]["Row"];
export type Opened = Database["public"]["Functions"]["open_capsule"]["Returns"][number];
export type Fix = { lat: number; lng: number; accuracy: number };
export type Bundle = {
  capsules: Row[];
  people: Record<string, Person>;
  places: Record<string, Place>;
  vessels: Record<string, VesselInfo>;
};

const keyed = <T extends { id: string }>(rows: T[] | null) =>
  Object.fromEntries((rows ?? []).map((r) => [r.id, r])) as Record<string, T>;

export async function loadBundle(userId: string): Promise<Bundle> {
  const [all, placeResult, vesselResult] = await Promise.all([
    supabase.from("capsules").select("*").or(`sender.eq.${userId},recipient.eq.${userId}`).order("sealed_at", { ascending: false }),
    supabase.from("places").select("*"),
    supabase.from("vessels").select("*"),
  ]);
  if (all.error) throw all.error;
  if (placeResult.error) throw placeResult.error;
  if (vesselResult.error) throw vesselResult.error;
  const rows = all.data ?? [];
  const ids = [...new Set(rows.flatMap((c) => [c.sender, c.recipient]).filter((id): id is string => id !== null))];
  const peopleResult = ids.length
    ? await supabase.from("profiles").select("id,name,avatar").in("id", ids)
    : { data: [], error: null };
  if (peopleResult.error) throw peopleResult.error;
  return {
    capsules: rows,
    people: keyed(peopleResult.data as Person[]),
    places: keyed(placeResult.data),
    vessels: keyed(vesselResult.data),
  };
}

export async function loadOne(id: string, userId: string): Promise<Bundle> {
  const bundle = await loadBundle(userId);
  bundle.capsules = bundle.capsules.filter((c) => c.id === id);
  return bundle;
}

export const formatDate = (iso: string | null, lang: "zh" | "en", time = false) =>
  iso ? new Intl.DateTimeFormat(lang === "zh" ? "zh-Hant" : "en", {
    year: "numeric", month: "numeric", day: "numeric",
    ...(time ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(new Date(iso)) : "";

export function pointOpeningPlace(c: Row): Place | undefined {
  if (c.place_lat == null || c.place_lng == null || c.place_name == null) return;
  return {
    id: c.id, lat: c.place_lat, lng: c.place_lng, radius_m: 100,
    name_zh: c.place_name, name_en: c.place_name,
    city_zh: "", city_en: "", why_zh: "", why_en: "", sort: 0, brand_vessel: null,
  };
}

export function status(c: Row, side: "inbox" | "sent", fix: Fix | null, place?: Place, now = Date.now()) {
  if (c.opened_at) return "opened" as const;
  if (new Date(c.open_at).getTime() > now) return "time" as const;
  if (side === "sent") return "waiting" as const;
  if (place && (!fix || fix.accuracy > 200 || distanceMeters(fix.lat, fix.lng, place.lat, place.lng) > place.radius_m)) return "place" as const;
  if ((c.place || c.place_lat != null) && !place) return "place" as const;
  return "ready" as const;
}

export function distance(c: Row, fix: Fix | null, place?: Place) {
  return (c.place || c.place_lat != null) && fix && place ? distanceMeters(fix.lat, fix.lng, place.lat, place.lng) : null;
}

export async function openForRecipient(id: string, fix: Fix | null) {
  return capsules.open(id, fix?.lat, fix?.lng, fix?.accuracy);
}
