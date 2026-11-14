// The organizer's side of a private hunt (docs/design/city-orienteering.md, Part B): create a hunt, put
// its quest pins on the map, publish it as a code, then review how people are doing.
// Organizers use the server functions. Nothing here grants any game reward.
import { supabase } from "./supabase";
import {
  PrivateHuntError, byRank, cleanCode, totalPoints,
  type GuideMode, type LeaderRow, type PrivateHuntQuestType, type PrivateHunt, type Quest,
} from "./privateHunt";

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
  /** Fixed: the guide waits at guide_lat/lng. Near: the guide appears beside each player, with no spot of its own. */
  guide_mode: GuideMode; guide_lat: number | null; guide_lng: number | null;
};
/** One quest being edited. `answer` only ever travels organizer → server, never back to players. */
export type QuestDraft = {
  id?: string; ordinal: number; name: string;
  /** Null for a catch quest, which has no spot. */
  location_lat: number | null; location_lng: number | null;
  /** Catch quests only: how many Corrupted Capsules to catch inside the hunt area. */
  catch_count?: number | null;
  quest_type: PrivateHuntQuestType; points: number; description: string;
  /** Arrive quests check GPS, or GPS plus a QR code the organizer prints and leaves at the spot. */
  arrive_check: "gps" | "gps_qr";
  /** Issued by the server once a GPS + QR quest is saved; the printed code carries it. Only the organizer sees it. */
  qr_token?: string;
  /** A template ("tpl:park", the default) or the organizer's own photo; it fills the quest's pin on the map. */
  image?: string | null;
  puzzle_kind: "text" | "choice"; choices: string[]; answer: string;
};
export type Review = {
  members: LeaderRow[];
  stats: { joined: number; finished: number; per_quest: { id: string; done: number }[] };
};

/** The limits in "Rules and safety"; the server enforces them too. */
export const LIMITS = {
  quests: 30, participants: 500, unfinishedHunts: 3,
  name: 60, description: 500, answer: 80, choices: 6, points: 999, catches: 20,
} as const;

/** The link an organizer shares. The app and the website both open it. */
export const shareLink = (code: string) => `https://time-capsule-pi-two.vercel.app/hunt/${cleanCode(code)}`;
export const appLink = (code: string) => `timecapsule://hunt/${cleanCode(code)}`;

/**
 * A hunt is as wide as the quests in it, so the organizer never guesses a radius. The centre is the
 * middle of the spread and the radius reaches the furthest quest with a little room to spare.
 */
export function huntArea(quests: { lat: number; lng: number }[]): { lat: number; lng: number; radius_m: number } {
  const placed = quests.filter((w) => w.lat || w.lng);
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

export const nextOrdinal = (quests: { ordinal: number }[]) =>
  quests.reduce((top, w) => Math.max(top, w.ordinal), 0) + 1;

/** What still has to be filled in before a hunt can go out. Empty means it is ready. */
export type Problem = "name" | "quests" | "window" | "tooManyQuests" | "guideArea";
export function huntProblems(draft: HuntDraft, quests: Pick<QuestDraft, "location_lat" | "location_lng">[]): Problem[] {
  const problems: Problem[] = [];
  if (!draft.name.trim()) problems.push("name");
  if (!quests.length) problems.push("quests");
  // A guide who appears near players needs an area to appear in, and only quest pins make one.
  else if (draft.guide_mode !== "fixed" && !quests.some(hasSpot)) problems.push("guideArea");
  if (quests.length > LIMITS.quests) problems.push("tooManyQuests");
  // A private hunt always ends: the server refuses "infinity" (only daily City Hunts run without an end).
  const end = new Date(draft.ends_at).getTime();
  if (!Number.isFinite(end) || end <= new Date(draft.starts_at).getTime()) problems.push("window");
  return problems;
}
export type QuestProblem = "name" | "place" | "answer" | "choices" | "points" | "catches";
export function questProblems(w: QuestDraft): QuestProblem[] {
  const problems: QuestProblem[] = [];
  if (!w.name.trim()) problems.push("name");
  if (w.quest_type === "restore") {
    const n = w.catch_count ?? 0;
    if (!Number.isInteger(n) || n < 1 || n > LIMITS.catches) problems.push("catches");
  } else if (!hasSpot(w)) problems.push("place");
  if (!Number.isInteger(w.points) || w.points < 1 || w.points > LIMITS.points) problems.push("points");
  if (w.quest_type === "puzzle") {
    // The server never sends a saved answer back, so a saved puzzle left blank keeps the answer it has.
    const keeps = !!w.id && !w.answer.trim();
    if (!w.answer.trim() && !keeps) problems.push("answer");
    // A multiple-choice puzzle needs at least two options, and the answer has to be one of them.
    if (w.puzzle_kind === "choice") {
      const filled = w.choices.map((c) => c.trim()).filter(Boolean);
      if (filled.length < 2 || (!keeps && !filled.includes(w.answer.trim()))) problems.push("choices");
    }
  }
  return problems;
}
export const canPublish = (draft: HuntDraft, quests: Pick<QuestDraft, "location_lat" | "location_lng">[]) => huntProblems(draft, quests).length === 0;
/** A quest with a spot on the map. */
export const hasSpot = (w: Pick<QuestDraft, "location_lat" | "location_lng">) => w.location_lat != null && w.location_lng != null;
/** What goes to the server: a catch quest drops any spot, every other kind drops the catch count. */
export const questForSave = (w: QuestDraft): QuestDraft => w.quest_type === "restore"
  ? { ...w, location_lat: null, location_lng: null, catch_count: w.catch_count ?? 5 }
  : { ...w, catch_count: null };

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
    guide_mode: "near", guide_lat: null, guide_lng: null,
  };
}
export function blankQuest(ordinal: number, at: { lat: number; lng: number } | null): QuestDraft {
  return {
    ordinal, name: "", location_lat: at?.lat ?? null, location_lng: at?.lng ?? null,
    quest_type: "arrive", points: 10, description: "", arrive_check: "gps", image: "tpl:park",
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
  throw new PrivateHuntError(/hunt_locked/.test(m) ? "hunt_locked" : /area_required/.test(m) ? "area_required" : /not allowed|permission|can_create/i.test(m) ? "not_allowed" : "unknown");
};
export const organizer = {
  /** Whether this account is on the server-owned organizer allow-list. */
  canCreate(profile: Record<string, unknown> | null | undefined) {
    return profile?.can_create_hunts === true;
  },
  async mine(userId: string): Promise<OwnedHunt[]> {
    const { data, error } = await rpc("private_hunt_organized");
    fail(error); return (data as OwnedHunt[] | null) ?? [];
  },
  /** `locked`: someone has joined, so the route, times and quests can no longer change (the server refuses with hunt_locked). */
  async get(userId: string, id: string): Promise<{ draft: HuntDraft; quests: QuestDraft[]; status: HuntStatus; code: string | null; locked?: boolean }> {
    const { data, error } = await rpc("private_hunt_edit_state", { p_hunt: id });
    fail(error); return data as { draft: HuntDraft; quests: QuestDraft[]; status: HuntStatus; code: string | null; locked: boolean };
  },
  async create(userId: string, draft: HuntDraft): Promise<string> {
    const { data, error } = await rpc("private_hunt_create", { p_draft: draft });
    fail(error); return (data as { id: string }).id;
  },
  async update(userId: string, id: string, draft: HuntDraft): Promise<void> {
    const { error } = await rpc("private_hunt_update", { p_hunt: id, p_draft: draft });
    fail(error); return;
  },
  async saveQuest(userId: string, id: string, w: QuestDraft): Promise<void> {
    const { error } = await rpc("private_hunt_quest_save", { p_hunt: id, p_quest: questForSave(w) });
    fail(error); return;
  },
  async deleteQuest(userId: string, id: string, questId: string): Promise<void> {
    const { error } = await rpc("private_hunt_quest_delete", { p_quest: questId });
    fail(error); return;
  },
  /** Publishing mints the join code on the server. */
  async publish(userId: string, id: string): Promise<string> {
    const { data, error } = await rpc("private_hunt_publish", { p_hunt: id });
    fail(error); return (data as { join_code: string }).join_code;
  },
  async close(userId: string, id: string): Promise<void> {
    const { error } = await rpc("private_hunt_close", { p_hunt: id });
    fail(error); return;
  },
  /** How everyone is doing. The organizer sees names, points and times, never live positions. */
  async review(userId: string, hunt: OwnedHunt): Promise<Review> {
    const { data, error } = await rpc("private_hunt_review", { p_hunt: hunt.id });
    fail(error);
    const r = data as Review;
    return { ...r, members: byRank(r.members) };
  },
  /** Points on offer, for the editor's summary line. */
  totalPoints,
};
