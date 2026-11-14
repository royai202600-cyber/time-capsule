import { describe, expect, it, vi } from "vitest";
// The helpers under test are pure; these two keep the module's native imports out of the test run.
vi.mock("@react-native-async-storage/async-storage", () => ({ default: { getItem: vi.fn(), setItem: vi.fn() } }));
vi.mock("./supabase", () => ({ supabase: { auth: { getSession: vi.fn() }, rpc: vi.fn() } }));
import { byRank, cleanCode, doneCount, huntOpen, huntStillOn, inOrder, locked, sameAnswer, totalPoints, waitLeft, type LeaderRow, type PrivateHunt, type Waypoint, questQr, questToken, qrGroups } from "./huntPrivate";

const wp = (id: string, ordinal: number, points: number, done?: string | null): Waypoint =>
  ({ id, ordinal, points, name: id, lat: 25, lng: 121, mission_type: "arrive", done_at: done ?? null });
const hunt = (route: "any" | "ordered", waypoints: Waypoint[]): PrivateHunt => ({
  id: "h", name: "Hunt", area: { lat: 25, lng: 121, radius_m: 500 }, route_mode: route,
  leaderboard_visible: true, starts_at: "2026-01-01T00:00:00Z", ends_at: "2027-01-01T00:00:00Z",
  joined_at: null, finished_at: null, points: 0, waypoints,
});

describe("points and progress", () => {
  const h = hunt("any", [wp("a", 1, 10, "2026-11-14T00:00:00Z"), wp("b", 2, 15), wp("c", 3, 25)]);
  it("adds up every mission's points", () => expect(totalPoints(h)).toBe(50));
  it("counts the finished missions", () => expect(doneCount(h)).toBe(1));
});

describe("route order", () => {
  it("locks nothing in an any-order hunt", () => {
    const h = hunt("any", [wp("a", 1, 10), wp("b", 2, 10)]);
    expect(h.waypoints.map((w) => locked(h, w))).toEqual([false, false]);
  });
  it("leaves only the next waypoint open in an ordered hunt", () => {
    const h = hunt("ordered", [wp("a", 1, 10, "2026-11-14T00:00:00Z"), wp("b", 2, 10), wp("c", 3, 10)]);
    expect(h.waypoints.map((w) => locked(h, w))).toEqual([false, false, true]);
  });
  it("sorts by the organizer's ordinal", () => {
    const h = hunt("ordered", [wp("c", 3, 10), wp("a", 1, 10), wp("b", 2, 10)]);
    expect(inOrder(h).map((w) => w.id)).toEqual(["a", "b", "c"]);
  });
});

describe("wrong-answer wait", () => {
  const now = Date.parse("2026-11-14T12:00:00Z");
  it("is zero with no wait set", () => expect(waitLeft(wp("a", 1, 10), now)).toBe(0));
  it("counts the seconds left", () =>
    expect(waitLeft({ ...wp("a", 1, 10), wait_until: "2026-11-14T12:00:45Z" }, now)).toBe(45));
  it("is zero once it has passed", () =>
    expect(waitLeft({ ...wp("a", 1, 10), wait_until: "2026-11-14T11:59:00Z" }, now)).toBe(0));
});

describe("answers", () => {
  it("ignores case and spacing", () => expect(sameAnswer("  Taipei  101 ", "taipei101")).toBe(true));
  it("ignores punctuation in both languages", () => expect(sameAnswer("一九零一年，對", "一九零一年對")).toBe(true));
  it("still tells different answers apart", () => expect(sameAnswer("1901", "1912")).toBe(false));
});

describe("leaderboard", () => {
  const rows: LeaderRow[] = [
    { user: "a", name: "A", points: 35, duration_s: null },
    { user: "b", name: "B", points: 50, duration_s: 1_500 },
    { user: "c", name: "C", points: 50, duration_s: 900 },
  ];
  it("ranks by points, then by the faster finish", () =>
    expect(byRank(rows).map((r) => r.user)).toEqual(["c", "b", "a"]));
  it("puts an unfinished player behind a finished one on equal points", () =>
    expect(byRank([{ user: "a", name: "A", points: 50, duration_s: null }, { user: "b", name: "B", points: 50, duration_s: 1_200 }])
      .map((r) => r.user)).toEqual(["b", "a"]));
});

describe("codes", () => {
  it("accepts a code typed loosely", () => expect(cleanCode(" demo-24 ")).toBe("DEMO24"));
  it("stops at six characters", () => expect(cleanCode("ABCDEFGH")).toBe("ABCDEF"));
});

describe("open window", () => {
  const h = hunt("any", []);
  it("is closed before it starts", () => expect(huntOpen(h, Date.parse("2025-06-01T00:00:00Z"))).toBe(false));
  it("is open inside the window", () => expect(huntOpen(h, Date.parse("2026-06-01T00:00:00Z"))).toBe(true));
  it("is closed after it ends", () => expect(huntOpen(h, Date.parse("2028-01-01T00:00:00Z"))).toBe(false));
  it("treats infinity as never ending", () =>
    expect(huntOpen({ ...h, ends_at: "infinity" }, Date.parse("2099-01-01T00:00:00Z"))).toBe(true));
});

describe("quest pins on the map", () => {
  const h = hunt("any", []), mid = Date.parse("2026-06-01T00:00:00Z");
  it("show while the hunt is on", () => expect(huntStillOn(h, mid)).toBe(true));
  it("go once the hunt has ended", () => expect(huntStillOn(h, Date.parse("2028-01-01T00:00:00Z"))).toBe(false));
  it("go once you finish", () => expect(huntStillOn({ ...h, finished_at: "2026-05-31T00:00:00Z" }, mid)).toBe(false));
  it("go once your own time runs out", () => expect(huntStillOn({ ...h, run_ends_at: "2026-05-31T00:00:00Z" }, mid)).toBe(false));
});

describe("quest QR codes", () => {
  it("reads the token from a scanned QR or a typed code", () => {
    expect(questToken(questQr("PARKGATE24"))).toBe("PARKGATE24");
    expect(questToken(" park-gate 24 ")).toBe("PARKGATE24");
  });
  it("rejects things that can't be a token", () => {
    expect(questToken("abc")).toBe("");
    expect(questToken("https://example.com/some/very/long/path/that/is/not/ours")).toBe("");
  });
});

describe("server QR tokens", () => {
  const token = "9f86d081884c7d659a2feaa0c55ad015";
  it("accepts the 32 hex characters the server issues, scanned or typed in groups", () => {
    expect(questToken(questQr(token))).toBe(token.toUpperCase());
    expect(questToken(qrGroups(token))).toBe(token.toUpperCase());
  });
  it("prints the code in groups of four", () => expect(qrGroups(token)).toBe("9F86 D081 884C 7D65 9A2F EAA0 C55A D015"));
});
