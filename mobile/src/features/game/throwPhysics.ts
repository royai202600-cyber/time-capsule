/** A wax ball's flight in a small fake 3D world: sideways, height and depth, seen through a camera. */
export type Flick = { dx: number; dy: number; vx: number; vy: number };
export type ThrowStage = { travel: number; vessel: number; hitHalfWidth: number; mouse?: boolean; still?: boolean };
export type ThrowOutcome = "hit" | "short" | "wide" | "over";
/** Flat list of frames at 60 per second: x, y, scale, rotation in degrees, opacity. */
export type BallPath = number[];
export type ThrowFlight = { outcome: ThrowOutcome; resolveAt: number; hitPath: BallPath; missPath: BallPath };

export const FRAME_FIELDS = 5;
export const FRAMES_PER_SECOND = 60;
const DT = 1 / FRAMES_PER_SECOND;
const DEPTH = 10; // The capsule's distance from the player, in metres.
const FAR_SCALE = .42; // How small the ball looks at the capsule.
const LENS = DEPTH * FAR_SCALE / (1 - FAR_SCALE);
const PX_PER_METRE = 60;
const GRAVITY = 40;
const IDEAL_FLIGHT = .55;
const IDEAL_FLICK = 2.2; // Finger speed in px per ms that lands dead centre.
const FORGIVING = .55; // Pulls weak and strong flicks toward the ideal, as aim help.
const SIDE_GAIN = 170; // Screen px of drift at the capsule per px/ms of sideways finger speed.
const TAIL_SECONDS = .72;
const FADE_FRAMES = 9;
const BALL_MARGIN = .6;

type Ball = { x: number; h: number; z: number; vx: number; vh: number; vz: number; turn: number; spin: number };
const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));

export function simulateThrow(flick: Flick, stage: ThrowStage): ThrowFlight {
  const scaleAt = (z: number) => LENS / (LENS + Math.max(-1.5, z));
  const baseRise = -stage.travel - stage.vessel / 2;
  const groundY = (z: number) => -baseRise * (1 - scaleAt(z)) / (1 - FAR_SCALE);
  const capsuleMiddle = (stage.vessel / 2) / (FAR_SCALE * PX_PER_METRE);
  const capsuleTop = stage.vessel / (FAR_SCALE * PX_PER_METRE) + BALL_MARGIN;
  const write = (path: BallPath, b: Ball, opacity = 1) => {
    const s = scaleAt(b.z);
    path.push(b.x * s, groundY(b.z) - b.h * s * PX_PER_METRE, s, b.turn, opacity);
  };
  const step = (b: Ball) => {
    b.vh -= GRAVITY * DT;
    b.x += b.vx * DT; b.h += b.vh * DT; b.z += b.vz * DT; b.turn += b.spin * DT;
  };

  const speed = stage.mouse ? Math.max(Math.abs(flick.vy), Math.abs(flick.dy) * .011) : Math.abs(flick.vy);
  const power = 1 + (clamp(speed / IDEAL_FLICK, .2, 3) - 1) * FORGIVING;
  const startHeight = Math.max(0, -flick.dy) / PX_PER_METRE;
  const lift = (capsuleMiddle - startHeight) / IDEAL_FLIGHT + GRAVITY * IDEAL_FLIGHT / 2;
  const ball: Ball = {
    x: flick.dx, h: startHeight, z: 0,
    vx: flick.vx * SIDE_GAIN / (IDEAL_FLIGHT * FAR_SCALE),
    vh: lift * power,
    vz: (DEPTH / IDEAL_FLIGHT) * Math.sqrt(power),
    turn: 0, spin: (flick.vx < 0 ? -1 : 1) * 620,
  };

  const flight: BallPath = [];
  write(flight, ball);
  let outcome: ThrowOutcome | null = null;
  while (!outcome && flight.length < FRAME_FIELDS * FRAMES_PER_SECOND * 3) {
    step(ball);
    if (ball.h <= 0) { ball.h = 0; outcome = "short"; }
    else if (ball.z >= DEPTH) {
      ball.z = DEPTH;
      const off = Math.abs(ball.x * FAR_SCALE);
      outcome = off >= stage.hitHalfWidth ? "wide" : ball.h > capsuleTop ? "over" : "hit";
    }
    write(flight, ball);
  }
  const resolveAt = (flight.length / FRAME_FIELDS - 1) * DT;

  const tail = (from: Ball, seconds: number) => {
    const b = { ...from };
    const path: BallPath = [];
    if (stage.still) {
      for (let i = 1; i <= FADE_FRAMES; i++) write(path, b, 1 - i / FADE_FRAMES);
      return path;
    }
    const frames = Math.round(seconds * FRAMES_PER_SECOND);
    for (let i = 1; i <= frames; i++) {
      step(b);
      if (b.h <= 0 && b.vh < 0) {
        b.h = 0; b.vh = Math.abs(b.vh) * .42;
        b.vx *= .6; b.vz *= .55; b.spin *= .6;
        if (b.vh < 1.2) b.vh = 0;
      }
      if (b.h === 0) { b.vx *= .9; b.vz *= .9; b.spin *= .9; } // Rolling slows to a stop.
      write(path, b, Math.min(1, (frames - i) / FADE_FRAMES));
    }
    return path;
  };

  const side = ball.x === 0 ? (flick.vx < 0 ? -1 : 1) : Math.sign(ball.x);
  const rebound: Ball = {
    ...ball, z: DEPTH - .05,
    vx: side * 300 + ball.vx * .25,
    vh: Math.max(7, Math.abs(ball.vh) * .35),
    vz: -ball.vz * .16,
    spin: -ball.spin * 1.2,
  };
  const passes = tail(ball, outcome === "short" ? TAIL_SECONDS : .3);
  return {
    outcome: outcome ?? "short",
    resolveAt,
    hitPath: outcome === "hit" ? [...flight, ...tail(rebound, TAIL_SECONDS)] : [...flight, ...passes],
    missPath: [...flight, ...passes],
  };
}
