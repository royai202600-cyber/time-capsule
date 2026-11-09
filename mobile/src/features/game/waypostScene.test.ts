import { describe, expect, it } from "vitest";
import { sceneKey } from "./waypostScene";

const w = (name_en: string, name_zh = "", place: string | null = null) => ({ name_en, name_zh, place });

describe("sceneKey", () => {
  it("uses the landmark's own picture", () => expect(sceneKey(w("Taipei Riverside", "", "taipei101"))).toBe("taipei101"));
  it("reads the kind of place from the name", () => {
    expect(sceneKey(w("Taipei Civic Square"))).toBe("square");
    expect(sceneKey(w("Botanic Gardens"))).toBe("garden");
    expect(sceneKey(w("", "碧潭河濱"))).toBe("waterfront");
  });
  it("prefers the saved scene, and ignores an unknown one", () => {
    expect(sceneKey({ ...w("Taipei Civic Square"), scene: "garden" })).toBe("garden");
    expect(sceneKey({ ...w("Taipei Civic Square"), scene: "moon" })).toBe("square");
  });
  it("falls back to the park", () => expect(sceneKey(w("Somewhere"))).toBe("park"));
});
