// City Hunt quests as blue quest pins (docs/design/hunt-loop.md, section 2): after the player checks in with
// the Keeper, the hunt's quests drop onto the map, numbered, purple when done, the Landmark last. The contract
// is Codex's HL-C3 backend. Until it is applied, development builds play a sample kept in memory.
import { CITIES } from "./cityPuzzle";
import type { Hunt } from "./cityHunt";
import { distanceMeters } from "./data";
import { GAME_ACTION_RADIUS_M } from "./game";
import { QUEST_ERRORS, type Quest, type QuestAttempt, type QuestErrorCode, type QuestResult } from "./quests";
import { supabase } from "./supabase";

/** Codex's HL-C3 migrations are applied. Switch on with the app release that shows quest pins. */
export const HUNT_QUESTS_BACKEND = true;
export const HUNT_QUESTS_SAMPLE = !HUNT_QUESTS_BACKEND && typeof __DEV__ !== "undefined" && __DEV__;
export const HUNT_QUESTS = HUNT_QUESTS_BACKEND || HUNT_QUESTS_SAMPLE;

export class QuestError extends Error { constructor(public code: QuestErrorCode) { super(code); } }

export const cityHuntQuests = {
  /** The checked-in player's quests for this run, in order; [] before check-in. */
  async list(h: Hunt): Promise<Quest[]> {
    if (!h.checked_in_at || h.finished_at) return [];
    if (HUNT_QUESTS_BACKEND) {
      const { data, error } = await supabase.rpc("city_hunt_quests" as never, { hunt_id: h.id } as never);
      if (error) throw new QuestError(QUEST_ERRORS.find((c) => error.message.includes(c)) ?? "unknown");
      return ((data as Quest[] | null) ?? []).map((q) => ({ ...q, color: "blue" }));
    }
    return sample.list(h);
  },
  /** At the pin, checked on the server. Catch starts this player's capsules at the pin; Landmark starts the usual fight. */
  async attempt(h: Hunt, payload: QuestAttempt): Promise<QuestResult> {
    if (HUNT_QUESTS_BACKEND) {
      const { data, error } = await supabase.rpc("city_hunt_quest_attempt" as never, { payload } as never);
      if (error) throw new QuestError(QUEST_ERRORS.find((c) => error.message.includes(c)) ?? "unknown");
      return data as QuestResult;
    }
    return sample.attempt(h, payload);
  },
};

// ---- development sample: Arrive ×3, Catch ×5 at one pin, then the Landmark (made-up spots) ----
const runs = new Map<string, Quest[]>();
const offset = (lat: number, lng: number, north: number, east: number) =>
  ({ location_lat: lat + north / 110_540, location_lng: lng + east / (111_320 * Math.cos(lat * Math.PI / 180)) });
const runFor = (h: Hunt): Quest[] => {
  const key = `${h.id}:${h.checked_in_at}`;
  let run = runs.get(key);
  if (run) return run;
  const lm = CITIES.filter((c) => c.playable).sort((a, b) => distanceMeters(h.area.lat, h.area.lng, a.lat, a.lng) - distanceMeters(h.area.lat, h.area.lng, b.lat, b.lng))[0]!;
  const k = h.keeper;
  const base = { image: null, done: false, locked: false, color: "blue" as const };
  // The first Arrive is at least 200 m from the Keeper.
  run = [
    { ...base, quest_id: `${key}-1`, ordinal: 1, type: "arrive", ...offset(k.lat, k.lng, 230, 60), name_zh: "第一站", name_en: "First stop", points: 20 },
    { ...base, quest_id: `${key}-2`, ordinal: 2, type: "arrive", ...offset(k.lat, k.lng, 120, 330), name_zh: "第二站", name_en: "Second stop", points: 20 },
    { ...base, quest_id: `${key}-3`, ordinal: 3, type: "arrive", ...offset(k.lat, k.lng, -150, 280), name_zh: "第三站", name_en: "Third stop", points: 20 },
    { ...base, quest_id: `${key}-4`, ordinal: 4, type: "catch", ...offset(k.lat, k.lng, -60, 120), name_zh: "修復破損膠囊", name_en: "Restore Corrupted Capsules", points: 50, catch_count: 5 },
    { ...base, quest_id: `${key}-5`, ordinal: 5, type: "landmark", location_lat: lm.lat, location_lng: lm.lng, name_zh: lm.landmark_zh ?? lm.name_zh, name_en: lm.landmark_en ?? lm.name_en, points: 100 },
  ];
  runs.set(key, run);
  return run;
};
const sample = {
  async list(h: Hunt) {
    const run = runFor(h);
    const landmarkLocked = run.some((q) => q.type !== "landmark" && !q.done);
    return run.map((q) => ({ ...q, locked: !q.done && q.type === "landmark" && landmarkLocked }));
  },
  async attempt(h: Hunt, payload: QuestAttempt): Promise<QuestResult> {
    const run = runFor(h);
    const q = run.find((x) => x.quest_id === payload.quest_id);
    if (!q) throw new QuestError("bad_rule");
    if (q.done) throw new QuestError("already_done");
    if (q.type === "landmark" && run.some((x) => x.type !== "landmark" && !x.done)) throw new QuestError("locked");
    if (distanceMeters(payload.lat, payload.lng, q.location_lat, q.location_lng) > GAME_ACTION_RADIUS_M) throw new QuestError("too_far");
    // The live server starts the catch or the fight here and finishes the quest from those; the sample counts it done.
    q.done = true;
    return { ok: true, done: true, points: q.points };
  },
};
