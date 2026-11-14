// Private City Hunts (docs/design/city-orienteering.md, Part B): a hunt made by an organizer and joined
// by code, link or QR. Signed-in players use the server functions in the backend contract. Until those
// are live, development and the test account get a demo hunt that counts progress on this device only.
// Private hunts never grant XP, Gold, balls or vessels, here or on the server.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import { distanceMeters } from "./data";
import { GAME_ACTION_RADIUS_M, type Coords } from "./game";
import { privateRun, runClock } from "./huntClock";

/** Flipped to true by Codex's `P2` session once the player RPCs are applied. */
export const HUNT_PRIVATE_BACKEND = false;

export type MissionType = "arrive" | "spin" | "puzzle";
export type Waypoint = {
  id: string; ordinal: number; lat: number; lng: number; name: string;
  mission_type: MissionType; points: number;
  description?: string | null; image?: string | null;
  /** Arrive quests only: "gps_qr" also needs the QR code the organizer left at the spot. */
  arrive_check?: "gps" | "gps_qr" | null;
  /** Puzzles only. The answer itself never leaves the server. */
  puzzle_kind?: "text" | "choice" | null; choices?: string[] | null;
  /** Mine, not anyone else's. */
  done_at?: string | null; tries?: number; wait_until?: string | null;
};
export type PrivateHunt = {
  id: string; name: string; description?: string | null; cover?: string | null;
  area: { lat: number; lng: number; radius_m: number };
  route_mode: "any" | "ordered";
  leaderboard_visible: boolean;
  starts_at: string; ends_at: string;
  /** The organizer's optional per-player limit, in the same shape as a system hunt's clock. */
  time_limit_min?: number | null; run_started_at?: string | null; run_ends_at?: string | null;
  join_code?: string | null;
  joined_at: string | null; finished_at: string | null;
  points: number;
  waypoints: Waypoint[];
  /** Counted on this device only, before the backend is live. */
  preview?: boolean;
};
/** `avatar` is the player's profile avatar record, the same shape the Avatar component takes. */
export type LeaderRow = { user: string; name: string; avatar?: Record<string, unknown> | null; points: number; duration_s?: number | null; you?: boolean };
export type MissionResult = { hunt: PrivateHunt; points_gained: number; tries_left: number; wait_s: number };

// "hunt_locked" comes before "locked", since codes are matched by substring.
const CODES = ["bad_code", "too_far", "closed", "not_joined", "hunt_locked", "locked", "already_done", "wrong_answer", "no_tries", "not_started", "time_up", "wrong_qr", "not_allowed", "not_ready", "too_many", "unknown"] as const;
export type PrivateHuntErrorCode = typeof CODES[number];
export class PrivateHuntError extends Error { constructor(public code: PrivateHuntErrorCode) { super(code); } }

// ---------- pure helpers (shared by the live path and the demo) ----------
/** Points on offer across every mission. */
export const totalPoints = (h: PrivateHunt) => h.waypoints.reduce((sum, w) => sum + w.points, 0);
export const doneCount = (h: PrivateHunt) => h.waypoints.filter((w) => w.done_at).length;
/** Waypoints in the order a player meets them: the organizer's order, then by name for a tidy list. */
export const inOrder = (h: PrivateHunt) => [...h.waypoints].sort((a, b) => a.ordinal - b.ordinal || a.name.localeCompare(b.name));
/**
 * An "in order" route hides nothing, but only the next unfinished waypoint can be completed; its pin is
 * drawn with a dashed outline until then. An "any order" route locks nothing.
 */
export function locked(h: PrivateHunt, w: Waypoint) {
  if (h.route_mode !== "ordered" || w.done_at) return false;
  const next = inOrder(h).find((x) => !x.done_at);
  return next?.id !== w.id;
}
/** Seconds left of a wrong-answer wait, or 0. */
export const waitLeft = (w: Waypoint, now = Date.now()) =>
  w.wait_until ? Math.max(0, Math.ceil((new Date(w.wait_until).getTime() - now) / 1000)) : 0;
/** Points first, then the faster finish, then whoever finished at all. */
export const byRank = (rows: LeaderRow[]) => [...rows].sort((a, b) =>
  b.points - a.points
  || (a.duration_s ?? Infinity) - (b.duration_s ?? Infinity)
  || a.name.localeCompare(b.name));
/** Case, spacing and full-width punctuation ignored, the same rule the server applies. */
export const sameAnswer = (a: string, b: string) => normalise(a) === normalise(b);
const normalise = (s: string) => s.toLowerCase().replace(/\s+/g, "").replace(/[，。、！？,.!?]/g, "");
export const huntOpen = (h: PrivateHunt, now = Date.now()) =>
  now >= new Date(h.starts_at).getTime() && (h.ends_at === "infinity" || now <= new Date(h.ends_at).getTime());
/** What a quest's on-site QR code carries: the server's secret for that quest. */
export const questQr = (token: string) => `timecapsule://quest/${token}`;
/** The token from a scanned QR or a typed code, in any case and with stray spaces or dashes; "" if it can't be one. */
export function questToken(raw: string) {
  const token = raw.trim().replace(/^timecapsule:\/\/quest\//i, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return token.length >= 6 && token.length <= 24 ? token : "";
}
/** A 6-character code, typed in any case and with stray spaces or dashes. */
export const cleanCode = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

// ---------- live ----------
type RpcResult = { data: unknown; error: { message?: string; code?: string } | null };
// Call through the client (never a detached supabase.rpc, which loses its `this`).
const rpc = (fn: string, args?: Record<string, unknown>): Promise<RpcResult> =>
  (supabase as unknown as { rpc: (f: string, a?: Record<string, unknown>) => Promise<RpcResult> }).rpc(fn, args);
const fail = (e: { message?: string } | null) => {
  if (!e) return;
  const m = e.message ?? "";
  throw new PrivateHuntError(CODES.find((c) => m.includes(c)) ?? "unknown");
};
const signedIn = async () => !!(await supabase.auth.getSession()).data.session;
const near = (at: Coords | null, w: { lat: number; lng: number }) =>
  !!at && distanceMeters(at.lat, at.lng, w.lat, w.lng) <= GAME_ACTION_RADIUS_M;

// ---------- demo (device-only) ----------
// One made-up hunt around wherever the player is, so the screens can be walked through before the
// backend lands. Its puzzle answer lives here because there is no server to keep it from the client;
// the live path never sees an answer.
const DEMO_CODE = "DEMO24";
const DEMO_ANSWER = "1901";
/** The demo's park-gate quest asks for this code, as if printed under a QR at the gate. */
const DEMO_QR = "PARKGATE24";
const DEMO_PUZZLE_CHOICES = ["1897", "1901", "1912"];
type DemoProgress = { joined_at: string | null; started_at: string | null; finished_at: string | null; done: Record<string, string>; tries: Record<string, number>; wait: Record<string, string> };
const emptyDemo = (): DemoProgress => ({ joined_at: null, started_at: null, finished_at: null, done: {}, tries: {}, wait: {} });
let demoUser = "";
let demoAt: Coords | null = null;
let demo: DemoProgress = emptyDemo();
const changed = new Set<() => void>();
export const onPrivateHuntChange = (l: () => void) => { changed.add(l); return () => { changed.delete(l); }; };
const demoKey = () => `tc-hunt-private-demo-${demoUser}`;
const saveDemo = () => { void AsyncStorage.setItem(demoKey(), JSON.stringify(demo)).catch(() => {}); changed.forEach((l) => l()); };
const offset = (at: Coords, north: number, east: number) =>
  ({ lat: at.lat + north / 110540, lng: at.lng + east / (111320 * Math.cos(at.lat * Math.PI / 180)) });

function demoHunt(at: Coords): PrivateHunt {
  const spots: [string, MissionType, number, number, number, string][] = [
    ["公園入口 Park gate", "arrive", 10, 60, 30, "走到公園門口的石牌旁。\nWalk to the stone sign by the gate."],
    ["老樹驛站 Old tree", "spin", 15, -50, 70, "在老樹旁轉一次驛站。\nSpin the Waypost beside the old tree."],
    ["紀念碑 Monument", "puzzle", 25, 20, -80, "碑上刻的年份是哪一年？\nWhich year is carved on the monument?"],
  ];
  const waypoints: Waypoint[] = spots.map(([name, mission_type, points, north, east, description], i) => {
    const spot = offset(at, north, east);
    return {
      id: `demo-wp-${i + 1}`, ordinal: i + 1, name, mission_type, points, description,
      // Two quests carry a picture, so the demo shows both pin shapes.
      image: i === 0 ? "tpl:park" : i === 2 ? "tpl:publicArt" : null,
      lat: spot.lat, lng: spot.lng,
      arrive_check: i === 0 ? "gps_qr" : mission_type === "arrive" ? "gps" : null,
      puzzle_kind: mission_type === "puzzle" ? "choice" : null,
      choices: mission_type === "puzzle" ? DEMO_PUZZLE_CHOICES : null,
      done_at: demo.done[`demo-wp-${i + 1}`] ?? null,
      tries: demo.tries[`demo-wp-${i + 1}`] ?? 0,
      wait_until: demo.wait[`demo-wp-${i + 1}`] ?? null,
    };
  });
  const starts_at = new Date(Date.now() - 3_600_000).toISOString(), ends_at = new Date(Date.now() + 6 * 3_600_000).toISOString();
  return {
    ...(demo.started_at ? privateRun(demo.started_at, starts_at, ends_at, 45) : {}),
    id: "demo-private-hunt", name: "示範定向 Demo Hunt", join_code: DEMO_CODE,
    description: "這是一場示範的私人定向，用來試走畫面。進度只存在這支手機。\nA demo private hunt for walking through the screens. Progress stays on this phone.",
    area: { ...at, radius_m: 1200 }, route_mode: "any", leaderboard_visible: true,
    starts_at, ends_at, time_limit_min: 45,
    joined_at: demo.joined_at, finished_at: demo.finished_at,
    points: waypoints.filter((w) => w.done_at).reduce((sum, w) => sum + w.points, 0),
    waypoints, preview: true,
  };
}
const DEMO_RIVALS: LeaderRow[] = [
  { user: "demo-a", name: "阿哲 Jay", points: 50, duration_s: 1_420 },
  { user: "demo-b", name: "Mei", points: 35, duration_s: null },
  { user: "demo-c", name: "Lin", points: 10, duration_s: null },
];

async function loadDemo(userId: string) {
  if (demoUser === userId) return;
  demoUser = userId; demo = emptyDemo();
  try { const raw = await AsyncStorage.getItem(demoKey()); if (raw) demo = { ...emptyDemo(), ...JSON.parse(raw) }; } catch { /* start fresh */ }
}
const demoOrThrow = () => { if (!demoAt) throw new PrivateHuntError("unknown"); return demoHunt(demoAt); };

export const privateHunt = {
  /** Hunts I have joined, newest first. `previewAllowed` is dev or the test account. */
  async mine(args: { userId: string; at: Coords | null; previewAllowed: boolean }): Promise<PrivateHunt[]> {
    demoAt = args.at;
    if (HUNT_PRIVATE_BACKEND && await signedIn()) {
      const { data, error } = await rpc("hunt_private_mine");
      fail(error); return (data as PrivateHunt[] | null) ?? [];
    }
    if (!args.previewAllowed || !args.at) return [];
    await loadDemo(args.userId);
    return demo.joined_at ? [demoHunt(args.at)] : [];
  },
  /**
   * What a code or link points at, before joining. `at` is only used by the demo hunt, which is built
   * around wherever the player is; a link opened cold can arrive before the hunt list has run.
   */
  async preview(code: string, at?: Coords | null): Promise<PrivateHunt> {
    const clean = cleanCode(code);
    if (at) demoAt = at;
    if (clean.length !== 6) throw new PrivateHuntError("bad_code");
    if (HUNT_PRIVATE_BACKEND && await signedIn()) {
      const { data, error } = await rpc("hunt_preview", { p_code: clean });
      fail(error);
      if (!data) throw new PrivateHuntError("bad_code");
      return data as PrivateHunt;
    }
    if (clean !== DEMO_CODE) throw new PrivateHuntError("bad_code");
    return demoOrThrow();
  },
  async join(h: PrivateHunt): Promise<PrivateHunt> {
    if (!h.preview) {
      const { data, error } = await rpc("hunt_join_code", { p_code: h.join_code });
      fail(error); return data as PrivateHunt;
    }
    // People join ahead of a coordinated start; only an ended hunt refuses them.
    if (h.ends_at !== "infinity" && Date.now() > new Date(h.ends_at).getTime()) throw new PrivateHuntError("closed");
    demo.joined_at ??= new Date().toISOString();
    demo.started_at ??= demo.joined_at;
    saveDemo();
    return demoOrThrow();
  },
  /**
   * Finish one mission. The server re-checks the distance, the route order and the answer; nothing here
   * is trusted. `answer` is the player's text or chosen option, for puzzles only; `qr` is the token
   * scanned or typed at a GPS + QR quest.
   */
  async complete(h: PrivateHunt, w: Waypoint, at: Coords | null, answer?: string, qr?: string): Promise<MissionResult> {
    if (!h.preview) {
      if (!at) throw new PrivateHuntError("too_far");
      const { data, error } = await rpc("hunt_mission_complete", {
        p_waypoint: w.id, p_lat: at.lat, p_lng: at.lng, p_accuracy: at.accuracy ?? 10, p_answer: answer ?? null, p_qr: qr ?? null,
      });
      fail(error); return data as MissionResult;
    }
    if (!demo.joined_at) throw new PrivateHuntError("not_joined");
    if (Date.now() < new Date(h.starts_at).getTime()) throw new PrivateHuntError("not_started");
    if (!huntOpen(h)) throw new PrivateHuntError("closed");
    if (w.done_at) throw new PrivateHuntError("already_done");
    // Out of time, the same answer the server gives: the run is over.
    if (runClock(h).state === "up") throw new PrivateHuntError("time_up");
    if (locked(h, w)) throw new PrivateHuntError("locked");
    if (!near(at, w)) throw new PrivateHuntError("too_far");
    if (waitLeft(w)) throw new PrivateHuntError("no_tries");
    if (w.arrive_check === "gps_qr" && questToken(qr ?? "") !== DEMO_QR) throw new PrivateHuntError("wrong_qr");
    if (w.mission_type === "puzzle" && !sameAnswer(answer ?? "", DEMO_ANSWER)) {
      const tries = (demo.tries[w.id] ?? 0) + 1;
      demo.tries[w.id] = tries;
      // Three tries, then a minute's wait, as on the server.
      if (tries % 3 === 0) demo.wait[w.id] = new Date(Date.now() + 60_000).toISOString();
      saveDemo();
      throw new PrivateHuntError("wrong_answer");
    }
    demo.done[w.id] = new Date().toISOString();
    delete demo.wait[w.id];
    const next = demoHunt(demoAt!);
    if (next.waypoints.every((x) => x.done_at)) demo.finished_at = new Date().toISOString();
    saveDemo();
    return { hunt: demoOrThrow(), points_gained: w.points, tries_left: 3, wait_s: 0 };
  },
  /** The organizer can hide this; the server then refuses it. */
  async leaderboard(h: PrivateHunt): Promise<LeaderRow[]> {
    if (!h.preview) {
      const { data, error } = await rpc("hunt_leaderboard", { p_hunt: h.id });
      fail(error); return byRank((data as LeaderRow[] | null) ?? []);
    }
    const duration = demo.finished_at && demo.started_at
      ? Math.round((new Date(demo.finished_at).getTime() - new Date(demo.started_at).getTime()) / 1000) : null;
    return byRank([...DEMO_RIVALS, { user: demoUser, name: "你 You", points: h.points, duration_s: duration, you: true }]);
  },
  async report(h: PrivateHunt): Promise<void> {
    if (h.preview) return;
    const { error } = await rpc("hunt_report", { p_hunt: h.id });
    fail(error);
  },
  /** Private-hunt stamps finished in the demo, shown in the Passport alongside the server's. */
  demoStamps(): { id: string; name: string; at: string }[] {
    return demoAt && demo.finished_at ? [{ id: "demo-private-hunt", name: demoHunt(demoAt).name, at: demo.finished_at }] : [];
  },
};
