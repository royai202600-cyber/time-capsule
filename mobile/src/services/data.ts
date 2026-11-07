import { supabase } from "./supabase";
import type { Database, Json } from "./database.types";
export type Profile = {
  id: string;
  name: string;
  city: string | null;
  avatar: Record<string, Json | undefined>;
};
export type Capsule = {
  id: string;
  sender: string;
  recipient: string;
  open_at: string;
  opened_at: string | null;
  place: string | null;
  vessel: string;
  edition_no: number | null;
};
export const profiles = {
  get: (id: string) =>
    supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
  save: (profile: Profile) => supabase.from("profiles").upsert(profile),
};
export const friendships = {
  list: (id: string) =>
    supabase
      .from("friendships")
      .select("*, profiles!friendships_friend_id_fkey(*)")
      .eq("user_id", id),
};
export const invites = {
  info: (code: string) => supabase.rpc("invite_info", { p_code: code }),
  accept: (code: string) => supabase.rpc("accept_invite", { p_code: code }),
  create: (id: string) =>
    supabase.from("invites").insert({ inviter: id }).select().single(),
};
export const capsules = {
  inbox: (id: string) =>
    supabase.from("capsules").select("*").eq("recipient", id),
  sent: (id: string) => supabase.from("capsules").select("*").eq("sender", id),
  markSeen: (id: string) => supabase.rpc("mark_seen", { p_id: id }),
  open: (id: string, lat?: number, lng?: number, accuracy?: number) =>
    supabase.rpc("open_capsule", {
      p_id: id,
      p_lat: lat,
      p_lng: lng,
      p_accuracy: accuracy,
    }),
  // p_voice / p_voice_ms: a voice note already uploaded to the sender's folder (services/voice.ts).
  send: (args: Database["public"]["Functions"]["send_capsule"]["Args"]) =>
    supabase.rpc("send_capsule", args),
};
export const places = {
  list: () => supabase.from("places").select("*").order("sort"),
};
export const vessels = {
  list: () => supabase.from("vessels").select("*").order("sort"),
  owned: (id: string) =>
    supabase.from("owned_vessels").select("*").eq("user_id", id),
  stock: () => supabase.rpc("vessel_stock"),
  acquire: (id: string) => supabase.rpc("acquire_vessel", { p_vessel: id }),
  /** The landmark vessel earned by opening a capsule at this place, and whether the user already owns it. */
  earnedAt: async (place: string, userId: string) => {
    const { data, error } = await supabase.from("vessels").select("id").eq("earned_place", place).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const { data: own, error: ownershipError } = await supabase.from("owned_vessels").select("vessel").eq("user_id", userId).eq("vessel", data.id).maybeSingle();
    if (ownershipError) throw ownershipError;
    return { id: data.id, owned: !!own };
  },
};
export function capsuleStatus(
  c: Capsule,
  side: "in" | "out",
  distance?: number,
) {
  if (c.opened_at) return "opened";
  if (new Date(c.open_at).getTime() > Date.now()) return "time";
  if (side === "out") return "waiting";
  if (c.place && (distance === undefined || distance > 100)) return "place";
  return "ready";
}
export function distanceMeters(a: number, b: number, c: number, d: number) {
  const rad = Math.PI / 180,
    dl = (c - a) * rad,
    dg = (d - b) * rad;
  return (
    2 *
    6371000 *
    Math.asin(
      Math.sqrt(
        Math.sin(dl / 2) ** 2 +
          Math.cos(a * rad) * Math.cos(c * rad) * Math.sin(dg / 2) ** 2,
      ),
    )
  );
}
export const editionLabel = (brand: string, n: number) =>
  `${brand} No.${String(n).padStart(3, "0")}`;
