import { describe, expect, it } from "vitest";
import { navigationUrl } from "./navigation";

describe("navigation links", () => {
  it("uses the English landmark and city for Google and includes both name and coordinates for Apple", () => {
    const place = { id: "tst-clock", lat: 22.29359, lng: 114.16954, name_en: "Tsim Sha Tsui Clock Tower", city_en: "Hong Kong" };
    const google = new URL(navigationUrl(place, "web"));
    expect(google.searchParams.get("destination")).toBe("Tsim Sha Tsui Clock Tower, Hong Kong");
    expect(google.searchParams.has("destination_place_id")).toBe(false);
    const apple = new URL(navigationUrl(place, "ios"));
    expect(apple.searchParams.get("daddr")).toBe("22.29359,114.16954");
    expect(apple.searchParams.get("q")).toBe("Tsim Sha Tsui Clock Tower, Hong Kong");
  });
  it("uses coordinates for the fictional boutique and unnamed places", () => {
    const place = { id: "aurele-cotai", lat: 22.1477, lng: 113.5609, name_en: "Maison Aurèle Cotai boutique (demo)", city_en: "Macau" };
    expect(new URL(navigationUrl(place, "android")).searchParams.get("destination")).toBe("22.1477,113.5609");
    expect(new URL(navigationUrl(place, "ios")).searchParams.get("q")).toBeNull();
    expect(new URL(navigationUrl({ ...place, id: "unknown", name_en: "", city_en: "" }, "web")).searchParams.get("destination")).toBe("22.1477,113.5609");
  });
});
