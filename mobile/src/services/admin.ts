// The admin (docs/design/admin.md). Every call goes to a server function that checks the caller's role and
// logs writes; this file only shapes the answers. The sample is available for local design work.
import { supabase } from "./supabase";
import { sample } from "./adminSample";

/** Set to false locally to work on the screens with sample data. */
export const ADMIN_BACKEND = true;
/** Development builds without the backend read the sample, so the screens can be built and checked. */
export const ADMIN_SAMPLE = !ADMIN_BACKEND && typeof __DEV__ !== "undefined" && __DEV__;

export type AdminRole = "owner" | "admin" | "moderator" | "viewer";
export const ROLES: AdminRole[] = ["owner", "admin", "moderator", "viewer"];

/** What each role may do. The server keeps the same table; this one only decides what to show. */
const CAN: Record<AdminRole, ReadonlySet<string>> = {
  owner: new Set(["members", "queue", "letters", "edit"]),
  admin: new Set(["queue", "letters", "edit"]),
  moderator: new Set(["queue", "letters"]),
  viewer: new Set([]),
};
export type AdminAction = "members" | "queue" | "letters" | "edit";
export const can = (role: AdminRole | null | undefined, action: AdminAction) => !!role && CAN[role].has(action);

export type Spot = { lat: number; lng: number };
export type Rarity = "common" | "uncommon" | "rare";
export type Habitat = "park" | "water" | "square";

/** A place the game runs in: a city inside a country. */
export type Region = {
  id: string;
  country_zh: string; country_en: string;
  name_zh: string; name_en: string;
  timezone: string;
  center: Spot;
  wayposts: { common: number; landmark: number };
  corrupted_spots: number;
  capsule_spots: number;
  /** The vessels that can appear here as Corrupted Capsules. */
  vessels: string[];
  out_now: number;
  city_hunts_live: number;
  private_hunts: number;
  coverage: { covered: boolean; bytes: number | null; built_at: string | null };
};

export type SpawnRule = {
  vessel: string;
  rarity: Rarity | null;
  habitat: Habitat | null;
  /** Local hours, start and end (inclusive), or null for all day. */
  hours: [number, number] | null;
  /** "MM-DD" start and end, or null for all year. */
  dates: [string, string] | null;
  regions: string[];
  /** Why a vessel can never be a Corrupted Capsule. */
  never: "starter" | "earned" | "brand" | null;
};
export type WaveConfig = { wave_minutes: number; spawn_chance: number; weights: Record<Rarity, number>; nearby_max: number };
export type Spawning = {
  config: WaveConfig;
  rules: SpawnRule[];
  stats: Record<string, { out_now: number; caught_today: number; caught_week: number }>;
};

export type MapWaypost = { id: string; name_zh: string; name_en: string; lat: number; lng: number; kind: "common" | "landmark"; game_enabled: boolean; source_ref?: string | null };
export type WaveCapsule = { spot: string; vessel: string; rarity: Rarity; lat: number; lng: number; expires_at: string; caught: boolean };
export type CityMap = {
  region: Region;
  wayposts: MapWaypost[];
  spots: { id: string; lat: number; lng: number; habitat: Habitat | null }[];
  wave: WaveCapsule[];
  keepers: { hunt: string; name_zh: string; name_en: string; lat: number; lng: number; landmark?: string }[];
  private_quests: { id: string; hunt: string; hunt_name: string; lat: number; lng: number; picture?: string }[];
};

export type Person = { id: string; name: string; avatar: Record<string, unknown> | null };
export type QueueKind = "hunt_report" | "public_capsule_report";
export type QueueItem = {
  kind: QueueKind; id: string;
  title: string;
  /** The reported content. Null for roles that may not read it. */
  preview: string | null;
  owner: Person;
  reports: number;
  reasons: string[];
  reporters: Person[];
  hidden: boolean;
  first_at: string;
  status: "open" | "done";
  decision?: "restore" | "remove";
  decided_by?: Person;
  decided_at?: string;
  note?: string | null;
};

export type Member = Person & { email: string; role: AdminRole; added_by: string | null; added_at: string };
export type ActivityRow = {
  id: number; actor: Person; action: string;
  target_type: string; target_id: string; target_label: string;
  before: unknown; after: unknown; note: string | null; at: string;
};

export class AdminError extends Error {
  constructor(public code: string) { super(code); }
}

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase.rpc as any)(name, args);
  if (error) throw new AdminError(error.message || "failed");
  return data as T;
}

/** The signed-in person's role, or null when they aren't a member. */
export async function adminMe(): Promise<{ role: AdminRole } | null> {
  if (ADMIN_SAMPLE) return sample.me();
  if (!ADMIN_BACKEND) return null;
  return rpc("admin_me");
}

export const admin = {
  cities: (): Promise<Region[]> => ADMIN_SAMPLE ? sample.cities() : rpc("admin_cities"),
  cityMap: (region: string): Promise<CityMap> => ADMIN_SAMPLE ? sample.cityMap(region) : rpc("admin_city_map", { p_region: region }),
  spawning: (): Promise<Spawning> => ADMIN_SAMPLE ? sample.spawning() : rpc("admin_spawning"),
  queue: (status: "open" | "done"): Promise<QueueItem[]> => ADMIN_SAMPLE ? sample.queue(status) : rpc("admin_queue", { p_status: status }),
  resolve: (kind: QueueKind, id: string, decision: "restore" | "remove", note: string | null): Promise<void> =>
    ADMIN_SAMPLE ? sample.resolve(kind, id, decision, note) : rpc("admin_queue_resolve", { p_kind: kind, p_id: id, p_decision: decision, p_note: note }),
  members: (): Promise<Member[]> => ADMIN_SAMPLE ? sample.members() : rpc("admin_members_list"),
  addMember: (email: string, role: AdminRole): Promise<void> =>
    ADMIN_SAMPLE ? sample.addMember(email, role) : rpc("admin_member_add", { p_email: email, p_role: role }),
  setRole: (user: string, role: AdminRole): Promise<void> =>
    ADMIN_SAMPLE ? sample.setRole(user, role) : rpc("admin_member_set_role", { p_user: user, p_role: role }),
  removeMember: (user: string): Promise<void> => ADMIN_SAMPLE ? sample.removeMember(user) : rpc("admin_member_remove", { p_user: user }),
  activity: (before?: number): Promise<ActivityRow[]> =>
    ADMIN_SAMPLE ? sample.activity(before) : rpc("admin_activity", { p_limit: 50, p_before: before ?? null }),
};

/** Minutes until a wave ends, never below zero. */
export const minutesLeft = (expiresAt: string, now = Date.now()) => Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 60000));
export const megabytes = (bytes: number | null) => bytes == null ? null : Math.round(bytes / 100000) / 10;
