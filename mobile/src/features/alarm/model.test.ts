import { describe, expect, it } from "vitest";
import { clampTime, describeDays, everyDay, nextRing, untilText } from "./model";

describe("alarm model", () => {
  it("wraps the time stepper around midnight", () => {
    expect(clampTime(23, 60)).toEqual({ hour: 0, minute: 0 });
    expect(clampTime(0, -5)).toEqual({ hour: 23, minute: 55 });
    expect(clampTime(-1, 0)).toEqual({ hour: 23, minute: 0 });
  });
  it("names common repeats", () => {
    expect(describeDays([0, 1, 2, 3, 4, 5, 6], "zh")).toBe("每天");
    expect(describeDays([5, 1, 2, 3, 4], "en")).toBe("Weekdays");
    expect(describeDays([6, 0], "en")).toBe("Weekends");
    expect(describeDays([1, 3], "zh")).toBe("週一、週三");
    expect(everyDay([0, 1, 2, 3, 4, 5])).toBe(false);
  });
  it("finds the next ring", () => {
    const from = new Date(2026, 10, 7, 8, 0); // Saturday 08:00
    expect(nextRing({ hour: 7, minute: 0, days: [0, 1, 2, 3, 4, 5, 6] }, from)).toEqual(new Date(2026, 10, 8, 7, 0));
    expect(nextRing({ hour: 9, minute: 30, days: [6] }, from)).toEqual(new Date(2026, 10, 7, 9, 30));
    expect(nextRing({ hour: 7, minute: 0, days: [1] }, from)).toEqual(new Date(2026, 10, 9, 7, 0));
    expect(nextRing({ hour: 8, minute: 0, days: [6] }, from)).toEqual(new Date(2026, 10, 14, 8, 0));
    expect(nextRing({ hour: 7, minute: 0, days: [] }, from)).toBeNull();
  });
  it("counts down in both languages", () => {
    const from = new Date(2026, 10, 7, 23, 0);
    expect(untilText(new Date(2026, 10, 8, 6, 20), "zh", from)).toBe("7 小時 20 分鐘後響起");
    expect(untilText(new Date(2026, 10, 8, 0, 0), "en", from)).toBe("Rings in 1 h");
  });
});
