// Waypost levels (docs/design/hunt-first-home.md, part 3): a common Waypost grows from everyone's spins,
// and each level has its own list of things a spin can drop. The map gem never changes with the level.
// The contract is Codex's WL1 backend. Until it ships, development builds use a sample that lasts until reload.
import { supabase } from "./supabase";

/** Switch on when `waypost_level`, `admin_waypost_levels` and `admin_waypost_level_set` are applied. */
export const WAYPOST_LEVELS_BACKEND = false;
export const WAYPOST_LEVELS_SAMPLE = !WAYPOST_LEVELS_BACKEND && typeof __DEV__ !== "undefined" && __DEV__;
export const WAYPOST_LEVELS = WAYPOST_LEVELS_BACKEND || WAYPOST_LEVELS_SAMPLE;

/** Every spin by anyone adds this much XP, with no daily cap. Leaving or opening capsules adds nothing. */
export const SPIN_XP = 1;
export const MAX_LEVEL = 5;

/** One thing a spin can drop. `vessel` null means the city's rare Corrupted Capsule vessel. `chance` is 1–100. */
export type LevelItemKind = "wax" | "gold" | "vessel";
export type LevelItem = { kind: LevelItemKind; vessel?: string | null; min: number; max: number; chance: number };
/** A level: the Waypost XP it starts at and what one spin drops there. Level 1 always starts at 0. */
export type LevelRow = { level: number; xp: number; items: LevelItem[] };

/** One Waypost's level, for the player at it. `next_xp` is null at the top level. */
export type WaypostLevel = {
  level: number; xp: number; level_xp: number; next_xp: number | null;
  items: LevelItem[]; next_items: LevelItem[] | null;
  /** How many times this player has spun here. */
  me: { spins: number };
};

/**
 * Defaults Roy approved with the demo. Level 1 is today's spin exactly (10 wax balls and the existing gold chance,
 * seeded by the server from the live game config), so nothing changes until a Waypost grows; no level gives less.
 */
export const DEFAULT_LEVELS: LevelRow[] = [
  { level: 1, xp: 0, items: [{ kind: "wax", min: 10, max: 10, chance: 100 }, { kind: "gold", min: 1, max: 1, chance: 5 }] },
  { level: 2, xp: 100, items: [{ kind: "wax", min: 12, max: 12, chance: 100 }, { kind: "gold", min: 1, max: 1, chance: 5 }] },
  { level: 3, xp: 300, items: [{ kind: "wax", min: 12, max: 12, chance: 100 }, { kind: "gold", min: 1, max: 1, chance: 10 }] },
  { level: 4, xp: 700, items: [{ kind: "wax", min: 14, max: 14, chance: 100 }, { kind: "gold", min: 1, max: 1, chance: 20 }] },
  { level: 5, xp: 1500, items: [{ kind: "wax", min: 15, max: 15, chance: 100 }, { kind: "gold", min: 1, max: 1, chance: 20 }, { kind: "vessel", vessel: null, min: 1, max: 1, chance: 5 }] },
];

/** 0–100: how far this Waypost is from its level towards the next. */
export const levelProgress = (l: WaypostLevel) => l.next_xp == null ? 100 : Math.max(0, Math.min(100, Math.round((l.xp - l.level_xp) / (l.next_xp - l.level_xp) * 100)));

/** The checks the admin form and the server share: rising thresholds from 0, 1–6 items, sane ranges. */
export function levelProblem(rows: LevelRow[], row: LevelRow): "order" | "items" | "range" | null {
  const prev = rows.find((r) => r.level === row.level - 1), next = rows.find((r) => r.level === row.level + 1);
  if (row.level === 1 ? row.xp !== 0 : (prev && row.xp <= prev.xp) || (next && row.xp >= next.xp) || row.xp < 1) return "order";
  if (row.items.length < 1 || row.items.length > 6) return "items";
  if (row.items.some((i) => i.min < 1 || i.max < i.min || i.max > 99 || i.chance < 1 || i.chance > 100)) return "range";
  return null;
}

export class WaypostLevelError extends Error { constructor(public code: string) { super(code); } }
const call = async <T>(fn: string, args: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.rpc(fn as never, args as never);
  if (error) throw new WaypostLevelError(error.message);
  return data as T;
};

export const waypostLevels = {
  /** A common Waypost's level. Any player may read it; `me` is the caller's own share. */
  async get(waypostId: string): Promise<WaypostLevel> {
    if (WAYPOST_LEVELS_BACKEND) return call<WaypostLevel>("waypost_level", { p_waypost: waypostId });
    return sample.get(waypostId);
  },
};

/** Owner and admin only: every level and its drop list, and saving one level (logged in Activity with Undo). */
export const adminLevels = {
  async list(): Promise<LevelRow[]> {
    if (WAYPOST_LEVELS_BACKEND) return call<LevelRow[]>("admin_waypost_levels", {});
    return sample.levels.map((r) => ({ ...r, items: r.items.map((i) => ({ ...i })) }));
  },
  async set(row: LevelRow, note: string | null): Promise<void> {
    if (WAYPOST_LEVELS_BACKEND) return call<void>("admin_waypost_level_set", { p_level: row.level, p_xp: row.xp, p_items: row.items, p_note: note });
    sample.set(row);
  },
};

// ---- development sample (sample numbers, not real Wayposts) ----
const seedXp = (id: string) => [...id].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) % 997, 7) % 420;
const sample = {
  levels: DEFAULT_LEVELS.map((r) => ({ ...r, items: r.items.map((i) => ({ ...i })) })),
  xp: new Map<string, number>(),
  me: new Map<string, { spins: number }>(),
  get(id: string): WaypostLevel {
    const xp = this.xp.get(id) ?? seedXp(id);
    this.xp.set(id, xp);
    const at = [...this.levels].reverse().find((r) => xp >= r.xp) ?? this.levels[0];
    const next = this.levels.find((r) => r.level === at.level + 1) ?? null;
    return { level: at.level, xp, level_xp: at.xp, next_xp: next?.xp ?? null, items: at.items, next_items: next?.items ?? null, me: this.me.get(id) ?? { spins: 3 } };
  },
  set(row: LevelRow) { this.levels = this.levels.map((r) => r.level === row.level ? { ...row, items: row.items.map((i) => ({ ...i })) } : r); },
};
/** Development only: what the server adds for a spin, so the sample's bar and level-up move. */
export function sampleSpinXp(waypostId: string) {
  if (!WAYPOST_LEVELS_SAMPLE) return;
  const now = sample.get(waypostId);
  sample.xp.set(waypostId, now.xp + SPIN_XP);
  sample.me.set(waypostId, { spins: now.me.spins + 1 });
}
