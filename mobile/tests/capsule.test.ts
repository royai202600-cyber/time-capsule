import { describe, expect, it, vi } from "vitest";

vi.mock("../src/services/supabase", () => ({ supabase: {} }));

import { capsuleStatus, distanceMeters } from "../src/services/data";
import { distance, formatDate, pointOpeningPlace, status, type Place, type Row } from "../src/features/capsule/model";

const capsule = (changes: Partial<Row> = {}) => ({
  open_at: "2026-11-07T12:00:00.000Z",
  opened_at: null,
  place: null,
  ...changes,
}) as Row;
const place = { lat: 0, lng: 0, radius_m: 100 } as Place;
const near = { lat: 0, lng: 0.0005, accuracy: 20 };
const far = { lat: 0, lng: 0.002, accuracy: 20 };
const before = Date.parse("2026-11-07T11:59:59.000Z");
const at = Date.parse("2026-11-07T12:00:00.000Z");

describe("distance", () => {
  it("measures great-circle distance in metres", () => {
    expect(distanceMeters(0, 0, 0, 0)).toBe(0);
    expect(distanceMeters(0, 0, 0, 1)).toBeCloseTo(111_195, -1);
    expect(distanceMeters(0, 1, 0, 0)).toBeCloseTo(distanceMeters(0, 0, 0, 1), 6);
  });

  it("returns the capsule's distance only with a place and location fix", () => {
    const located = capsule({ place: "test-place" });
    expect(distance(located, near, place)).toBeCloseTo(distanceMeters(0, 0.0005, 0, 0), 6);
    expect(distance(located, null, place)).toBeNull();
    expect(distance(capsule(), near, place)).toBeNull();
  });
});

describe("capsule status", () => {
  it("checks time, place, readiness, and opened state for the recipient", () => {
    expect(status(capsule(), "inbox", null, undefined, before)).toBe("time");
    expect(status(capsule({ place: "test-place" }), "inbox", null, place, at)).toBe("place");
    expect(status(capsule({ place: "test-place" }), "inbox", far, place, at)).toBe("place");
    expect(status(capsule({ place: "test-place" }), "inbox", { ...near, accuracy: 201 }, place, at)).toBe("place");
    expect(status(capsule({ place: "test-place" }), "inbox", near, place, at)).toBe("ready");
    expect(status(capsule(), "inbox", null, undefined, at)).toBe("ready");
    expect(status(capsule({ opened_at: "2026-11-07T12:01:00.000Z" }), "inbox", null, undefined, before)).toBe("opened");
  });

  it("uses the point and 100 m radius for a capsule without a landmark ID", () => {
    const row = capsule({ place_lat: 0, place_lng: 0, place_name: "Opening point" });
    const point = pointOpeningPlace(row);
    expect(point).toMatchObject({ radius_m: 100, name_en: "Opening point" });
    expect(status(row, "inbox", near, point, at)).toBe("ready");
    expect(status(row, "inbox", far, point, at)).toBe("place");
    expect(status(row, "inbox", near, undefined, at)).toBe("place");
    expect(distance(row, near, point)).toBeCloseTo(55.6, 1);
  });

  it("shows the sender's waiting state and preserves the existing service status", () => {
    expect(status(capsule({ place: "test-place" }), "sent", null, place, at)).toBe("waiting");
    const old = { ...capsule({ open_at: "2020-01-01T00:00:00.000Z" }), id: "id", sender: "s", recipient: "r", vessel: "tin", edition_no: null };
    expect(capsuleStatus(old, "in")).toBe("ready");
    expect(capsuleStatus({ ...old, place: "test-place" }, "in", 101)).toBe("place");
    expect(capsuleStatus({ ...old, place: "test-place" }, "in", 100)).toBe("ready");
    expect(capsuleStatus({ ...old, opened_at: "2026-11-07T12:01:00.000Z" }, "in")).toBe("opened");
  });
});

describe("date formatting", () => {
  it("formats the same date in Traditional Chinese and English", () => {
    const iso = "2026-11-07T12:00:00.000Z";
    expect(formatDate(iso, "zh")).toBe("2026/11/7");
    expect(formatDate(iso, "en")).toBe("11/7/2026");
    expect(formatDate(null, "zh")).toBe("");
  });
});
