import { describe, expect, it } from "vitest";
import { clockText, runClock, runningLow } from "./huntClock";

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

describe("clockText", () => {
  it("formats minutes and hours", () => {
    expect(clockText(754)).toBe("12:34");
    expect(clockText(3725)).toBe("1:02:05");
    expect(clockText(-3)).toBe("0:00");
  });
});
