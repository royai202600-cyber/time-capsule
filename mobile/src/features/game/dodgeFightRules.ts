import type { BallKind, Rarity } from "../../services/game";

export type FightMode = "corrupted" | "landmark" | "home";
export type DodgeInput = "left" | "jump" | "right";
export type FightEnd = "won" | "lost" | "timeout" | "expired" | "empty" | "error";
export type BallStock = Record<BallKind, number>;
export const LANES = [.2, .5, .8] as const;
export const GROUND = .865;
export const BOSS_Y = .31;
export const LIVES = 3;
export const CHARGE = .95;
export const WIND = .14;
export const MOVE = .13;
export const JUMP = .7;
export const FLIGHT = .62;
export const INVULNERABLE = 1;
export const LANDMARK_SECONDS = 150;

export const fightHealth = (mode: FightMode, rarity: Rarity) =>
  mode === "landmark" ? 20 : mode === "home" ? 3 : { common: 3, uncommon: 4, rare: 5 }[rarity];

export function fightHealthTicks(mode: FightMode, maxHp: number) {
  const section = mode === "landmark" ? 5 : 1;
  return Array.from({ length: Math.ceil(maxHp / section) - 1 }, (_, index) => (index + 1) * section / maxHp);
}

export function dodgeSwipe(dx: number, dy: number): DodgeInput | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? "left" : "right";
  return dy < 0 ? "jump" : null;
}

export const otherBall = (ball: BallKind): BallKind => ball === "wax" ? "gold" : "wax";
export function availableBall(ball: BallKind, stock: BallStock): BallKind | null {
  if (stock[ball] > 0) return ball;
  const other = otherBall(ball);
  return stock[other] > 0 ? other : null;
}

export type Attack = {
  at: number;
  warning: number;
  travel: number;
  kind: "shot" | "double" | "wave";
  lanes: number[];
};
export type Flight = { at: number; x: number; ball: BallKind };
export type FightFrame = {
  now: number; x: number; jump: number; charge: number; wind: boolean; moving: number;
  scatterAt: number; scatterX: number; hurtAt: number; throwAt: number; hitAt: number;
};
export const initialFrame: FightFrame = {
  now: 0, x: .5, jump: 0, charge: 0, wind: false, moving: 0,
  scatterAt: -10, scatterX: .5, hurtAt: -10, throwAt: -10, hitAt: -10,
};

/** The demo's active-play clock. All positions are fractions and all times are seconds. */
export class DodgeFight {
  readonly maxHp: number;
  private timer: number;
  hp: number;
  lives = LIVES;
  stock: BallStock;
  selected: BallKind = "wax";
  end: FightEnd | null = null;
  frame = { ...initialFrame };
  attack: Attack | null = null;
  flight: Flight | null = null;
  private remoteShot: { flight: Flight; health?: number } | null = null;
  damage = 0;
  private lane = 1;
  private moveAt = -10;
  private moveFrom = .5;
  private jumpAt = -10;
  private gatherFrom = 0;
  private nextAttackAt = 1.8;
  private comboShot = false;

  constructor(readonly mode: FightMode, rarity: Rarity, stock: BallStock,
    private readonly random = Math.random, remote?: { health: number; maxHealth: number; seconds?: number }) {
    this.timer = Math.min(LANDMARK_SECONDS, remote?.seconds ?? LANDMARK_SECONDS);
    this.maxHp = remote?.maxHealth ?? fightHealth(mode, rarity);
    this.hp = remote?.health ?? this.maxHp;
    this.stock = { ...stock };
    this.selected = mode === "home" ? "wax" : availableBall("wax", stock) ?? "wax";
  }

  get awaitingThrow() { return this.remoteShot !== null; }

  get secondsLeft() {
    return this.mode === "landmark" ? Math.max(0, Math.ceil(this.timer - this.frame.now)) : null;
  }

  /** A hosted attempt's expiry keeps running while local play is paused. */
  syncTimer(seconds: number) {
    if (this.mode === "landmark") this.timer = Math.min(this.timer, this.frame.now + Math.max(0, seconds));
  }

  get ball(): BallKind | null {
    return this.mode === "home" ? "wax" : availableBall(this.selected, this.stock);
  }

  chooseBall(ball: BallKind) {
    if (this.mode === "home" || this.end || this.stock[ball] <= 0 || ball === this.selected) return;
    this.selected = ball;
  }

  input(input: DodgeInput) {
    if (this.end || this.lives === 0) return;
    const { now, x } = this.frame;
    if (input === "jump") {
      if (now - this.jumpAt < JUMP) return;
      this.jumpAt = now;
      this.interrupt(now + JUMP);
      return;
    }
    const lane = Math.max(0, Math.min(2, this.lane + (input === "left" ? -1 : 1)));
    if (lane === this.lane) return;
    this.lane = lane;
    this.moveFrom = x;
    this.moveAt = now;
    this.interrupt(now + MOVE);
  }

  private interrupt(until: number) {
    const frame = this.frame;
    if (frame.charge > .15) {
      frame.scatterAt = frame.now;
      frame.scatterX = frame.x;
    }
    frame.charge = 0;
    frame.wind = false;
    this.gatherFrom = Math.max(this.gatherFrom, until);
  }

  private announceAttack() {
    const { now } = this.frame;
    const tough = 1 - this.hp / this.maxHp;
    const landmark = this.mode === "landmark";
    const roll = this.random();
    const combo = !this.comboShot && landmark && tough >= .5 && roll < .35;
    const kind = this.comboShot ? "shot"
      : combo || roll < .27 ? "wave"
      : roll > .78 && (landmark || (this.mode === "corrupted" && tough >= .25)) ? "double" : "shot";
    const warning = .85 - .23 * tough - (landmark ? .12 : 0);
    const travel = kind === "wave" ? .62 : .7 - .15 * tough;
    // Double shots always threaten the player's lane and leave one of the other lanes safe.
    const otherLanes = [0, 1, 2].filter((lane) => lane !== this.lane);
    const lanes = kind === "wave" ? [] : kind === "double"
      ? [this.lane, otherLanes[this.random() < .5 ? 0 : 1]].sort() : [this.lane];
    this.attack = { at: now, warning, travel, kind, lanes };
    this.nextAttackAt = now + warning + (combo ? travel + .12 : 1.25 + this.random() * .85 - tough * .5);
    this.comboShot = combo;
  }

  finish(end: FightEnd) {
    this.end = end;
    this.attack = this.flight = this.remoteShot = null;
    this.frame.charge = 0;
    this.frame.wind = false;
  }

  /** A response can arrive on either side of the impact. Only the authoritative HP settles the throw. */
  confirmThrow(flight: Flight, health: number) {
    if (this.remoteShot?.flight !== flight) return;
    if (this.flight) this.remoteShot.health = health;
    else this.settleHit(health);
  }

  private settleHit(health: number) {
    this.remoteShot = null;
    this.gatherFrom = Math.max(this.gatherFrom, this.frame.now - CHARGE);
    this.damage = Math.max(0, this.hp - health);
    this.hp = health;
    if (health === 0) this.finish("won");
    else if (this.lives === 0) this.finish("lost");
  }

  /** Only advance while visible and playing. No timestamp from outside the fight enters these rules. */
  advance(delta: number, serverHit = false) {
    if (this.end) return;
    const frame = this.frame;
    const now = frame.now += Math.min(delta, .05);
    const move = Math.min(1, (now - this.moveAt) / MOVE);
    const jumpTime = now - this.jumpAt;
    frame.moving = move < 1 ? Math.sin(move * Math.PI) : 0;
    frame.x = this.moveFrom + (LANES[this.lane] - this.moveFrom) * (1 - (1 - move) ** 3);
    frame.jump = jumpTime < JUMP ? Math.sin(Math.PI * jumpTime / JUMP) : 0;

    if (this.flight && now - this.flight.at >= FLIGHT) {
      const ball = this.flight.ball;
      this.flight = null;
      const predicted = Math.max(0, this.hp - (ball === "gold" ? 2 : 1));
      const health = serverHit ? this.remoteShot?.health : predicted;
      this.damage = this.hp - (health ?? predicted);
      frame.hitAt = now;
      if (health !== undefined) this.settleHit(health);
      if (this.end) return;
    }
    if (this.lives === 0) return;
    if (this.secondsLeft === 0 && !this.awaitingThrow) { this.finish("timeout"); return; }

    if (this.attack && now >= this.attack.at + this.attack.warning + this.attack.travel) {
      const hit = this.attack.kind === "wave" ? jumpTime >= JUMP - .06
        : this.attack.lanes.some((lane) => Math.abs(frame.x - LANES[lane]) < .14);
      this.attack = null;
      if (hit && now - frame.hurtAt >= INVULNERABLE) {
        frame.hurtAt = now;
        this.lives--;
        this.interrupt(now);
        if (this.lives === 0) {
          this.attack = null;
          if (!this.flight && !this.awaitingThrow) this.finish("lost");
          return;
        }
      }
    }

    const ball = this.ball;
    if (!ball && !this.flight && !this.awaitingThrow) { this.finish("empty"); return; }
    if (!this.attack && now >= this.nextAttackAt) this.announceAttack();

    if (!ball || move < 1 || jumpTime < JUMP) return;
    const standing = Math.max(0, now - this.gatherFrom);
    frame.charge = Math.min(1, standing / CHARGE);
    frame.wind = standing >= CHARGE && !this.awaitingThrow;
    if (standing < CHARGE + WIND || this.awaitingThrow) return;

    this.flight = { at: now, x: frame.x, ball };
    if (serverHit) this.remoteShot = { flight: this.flight };
    if (this.mode !== "home") this.stock[ball]--;
    this.selected = this.ball ?? ball;
    this.gatherFrom = now;
    frame.throwAt = now;
    frame.charge = 0;
    frame.wind = false;
  }
}
