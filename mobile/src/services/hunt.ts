// City Hunt (docs/design/city-hunt.md). Signed-in players use the server functions in the backend
// contract. Until those are live, development and the test account get a preview that counts
// progress on this device only and grants no reward.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import { distanceMeters } from "./data";
import { GAME_ACTION_RADIUS_M, onGameEvent, type Coords, type Waypost } from "./game";

export type HuntStepKey = "checkin" | "spin" | "restore" | "landmark" | "return";
export type HuntStep = { key: HuntStepKey; goal: number; count: number };
export type Hunt = {
  id: string; name_zh: string; name_en: string; city_zh: string; city_en: string;
  starts_at: string; ends_at: string;
  keeper: { lat: number; lng: number };
  area: { lat: number; lng: number; radius_m: number };
  landmark: string;
  reward: { xp: number; gold: number };
  steps: HuntStep[];
  joined_at: string | null; checked_in_at: string | null; finished_at: string | null;
  /** Counted on this device only, before the backend is live. */
  preview?: boolean;
};
export type HuntFinish = { hunt: Hunt; xp_gained: number; gold_gained: number };

/** Where each hunt's Letter Keeper stands, for his lines. Falls back to "the starting point". */
export const KEEPER_SPOT: Record<string, { zh: string; en: string }> = {
  "xinyi-2026-11": { zh: "市府廣場", en: "Civic Square" },
};

export const huntStatus = (h: Hunt, now = Date.now()) =>
  now < new Date(h.starts_at).getTime() ? "upcoming" : now > new Date(h.ends_at).getTime() ? "closed" : "open";
const step = (h: Hunt, key: HuntStepKey) => h.steps.find((s) => s.key === key);
/** Steps between check-in and the return are all done: time to go back to the Keeper. */
export const readyToReturn = (h: Hunt) => !!h.checked_in_at && !h.finished_at
  && h.steps.filter((s) => s.key !== "checkin" && s.key !== "return").every((s) => s.count >= s.goal);
/** The seal over the Keeper's head: ! (a quest for you), ✓ (come back) or nothing. */
export const keeperMark = (h: Hunt): "!" | "✓" | null =>
  h.finished_at ? null : readyToReturn(h) ? "✓" : !h.checked_in_at ? "!" : null;

// ---------- live ----------
// Call through the client (never a detached supabase.rpc, which loses its `this`).
type RpcResult = { data: unknown; error: { message?: string; code?: string } | null };
const rpc = (fn: string, args?: Record<string, unknown>): Promise<RpcResult> =>
  (supabase as unknown as { rpc: (f: string, a?: Record<string, unknown>) => Promise<RpcResult> }).rpc(fn, args);
const missing = (e: { message?: string; code?: string } | null) => !!e && (e.code === "PGRST202" || /could not find the function|does not exist/i.test(e.message ?? ""));
const CODES = ["too_far", "closed", "not_joined", "not_checked_in", "incomplete", "already_finished", "too_fast"] as const;
export type HuntErrorCode = typeof CODES[number] | "unknown";
export class HuntError extends Error { constructor(public code: HuntErrorCode) { super(code); } }
// The server's messages ("join first", "check in first", "already finished") mapped to our codes.
const ALIASES: [string, HuntErrorCode][] = [["join first", "not_joined"], ["check in first", "not_checked_in"], ["already finished", "already_finished"]];
const fail = (e: { message?: string } | null) => {
  if (!e) return;
  const m = e.message ?? "";
  throw new HuntError(ALIASES.find(([text]) => m.includes(text))?.[1] ?? CODES.find((c) => m.includes(c)) ?? "unknown");
};
const signedIn = async () => !!(await supabase.auth.getSession()).data.session;

// ---------- preview (device-only) ----------
const XINYI = {
  id: "xinyi-2026-11", name_zh: "信義城市尋寶", name_en: "Xinyi City Hunt", city_zh: "台北", city_en: "Taipei",
  starts_at: "2026-11-10T00:00:00+08:00", ends_at: "2026-11-30T23:59:59+08:00",
  keeper: { lat: 25.037546, lng: 121.562754 }, area: { lat: 25.033263, lng: 121.564887, radius_m: 1200 },
  landmark: "Taipei 101", reward: { xp: 300, gold: 5 },
};
type Progress = { joined_at: string | null; checked_in_at: string | null; finished_at: string | null; spun: string[]; restored: number; won: number };
const empty = (): Progress => ({ joined_at: null, checked_in_at: null, finished_at: null, spun: [], restored: 0, won: 0 });
let previewUser = "";
let previewHunt: Hunt | null = null;
let progress: Progress = empty();
const changed = new Set<() => void>();
export const onHuntChange = (l: () => void) => { changed.add(l); return () => { changed.delete(l); }; };
const key = () => `tc-hunt-preview-${previewUser}-${previewHunt?.id}`;
const save = () => { void AsyncStorage.setItem(key(), JSON.stringify(progress)).catch(() => {}); changed.forEach((l) => l()); };
const offset = (at: Coords, north: number, east: number) => ({ lat: at.lat + north / 110540, lng: at.lng + east / (111320 * Math.cos(at.lat * Math.PI / 180)) });

function buildPreview(at: Coords, known: Waypost[], live: boolean): Hunt | null {
  const name = (w: Waypost) => w.name_en;
  if (live) {
    // The real Xinyi hunt, matched to the live Wayposts by name.
    const landmark = known.find((w) => w.kind === "landmark" && name(w) === XINYI.landmark)?.id ?? previewHunt?.landmark ?? "";
    return asPreview({ ...XINYI, landmark });
  }
  // Signed out in development: a small hunt around wherever you are, using the stand-in Wayposts.
  if (previewHunt && previewHunt.id === "dev-hunt") return previewHunt;
  return asPreview({
    ...XINYI, id: "dev-hunt", name_zh: "測試尋寶", name_en: "Test Hunt", city_zh: "這附近", city_en: "Nearby",
    starts_at: new Date(Date.now() - 3_600_000).toISOString(), ends_at: new Date(Date.now() + 3 * 3_600_000).toISOString(),
    keeper: offset(at, 40, -30), area: { ...at, radius_m: 1200 },
    landmark: known.find((w) => w.kind === "landmark")?.id ?? ""
  });
}
type Base = Omit<Hunt, "steps" | "joined_at" | "checked_in_at" | "finished_at" | "preview">;
const asPreview = (h: Base): Hunt => ({ ...h, preview: true, joined_at: null, checked_in_at: null, finished_at: null, steps: [] });
function withProgress(h: Hunt): Hunt {
  const goals = previewGoals(h);
  return {
    ...h, joined_at: progress.joined_at, checked_in_at: progress.checked_in_at, finished_at: progress.finished_at,
    steps: [
      { key: "checkin", goal: 1, count: progress.checked_in_at ? 1 : 0 },
      { key: "spin", goal: goals.spin, count: Math.min(goals.spin, progress.spun.length) },
      { key: "restore", goal: goals.restore, count: Math.min(goals.restore, progress.restored) },
      { key: "landmark", goal: 1, count: Math.min(1, progress.won) },
      { key: "return", goal: 1, count: progress.finished_at ? 1 : 0 },
    ],
  };
}
// The signed-out stand-in has only two common Wayposts.
const previewGoals = (h: Hunt) => h.id === "dev-hunt" ? { spin: 2, restore: 3 } : { spin: 3, restore: 5 };
const counting = () => !!previewHunt && !!progress.checked_in_at && !progress.finished_at && huntStatus(previewHunt) === "open";
onGameEvent((e) => {
  const h = previewHunt;
  if (!h || !counting()) return;
  // Any Waypost inside the hunt area counts, each one once.
  if (e.kind === "spin" && distanceMeters(h.area.lat, h.area.lng, e.lat, e.lng) <= h.area.radius_m && !progress.spun.includes(e.waypost)) { progress.spun.push(e.waypost); save(); }
  if (e.kind === "restore" && distanceMeters(h.area.lat, h.area.lng, e.lat, e.lng) <= h.area.radius_m) { progress.restored += 1; save(); }
  if (e.kind === "landmark" && e.waypost === h.landmark) { progress.won += 1; save(); }
});
// Live hunts: the server counts. Tell the screen to refresh after any counted action.
onGameEvent(() => { if (!previewHunt) changed.forEach((l) => l()); });

async function loadPreview(userId: string, at: Coords, known: Waypost[], live: boolean): Promise<Hunt[]> {
  const next = buildPreview(at, known, live);
  if (!next) return [];
  if (previewUser !== userId || previewHunt?.id !== next.id) {
    previewUser = userId; previewHunt = next;
    progress = empty();
    try { const raw = await AsyncStorage.getItem(key()); if (raw) progress = { ...empty(), ...JSON.parse(raw) }; } catch { /* start fresh */ }
  } else previewHunt = next;
  return [withProgress(previewHunt)];
}
const near = (at: Coords | null, p: { lat: number; lng: number }) => !!at && distanceMeters(at.lat, at.lng, p.lat, p.lng) <= GAME_ACTION_RADIUS_M;

let liveMissing = false;
export const hunt = {
  /** Open and upcoming hunts. `known` is what the map already loaded, `previewAllowed` is dev or the test account. */
  async list(args: { userId: string; at: Coords; known: Waypost[]; previewAllowed: boolean }): Promise<Hunt[]> {
    const live = await signedIn();
    if (live && !liveMissing) {
      const { data, error } = await rpc("hunt_list", { p_lat: args.at.lat, p_lng: args.at.lng });
      if (!error) { previewHunt = null; return (data as Hunt[] | null) ?? []; }
      if (!missing(error)) fail(error);
      liveMissing = true;
    }
    return args.previewAllowed ? loadPreview(args.userId, args.at, args.known, live) : [];
  },
  async join(h: Hunt): Promise<Hunt> {
    if (!h.preview) { const { data, error } = await rpc("hunt_join", { p_hunt: h.id }); fail(error); return data as Hunt; }
    if (huntStatus(h) === "closed") throw new HuntError("closed");
    progress.joined_at ??= new Date().toISOString(); save();
    return withProgress(previewHunt!);
  },
  async checkIn(h: Hunt, at: Coords | null): Promise<Hunt> {
    if (!h.preview) {
      if (!at) throw new HuntError("too_far");
      const { data, error } = await rpc("hunt_check_in", { p_hunt: h.id, p_lat: at.lat, p_lng: at.lng, p_accuracy: at.accuracy ?? 10 });
      fail(error); return data as Hunt;
    }
    if (huntStatus(h) !== "open") throw new HuntError("closed");
    if (!near(at, h.keeper)) throw new HuntError("too_far");
    progress.joined_at ??= new Date().toISOString();
    progress.checked_in_at ??= new Date().toISOString(); save();
    return withProgress(previewHunt!);
  },
  async finish(h: Hunt, at: Coords | null): Promise<HuntFinish> {
    if (!h.preview) {
      if (!at) throw new HuntError("too_far");
      const { data, error } = await rpc("hunt_finish", { p_hunt: h.id, p_lat: at.lat, p_lng: at.lng, p_accuracy: at.accuracy ?? 10 });
      fail(error); return data as HuntFinish;
    }
    if (!near(at, h.keeper)) throw new HuntError("too_far");
    if (!readyToReturn(h)) throw new HuntError("incomplete");
    progress.finished_at = new Date().toISOString(); save();
    // The preview grants nothing: rewards only ever come from the server.
    return { hunt: withProgress(previewHunt!), xp_gained: 0, gold_gained: 0 };
  },
  /** Hunt stamps finished in the preview, shown in the Passport alongside the server's. */
  previewStamps(): { id: string; name_zh: string; name_en: string; at: string }[] {
    return previewHunt && progress.finished_at ? [{ id: previewHunt.id, name_zh: previewHunt.name_zh, name_en: previewHunt.name_en, at: progress.finished_at }] : [];
  },
};
