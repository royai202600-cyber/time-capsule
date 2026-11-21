// The collecting game's data. Signed-in players use the live server functions; signed-out
// development falls back to an in-memory stand-in.
import type { PublicCapsule } from "./publicCapsule";
import { supabase } from "./supabase";

export const GAME_ENABLED = true;
export const GAME_ACTION_RADIUS_M = 100;

export type Rarity = "common" | "uncommon" | "rare";
export type BallKind = "wax" | "gold";
export type Coords = { lat: number; lng: number; accuracy?: number };
export type GameState = { xp: number; level: number; xp_to_next: number; wax_balls: number; gold_balls: number };
export type CorruptedCapsule = { id: string; vessel: string; rarity: Rarity; lat: number; lng: number; expires_at: string; attempts_left: number };
/** What one spin dropped. `vessel` is a vessel id when the Waypost's level drop list gave a copy (WL1). */
export type SpinResult = { wax: number; gold: number; vessel?: string | null; state: GameState };
export type Waypost = { id: string; kind: "common" | "landmark"; name_zh: string; name_en: string; lat: number; lng: number; cooldown_until: string | null; place?: string | null; scene?: string | null };
export type Nearby = { corrupted: CorruptedCapsule[]; wayposts: Waypost[] };
/** What a won fight gives. Copies are null for an unlimited vessel (a starter or an earned Landmark vessel). */
export type Restored = { vessel: string; copies: number | null; stars: number; is_new: boolean; xp_gained: number };
export type LandmarkAttempt = { id: string; waypost: string; vessel: string; cracks: number; maxCracks: number; expires_at: string };
// Normalize names from the old server until the timed-hunt migration ships.
export const cityHuntNameZh = (name: string) => name.replace("城市尋寶", "城市定向");
export type PassportHunt = { id: string; name_zh: string; name_en: string; at: string };
export type PrivateHuntStamp = { id: string; name: string; at: string };
export type DevLetter = { publicCapsule: PublicCapsule; message: string };
export type GameErrorCode = "no_balls" | "expired" | "no_attempts" | "already_caught" | "too_far" | "too_fast" | "cooldown" | "active_attempt" | "too_soon" | "not_enough_damage" | "network" | "unknown";
export class GameError extends Error { constructor(public code: GameErrorCode) { super(code); } }

const CODES: GameErrorCode[] = ["no_balls", "expired", "no_attempts", "already_caught", "too_far", "too_fast", "cooldown", "active_attempt", "too_soon", "not_enough_damage"];
const fail = (error: { message?: string } | null) => {
  if (error) throw new GameError(CODES.find((c) => error.message?.includes(c)) ?? "unknown");
};
// Landmark Wayposts only return their place; each place has one earned vessel.
const LANDMARK_VESSEL: Record<string, string> = { taipei101: "bamboo-tower", merlion: "lionfish-fountain", senado: "senado-fountain", hkust: "red-bird",
  beimen: "north-gate", esplanade: "durian", guia: "lighthouse" };
let position: Coords | null = null;
/** Successful game actions, also counted by the signed-out development City Hunt preview. */
export type GameEvent = { kind: "spin"; waypost: string; lat: number; lng: number } | { kind: "restore"; lat: number; lng: number } | { kind: "landmark"; waypost: string };
const listeners = new Set<(e: GameEvent) => void>();
const emit = (e: GameEvent) => { listeners.forEach((l) => { try { l(e); } catch { /* never break the game */ } }); };
export const onGameEvent = (l: (e: GameEvent) => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const spots = new Map<string, { lat: number; lng: number }>();
const posts = new Map<string, { lat: number; lng: number }>();
const live = async () => {
  const present = !!(await supabase.auth.getSession()).data.session;
  if (!present && !__DEV__) throw new GameError("unknown");
  return present;
};
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

const dev = {
  xp: 0, wax: 30, gold: 2, seeded: false,
  corrupted: [] as CorruptedCapsule[], wayposts: [] as Waypost[], copies: new Map<string, number>(), publicCapsules: [] as DevLetter[],
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
  const publicCapsules: [string, string, string, string, string, number, number][] = [
    ["小雅", "02", "給今天有點累的你", "測試信：如果你正在讀這封信，希望你今天吃得好。", "tin", 12, 82],
    ["阿明", "05", "這裡的風很舒服", "測試信：我在這裡坐了一個下午，你也坐一下吧。", "bottle", -84, -72],
    ["Mei", "03", "寫給路過的人", "測試信：謝謝你走過來，把這封信撿起來。", "envelope", 68, -24],
    ["Ken", "07", "要走近一點才能撿", "測試信：這封放得遠一點，測試走近才能撿起。", "hourglass", 150, 150],
  ];
  dev.publicCapsules = publicCapsules.map(([name, avatar, hint, message, vessel, n, e], i) => ({
    message,
    publicCapsule: { id: `dev-public-capsule-${i}`, hint, vessel, ...offset(at, n, e), spot_zh: "公園驛站", spot_en: "Park Waypost", sealed_at: sealed, available_at: sealed, returns: 0, sender: { id: `dev-sender-${i}`, name, avatar: { set: "illus", id: avatar }, city: "台北" } },
  }));
}

// Signed-out development fallback: one finite batch, replaced at the next ten-minute boundary.
const DEV_VESSELS = ["bubble-tea", "bento", "hot-air-balloon"];
const DEV_RARITY: Rarity[] = ["common", "uncommon", "rare"];
let devNext = 0;
const DEV_WAVE_MINUTES = 10;
let devWave = -1;
let devAnchor: Coords | null = null;
function refreshDevWave(at: Coords) {
  const waveMs = DEV_WAVE_MINUTES * 60_000;
  const wave = Math.floor(Date.now() / waveMs);
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
      expires_at: new Date((wave + 1) * waveMs).toISOString(), attempts_left: 3,
    });
  }
}

export const game = {
  setPosition(at: Coords) { position = at; },
  async state(): Promise<GameState> { return await live() ? liveState() : stateNow(); },
  async nearby(at: Coords): Promise<Nearby> {
    position = at;
    if (await live()) {
      const { data, error } = await supabase.rpc("game_nearby", coords());
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
  async landmarkStartOnce(target: Waypost): Promise<LandmarkAttempt> {
    if (await live()) {
      const { data, error } = await supabase.rpc("landmark_start", { p_waypost: target.id, ...coords() });
      fail(error);
      const row = data?.[0];
      if (!row) throw new GameError("unknown");
      return { id: row.attempt_id, waypost: target.id, vessel: LANDMARK_VESSEL[target.place ?? ""] ?? "hourglass", cracks: row.cracks,
        // DF3's landmark_start also returns max_health; the older one only the cracks left, out of 20.
        maxCracks: (row as { max_health?: number }).max_health ?? Math.max(row.cracks, 20), expires_at: row.expires_at };
    }
    return { id: `dev-fight-${Date.now()}`, waypost: target.id, vessel: "bamboo-tower", cracks: 40, maxCracks: 40, expires_at: new Date(Date.now() + 150_000).toISOString() };
  },
  /** Signed-out development: a won practice fight restores the sample capsule so the wave shrinks as it would live. */
  devRestore(id: string): Restored | null {
    const capsule = dev.corrupted.find((c) => c.id === id);
    if (!capsule) return null;
    capsule.attempts_left = 0;
    const copies = (dev.copies.get(capsule.vessel) ?? 0) + 1;
    dev.copies.set(capsule.vessel, copies);
    const xp_gained = 100 + (copies === 1 ? 500 : 0);
    dev.xp += xp_gained;
    const at = spots.get(id);
    if (at) emit({ kind: "restore", ...at });
    return { vessel: capsule.vessel, copies, stars: starsFor(copies), is_new: copies === 1, xp_gained };
  },
  async collection(): Promise<Record<string, { copies: number | null; stars: number }>> {
    if (await live()) {
      const { data, error } = await supabase.rpc("my_collection");
      fail(error);
      const test = [...dev.copies].map(([id, copies]) => [id, { copies, stars: starsFor(copies) }] as const);
      return Object.fromEntries([...(data ?? []).map((row) => [row.vessel, { copies: row.copies, stars: row.stars }] as const), ...test]);
    }
    return Object.fromEntries([...dev.copies].map(([id, copies]) => [id, { copies, stars: starsFor(copies) }]));
  },
  /** Development only: capsules from other people, so the pickup can be tried anywhere. */
  devPublicCapsules(at: Coords): PublicCapsule[] { if (!__DEV__) return []; seed(at); return dev.publicCapsules.map((b) => b.publicCapsule); },
  devPickUp(id: string): DevLetter | null {
    const found = dev.publicCapsules.find((b) => b.publicCapsule.id === id) ?? null;
    dev.publicCapsules = dev.publicCapsules.filter((b) => b.publicCapsule.id !== id);
    return found;
  },
  /** Places stamped by a Landmark win or an opened capsule, with when they were first earned. */
  async passport(): Promise<{ places: Record<string, string>; hunts: PassportHunt[]; privateHunts: PrivateHuntStamp[] }> {
    if (!await live()) return { places: {}, hunts: [], privateHunts: [] };
    const { data, error } = await supabase.rpc("my_passport");
    fail(error);
    const rows = data ?? [];
    return {
      places: Object.fromEntries(rows.filter((row) => row.how_earned !== "hunt" && row.how_earned !== "private_hunt").map((row) => [row.place, row.first_at])),
      hunts: rows.filter((row) => row.how_earned === "hunt").map((row) => ({ id: row.place, name_zh: cityHuntNameZh(row.name_zh), name_en: row.name_en, at: row.first_at })),
      privateHunts: rows.filter((row) => row.how_earned === "private_hunt").map((row) => ({ id: row.place, name: row.name_zh, at: row.first_at })),
    };
  },
  async spin(id: string): Promise<SpinResult> {
    const out = await game.spinOnce(id);
    const at = posts.get(id);
    if (at) emit({ kind: "spin", waypost: id, ...at });
    return out;
  },
  async spinOnce(id: string): Promise<SpinResult> {
    if (await live()) {
      const { data, error } = await supabase.rpc("waypost_spin", { p_id: id, ...coords() });
      fail(error);
      const row = data?.[0];
      if (!row) throw new GameError("unknown");
      // WL1: a levelled Waypost can also drop one copy of a vessel.
      return { wax: row.wax_awarded, gold: row.gold_awarded, vessel: (row as { vessel_awarded?: string | null }).vessel_awarded ?? null, state: await liveState() };
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

export type DodgeTarget = { capsule: CorruptedCapsule; landmark?: Waypost };
export type DodgeSession = { id: string; health: number; maxHealth: number; expiresAt: number; attemptsLeft: number };
async function dodgeRow<Row>(request: PromiseLike<{ data: Row[] | null; error: { message?: string } | null; status?: number }>): Promise<Row> {
  const { data, error, status } = await request;
  if (error && status === 0) throw new GameError("network");
  fail(error);
  const row = data?.[0];
  if (!row) throw new GameError("unknown");
  return row;
}

export type DodgeFinish = {
  result: "won" | "lost";
  vessel: string | null;
  copies: number | null;
  stars: number | null;
  is_new: boolean;
  xp_gained: number;
  wax_balls: number;
  gold_balls: number;
  attempts_left: number;
};

/** Session methods serve the located fights only. Today's Hunt plays entirely on the device. */
export const dodgeFights = {
  landmarkVessel: (waypost: Waypost) => LANDMARK_VESSEL[waypost.place ?? ""] ?? "hourglass",
  async start(target: DodgeTarget): Promise<DodgeSession> {
    if (target.landmark) {
      const row = await game.landmarkStartOnce(target.landmark);
      return { id: row.id, health: row.cracks, maxHealth: row.maxCracks, expiresAt: Date.parse(row.expires_at), attemptsLeft: 1 };
    }
    const row = await dodgeRow(supabase.rpc("corrupted_fight_start", { p_spawn: target.capsule.id, ...coords() }));
    return { id: row.fight_id, health: row.health, maxHealth: row.max_health, expiresAt: Date.parse(row.expires_at), attemptsLeft: row.attempts_left };
  },
  async finish(target: DodgeTarget, session: DodgeSession, result: DodgeFinish["result"], used: Record<BallKind, number>) {
    const args = {
      p_fight: session.id, p_result: result, p_wax_used: used.wax, p_gold_used: used.gold, ...coords(),
    };
    const { data, error, status } = await supabase.rpc(target.landmark ? "landmark_finish" : "corrupted_fight_finish", args);
    if (error && (status === 0 || status === 502 || status === 503 || status === 504)) throw new GameError("network");
    fail(error);
    if (!data || typeof data !== "object" || !("result" in data)) throw new GameError("unknown");
    const out = data as DodgeFinish;
    if (out.result === "won") {
      if (target.landmark) emit({ kind: "landmark", waypost: target.landmark.id });
      else emit({ kind: "restore", lat: target.capsule.lat, lng: target.capsule.lng });
    }
    return out;
  },
};
