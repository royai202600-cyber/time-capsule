import { describe, expect, it } from "vitest";
import { sliderSpot, sliderValue } from "./pointsScale";

describe("points slider", () => {
  it("runs from 5 to 200", () => {
    expect(sliderValue(0)).toBe(5);
    expect(sliderValue(1)).toBe(200);
  });
  it("snaps to steps of 5", () => expect(sliderValue(0.26)).toBe(55));
  it("never leaves its ends", () => {
    expect(sliderValue(-1)).toBe(5);
    expect(sliderValue(2)).toBe(200);
  });
  it("rests at the end for anything typed past 200", () => expect(sliderSpot(750)).toBe(1));
  it("puts a typed number back where the slider would", () => expect(sliderValue(sliderSpot(120))).toBe(120));
});
