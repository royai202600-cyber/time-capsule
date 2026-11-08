import { supabase } from "./supabase";
import { distanceMeters } from "./data";

// Public Sea (公開的海). A sea bottle is an ordinary capsule (same Create flow, same capsule
// pages, typed letters only) whose recipient is "the sea". It is placed at the public shore
// nearest the sender, never their exact spot, and washes up after the drift time they chose
// (open_at). The first stranger who walks within 100 m picks it up: they become its recipient
// and open it on the normal capsule pages. They keep it (it stays in their Inbox) or return it,
// and it drifts to another shore for someone else.
// SEA_BACKEND=false: an in-memory sea around you for UI work (development builds only).
export const SEA_BACKEND = false;
export const SEA_ENABLED = SEA_BACKEND || __DEV__;
export const SEA_RECIPIENT = "sea";
export const SEA_MESSAGE_MAX = 280;
export const SEA_PICKUP_RADIUS_M = 100;
export const SEA_VISIBLE_RADIUS_M = 5000;
export const SEA_DAILY_PICKUPS = 3;
export const DRIFT_CHOICES = [1, 7, 30, 365] as const;
export type DriftDays = (typeof DRIFT_CHOICES)[number];
/** Set by Codex once the Cloudflare R2 bucket exists; until then the map uses tinted OSM raster tiles in development. */
export const MAP_PMTILES_URL: string | null = process.env.EXPO_PUBLIC_MAP_PMTILES_URL || null;

type Coords = { lat: number; lng: number; accuracy: number };
export type SeaSender = { id: string; name: string; avatar: Record<string, unknown> | null; city: string | null };
/** A bottle ashore: what anyone nearby may see before picking it up (never the letter). */
export type SeaBottle = {
  id: string; hint: string; vessel: string; lat: number; lng: number;
  shore_zh: string; shore_en: string; sealed_at: string; washed_up_at: string; returns: number;
  sender: SeaSender;
};
export type ThrowResult = { id: string; shore_zh: string; shore_en: string; washes_up_at: string };
export type SeaErrorCode = "too_far" | "taken" | "daily_limit" | "no_shore" | "rejected" | "own_bottle" | "unknown";
export class SeaError extends Error { constructor(public code: SeaErrorCode) { super(code); } }
const CODES: SeaErrorCode[] = ["too_far", "taken", "daily_limit", "no_shore", "rejected", "own_bottle"];
const fail = (error: { message?: string } | null) => {
  if (error) throw new SeaError(CODES.find((c) => error.message?.includes(c)) ?? "unknown");
};
const coords = (at: Coords | null) => ({ p_lat: at?.lat, p_lng: at?.lng, p_accuracy: at?.accuracy });
// The RPCs are added by Codex's backend task; cast until database.types.ts is regenerated.
const rpc = (name: string, args?: object) => (supabase.rpc as unknown as (n: string, a?: object) => PromiseLike<{ data: unknown; error: { message: string } | null }>)(name, args);

export const sea = {
  /** Bottles ashore within 5 km, excluding your own and ones you returned or reported. */
  async nearby(at: Coords | null): Promise<SeaBottle[]> {
    if (!SEA_BACKEND) return mock.nearby(at);
    if (!at) return [];
    const { data, error } = await rpc("sea_nearby", coords(at));
    fail(error);
    return (data ?? []) as SeaBottle[];
  },
  /** Server-checked (within 100 m, still ashore, not yours, daily limit). You become its recipient;
   *  it then opens on the normal capsule pages. Returns the capsule id, or null in the dev sea. */
  async pickUp(id: string, at: Coords | null): Promise<string | null> {
    if (!SEA_BACKEND) return mock.pickUp(id, at);
    const { error } = await rpc("sea_pick_up", { p_id: id, ...coords(at) });
    fail(error);
    return id;
  },
  /** Only the opened finder: it drifts to another shore and washes up again tomorrow. */
  async returnToSea(id: string): Promise<void> {
    if (!SEA_BACKEND) return;
    const { error } = await rpc("sea_return", { p_id: id });
    fail(error);
  },
  /** Called from Create when the recipient is the sea. Typed letters only. */
  async throwBottle(args: { message: string; hint: string; vessel: string; driftDays: DriftDays; at: Coords | null }): Promise<ThrowResult> {
    if (!SEA_BACKEND) return mock.throwBottle(args);
    const { data, error } = await rpc("sea_throw", {
      p_message: args.message.trim(), p_hint: args.hint.trim(), p_vessel: args.vessel, p_drift_days: args.driftDays, ...coords(args.at),
    });
    fail(error);
    return (Array.isArray(data) ? data[0] : data) as ThrowResult;
  },
  /** Hides it from you at once; enough reports hide it for everyone until reviewed. */
  async report(id: string, reason: "unkind" | "personal" | "spam" | "other"): Promise<void> {
    if (!SEA_BACKEND) { mock.hide(id); return; }
    const { error } = await rpc("sea_report", { p_id: id, p_reason: reason });
    fail(error);
  },
  async pickupsLeft(): Promise<number> {
    if (!SEA_BACKEND) return SEA_DAILY_PICKUPS - mockPickups;
    const { data, error } = await rpc("sea_pickups_left");
    fail(error);
    return Number(data ?? 0);
  },
};

/** A sea capsule as the Home/Capsule screens see it (columns added by the backend task). */
export const isSeaCapsule = (c: object) => (c as { sea?: boolean }).sea === true;

// ---------- Development sea: bottles placed around wherever you are ----------
const SHORES: [string, string, number, number][] = [
  ["榕樹下的長椅", "Bench under the banyan", 35, 50],
  ["小廣場噴水池", "Little square fountain", -60, -40],
  ["老碼頭石階", "Old pier steps", 260, -180],
  ["海旁步道", "Waterfront promenade", -420, 330],
  ["公園涼亭", "Park pavilion", 700, 520],
  ["燈塔下", "Below the lighthouse", -1200, -900],
];
const NOTES: [string, string, string, string, number, number][] = [
  ["給今天累了的人", "bottle", "Mei", "台北", 12, 0],
  ["一個小小的坦白", "envelope", "Kit", "澳門", 40, 1],
  ["在這張長椅上收到好消息", "bottle", "Ada", "香港", 3, 0],
  ["給陌生人", "tin", "Jun", "首爾", 90, 2],
  ["那年夏天", "bottle", "Noor", "Singapore", 365, 0],
  ["慢一點也沒關係", "lantern", "Hana", "京都", 30, 3],
];
let mockRows: (SeaBottle & { hidden?: boolean })[] | null = null;
let mockPickups = 0;
const wait = (ms = 350) => new Promise((r) => setTimeout(r, ms));
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
function seed(center: { lat: number; lng: number }) {
  if (mockRows) return mockRows;
  mockRows = NOTES.map(([hint, vessel, name, city, days, returns], i) => {
    const [zh, en, east, north] = SHORES[i];
    return {
      id: `dev-sea-${i}`, hint, vessel, shore_zh: zh, shore_en: en, returns,
      lat: center.lat + north / 111_000, lng: center.lng + east / (111_000 * Math.cos(center.lat * Math.PI / 180)),
      sealed_at: daysAgo(days + 1), washed_up_at: daysAgo(Math.min(days, 2) / 2),
      sender: { id: `dev-${name}`, name, city, avatar: { set: "illus", id: String(i + 2).padStart(2, "0") } },
    };
  });
  return mockRows;
}
const mock = {
  async nearby(at: Coords | null) {
    await wait(200);
    const center = at ?? { lat: 22.19358, lng: 113.53917 };
    return seed(center).filter((b) => !b.hidden && distanceMeters(center.lat, center.lng, b.lat, b.lng) <= SEA_VISIBLE_RADIUS_M);
  },
  async pickUp(id: string, at: Coords | null) {
    await wait();
    const row = mockRows?.find((b) => b.id === id);
    if (!row || row.hidden) throw new SeaError("taken");
    if (at && distanceMeters(at.lat, at.lng, row.lat, row.lng) > SEA_PICKUP_RADIUS_M) throw new SeaError("too_far");
    if (mockPickups >= SEA_DAILY_PICKUPS) throw new SeaError("daily_limit");
    mockPickups++; row.hidden = true;
    return null;
  },
  async throwBottle({ message, driftDays }: { message: string; driftDays: DriftDays }) {
    await wait(900);
    if (/(\d[\s-]?){8,}|@\w+\.\w+/.test(message)) throw new SeaError("rejected"); // stand-in for the server safety check
    return { id: `dev-thrown-${Date.now()}`, shore_zh: SHORES[1][0], shore_en: SHORES[1][1], washes_up_at: new Date(Date.now() + driftDays * 86_400_000).toISOString() };
  },
  hide(id: string) { const row = mockRows?.find((b) => b.id === id); if (row) row.hidden = true; },
};
