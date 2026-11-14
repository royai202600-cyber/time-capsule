import { describe, expect, it } from "vitest";
import { placeLabel, pointPlaceArgs } from "./places";

const at = { lat: 25.0375, lng: 121.5628, detail: "" };

describe("place names", () => {
  it("adds the city and country in Chinese", () =>
    expect(placeLabel({ ...at, name: "台北市民廣場", area: "臺北市, 臺灣" })).toBe("台北市民廣場，臺北市，臺灣"));
  it("adds the city and country in English", () =>
    expect(placeLabel({ ...at, name: "Civic Square", area: "Taipei, Taiwan" })).toBe("Civic Square, Taipei, Taiwan"));
  it("does not repeat a city that is already the name", () =>
    expect(placeLabel({ ...at, name: "臺北市", area: "臺北市, 臺灣" })).toBe("臺北市，臺灣"));
  it("keeps a name with no known area", () => expect(placeLabel({ ...at, name: "25.0375, 121.5628" })).toBe("25.0375, 121.5628"));
  it("sends the full label within the server's limit", () =>
    expect(pointPlaceArgs({ ...at, name: "x".repeat(250), area: "Taipei, Taiwan" }).p_place_name).toHaveLength(200));
});
