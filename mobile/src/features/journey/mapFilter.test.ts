import { describe, expect, it } from "vitest";
import { filterCounts, shows } from "./mapFilter";

describe("map filter", () => {
  it("shows everything by default", () => {
    expect(shows("all", "quest")).toBe(true);
    expect(shows("all", "publicCapsule")).toBe(true);
  });
  it("keeps each hunt to its own pins", () => {
    expect(shows("cityHunt", "keeper")).toBe(true);
    expect(shows("cityHunt", "corrupted")).toBe(true);
    expect(shows("cityHunt", "quest")).toBe(false);
    expect(shows("privateHunt", "quest")).toBe(true);
    expect(shows("privateHunt", "waypost")).toBe(false);
    expect(shows("capsules", "place")).toBe(true);
    expect(shows("capsules", "landmark")).toBe(false);
  });
  it("counts what each choice would show", () => {
    const pins = [{ kind: "publicCapsule" }, { kind: "place" }, { kind: "waypost" }, { kind: "quest" }, { kind: "quest" }] as const;
    expect(filterCounts([...pins])).toEqual({ all: 5, capsules: 2, cityHunt: 1, privateHunt: 2 });
  });
});
