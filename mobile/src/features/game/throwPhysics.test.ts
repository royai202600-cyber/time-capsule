import { describe, expect, it } from "vitest";
import { FRAME_FIELDS, simulateThrow } from "./throwPhysics";

const stage = { travel: -380, vessel: 150, hitHalfWidth: 74 };
const flick = (vy: number, vx = 0) => ({ dx: 0, dy: -120, vx, vy });
const frame = (path: number[], i: number) => path.slice(i * FRAME_FIELDS, (i + 1) * FRAME_FIELDS);

describe("simulateThrow", () => {
  it("hits with a good flick, and reaches the capsule on screen", () => {
    const out = simulateThrow(flick(-2.2), stage);
    expect(out.outcome).toBe("hit");
    const impact = frame(out.hitPath, Math.round(out.resolveAt * 60));
    expect(Math.abs(impact[1] - stage.travel)).toBeLessThan(40);
    expect(impact[2]).toBeCloseTo(.42, 1);
  });
  it("lands short on a weak flick", () => expect(simulateThrow(flick(-.5), stage).outcome).toBe("short"));
  it("flies over on a very hard flick", () => expect(simulateThrow(flick(-6.6), stage).outcome).toBe("over"));
  it("goes wide on a strong sideways flick", () => expect(simulateThrow(flick(-2.2, 1.2), stage).outcome).toBe("wide"));
  it("starts where the finger let go, and ends faded", () => {
    const out = simulateThrow({ dx: 30, dy: -90, vx: 0, vy: -2.2 }, stage);
    const first = frame(out.hitPath, 0);
    expect(first[0]).toBeCloseTo(30, 0);
    expect(first[1]).toBeCloseTo(-90, 0);
    expect(out.hitPath[out.hitPath.length - 1]).toBe(0);
  });
  it("bounces back from a hit rather than carrying on", () => {
    const out = simulateThrow(flick(-2.2), stage);
    const impact = Math.round(out.resolveAt * 60);
    expect(frame(out.hitPath, impact + 12)[2]).toBeGreaterThan(frame(out.missPath, impact + 12)[2]);
  });
  it("lets a mouse drag stand in for speed", () => expect(simulateThrow({ dx: 0, dy: -200, vx: 0, vy: 0 }, { ...stage, mouse: true }).outcome).toBe("hit"));
});
