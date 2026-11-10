// The collecting game's data. Signed-in players use the live server functions; signed-out
// development falls back to an in-memory stand-in. The game stays hidden in production until launch.
import type { SeaBottle } from "./sea";
import { supabase } from "./supabase";

export const GAME_BACKEND = true;
export const GAME_ENABLED = true;
export const GAME_ACTION_RADIUS_M = 100;

export type Rarity = "common" | "uncommon" | "rare";
export type BallKind = "wax" | "gold";
export type Coords = { lat: number; lng: number; accuracy?: number };
export type GameState = { xp: number; level: number; xp_to_next: number; wax_balls: number; gold_balls: number };
export type CorruptedCapsule = { id: string; vessel: string; rarity: Rarity; lat: number; lng: number; expires_at: string; attempts_left: number };
export type Waypost = { id: string; kind: "common" | "landmark"; name_zh: string; name_en: string; lat: number; lng: number; cooldown_until: string | null; place?: string | null; scene?: string | null };
export type Nearby = { corrupted: CorruptedCapsule[]; wayposts: Waypost[] };
export type ThrowResult = {
  result: "restored" | "broke_free" | "miss";
  vessel: string; copies: number; stars: number; is_new: boolean; xp_gained: number;
  attempts_left: number; state: GameState;
};
export type LandmarkAttempt = { id: string; waypost: string; vessel: string; cracks: number; expires_at: string };
export type LandmarkHit = { result: "hit" | "won"; cracks: number; vessel: string; copies: number; stars: number; is_new: boolean; xp_gained: number; state: GameState };
export type PassportHunt = { id: string; name_zh: string; name_en: string; at: string };
export type DevLetter = { bottle: SeaBottle; message: string };
export type GameErrorCode = "no_balls" | "expired" | "no_attempts" | "already_caught" | "too_far" | "too_fast" | "cooldown" | "active_attempt" | "unknown";
export class GameError extends Error { constructor(public code: GameErrorCode) { super(code); } }

const CODES: GameErrorCode[] = ["no_balls", "expired", "no_attempts", "already_caught", "too_far", "too_fast", "cooldown", "active_attempt"];
const fail = (error: { message?: string } | null) => {
  if (error) throw new GameError(CODES.find((c) => error.message?.includes(c)) ?? "unknown");
};
// Landmark Wayposts only return their place; each place has one earned vessel.
const LANDMARK_VESSEL: Record<string, string> = { taipei101: "bamboo-tower", merlion: "lionfish-fountain", senado: "senado-fountain" };
let position: Coords | null = null;
/** Successful game actions, so a City Hunt can count them on the device while its backend is not live. */
export type GameEvent = { kind: "spin"; waypost: string; lat: number; lng: number } | { kind: "restore"; lat: number; lng: number } | { kind: "landmark"; waypost: string };
const listeners = new Set<(e: GameEvent) => void>();
const emit = (e: GameEvent) => { listeners.forEach((l) => { try { l(e); } catch { /* never break the game */ } }); };
export const onGameEvent = (l: (e: GameEvent) => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const spots = new Map<string, { lat: number; lng: number }>();
const posts = new Map<string, { lat: number; lng: number }>();
const attemptPost = new Map<string, string>();
const live = async () => GAME_BACKEND && !!(await supabase.auth.getSession()).data.session;
const coords = () => {
  if (!position) throw new GameError("too_far");
  return { p_lat: position.lat, p_lng: position.lng, p_accuracy: position.accuracy ?? 10 };
};
async function liveState(): Promise<GameState> {
  const { data, error } = await supabase.rpc("game_state");
  fail(error);
  const row = data?.[0];
  if (!row) throw new GameError("unknown");
  return { xp: row.xp, level: row.level, xp_to_next: row.xp_to_next, wax_balls: row.wax_balls, gold_balls: row.gold_balls };
}
type NearbyPayload = {
  spawns: { spawn_id: string; vessel: string; rarity: Rarity; lat: number; lng: number; expires_at: string; attempts_left: number; already_caught: boolean }[];
  wayposts: { id: string; kind: "common" | "landmark"; name_zh: string; name_en: string; place: string | null; scene?: string | null; lat: number; lng: number; cooldown_end: string | null }[];
};

const STAR_COPIES = [1, 3, 6, 10, 15];
const starsFor = (copies: number) => STAR_COPIES.filter((c) => copies >= c).length;
const XP_PER_LEVEL = 1000;
const THROW_CHANCE: Record<Rarity, number> = { common: .55, uncommon: .35, rare: .18 };

const dev = {
  xp: 0, wax: 30, gold: 2, seeded: false,
  corrupted: [] as CorruptedCapsule[], wayposts: [] as Waypost[], copies: new Map<string, number>(), bottles: [] as DevLetter[],
  attempts: new Map<string, { attempt: LandmarkAttempt; cracks: number }>(),
};
const stateNow = (): GameState => ({
  xp: dev.xp, level: Math.floor(dev.xp / XP_PER_LEVEL) + 1,
  xp_to_next: XP_PER_LEVEL - (dev.xp % XP_PER_LEVEL), wax_balls: dev.wax, gold_balls: dev.gold,
});
const offset = (at: Coords, north: number, east: number) => ({
  lat: at.lat + north / 110540,
  lng: at.lng + east / (111320 * Math.cos(at.lat * Math.PI / 180)),
});
function seed(at: Coords) {
  if (dev.seeded) return;
  dev.seeded = true;
  dev.wayposts = [
    { id: "dev-a", kind: "common", name_zh: "公園驛站", name_en: "Park Waypost", ...offset(at, -70, 25), cooldown_until: null },
    { id: "dev-b", kind: "common", name_zh: "廣場驛站", name_en: "Square Waypost", ...offset(at, 130, 80), cooldown_until: null },
    { id: "dev-c", kind: "landmark", name_zh: "台北101廣場", name_en: "Taipei 101 Plaza", place: "taipei101", ...offset(at, 78, -52), cooldown_until: null },
  ];
  const sealed = new Date(Date.now() - 9 * 86_400_000).toISOString();
  const bottles: [string, string, string, string, string, number, number][] = [
    ["小雅", "02", "給今天有點累的你", "測試信：如果你正在讀這封信，希望你今天吃得好。", "tin", 12, 82],
    ["阿明", "05", "這裡的風很舒服", "測試信：我在這裡坐了一個下午，你也坐一下吧。", "bottle", -84, -72],
    ["Mei", "03", "寫給路過的人", "測試信：謝謝你走過來，把這封信撿起來。", "envelope", 68, -24],
    ["Ken", "07", "要走近一點才能撿", "測試信：這封放得遠一點，測試走近才能撿起。", "hourglass", 150, 150],
  ];
  dev.bottles = bottles.map(([name, avatar, hint, message, vessel, n, e], i) => ({
    message,
    bottle: { id: `dev-bottle-${i}`, hint, vessel, ...offset(at, n, e), shore_zh: "公園驛站", shore_en: "Park Waypost", sealed_at: sealed, washed_up_at: sealed, returns: 0, sender: { id: `dev-sender-${i}`, name, avatar: { set: "illus", id: avatar }, city: "台北" } },
  }));
}

// Signed-out development fallback: one finite batch, replaced at the next ten-minute boundary.
const DEV_VESSELS = ["bubble-tea", "bento", "hot-air-balloon"];
const DEV_RARITY: Rarity[] = ["common", "uncommon", "rare"];
let devNext = 0;
let devWave = -1;
let devAnchor: Coords | null = null;
function refreshDevWave(at: Coords) {
  const wave = Math.floor(Date.now() / 600_000);
  const meters = (a: Coords, b: Coords) => Math.hypot((a.lat - b.lat) * 110540, (a.lng - b.lng) * 111320 * Math.cos(at.lat * Math.PI / 180));
  if (wave === devWave && devAnchor && meters(at, devAnchor) <= 100) return;
  devWave = wave; devAnchor = { ...at }; dev.corrupted = [];
  for (let tries = 0; tries < 2000 && dev.corrupted.length < 6; tries++) {
    const angle = Math.random() * Math.PI * 2, distance = 35 + Math.random() * 50;
    const point = offset(at, Math.cos(angle) * distance, Math.sin(angle) * distance);
    if (dev.corrupted.some((c) => meters(c, point) < 28)) continue;
    const i = devNext++, kind = i % DEV_VESSELS.length;
    dev.corrupted.push({
      id: `dev-${wave}-${i}`, vessel: DEV_VESSELS[kind], rarity: DEV_RARITY[kind], ...point,
      expires_at: new Date((wave + 1) * 600_000).toISOString(), attempts_left: 3,
    });
  }
}

export const game = {
  setPosition(at: Coords) { position = at; },
  async state(): Promise<GameState> { return await live() ? liveState() : stateNow(); },
  async nearby(at: Coords): Promise<Nearby> {
    position = at;
    if (await live()) {
      const { data, error } = await supabase.rpc("corrupted_nearby", coords());
      fail(error);
      const payload = data as unknown as NearbyPayload;
      payload.spawns.forEach((c) => spots.set(c.spawn_id, { lat: c.lat, lng: c.lng }));
      payload.wayposts.forEach((w) => posts.set(w.id, { lat: w.lat, lng: w.lng }));
      return {
        corrupted: payload.spawns.filter((c) => !c.already_caught && c.attempts_left > 0)
          .map((c) => ({ id: c.spawn_id, vessel: c.vessel, rarity: c.rarity, lat: c.lat, lng: c.lng, expires_at: c.expires_at, attempts_left: c.attempts_left })),
        wayposts: payload.wayposts.map((w) => ({ id: w.id, kind: w.kind, name_zh: w.name_zh, name_en: w.name_en, lat: w.lat, lng: w.lng, cooldown_until: w.cooldown_end, place: w.place, scene: w.scene })),
      };
    }
    if (!__DEV__) return { corrupted: [], wayposts: [] };
    seed(at);
    refreshDevWave(at);
    dev.corrupted.forEach((c) => spots.set(c.id, { lat: c.lat, lng: c.lng }));
    dev.wayposts.forEach((w) => posts.set(w.id, { lat: w.lat, lng: w.lng }));
    return { corrupted: dev.corrupted.filter((c) => c.attempts_left > 0), wayposts: dev.wayposts.map((w) => ({ ...w })) };
  },
  async throwBall(args: { id: string; ball: BallKind; ring: number; hit: boolean }): Promise<ThrowResult> {
    const out = await game.throwOnce(args);
    const at = spots.get(args.id);
    if (out.result === "restored" && at) emit({ kind: "restore", ...at });
    return out;
  },
  async throwOnce(args: { id: string; ball: BallKind; ring: number; hit: boolean }): Promise<ThrowResult> {
    if (!args.id.startsWith("dev-") && await live()) {
      const { data, error } = await supabase.rpc("corrupted_throw", { p_spawn: args.id, ...coords(), p_ball: args.ball, p_ring: args.ring, p_hit: args.hit });
      fail(error);
      const row = data?.[0];
      if (!row) throw new GameError("unknown");
      return {
        result: row.result === "restored" ? "restored" : row.result === "miss" ? "miss" : "broke_free",
        vessel: row.vessel, copies: row.copies ?? 0, stars: row.stars ?? 0, is_new: row.is_new, xp_gained: row.xp_gained,
        attempts_left: row.attempts_left, state: await liveState(),
      };
    }
    const out = await game.devThrow(args);
    return await live() ? { ...out, state: await liveState() } : out;
  },
  async devThrow(args: { id: string; ball: BallKind; ring: number; hit: boolean }): Promise<ThrowResult> {
    const capsule = dev.corrupted.find((c) => c.id === args.id);
    if (!capsule) throw new GameError("expired");
    if (capsule.attempts_left <= 0) throw new GameError("no_attempts");
    if (args.ball === "gold" ? dev.gold <= 0 : dev.wax <= 0) throw new GameError("no_balls");
    if (args.ball === "gold") dev.gold -= 1; else dev.wax -= 1;
    const base = { vessel: capsule.vessel, copies: dev.copies.get(capsule.vessel) ?? 0, is_new: false };
    if (!args.hit) return { ...base, result: "miss", stars: starsFor(base.copies), xp_gained: 0, attempts_left: capsule.attempts_left, state: stateNow() };
    capsule.attempts_left -= 1;
    const ring = Math.max(0, Math.min(1, args.ring));
    const restored = Math.random() < Math.min(.95, THROW_CHANCE[capsule.rarity] + ring * .35 + (args.ball === "gold" ? .2 : 0));
    if (!restored) return { ...base, result: "broke_free", stars: starsFor(base.copies), xp_gained: 0, attempts_left: capsule.attempts_left, state: stateNow() };
    const copies = base.copies + 1;
    dev.copies.set(capsule.vessel, copies);
    const is_new = copies === 1;
    const xp_gained = 100 + (is_new ? 500 : 0);
    dev.xp += xp_gained;
    capsule.attempts_left = 0;
    return { vessel: capsule.vessel, result: "restored", copies, stars: starsFor(copies), is_new, xp_gained, attempts_left: 0, state: stateNow() };
  },
  async landmarkStart(target: Waypost): Promise<LandmarkAttempt> {
    const attempt = await game.landmarkStartOnce(target);
    attemptPost.set(attempt.id, target.id);
    return attempt;
  },
  async landmarkStartOnce(target: Waypost): Promise<LandmarkAttempt> {
    if (await live()) {
      const { data, error } = await supabase.rpc("landmark_start", { p_waypost: target.id, ...coords() });
      fail(error);
      const row = data?.[0];
      if (!row) throw new GameError("unknown");
      return { id: row.attempt_id, waypost: target.id, vessel: LANDMARK_VESSEL[target.place ?? ""] ?? "hourglass", cracks: row.cracks, expires_at: row.expires_at };
    }
    const attempt: LandmarkAttempt = { id: `dev-fight-${Date.now()}`, waypost: target.id, vessel: "bamboo-tower", cracks: 12, expires_at: new Date(Date.now() + 180_000).toISOString() };
    dev.attempts.set(attempt.id, { attempt, cracks: attempt.cracks });
    return attempt;
  },
  async landmarkHit(args: { attempt: string; ball: BallKind; ring: number }): Promise<LandmarkHit> {
    const out = await game.landmarkHitOnce(args);
    const post = attemptPost.get(args.attempt);
    if (out.result === "won" && post) emit({ kind: "landmark", waypost: post });
    return out;
  },
  async landmarkHitOnce(args: { attempt: string; ball: BallKind; ring: number }): Promise<LandmarkHit> {
    if (await live()) {
      const { data, error } = await supabase.rpc("landmark_hit", { p_attempt: args.attempt, ...coords(), p_ball: args.ball, p_ring: args.ring });
      fail(error);
      const row = data?.[0];
      if (!row) throw new GameError("unknown");
      return { result: row.result === "won" ? "won" : "hit", cracks: row.cracks, vessel: row.vessel ?? "", copies: row.copies ?? 0, stars: row.stars ?? 0, is_new: row.is_new, xp_gained: row.xp_gained, state: await liveState() };
    }
    const fight = dev.attempts.get(args.attempt);
    if (!fight || new Date(fight.attempt.expires_at).getTime() <= Date.now()) throw new GameError("expired");
    if (args.ball === "gold" ? dev.gold <= 0 : dev.wax <= 0) throw new GameError("no_balls");
    if (args.ball === "gold") dev.gold -= 1; else dev.wax -= 1;
    fight.cracks = Math.max(0, fight.cracks - (args.ball === "gold" || args.ring >= .8 ? 2 : 1));
    const vessel = fight.attempt.vessel;
    if (fight.cracks > 0) return { result: "hit", cracks: fight.cracks, vessel, copies: 0, stars: 0, is_new: false, xp_gained: 0, state: stateNow() };
    const copies = (dev.copies.get(vessel) ?? 0) + 1;
    dev.copies.set(vessel, copies);
    dev.xp += 2000;
    dev.attempts.delete(args.attempt);
    return { result: "won", cracks: 0, vessel, copies, stars: starsFor(copies), is_new: copies === 1, xp_gained: 2000, state: stateNow() };
  },
  async collection(): Promise<Record<string, { copies: number; stars: number }>> {
    if (await live()) {
      const { data, error } = await supabase.rpc("my_collection");
      fail(error);
      const test = [...dev.copies].map(([id, copies]) => [id, { copies, stars: starsFor(copies) }] as const);
      return Object.fromEntries([...(data ?? []).map((row) => [row.vessel, { copies: row.copies, stars: row.stars }] as const), ...test]);
    }
    return Object.fromEntries([...dev.copies].map(([id, copies]) => [id, { copies, stars: starsFor(copies) }]));
  },
  /** Development only: capsules from other people, so the pickup can be tried anywhere. */
  devBottles(at: Coords): SeaBottle[] { if (!__DEV__) return []; seed(at); return dev.bottles.map((b) => b.bottle); },
  devPickUp(id: string): DevLetter | null {
    const found = dev.bottles.find((b) => b.bottle.id === id) ?? null;
    dev.bottles = dev.bottles.filter((b) => b.bottle.id !== id);
    return found;
  },
  /** Places stamped by a Landmark win or an opened capsule, with when they were first earned. */
  async passport(): Promise<{ places: Record<string, string>; hunts: PassportHunt[] }> {
    if (!await live()) return { places: {}, hunts: [] };
    const { data, error } = await supabase.rpc("my_passport");
    fail(error);
    const rows = data ?? [];
    return {
      places: Object.fromEntries(rows.filter((row) => row.how_earned !== "hunt").map((row) => [row.place, row.first_at])),
      hunts: rows.filter((row) => row.how_earned === "hunt").map((row) => ({ id: row.place, name_zh: row.name_zh, name_en: row.name_en, at: row.first_at })),
    };
  },
  async spin(id: string): Promise<{ wax: number; gold: number; state: GameState }> {
    const out = await game.spinOnce(id);
    const at = posts.get(id);
    if (at) emit({ kind: "spin", waypost: id, ...at });
    return out;
  },
  async spinOnce(id: string): Promise<{ wax: number; gold: number; state: GameState }> {
    if (await live()) {
      const { data, error } = await supabase.rpc("waypost_spin", { p_id: id, ...coords() });
      fail(error);
      const row = data?.[0];
      if (!row) throw new GameError("unknown");
      return { wax: row.wax_awarded, gold: row.gold_awarded, state: await liveState() };
    }
    const waypost = dev.wayposts.find((w) => w.id === id);
    if (!waypost) throw new GameError("unknown");
    if (waypost.cooldown_until && new Date(waypost.cooldown_until).getTime() > Date.now()) throw new GameError("cooldown");
    waypost.cooldown_until = new Date(Date.now() + 300_000).toISOString();
    const wax = 3 + Math.floor(Math.random() * 3);
    const gold = Math.random() < .05 ? 1 : 0;
    dev.wax += wax; dev.gold += gold; dev.xp += 20;
    return { wax, gold, state: stateNow() };
  },
};
