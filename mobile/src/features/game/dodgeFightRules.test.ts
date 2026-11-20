import { describe, expect, it } from "vitest";
import { CHARGE, DodgeFight, dodgeSwipe, fightHealthTicks, FLIGHT, LIVES, WIND, fightHealth } from "./dodgeFightRules";

const stock = { wax: 30, gold: 2 };
function advance(fight: DodgeFight, seconds: number, remote = false) {
  for (let elapsed = 0; elapsed < seconds; elapsed += .01) fight.advance(Math.min(.01, seconds - elapsed), remote);
}

describe("dodge fight rules", () => {
  it("uses rarity health, 20 HP for landmarks, and 3 HP at home", () => {
    expect((["common", "uncommon", "rare"] as const).map((rarity) => fightHealth("corrupted", rarity))).toEqual([3, 4, 5]);
    expect(fightHealth("landmark", "common")).toBe(20);
    expect(fightHealth("home", "rare")).toBe(3);
  });

  it("gathers, winds up, launches, then hits for one wax damage", () => {
    const fight = new DodgeFight("corrupted", "common", stock, () => .5);
    advance(fight, CHARGE + .02);
    expect(fight.frame.wind).toBe(true);
    expect(fight.flight).toBeNull();
    advance(fight, WIND);
    expect(fight.flight?.ball).toBe("wax");
    expect(fight.stock.wax).toBe(29);
    expect(fight.hp).toBe(3);
    advance(fight, FLIGHT);
    expect(fight.hp).toBe(2);
    expect(fight.damage).toBe(1);
  });

  it("scatters a windup on a step and only charges once back on the ground", () => {
    const fight = new DodgeFight("corrupted", "rare", stock);
    advance(fight, 1);
    fight.input("left");
    expect(fight.frame.scatterAt).toBe(fight.frame.now);
    advance(fight, .15);
    expect(fight.frame.x).toBeCloseTo(.2);
    expect(fight.flight).toBeNull();
    fight.input("left");
    fight.input("jump");
    advance(fight, .38);
    expect(fight.frame.jump).toBeGreaterThan(.9);
    expect(fight.frame.charge).toBe(0);
    advance(fight, .5);
    expect(fight.frame.x).toBeCloseTo(.2);
    expect(fight.frame.charge).toBeGreaterThan(0);
  });

  it("uses gold for two damage and falls back to wax, then stops without a ball", () => {
    const fight = new DodgeFight("landmark", "common", { wax: 1, gold: 1 }, () => .5);
    fight.chooseBall("gold");
    advance(fight, 1.15);
    expect(fight.flight?.ball).toBe("gold");
    expect(fight.ball).toBe("wax");
    advance(fight, .62);
    expect(fight.hp).toBe(18);
    advance(fight, 1.1);
    expect(fight.hp).toBe(17);
    expect(fight.end).toBe("empty");
  });

  it("uses gold automatically when wax runs out and wins with the last ball", () => {
    const fight = new DodgeFight("corrupted", "common", { wax: 1, gold: 1 }, () => .5);
    advance(fight, 1.12);
    expect(fight.selected).toBe("gold");
    advance(fight, 2);
    expect(fight.end).toBe("won");
    expect(fight.stock).toEqual({ wax: 0, gold: 0 });
  });

  it("keeps home throws free, with no gold and no double shot", () => {
    const fight = new DodgeFight("home", "rare", { wax: 0, gold: 0 }, () => .99);
    fight.chooseBall("gold");
    advance(fight, 1.82);
    expect(fight.attack?.kind).toBe("shot");
    fight.input("left");
    advance(fight, 3.5);
    expect(fight.end).toBe("won");
    expect(fight.stock).toEqual({ wax: 0, gold: 0 });
  });

  it("locks shots to a lane, and dodging that lane saves a life", () => {
    const fight = new DodgeFight("corrupted", "rare", stock, () => .5);
    advance(fight, 1.82);
    expect(fight.attack?.lanes).toEqual([1]);
    fight.input("right");
    advance(fight, 1.6);
    expect(fight.lives).toBe(LIVES);
  });

  it("announces two lanes only after 25 percent damage in Corrupted fights", () => {
    const fight = new DodgeFight("corrupted", "rare", stock, () => .99);
    advance(fight, 1.82);
    expect(fight.attack?.kind).toBe("shot");
    advance(fight, 2.85);
    expect(fight.attack?.kind).toBe("double");
    expect(new Set(fight.attack?.lanes).size).toBe(2);
  });

  it("lets an airborne player clear a wave and hits a grounded player once", () => {
    const jumper = new DodgeFight("landmark", "rare", stock, () => .1);
    const grounded = new DodgeFight("landmark", "rare", stock, () => .1);
    for (const fight of [jumper, grounded]) {
      advance(fight, 1.82);
      expect(fight.attack?.kind).toBe("wave");
      advance(fight, .92);
    }
    jumper.input("jump");
    advance(jumper, .55);
    advance(grounded, .55);
    expect(jumper.lives).toBe(LIVES);
    expect(grounded.lives).toBe(LIVES - 1);
    expect(grounded.frame.charge).toBeLessThan(.2);
    expect(grounded.frame.scatterAt).toBeGreaterThan(0);
  });

  it("uses faster Landmark warnings, waves followed by shots at half HP, and one-second protection", () => {
    const fight = new DodgeFight("landmark", "common", stock, () => .1, { health: 10, maxHealth: 20 });
    const common = new DodgeFight("corrupted", "rare", stock, () => .1);
    advance(fight, 1.82);
    advance(common, 1.82);
    expect(fight.attack?.warning).toBeLessThan(common.attack!.warning);
    expect(fight.attack?.kind).toBe("wave");
    advance(fight, 1.45);
    expect(fight.attack?.kind).toBe("shot");
    const lastHit = fight.frame.hurtAt;
    // A second attack resolving during the protection window leaves the total unchanged.
    fight.attack = { at: fight.frame.now, warning: .05, travel: .05, kind: "shot", lanes: [1] };
    advance(fight, .11);
    expect(fight.frame.hurtAt).toBe(lastHit);
    expect(fight.lives).toBe(2);
  });

  it("ends after three hits and expires a Landmark at 150 seconds of active play", () => {
    const lost = new DodgeFight("landmark", "common", stock, () => .5);
    advance(lost, 15);
    expect(lost.lives).toBe(0);
    expect(lost.end).toBe("lost");

    const timed = new DodgeFight("landmark", "common", { wax: 500, gold: 0 }, () => .5);
    expect(timed.secondsLeft).toBe(150);
    // Keep changing lanes between frames, dodging aimed shots without launching.
    for (let i = 0; i < 751; i++) {
      timed.input(i % 2 ? "right" : "left");
      if (timed.attack) timed.attack.lanes = [];
      advance(timed, .2);
    }
    expect(timed.end).toBe("timeout");
    expect(timed.secondsLeft).toBe(0);
  });

  it("reconciles a resumed Landmark timer with the server expiry without advancing attacks", () => {
    const fight = new DodgeFight("landmark", "common", stock, () => .5);
    advance(fight, 1);
    fight.syncTimer(90);
    expect(fight.secondsLeft).toBe(90);
    expect(fight.frame.now).toBeCloseTo(1);
    expect(fight.attack).toBeNull();
    expect(fight.lives).toBe(3);
  });

  it("uses early server HP at impact while keeping the ball in flight", () => {
    const fight = new DodgeFight("corrupted", "rare", stock, () => .5, { health: 2, maxHealth: 5 });
    advance(fight, 1.1, true);
    const flight = fight.flight!;
    expect(flight.ball).toBe("wax");
    expect(fight.awaitingThrow).toBe(true);
    fight.confirmThrow(flight, 0);
    expect(fight.hp).toBe(2);
    expect(fight.end).toBeNull();
    advance(fight, FLIGHT, true);
    expect(fight.hp).toBe(0);
    expect(fight.damage).toBe(2);
    expect(fight.end).toBe("won");
  });

  it("shows the impact and keeps movement, attacks and gathering going during a slow response", () => {
    const fight = new DodgeFight("landmark", "common", stock, () => .5);
    advance(fight, 1.1, true);
    const flight = fight.flight!;
    fight.input("right");
    advance(fight, .75, true);
    expect(fight.frame.x).toBeCloseTo(.8);
    expect(fight.flight).toBeNull();
    expect(fight.hp).toBe(20);
    expect(fight.damage).toBe(1);
    const impactAt = fight.frame.hitAt;
    expect(impactAt).toBeGreaterThan(flight.at);
    expect(fight.attack?.lanes).toEqual([2]);
    fight.input("left");
    advance(fight, 1.55, true);
    expect(fight.frame.x).toBeCloseTo(.5);
    expect(fight.frame.charge).toBe(1);
    expect(fight.lives).toBe(3);
    expect(fight.stock.wax).toBe(stock.wax - 1);
    expect(fight.flight).toBeNull();
    fight.confirmThrow(flight, 19);
    expect(fight.hp).toBe(19);
    expect(fight.frame.hitAt).toBe(impactAt);
    advance(fight, .2, true);
    expect(fight.flight?.ball).toBe("wax");
    expect(fight.stock.wax).toBe(stock.wax - 2);
  });

  it("waits for the last launched throw before resolving the third lost seal", () => {
    const fight = new DodgeFight("landmark", "common", stock, () => .5);
    advance(fight, 1.1, true);
    const flight = fight.flight!;
    advance(fight, .8, true);
    fight.lives = 1;
    advance(fight, 1.5, true);
    expect(fight.lives).toBe(0);
    expect(fight.end).toBeNull();
    expect(fight.awaitingThrow).toBe(true);
    fight.confirmThrow(flight, 19);
    expect(fight.end).toBe("lost");
  });

  it("marks hits on the health bar and recognizes swipes from movement", () => {
    expect(fightHealthTicks("home", 3)).toEqual([1 / 3, 2 / 3]);
    expect(fightHealthTicks("corrupted", 4)).toEqual([.25, .5, .75]);
    expect(fightHealthTicks("corrupted", 5)).toEqual([.2, .4, .6, .8]);
    expect(fightHealthTicks("landmark", 20)).toEqual([.25, .5, .75]);
    expect(dodgeSwipe(23, 0)).toBeNull();
    expect(dodgeSwipe(24, 6)).toBe("right");
    expect(dodgeSwipe(-24, -5)).toBe("left");
    expect(dodgeSwipe(10, -24)).toBe("jump");
    expect(dodgeSwipe(0, 50)).toBeNull();
  });
});
