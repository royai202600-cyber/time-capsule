// The collecting game's data. Until Codex's backend lands, development runs on an in-memory
// stand-in and the game stays hidden in production builds.
export const GAME_BACKEND = false;
export const GAME_ENABLED = GAME_BACKEND || __DEV__;
export const GAME_ACTION_RADIUS_M = 100;

export type Rarity = "common" | "uncommon" | "rare";
export type BallKind = "wax" | "gold";
export type Coords = { lat: number; lng: number; accuracy?: number };
export type GameState = { xp: number; level: number; xp_to_next: number; wax_balls: number; gold_balls: number };
export type LostCapsule = { id: string; vessel: string; rarity: Rarity; lat: number; lng: number; expires_at: string; attempts_left: number };
export type Waypost = { id: string; kind: "common" | "landmark"; name_zh: string; name_en: string; lat: number; lng: number; cooldown_until: string | null };
export type Nearby = { lost: LostCapsule[]; wayposts: Waypost[] };
export type ThrowResult = {
  result: "restored" | "broke_free" | "miss";
  vessel: string; copies: number; stars: number; is_new: boolean; xp_gained: number;
  attempts_left: number; state: GameState;
};
export type GameErrorCode = "no_balls" | "expired" | "no_attempts" | "too_far" | "cooldown" | "unknown";
export class GameError extends Error { constructor(public code: GameErrorCode) { super(code); } }

const STAR_COPIES = [1, 3, 6, 10, 15];
const starsFor = (copies: number) => STAR_COPIES.filter((c) => copies >= c).length;
const XP_PER_LEVEL = 1000;
const THROW_CHANCE: Record<Rarity, number> = { common: .55, uncommon: .35, rare: .18 };

const dev = {
  xp: 0, wax: 30, gold: 2, seeded: false,
  lost: [] as LostCapsule[], wayposts: [] as Waypost[], copies: new Map<string, number>(),
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
  const expires = new Date(Date.now() + 3_600_000).toISOString();
  const lost: [string, Rarity, number, number][] = [
    ["hourglass", "common", 45, 30], ["tin", "common", -55, -35], ["lantern", "uncommon", 20, -75],
    ["musicbox", "rare", -30, 70], ["envelope", "common", 170, -120], ["dome", "uncommon", -190, 90],
  ];
  dev.lost = lost.map(([vessel, rarity, n, e], i) => ({ id: `dev-${i}`, vessel, rarity, ...offset(at, n, e), expires_at: expires, attempts_left: 3 }));
  dev.wayposts = [
    { id: "dev-a", kind: "common", name_zh: "公園驛站", name_en: "Park Waypost", ...offset(at, -70, 25), cooldown_until: null },
    { id: "dev-b", kind: "common", name_zh: "廣場驛站", name_en: "Square Waypost", ...offset(at, 130, 80), cooldown_until: null },
    { id: "dev-c", kind: "landmark", name_zh: "地標驛站", name_en: "Landmark Waypost", ...offset(at, 240, -60), cooldown_until: null },
  ];
}

export const game = {
  async state(): Promise<GameState> { return stateNow(); },
  async nearby(at: Coords): Promise<Nearby> {
    seed(at);
    return { lost: dev.lost.filter((c) => c.attempts_left > 0), wayposts: dev.wayposts.map((w) => ({ ...w })) };
  },
  async throwBall(args: { id: string; ball: BallKind; ring: number; hit: boolean }): Promise<ThrowResult> {
    const capsule = dev.lost.find((c) => c.id === args.id);
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
  async spin(id: string): Promise<{ wax: number; gold: number; state: GameState }> {
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
