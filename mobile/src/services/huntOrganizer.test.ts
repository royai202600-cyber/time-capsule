import { describe, expect, it, vi } from "vitest";
// The rules under test are pure; these two keep the module's native imports out of the test run.
vi.mock("@react-native-async-storage/async-storage", () => ({ default: { getItem: vi.fn(), setItem: vi.fn() } }));
vi.mock("./supabase", () => ({ supabase: { auth: { getSession: vi.fn() }, rpc: vi.fn() } }));
import { LIMITS, appLink, blankDraft, huntArea, blankWaypoint, canPublish, huntProblems, makeCode, nextOrdinal, shareLink, waypointProblems, type HuntDraft, type WaypointDraft } from "./huntOrganizer";

const draft = (over: Partial<HuntDraft> = {}): HuntDraft => ({ ...blankDraft(), name: "Park hunt", ...over });
const wp = (over: Partial<WaypointDraft> = {}): WaypointDraft => ({ ...blankWaypoint(1, { lat: 25, lng: 121 }), name: "Gate", ...over });

describe("join codes", () => {
  it("is six characters", () => expect(makeCode()).toHaveLength(6));
  it("never uses characters that can be misread", () => {
    // 600 codes is plenty to catch a stray 0/O/1/I in the alphabet.
    const all = Array.from({ length: 600 }, () => makeCode()).join("");
    expect(all).not.toMatch(/[01OI]/);
    expect(all).toMatch(/^[A-Z2-9]+$/);
  });
  it("spans the whole alphabet", () => {
    // 2000 codes is 12000 characters; missing one of 32 would mean the alphabet is wrong, not bad luck.
    const seen = new Set(Array.from({ length: 2000 }, () => makeCode()).join(""));
    expect(seen.size).toBe(32);
  });
});

describe("share links", () => {
  it("builds a web link from a loosely typed code", () => expect(shareLink(" park-24 ")).toBe("https://time-capsule-pi-two.vercel.app/hunt/PARK24"));
  it("builds an app link too", () => expect(appLink("park24")).toBe("timecapsule://hunt/PARK24"));
});

describe("what blocks publishing", () => {
  it("passes a filled-in hunt with one waypoint", () => {
    expect(huntProblems(draft(), [{ id: "a" }])).toEqual([]);
    expect(canPublish(draft(), [{ id: "a" }])).toBe(true);
  });
  it("needs a name", () => expect(huntProblems(draft({ name: "  " }), [{ id: "a" }])).toContain("name"));
  it("needs at least one waypoint", () => expect(huntProblems(draft(), [])).toContain("waypoints"));
  it("refuses more waypoints than the limit", () =>
    expect(huntProblems(draft(), Array.from({ length: LIMITS.waypoints + 1 }, (_, i) => ({ id: String(i) })))).toContain("tooManyWaypoints"));
  it("refuses an end before the start", () =>
    expect(huntProblems(draft({ starts_at: "2026-12-01T00:00:00Z", ends_at: "2026-11-01T00:00:00Z" }), [{ id: "a" }])).toContain("window"));
  it("refuses a hunt that never ends", () =>
    expect(huntProblems(draft({ ends_at: "infinity" }), [{ id: "a" }])).toContain("window"));
});

describe("what blocks a waypoint", () => {
  it("passes a plain arrive mission", () => expect(waypointProblems(wp())).toEqual([]));
  it("needs a name", () => expect(waypointProblems(wp({ name: "" }))).toContain("name"));
  it("needs a place", () => expect(waypointProblems(wp({ lat: 0, lng: 0 }))).toContain("place"));
  it("refuses points beyond the limit", () => expect(waypointProblems(wp({ points: LIMITS.points + 1 }))).toContain("points"));
  it("needs an answer for a puzzle", () =>
    expect(waypointProblems(wp({ mission_type: "puzzle", puzzle_kind: "text", answer: " " }))).toContain("answer"));
  it("accepts a free-text puzzle with an answer", () =>
    expect(waypointProblems(wp({ mission_type: "puzzle", puzzle_kind: "text", answer: "1901" }))).toEqual([]));
  it("needs two options on a multiple-choice puzzle", () =>
    expect(waypointProblems(wp({ mission_type: "puzzle", puzzle_kind: "choice", answer: "1901", choices: ["1901", ""] }))).toContain("choices"));
  it("needs the answer to be one of the options", () =>
    expect(waypointProblems(wp({ mission_type: "puzzle", puzzle_kind: "choice", answer: "1912", choices: ["1897", "1901"] }))).toContain("choices"));
  it("accepts a multiple-choice puzzle whose answer is an option", () =>
    expect(waypointProblems(wp({ mission_type: "puzzle", puzzle_kind: "choice", answer: "1901", choices: ["1897", "1901", "1912"] }))).toEqual([]));
  it("keeps a saved puzzle's answer when it is left blank", () => {
    expect(waypointProblems(wp({ id: "w1", mission_type: "puzzle", puzzle_kind: "text", answer: "" }))).toEqual([]);
    expect(waypointProblems(wp({ id: "w1", mission_type: "puzzle", puzzle_kind: "choice", answer: "", choices: ["1897", "1901"] }))).toEqual([]);
    expect(waypointProblems(wp({ id: "w1", mission_type: "puzzle", puzzle_kind: "choice", answer: "", choices: ["1897", ""] }))).toContain("choices");
  });
  it("ignores puzzle fields on a non-puzzle mission", () =>
    expect(waypointProblems(wp({ mission_type: "spin", answer: "", choices: [] }))).toEqual([]));
});

describe("ordinals", () => {
  it("starts at one", () => expect(nextOrdinal([])).toBe(1));
  it("follows the highest so far, not the count", () => expect(nextOrdinal([{ ordinal: 1 }, { ordinal: 7 }])).toBe(8));
});

describe("huntArea", () => {
  it("is empty with no placed quests", () => {
    expect(huntArea([{ lat: 0, lng: 0 }]).radius_m).toBe(0);
  });
  it("reaches the furthest quest with room to spare, and is never tiny", () => {
    expect(huntArea([{ lat: 25.03, lng: 121.56 }]).radius_m).toBe(200);
    const a = huntArea([{ lat: 25.03, lng: 121.56 }, { lat: 25.04, lng: 121.56 }]);
    expect(a.lat).toBeCloseTo(25.035);
    expect(a.radius_m).toBeGreaterThan(680);
    expect(a.radius_m).toBeLessThan(700);
  });
});
