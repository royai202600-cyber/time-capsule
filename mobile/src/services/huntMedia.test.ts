import { describe, expect, it, vi } from "vitest";
// Only the pure helper is tested; these keep the module's native imports out of the test run.
vi.mock("expo-crypto", () => ({ randomUUID: () => "00000000-0000-4000-8000-000000000000" }));
vi.mock("./supabase", () => ({ supabase: { auth: { getSession: vi.fn() }, storage: { from: vi.fn() } } }));
import { isMediaPath } from "./huntMedia";

describe("quest photos", () => {
  it("knows a stored photo from a template or a data URL", () => {
    expect(isMediaPath("0b9c2c9e-1111-4222-8333-944445555666/1a2b3c4d-1111-4222-8333-944445555666.jpg")).toBe(true);
    expect(isMediaPath("tpl:park")).toBe(false);
    expect(isMediaPath("data:image/jpeg;base64,abc")).toBe(false);
    expect(isMediaPath("https://example.com/a.jpg")).toBe(false);
    expect(isMediaPath(null)).toBe(false);
  });
});
