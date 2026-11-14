import { supabase } from "./supabase";

// Public capsules use the normal capsule opening path after a server-checked pickup.
export const PUBLIC_CAPSULE_BACKEND = true;
export const PUBLIC_CAPSULE_ENABLED = true;
export const PUBLIC_CAPSULE_RECIPIENT = "public-capsule";
/** Existing portrait asset used by the public-capsule recipient. */
export const PUBLIC_CAPSULE_AVATAR = { set: "illus", id: "sea" } as const;
export const PUBLIC_CAPSULE_MESSAGE_MAX = 280;
export const PUBLIC_CAPSULE_PICKUP_RADIUS_M = 100;
export const PUBLIC_CAPSULE_VISIBLE_RADIUS_M = 5000;
export const DRIFT_CHOICES = [1, 7, 30, 365] as const;
export type DriftDays = (typeof DRIFT_CHOICES)[number];
export const MAP_PMTILES_URL: string | null = process.env.EXPO_PUBLIC_MAP_PMTILES_URL || null;

type Coords = { lat: number; lng: number; accuracy: number };
export type PublicCapsuleSender = { id: string; name: string; avatar: Record<string, unknown> | null; city: string | null };
export type PublicCapsule = {
  id: string; hint: string; vessel: string; lat: number; lng: number;
  spot_zh: string; spot_en: string; sealed_at: string; available_at: string;
  returns: number; sender: PublicCapsuleSender;
};
export type ThrowResult = { id: string; spot_zh: string; spot_en: string; available_at: string };
export type PublicCapsuleErrorCode = "too_far" | "taken" | "no_shore" | "rejected" | "own_bottle" | "unknown";
export class PublicCapsuleError extends Error { constructor(public code: PublicCapsuleErrorCode) { super(code); } }
const CODES: PublicCapsuleErrorCode[] = ["too_far", "taken", "no_shore", "rejected", "own_bottle"];
const fail = (error: { message?: string } | null) => {
  if (error) throw new PublicCapsuleError(CODES.find((c) => error.message?.includes(c)) ?? "unknown");
};
const coords = (at: Coords) => ({ p_lat: at.lat, p_lng: at.lng, p_accuracy: at.accuracy });

export const publicCapsule = {
  async nearby(at: Coords | null): Promise<PublicCapsule[]> {
    if (!at) return [];
    const { data, error } = await supabase.rpc("public_capsule_nearby", coords(at));
    fail(error);
    return (data ?? []).map((row) => ({ ...row, sender: row.sender as unknown as PublicCapsuleSender }));
  },
  async pickUp(id: string, at: Coords | null): Promise<string> {
    if (!at) throw new PublicCapsuleError("too_far");
    const { error } = await supabase.rpc("public_capsule_pick_up", { p_id: id, ...coords(at) });
    fail(error);
    return id;
  },
  async returnPublicCapsule(id: string): Promise<void> {
    const { error } = await supabase.rpc("public_capsule_return", { p_id: id });
    fail(error);
  },
  async dropPublicCapsule(args: { message: string; hint: string; vessel: string; driftDays: DriftDays; at: Coords | null }): Promise<ThrowResult> {
    if (!args.at) throw new PublicCapsuleError("no_shore");
    const { data, error } = await supabase.rpc("public_capsule_drop", {
      p_message: args.message.trim(), p_hint: args.hint.trim(), p_vessel: args.vessel,
      p_drift_days: args.driftDays, ...coords(args.at),
    });
    fail(error);
    if (!data?.[0]) throw new PublicCapsuleError("unknown");
    return data[0];
  },
  async report(id: string, reason: "unkind" | "personal" | "spam" | "other"): Promise<void> {
    const { error } = await supabase.rpc("public_capsule_report", { p_id: id, p_reason: reason });
    fail(error);
  },
};

export const isPublicCapsule = (c: object) => (c as { is_public?: boolean }).is_public === true;
