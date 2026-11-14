// The organizer's side of a private hunt (docs/design/city-orienteering.md, Part B): create a hunt, put
// its waypoints and missions on the map, publish it as a code, then review how people are doing.
// Signed-in organizers use the server functions in the backend contract; until those are live, a
// device-only draft lets the screens be walked through. Nothing here grants any game reward.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import {
  HUNT_PRIVATE_BACKEND, PrivateHuntError, byRank, cleanCode, totalPoints,
  type LeaderRow, type MissionType, type PrivateHunt, type Waypoint,
} from "./huntPrivate";

export type HuntStatus = "draft" | "published" | "closed";
/** A hunt as its owner sees it: the player's view plus what only the owner may know. */
export type OwnedHunt = PrivateHunt & { status: HuntStatus; joined: number };
/** The editable details of a hunt, without its quests. The area is derived, never typed in. */
export type HuntDraft = {
  name: string; description: string; cover: string | null;
  route_mode: "any" | "ordered";
  leaderboard_visible: boolean;
  starts_at: string; ends_at: string;
  time_limit_min: number | null;
};
/** One quest being edited. `answer` only ever travels organizer → server, never back to players. */
export type WaypointDraft = {
  id?: string; ordinal: number; name: string;
  lat: number; lng: number;
  mission_type: MissionType; points: number; description: string;
  /** Arrive quests check GPS, or GPS plus a QR code the organizer prints and leaves at the spot. */
  arrive_check: "gps" | "gps_qr";
  /** Issued by the server once a GPS + QR quest is saved; the printed code carries it. Only the organizer sees it. */
  qr_token?: string;
  puzzle_kind: "text" | "choice"; choices: string[]; answer: string;
};
export type Review = {
  members: LeaderRow[];
  stats: { joined: number; finished: number; per_waypoint: { id: string; done: number }[] };
};

/** The limits in "Rules and safety"; the server enforces them too. */
export const LIMITS = {
  waypoints: 30, participants: 500, unfinishedHunts: 3,
  name: 60, description: 500, answer: 80, choices: 6, points: 999,
} as const;

/** Six characters with no 0/O or 1/I, so a code read aloud or off a poster cannot be mistyped. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function makeCode(random: () => number = Math.random) {
  let code = "";
  for (let i = 0; i < 6; i++) code += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return code;
}
/** The link an organizer shares. The app and the website both open it. */
export const shareLink = (code: string) => `https://time-capsule-pi-two.vercel.app/hunt/${cleanCode(code)}`;
export const appLink = (code: string) => `timecapsule://hunt/${cleanCode(code)}`;

/**
 * A hunt is as wide as the quests in it, so the organizer never guesses a radius. The centre is the
 * middle of the spread and the radius reaches the furthest quest with a little room to spare.
 */
export function huntArea(waypoints: { lat: number; lng: number }[]): { lat: number; lng: number; radius_m: number } {
  const placed = waypoints.filter((w) => w.lat || w.lng);
  if (!placed.length) return { lat: 0, lng: 0, radius_m: 0 };
  const lat = placed.reduce((sum, w) => sum + w.lat, 0) / placed.length;
  const lng = placed.reduce((sum, w) => sum + w.lng, 0) / placed.length;
  const far = Math.max(...placed.map((w) => metres(lat, lng, w.lat, w.lng)));
  return { lat, lng, radius_m: Math.round(Math.max(200, far * 1.25)) };
}
const metres = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const north = (bLat - aLat) * 110_540;
  const east = (bLng - aLng) * 111_320 * Math.cos(aLat * Math.PI / 180);
  return Math.hypot(north, east);
};

export const nextOrdinal = (waypoints: { ordinal: number }[]) =>
  waypoints.reduce((top, w) => Math.max(top, w.ordinal), 0) + 1;

/** What still has to be filled in before a hunt can go out. Empty means it is ready. */
export type Problem = "name" | "waypoints" | "window" | "tooManyWaypoints";
export function huntProblems(draft: HuntDraft, waypoints: { id?: string }[]): Problem[] {
  const problems: Problem[] = [];
  if (!draft.name.trim()) problems.push("name");
  if (!waypoints.length) problems.push("waypoints");
  if (waypoints.length > LIMITS.waypoints) problems.push("tooManyWaypoints");
  if (draft.ends_at !== "infinity" && new Date(draft.ends_at).getTime() <= new Date(draft.starts_at).getTime()) problems.push("window");
  return problems;
}
export type WaypointProblem = "name" | "place" | "answer" | "choices" | "points";
export function waypointProblems(w: WaypointDraft): WaypointProblem[] {
  const problems: WaypointProblem[] = [];
  if (!w.name.trim()) problems.push("name");
  if (!w.lat && !w.lng) problems.push("place");
  if (!Number.isInteger(w.points) || w.points < 1 || w.points > LIMITS.points) problems.push("points");
  if (w.mission_type === "puzzle") {
    if (!w.answer.trim()) problems.push("answer");
    // A multiple-choice puzzle needs at least two options, and the answer has to be one of them.
    if (w.puzzle_kind === "choice") {
      const filled = w.choices.map((c) => c.trim()).filter(Boolean);
      if (filled.length < 2 || !filled.includes(w.answer.trim())) problems.push("choices");
    }
  }
  return problems;
}
export const canPublish = (draft: HuntDraft, waypoints: { id?: string }[]) => huntProblems(draft, waypoints).length === 0;

/** A fresh hunt, starting on the hour and running for a week. */
export function blankDraft(): HuntDraft {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  return {
    name: "", description: "", cover: null,
    route_mode: "any", leaderboard_visible: true,
    starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 7 * 86_400_000).toISOString(),
    time_limit_min: null,
  };
}
export function blankWaypoint(ordinal: number, at: { lat: number; lng: number } | null): WaypointDraft {
  return {
    ordinal, name: "", lat: at?.lat ?? 0, lng: at?.lng ?? 0,
    mission_type: "arrive", points: 10, description: "", arrive_check: "gps",
    puzzle_kind: "choice", choices: ["", ""], answer: "",
  };
}

// ---------- live ----------
type RpcResult = { data: unknown; error: { message?: string; code?: string } | null };
// Call through the client (never a detached supabase.rpc, which loses its `this`).
const rpc = (fn: string, args?: Record<string, unknown>): Promise<RpcResult> =>
  (supabase as unknown as { rpc: (f: string, a?: Record<string, unknown>) => Promise<RpcResult> }).rpc(fn, args);
const fail = (e: { message?: string } | null) => {
  if (!e) return;
  const m = e.message ?? "";
  throw new PrivateHuntError(/not allowed|permission|can_create/i.test(m) ? "not_allowed" : "unknown");
};
const signedIn = async () => !!(await supabase.auth.getSession()).data.session;

// ---------- device-only drafts ----------
// Until the organizer RPCs land, hunts an organizer makes live on this device so the screens can be
// walked through end to end. They are never visible to anyone else, and no player can join them.
type Stored = { draft: HuntDraft; waypoints: WaypointDraft[]; status: HuntStatus; code: string | null; created_at: string };
let user = "";
let hunts: Record<string, Stored> = {};
const changed = new Set<() => void>();
export const onOwnedHuntsChange = (l: () => void) => { changed.add(l); return () => { changed.delete(l); }; };
const key = () => `tc-hunt-organizer-${user}`;
const save = () => { void AsyncStorage.setItem(key(), JSON.stringify(hunts)).catch(() => {}); changed.forEach((l) => l()); };
async function load(userId: string) {
  if (user === userId) return;
  user = userId; hunts = {};
  try { const raw = await AsyncStorage.getItem(key()); if (raw) hunts = JSON.parse(raw); } catch { /* start fresh */ }
}
/** A stored draft as the rest of the app sees a hunt. */
function asOwned(id: string, s: Stored): OwnedHunt {
  const waypoints: Waypoint[] = s.waypoints.map((w) => ({
    id: w.id ?? `${id}-${w.ordinal}`, ordinal: w.ordinal, name: w.name, lat: w.lat, lng: w.lng,
    mission_type: w.mission_type, points: w.points, description: w.description || null,
    arrive_check: w.mission_type === "arrive" ? w.arrive_check : null,
    puzzle_kind: w.mission_type === "puzzle" ? w.puzzle_kind : null,
    choices: w.mission_type === "puzzle" && w.puzzle_kind === "choice" ? w.choices.filter((c) => c.trim()) : null,
    done_at: null,
  }));
  return {
    id, status: s.status, joined: 0, join_code: s.code,
    name: s.draft.name, description: s.draft.description, cover: s.draft.cover,
    area: huntArea(s.waypoints), route_mode: s.draft.route_mode, leaderboard_visible: s.draft.leaderboard_visible,
    starts_at: s.draft.starts_at, ends_at: s.draft.ends_at, time_limit_min: s.draft.time_limit_min,
    joined_at: null, finished_at: null, points: 0, waypoints, preview: true,
  };
}

export const organizer = {
  /**
   * Whether this account may create hunts. During the pilot it is an allow-list the server owns
   * (`profiles.can_create_hunts`); development and the test account may always try.
   */
  // Read loosely: `profiles.can_create_hunts` arrives with Codex's P1, so the generated types
  // do not carry it yet.
  canCreate(profile: Record<string, unknown> | null | undefined, previewAllowed: boolean) {
    return HUNT_PRIVATE_BACKEND ? profile?.can_create_hunts === true : previewAllowed;
  },
  async mine(userId: string): Promise<OwnedHunt[]> {
    if (HUNT_PRIVATE_BACKEND && await signedIn()) {
      const { data, error } = await rpc("my_hunts");
      fail(error); return (data as OwnedHunt[] | null) ?? [];
    }
    await load(userId);
    return Object.entries(hunts)
      .sort((a, b) => b[1].created_at.localeCompare(a[1].created_at))
      .map(([id, s]) => asOwned(id, s));
  },
  async get(userId: string, id: string): Promise<{ draft: HuntDraft; waypoints: WaypointDraft[]; status: HuntStatus; code: string | null }> {
    if (HUNT_PRIVATE_BACKEND && await signedIn()) {
      const { data, error } = await rpc("hunt_edit_state", { p_hunt: id });
      fail(error); return data as { draft: HuntDraft; waypoints: WaypointDraft[]; status: HuntStatus; code: string | null };
    }
    await load(userId);
    const s = hunts[id];
    if (!s) throw new PrivateHuntError("unknown");
    return { draft: s.draft, waypoints: s.waypoints, status: s.status, code: s.code };
  },
  async create(userId: string, draft: HuntDraft): Promise<string> {
    if (HUNT_PRIVATE_BACKEND && await signedIn()) {
      const { data, error } = await rpc("hunt_create", { p_draft: draft });
      fail(error); return (data as { id: string }).id;
    }
    await load(userId);
    const open = Object.values(hunts).filter((h) => h.status !== "closed").length;
    if (open >= LIMITS.unfinishedHunts) throw new PrivateHuntError("too_many");
    const id = `draft-${Date.now()}`;
    hunts[id] = { draft, waypoints: [], status: "draft", code: null, created_at: new Date().toISOString() };
    save();
    return id;
  },
  async update(userId: string, id: string, draft: HuntDraft): Promise<void> {
    if (HUNT_PRIVATE_BACKEND && await signedIn()) {
      const { error } = await rpc("hunt_update", { p_hunt: id, p_draft: draft });
      fail(error); return;
    }
    await load(userId);
    if (!hunts[id]) throw new PrivateHuntError("unknown");
    hunts[id].draft = draft; save();
  },
  async saveWaypoint(userId: string, id: string, w: WaypointDraft): Promise<void> {
    if (HUNT_PRIVATE_BACKEND && await signedIn()) {
      const { error } = await rpc("hunt_waypoint_save", { p_hunt: id, p_waypoint: w });
      fail(error); return;
    }
    await load(userId);
    const s = hunts[id];
    if (!s) throw new PrivateHuntError("unknown");
    const at = s.waypoints.findIndex((x) => x.id && x.id === w.id);
    if (w.arrive_check === "gps_qr" && !w.qr_token) w = { ...w, qr_token: makeCode() + makeCode() };
    if (at >= 0) s.waypoints[at] = w;
    else {
      if (s.waypoints.length >= LIMITS.waypoints) throw new PrivateHuntError("too_many");
      s.waypoints.push({ ...w, id: `${id}-wp-${Date.now()}` });
    }
    save();
  },
  async deleteWaypoint(userId: string, id: string, waypointId: string): Promise<void> {
    if (HUNT_PRIVATE_BACKEND && await signedIn()) {
      const { error } = await rpc("hunt_waypoint_delete", { p_waypoint: waypointId });
      fail(error); return;
    }
    await load(userId);
    const s = hunts[id];
    if (!s) throw new PrivateHuntError("unknown");
    s.waypoints = s.waypoints.filter((w) => w.id !== waypointId);
    save();
  },
  /** Publishing mints the join code. The server owns the real one; the draft makes a local stand-in. */
  async publish(userId: string, id: string): Promise<string> {
    if (HUNT_PRIVATE_BACKEND && await signedIn()) {
      const { data, error } = await rpc("hunt_publish", { p_hunt: id });
      fail(error); return (data as { join_code: string }).join_code;
    }
    await load(userId);
    const s = hunts[id];
    if (!s) throw new PrivateHuntError("unknown");
    if (!canPublish(s.draft, s.waypoints)) throw new PrivateHuntError("not_ready");
    s.status = "published"; s.code ??= makeCode(); save();
    return s.code;
  },
  async close(userId: string, id: string): Promise<void> {
    if (HUNT_PRIVATE_BACKEND && await signedIn()) {
      const { error } = await rpc("hunt_close", { p_hunt: id });
      fail(error); return;
    }
    await load(userId);
    if (!hunts[id]) throw new PrivateHuntError("unknown");
    hunts[id].status = "closed"; save();
  },
  /** How everyone is doing. The organizer sees names, points and times, never live positions. */
  async review(userId: string, hunt: OwnedHunt): Promise<Review> {
    if (!hunt.preview) {
      const { data, error } = await rpc("hunt_review", { p_hunt: hunt.id });
      fail(error);
      const r = data as Review;
      return { ...r, members: byRank(r.members) };
    }
    await load(userId);
    // A device-only draft has no players yet, so the review is honestly empty.
    return { members: [], stats: { joined: 0, finished: 0, per_waypoint: hunt.waypoints.map((w) => ({ id: w.id, done: 0 })) } };
  },
  /** Points on offer, for the editor's summary line. */
  totalPoints,
};
