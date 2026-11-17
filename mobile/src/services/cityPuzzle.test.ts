import { describe, expect, it, vi } from "vitest";
import { PostgrestError } from "@supabase/supabase-js";


vi.mock("./supabase", () => ({ supabase: { rpc: vi.fn() } }));

import { supabase } from "./supabase";
import { CITIES, MAX_GUESSES, cityAt, cityPuzzle, judge, localPriceText, localText, parseGuess, shareText, usdText, type CityPuzzle } from "./cityPuzzle";

describe("judge", () => {
  it("wins within 10% either way", () => {
    expect(judge(1.8, 2).hint).toBe("solved");
    expect(judge(2.2, 2).hint).toBe("solved");
    expect(judge(1.79, 2).hint).toBe("higher");
    expect(judge(2.21, 2).hint).toBe("lower");
  });
  it("says close within 25% and not beyond", () => {
    expect(judge(1.5, 2)).toEqual({ hint: "higher", close: true });
    expect(judge(1.4, 2)).toEqual({ hint: "higher", close: false });
    expect(judge(2.5, 2)).toEqual({ hint: "lower", close: true });
    expect(judge(9, 2)).toEqual({ hint: "lower", close: false });
  });
});

describe("money", () => {
  it("shows US dollars without empty decimals", () => {
    expect(usdText(2)).toBe("US$ 2");
    expect(usdText(1.5)).toBe("US$ 1.5");
    expect(usdText(1.88)).toBe("US$ 1.88");
  });
  it("turns a dollar guess into the city's money", () => {
    expect(localText(2, { currency: "NT$", rate: 32 })).toBe("NT$ 64");
    expect(localText(1.5, { currency: "HK$", rate: 7.8 })).toBe("HK$ 11.7");
    expect(localText(1, { currency: "S$", rate: 1.35 })).toBe("S$ 1.4");
  });
  it("shows the answer's checked local price as stored, not converted back", () => {
    expect(localPriceText(200, "NT$")).toBe("NT$ 200");
    expect(localPriceText(11.5, "MOP")).toBe("MOP 11.5");
  });
  it("reads a typed guess", () => {
    expect(parseGuess("2")).toBe(2);
    expect(parseGuess(" $1.85 ")).toBe(1.85);
    expect(parseGuess("US$ 1,200")).toBe(1200);
    for (const bad of ["", "0", "-3", "1.234", "abc", "1e3"]) expect(parseGuess(bad)).toBeNull();
  });
});

describe("shareText", () => {
  const base: CityPuzzle = { city: "taipei", no: 12, question_zh: "", question_en: "", venue_zh: "", venue_en: "", photo: null, vessel: "bubble-tea", currency: "NT$", rate: 32, guesses: [], done: true, won: true, answer: null, reward: 3 };
  it("shows arrows and the count, never a price", () => {
    const text = shareText({ ...base, guesses: [{ usd: 1, hint: "higher", close: false }, { usd: 5, hint: "lower", close: false }, { usd: 1.9, hint: "solved", close: true }] }, "Taipei", "Time Capsule");
    expect(text).toBe("Time Capsule · Taipei #12 · 3/6\n⬆️⬇️✅");
  });
  it("marks a miss with X", () => {
    const text = shareText({ ...base, won: false, guesses: Array.from({ length: MAX_GUESSES }, () => ({ usd: 1, hint: "higher" as const, close: false })) }, "台北", "時光膠囊");
    expect(text.startsWith("時光膠囊 · 台北 #12 · X/6")).toBe(true);
  });
});

describe("cityAt", () => {
  it("finds the playable city you are standing in", () => {
    expect(cityAt({ lat: 25.0375, lng: 121.5628 })?.id).toBe("taipei");
    expect(cityAt({ lat: 22.19, lng: 113.54 })?.id).toBe("macau");
  });
  it("is nothing far from every playable city, and for cities that are only coming soon", () => {
    expect(cityAt({ lat: 40.71, lng: -74.0 })).toBeNull();
    expect(cityAt({ lat: 35.7148, lng: 139.7967 })).toBeNull();
    expect(cityAt(null)).toBeNull();
  });
  it("lists every playable city with a Landmark and what it is known for", () => {
    for (const c of CITIES.filter((x) => x.playable)) expect(c.known_zh && c.known_en && c.landmark_zh && c.landmark_en).toBeTruthy();
  });
});

describe("puzzle RPCs", () => {
  const rpc = vi.mocked(supabase.rpc);

  it("fetches the server's puzzle day and streak", async () => {
    const day = { puzzles: [], streak: 2 };
    rpc.mockResolvedValueOnce({
      data: day, error: null, success: true, count: null, status: 200, statusText: "OK",
    });
    await expect(cityPuzzle.today()).resolves.toEqual(day);
    expect(rpc).toHaveBeenLastCalledWith("city_puzzle_today");
  });

  it("submits US dollars and keeps the RPC error code", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: new PostgrestError({ message: "already_done", code: "P0001", details: "", hint: "" }),
      success: false, count: null, status: 400, statusText: "Bad Request",
    });
    await expect(cityPuzzle.guess("taipei", 1.9)).rejects.toMatchObject({ code: "already_done" });
    expect(rpc).toHaveBeenLastCalledWith("city_puzzle_guess", { p_city: "taipei", p_usd: 1.9 });
  });
});
