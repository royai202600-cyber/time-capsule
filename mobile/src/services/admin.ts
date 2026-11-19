// The admin (docs/design/admin.md). Every call goes to a server function that checks the caller's role and
// logs writes; this file only shapes the answers. The sample is available for local design work.
import { supabase } from "./supabase";
import { sample } from "./adminSample";

/** Set to false locally to work on the screens with sample data. */
export const ADMIN_BACKEND = true;
/** Development builds without the backend read the sample, so the screens can be built and checked. */
export const ADMIN_SAMPLE = !ADMIN_BACKEND && typeof __DEV__ !== "undefined" && __DEV__;
/** Phase 2 editing (Wayposts, spots, spawning, undo). Turn on once Codex's edit functions are live. */
export const ADMIN_EDIT_BACKEND = true;
/** Whether the edit controls show: with the live edit functions, or on the development sample. */
export const ADMIN_EDIT = ADMIN_EDIT_BACKEND || ADMIN_SAMPLE;

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
/** The picture players see when they spin a Waypost. */
export type Scene = "park" | "garden" | "waterfront" | "square" | "publicArt";
export const SCENES: Scene[] = ["park", "garden", "waterfront", "square", "publicArt"];

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
  /** The places it is assigned to directly (a country such as taiwan, or a city). Falls back to regions. */
  places?: string[];
  /** Why a vessel can never be a Corrupted Capsule. */
  never: "starter" | "earned" | "brand" | null;
  /** Sends never use up a copy (HL-C2). Always on for starters and earned Landmark vessels. */
  unlimited_copies?: boolean;
};
export type WaveConfig = { wave_minutes: number;
  /** Copies a catch gives (HL-C2). */
  copies_per_catch?: number; spawn_chance: number; weights: Record<Rarity, number>; nearby_max: number;
  /** A wave length chosen but not started yet: it starts at a moment that ends a wave under both lengths. */
  next_length?: { minutes: number; starts_at: string } | null };
/** A place vessels can be assigned to: a country with several cities (Taiwan), or a city. */
export type SpawnPlace = { id: string; parent: string | null; name_zh: string; name_en: string; country_zh: string; country_en: string; has_spots: boolean };
export type Spawning = {
  config: WaveConfig;
  rules: SpawnRule[];
  /** Where vessels can be assigned. Falls back to the cities when missing. */
  places?: SpawnPlace[];
  stats: Record<string, { out_now: number; caught_today: number; caught_week: number }>;
};

export type MapWaypost = { id: string; name_zh: string; name_en: string; lat: number; lng: number; kind: "common" | "landmark"; game_enabled: boolean; source_ref?: string | null;
  scene?: Scene | null; hidden_at?: string | null };
export type MapSpot = { id: string; lat: number; lng: number; habitat: Habitat | null; hidden_at?: string | null };
export type WaveCapsule = { spot: string; vessel: string; rarity: Rarity; lat: number; lng: number; expires_at: string; caught: boolean };
export type CityMap = {
  region: Region;
  wayposts: MapWaypost[];
  spots: MapSpot[];
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

/** What the server says about a spot before a Waypost is added or moved there. */
export type WaypostCheck = {
  inside_coverage: boolean;
  nearest: { id: string; name_zh: string; name_en: string; meters: number } | null;
  live_hunts: { id: string; name_zh: string; name_en: string; wayposts_left: number; wayposts_needed: number }[];
};
/** The closest two Wayposts may be without a note. */
export const WAYPOST_SPACING = 250;
export const WAVE_LENGTHS = [5, 10, 15, 20, 30, 60];

/** One spawning change, as the preview and the write calls take it. Hours are local, end inclusive (as admin_spawning shows them). */
export type SpawnChange =
  | { call: "place_add" | "place_remove"; region: string; vessel: string }
  | { call: "rule"; vessel: string; rarity: Rarity; habitat: Habitat | null; hours: [number, number] | null; dates: [string, string] | null }
  | { call: "wave"; spawn_chance: number; weights: Record<Rarity, number>; nearby_max: number };
/** How many of each vessel would appear over the next day at a place, now and after the change. */
export type SpawnPreview = { regions: { region: string; before: Record<string, number>; after: Record<string, number> }[] };

export class AdminError extends Error {
  constructor(public code: string) { super(code); }
}

export async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
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

function changeArgs(c: SpawnChange) {
  if (c.call === "rule") return { p_vessel: c.vessel, p_rarity: c.rarity, p_habitat: c.habitat, p_start_hour: c.hours?.[0] ?? null,
    // The screens show the last hour included; the server stores the hour it stops at.
    p_end_hour: c.hours ? (c.hours[1] + 1) % 24 : null,
    p_md_start: c.dates?.[0] ?? null, p_md_end: c.dates?.[1] ?? null };
  if (c.call === "wave") return { p_spawn_chance: c.spawn_chance, p_common_weight: c.weights.common, p_uncommon_weight: c.weights.uncommon,
    p_rare_weight: c.weights.rare, p_nearby_target: c.nearby_max };
  return { p_region: c.region, p_vessel: c.vessel };
}
const CHANGE_RPC: Record<SpawnChange["call"], string> = {
  place_add: "admin_spawn_place_add", place_remove: "admin_spawn_place_remove", rule: "admin_spawn_rule_set", wave: "admin_wave_config_set",
};

type WaypostFields = { lat?: number; lng?: number; name_zh?: string; name_en?: string; scene?: Scene };

/** Phase 2 writes. Each one is checked and logged on the server, and refuses with a code the screens explain. */
export const adminEdit = {
  checkWaypost: (region: string, lat: number, lng: number, id?: string): Promise<WaypostCheck> =>
    ADMIN_SAMPLE ? sample.checkWaypost(region, lat, lng, id) : rpc("admin_waypost_check", { p_region: region, p_lat: lat, p_lng: lng, p_id: id ?? null }),
  addWaypost: (region: string, w: Required<WaypostFields>, checked: boolean, note: string | null): Promise<MapWaypost> =>
    ADMIN_SAMPLE ? sample.addWaypost(region, w, checked, note)
      : rpc("admin_waypost_add", { p_region: region, p_lat: w.lat, p_lng: w.lng, p_name_zh: w.name_zh, p_name_en: w.name_en, p_scene: w.scene, p_checked: checked, p_note: note }),
  updateWaypost: (id: string, w: WaypostFields, note: string | null): Promise<MapWaypost> =>
    ADMIN_SAMPLE ? sample.updateWaypost(id, w, note)
      : rpc("admin_waypost_update", { p_id: id, p_lat: w.lat ?? null, p_lng: w.lng ?? null, p_name_zh: w.name_zh ?? null, p_name_en: w.name_en ?? null, p_scene: w.scene ?? null, p_note: note }),
  setWaypostVisible: (id: string, visible: boolean, note: string | null): Promise<MapWaypost> =>
    ADMIN_SAMPLE ? sample.setWaypostVisible(id, visible, note) : rpc("admin_waypost_set_visible", { p_id: id, p_visible: visible, p_note: note }),
  setSpotVisible: (id: string, visible: boolean, note: string | null): Promise<MapSpot> =>
    ADMIN_SAMPLE ? sample.setSpotVisible(id, visible, note) : rpc("admin_spot_set_visible", { p_id: id, p_visible: visible, p_note: note }),
  preview: (change: SpawnChange): Promise<SpawnPreview> =>
    ADMIN_SAMPLE ? sample.preview(change) : rpc("admin_spawn_preview", { p_change: { call: change.call, args: changeArgs(change) } }),
  change: (change: SpawnChange, note: string | null): Promise<void> =>
    ADMIN_SAMPLE ? sample.change(change, note) : rpc(CHANGE_RPC[change.call], { ...changeArgs(change), p_note: note }),
  /** Returns when the new length starts. */
  setWaveLength: (minutes: number, note: string | null): Promise<string> =>
    ADMIN_SAMPLE ? sample.setWaveLength(minutes, note) : rpc("admin_wave_length_set", { p_minutes: minutes, p_note: note }),
  undo: (action: number, note: string | null): Promise<void> =>
    ADMIN_SAMPLE ? sample.undo(action, note) : rpc("admin_undo", { p_action_id: action, p_note: note }),
};

/** Kinds of change Undo can put back. */
export const undoable = (action: string) => /^(waypost|spawn|config|question_pool|todays_hunt|vessel)\./.test(action) || action === "rack.remove";

/** When a new wave length would start: the next moment that ends a wave under both lengths (the server decides; this is for showing it). */
export function nextLengthStart(from: number, to: number, now = Date.now()) {
  const gcdOf = (x: number, y: number): number => y ? gcdOf(y, x % y) : x;
  const step = (from * to / gcdOf(from, to)) * 60000;
  return new Date(Math.floor(now / step) * step + step);
}

/** Meters between two points (for the screens; the server measures its own). */
export function meters(a: Spot, b: Spot) {
  const r = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

/** Minutes until a wave ends, never below zero. */
export const minutesLeft = (expiresAt: string, now = Date.now()) => Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 60000));
export const megabytes = (bytes: number | null) => bytes == null ? null : Math.round(bytes / 100000) / 10;
