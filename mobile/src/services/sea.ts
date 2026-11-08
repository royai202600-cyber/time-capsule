import { supabase } from "./supabase";

// Public Sea bottles use the normal capsule opening path after a server-checked pickup.
export const SEA_BACKEND = true;
export const SEA_ENABLED = true;
export const SEA_RECIPIENT = "sea";
/** Avatar value for "the sea" as a recipient (portrait-sea). */
export const SEA_AVATAR = { set: "illus", id: "sea" } as const;
export const SEA_MESSAGE_MAX = 280;
export const SEA_PICKUP_RADIUS_M = 100;
export const SEA_VISIBLE_RADIUS_M = 5000;
export const DRIFT_CHOICES = [1, 7, 30, 365] as const;
export type DriftDays = (typeof DRIFT_CHOICES)[number];
export const MAP_PMTILES_URL: string | null = process.env.EXPO_PUBLIC_MAP_PMTILES_URL || null;

type Coords = { lat: number; lng: number; accuracy: number };
export type SeaSender = { id: string; name: string; avatar: Record<string, unknown> | null; city: string | null };
export type SeaBottle = {
  id: string; hint: string; vessel: string; lat: number; lng: number;
  shore_zh: string; shore_en: string; sealed_at: string; washed_up_at: string;
  returns: number; sender: SeaSender;
};
export type ThrowResult = { id: string; shore_zh: string; shore_en: string; washes_up_at: string };
export type SeaErrorCode = "too_far" | "taken" | "no_shore" | "rejected" | "own_bottle" | "unknown";
export class SeaError extends Error { constructor(public code: SeaErrorCode) { super(code); } }
const CODES: SeaErrorCode[] = ["too_far", "taken", "no_shore", "rejected", "own_bottle"];
const fail = (error: { message?: string } | null) => {
  if (error) throw new SeaError(CODES.find((c) => error.message?.includes(c)) ?? "unknown");
};
const coords = (at: Coords) => ({ p_lat: at.lat, p_lng: at.lng, p_accuracy: at.accuracy });

export const sea = {
  async nearby(at: Coords | null): Promise<SeaBottle[]> {
    if (!at) return [];
    const { data, error } = await supabase.rpc("sea_nearby", coords(at));
    fail(error);
    return (data ?? []).map((row) => ({ ...row, sender: row.sender as unknown as SeaSender }));
  },
  async pickUp(id: string, at: Coords | null): Promise<string> {
    if (!at) throw new SeaError("too_far");
    const { error } = await supabase.rpc("sea_pick_up", { p_id: id, ...coords(at) });
    fail(error);
    return id;
  },
  async returnToSea(id: string): Promise<void> {
    const { error } = await supabase.rpc("sea_return", { p_id: id });
    fail(error);
  },
  async throwBottle(args: { message: string; hint: string; vessel: string; driftDays: DriftDays; at: Coords | null }): Promise<ThrowResult> {
    if (!args.at) throw new SeaError("no_shore");
    const { data, error } = await supabase.rpc("sea_throw", {
      p_message: args.message.trim(), p_hint: args.hint.trim(), p_vessel: args.vessel,
      p_drift_days: args.driftDays, ...coords(args.at),
    });
    fail(error);
    if (!data?.[0]) throw new SeaError("unknown");
    return data[0];
  },
  async report(id: string, reason: "unkind" | "personal" | "spam" | "other"): Promise<void> {
    const { error } = await supabase.rpc("sea_report", { p_id: id, p_reason: reason });
    fail(error);
  },
};

export const isSeaCapsule = (c: object) => (c as { sea?: boolean }).sea === true;
