import { describe, expect, it } from "vitest";
import { clockText, privateRun, runClock, runningLow } from "./huntClock";

const start = "2026-11-14T10:00:00Z", t0 = new Date(start).getTime();
const run = { time_limit_min: 60, checked_in_at: start, finished_at: null };

describe("runClock", () => {
  it("has no clock without a limit, before check-in or once finished", () => {
    expect(runClock({ ...run, time_limit_min: null }, t0).state).toBe("none");
    expect(runClock({ ...run, checked_in_at: null }, t0).state).toBe("none");
    expect(runClock({ ...run, finished_at: start }, t0).state).toBe("none");
  });
  it("counts down from check-in", () => {
    expect(runClock(run, t0 + 15 * 60_000)).toEqual({ state: "running", left_s: 45 * 60, total_s: 3600 });
  });
  it("prefers the server's run times", () => {
    const h = { ...run, run_started_at: "2026-11-14T11:00:00Z", run_ends_at: "2026-11-14T11:30:00Z" };
    expect(runClock(h, new Date("2026-11-14T11:10:00Z").getTime())).toMatchObject({ state: "running", left_s: 20 * 60 });
  });
  it("is up at the limit", () => {
    expect(runClock(run, t0 + 60 * 60_000).state).toBe("up");
  });
  it("runs low in the last five minutes", () => {
    expect(runningLow(runClock(run, t0 + 54 * 60_000))).toBe(false);
    expect(runningLow(runClock(run, t0 + 56 * 60_000))).toBe(true);
  });
});

describe("private runs", () => {
  const starts = "2026-11-14T12:00:00Z", ends = "2026-11-14T15:00:00Z";
  it("start at the hunt's start when joined early, and stop at the limit", () => {
    expect(privateRun("2026-11-14T09:00:00Z", starts, ends, 45)).toEqual({ run_started_at: "2026-11-14T12:00:00.000Z", run_ends_at: "2026-11-14T12:45:00.000Z" });
  });
  it("are cut short by the hunt's end", () => {
    expect(privateRun("2026-11-14T14:40:00Z", starts, ends, 45).run_ends_at).toBe("2026-11-14T15:00:00.000Z");
  });
  it("count down to the hunt's end when there is no limit", () => {
    const r = privateRun("2026-11-14T13:00:00Z", starts, ends, null);
    expect(r.run_ends_at).toBe("2026-11-14T15:00:00.000Z");
    expect(runClock({ ...r, time_limit_min: null, finished_at: null }, new Date("2026-11-14T14:00:00Z").getTime())).toMatchObject({ state: "running", left_s: 3600 });
  });
  it("have no clock before they start, or with no limit and no end", () => {
    const r = privateRun("2026-11-14T09:00:00Z", starts, ends, 45);
    expect(runClock({ ...r, finished_at: null }, new Date("2026-11-14T10:00:00Z").getTime()).state).toBe("none");
    expect(privateRun(starts, starts, "infinity", null).run_ends_at).toBeNull();
  });
});

describe("clockText", () => {
  it("formats minutes and hours", () => {
    expect(clockText(754)).toBe("12:34");
    expect(clockText(3725)).toBe("1:02:05");
    expect(clockText(-3)).toBe("0:00");
  });
});
