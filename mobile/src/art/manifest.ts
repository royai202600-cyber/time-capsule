import type { ImageSourcePropType } from 'react-native';
import type { VesselKind } from '../vesselArt';

/**
 * Vessel spec: everything the app needs to draw, open and idle a vessel, as data.
 * Follows design/art/VESSEL-SOP.md. Coordinates are px on the 1024 canvas; amounts are fractions of
 * the drawn size. A new vessel is art + one entry here (+ DB row and translations), no new motion code.
 */
/** One keyframe of the opening move; `at` is lidLift (0 closed → 1 open). Missing values hold the default. */
export type OpenKey = { at: number; x?: number; y?: number; rotate?: number; scaleX?: number; scaleY?: number; scale?: number; opacity?: number };
/** Resting-loop motion. One loop = `idleMs`; every term repeats whole turns so it loops seamlessly. */
export type IdleMotion =
  | { type: 'sway'; deg: number; pivot?: Point; turns?: number }          // rotate back and forth
  | { type: 'bob'; amount: number; axis?: 'x' | 'y'; turns?: number }     // move back and forth
  | { type: 'float'; amount: number }                                     // rise once per loop and settle
  | { type: 'breathe'; amount: number }                                   // grow once per loop and settle
  | { type: 'peek'; deg: number; pivot: Point }                           // a lid lifts a little and settles
  | { type: 'spin'; pivot?: Point; turns?: number }                       // continuous turn
  | { type: 'tick'; deg: number; pivot?: Point }                          // a small jolt once per loop
  | { type: 'drift'; amount: number; direction?: 'up' | 'down' }        // particles drift and fade: up (steam, fireflies, default) or down (snow, sand)
  | { type: 'glow'; base: number; range: number; readyBase?: number; readyRange?: number; flicker?: number }; // opacity pulse
export type Point = { x: number; y: number };
export type ArtLayer = {
  source: ImageSourcePropType; name: string;
  role: 'static' | 'hinge' | 'lift' | 'fade' | 'slide' | 'twist' | 'split' | 'door' | 'pop';
  pivot?: Point;
  /** Opening keyframes (all roles except static). */
  open?: OpenKey[];
  /** Opening keyframes used instead when the capsule is ready (e.g. a brighter glow). */
  openReady?: OpenKey[];
  /** Resting motion of this layer alone. */
  idle?: IdleMotion[];
  /** Stays put while the rest of the vessel idles (e.g. the sea under a bobbing bottle). Ground layers come first. */
  ground?: boolean;
};
export type OpeningCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'J' | 'K';
export type IllustratedParts = {
  assembled: ImageSourcePropType;
  /** Bottom to top, in drawing order. */
  layers: ArtLayer[];
  opening: OpeningCode;
  /** One idle loop in ms. */
  idleMs: number;
  /** Resting motion of the whole vessel (all non-ground layers, glint and sparkle). */
  idle?: IdleMotion[];
  /** Where the letter enters when sealing. */
  mouth: Point;
  /** Seal-step drop distance; defaults to 145 + mouth.y × 120 / 1024 (VESSEL-SOP §4). */
  letterDrop?: number;
  /** Lowest opaque row of the assembled art (where it stands on a shelf). */
  baseY: number;
  /** Where fx-glint twinkles once per idle loop. */
  sparkle?: Point;
  /** A highlight layer that gleams across glass once per idle loop. */
  glint?: ImageSourcePropType;
  /** A warm point of light revealed as it opens (e.g. a ring catching the light). */
  openGlow?: Point;
  /** This layer pulses softly while the capsule is ready to open and the vessel is otherwise still. */
  readyPulse?: string;
};
// Metro requires literal paths, so all assets are registered once here.
// Opening keyframes and idle amounts below reproduce the hand-tuned motion from PRs #16, #29 and #37 exactly.
export const vesselParts: Record<VesselKind, IllustratedParts> = {
  dome: {
    assembled: require('../../../public/art/vessels/vessel-dome.webp'), opening: 'B', idleMs: 4200,
    mouth: { x: 512, y: 500 }, letterDrop: 205, baseY: 920,
    glint: require('../../../public/art/vessels/vessel-dome-glint.webp'),
    layers: [
      { name: 'base', role: 'static', source: require('../../../public/art/vessels/vessel-dome-base.webp') },
      { name: 'rose', role: 'static', source: require('../../../public/art/vessels/vessel-dome-rose.webp'), idle: [{ type: 'sway', deg: 6, pivot: { x: 505, y: 790 } }] },
      { name: 'glass', role: 'lift', source: require('../../../public/art/vessels/vessel-dome-glass.webp'), open: [{ at: 0, y: 0, opacity: 1 }, { at: 1, y: -.35, opacity: 0 }] },
    ],
  },
  bottle: {
    assembled: require('../../../public/art/vessels/vessel-bottle.webp'), opening: 'D', idleMs: 3600,
    mouth: { x: 700, y: 380 }, letterDrop: 190, baseY: 812,
    idle: [{ type: 'bob', amount: .025, turns: 2 }, { type: 'sway', deg: 5.5, pivot: { x: 500, y: 640 } }],
    layers: [
      { name: 'waves', role: 'static', ground: true, source: require('../../../public/art/vessels/vessel-bottle-waves.webp'), idle: [{ type: 'bob', amount: .035, axis: 'x' }] },
      { name: 'letter', role: 'slide', source: require('../../../public/art/vessels/vessel-bottle-letter.webp'), open: [{ at: .42, x: 0, y: 0 }, { at: 1, x: .19, y: -.32 }] },
      { name: 'body', role: 'static', source: require('../../../public/art/vessels/vessel-bottle-body.webp') },
      { name: 'cork', role: 'hinge', pivot: { x: 724, y: 355 }, source: require('../../../public/art/vessels/vessel-bottle-cork.webp'),
        open: [{ at: 0, x: 0, y: 0, rotate: 0, opacity: 1 }, { at: .5, x: .16, y: -.18, rotate: -9, opacity: 1 }, { at: 1, x: .28, y: .09, rotate: -18, opacity: 0 }] },
    ],
  },
  envelope: {
    assembled: require('../../../public/art/vessels/vessel-envelope.webp'), opening: 'E', idleMs: 3800,
    mouth: { x: 512, y: 500 }, letterDrop: 205, baseY: 814, sparkle: { x: 440, y: 512 },
    idle: [{ type: 'float', amount: .035 }, { type: 'sway', deg: 2.5 }],
    layers: [
      { name: 'body', role: 'static', source: require('../../../public/art/vessels/vessel-envelope-body.webp') },
      { name: 'flap', role: 'hinge', pivot: { x: 496, y: 260 }, source: require('../../../public/art/vessels/vessel-envelope-flap.webp'), open: [{ at: .3, scaleY: 1 }, { at: 1, scaleY: -1 }] },
      { name: 'seal', role: 'fade', source: require('../../../public/art/vessels/vessel-envelope-seal.webp'), open: [{ at: 0, opacity: 1, scale: 1 }, { at: .3, opacity: 0, scale: .82 }] },
    ],
  },
  tin: {
    assembled: require('../../../public/art/vessels/vessel-tin.webp'), opening: 'A', idleMs: 4400,
    mouth: { x: 512, y: 580 }, letterDrop: 215, baseY: 776, sparkle: { x: 300, y: 470 },
    idle: [{ type: 'float', amount: .03 }, { type: 'breathe', amount: .035 }],
    layers: [
      { name: 'box', role: 'static', source: require('../../../public/art/vessels/vessel-tin-box.webp') },
      { name: 'lid', role: 'hinge', pivot: { x: 505, y: 310 }, source: require('../../../public/art/vessels/vessel-tin-lid.webp'), open: [{ at: 0, rotate: 0, scaleY: 1 }, { at: 1, rotate: -22, scaleY: .7 }] },
    ],
  },
  lantern: {
    assembled: require('../../../public/art/vessels/vessel-lantern.webp'), opening: 'C', idleMs: 3400,
    mouth: { x: 512, y: 560 }, letterDrop: 210, baseY: 956, sparkle: { x: 578, y: 214 }, readyPulse: 'glow',
    idle: [{ type: 'sway', deg: 4.5, pivot: { x: 512, y: 110 } }],
    layers: [
      { name: 'glow', role: 'fade', source: require('../../../public/art/vessels/vessel-lantern-glow.webp'),
        open: [{ at: 0, opacity: .25 }, { at: 1, opacity: 1 }], openReady: [{ at: 0, opacity: .5 }, { at: 1, opacity: 1 }],
        idle: [{ type: 'glow', base: .15, range: .45, readyBase: .45, readyRange: .45, flicker: .08 }] },
      { name: 'body', role: 'static', source: require('../../../public/art/vessels/vessel-lantern-body.webp') },
      { name: 'cap', role: 'lift', source: require('../../../public/art/vessels/vessel-lantern-cap.webp'), open: [{ at: 0, y: 0, opacity: 1 }, { at: 1, y: -.09, opacity: .8 }] },
    ],
  },
  musicbox: {
    assembled: require('../../../public/art/vessels/vessel-musicbox.webp'), opening: 'A', idleMs: 3800,
    mouth: { x: 512, y: 620 }, letterDrop: 220, baseY: 818,
    idle: [{ type: 'breathe', amount: .025 }],
    layers: [
      { name: 'box', role: 'static', source: require('../../../public/art/vessels/vessel-musicbox-box.webp') },
      { name: 'lid', role: 'hinge', pivot: { x: 541, y: 292 }, source: require('../../../public/art/vessels/vessel-musicbox-lid.webp'),
        open: [{ at: 0, rotate: 0, scaleY: 1 }, { at: 1, rotate: -22, scaleY: .7 }], idle: [{ type: 'peek', deg: -9, pivot: { x: 541, y: 292 } }] },
    ],
  },
  maison: {
    assembled: require('../../../public/art/vessels/vessel-maison.webp'), opening: 'A', idleMs: 4600,
    mouth: { x: 512, y: 580 }, letterDrop: 215, baseY: 784, sparkle: { x: 438, y: 612 }, openGlow: { x: 522, y: 543 },
    idle: [{ type: 'float', amount: .03 }],
    layers: [
      { name: 'box', role: 'static', source: require('../../../public/art/vessels/vessel-maison-box.webp') },
      { name: 'ring', role: 'pop', source: require('../../../public/art/vessels/vessel-maison-ring.webp'),
        open: [{ at: .22, y: 0, scale: 1, opacity: .85 }, { at: .77, y: -.035, scale: 1.22, opacity: 1 }] },
      { name: 'lid', role: 'hinge', pivot: { x: 605, y: 300 }, source: require('../../../public/art/vessels/vessel-maison-lid.webp'),
        open: [{ at: 0, rotate: 0, scaleY: 1 }, { at: 1, rotate: -22, scaleY: .7 }], idle: [{ type: 'peek', deg: -6, pivot: { x: 605, y: 300 } }] },
    ],
  },
};
/** Seal-step drop distance for a vessel (VESSEL-SOP §4). */
export const letterDropFor = (kind: VesselKind) => { const p = vesselParts[kind]; return p.letterDrop ?? Math.round(145 + p.mouth.y * 120 / 1024); };
export const portraits: Record<string, ImageSourcePropType> = {
  '01': require('../../../public/art/portraits/portrait-01.webp'), '02': require('../../../public/art/portraits/portrait-02.webp'),
  '03': require('../../../public/art/portraits/portrait-03.webp'), '04': require('../../../public/art/portraits/portrait-04.webp'),
  '05': require('../../../public/art/portraits/portrait-05.webp'), '06': require('../../../public/art/portraits/portrait-06.webp'),
  '07': require('../../../public/art/portraits/portrait-07.webp'), '08': require('../../../public/art/portraits/portrait-08.webp'),
  future: require('../../../public/art/portraits/portrait-future.webp'),
};
export const scenes = {
  welcome: require('../../../public/art/scenes/scene-welcome.webp'),
  emptyInbox: require('../../../public/art/scenes/scene-empty-inbox.webp'),
  emptySent: require('../../../public/art/scenes/scene-empty-sent.webp'),
  sealed: require('../../../public/art/scenes/scene-sealed.webp'),
};
export const sealWax = require('../../../public/art/seal-wax.webp');
export const lightBurst = require('../../../public/art/fx/fx-light-burst.webp');
// Idle glints (art A2, PR #32): a small sparkle for wax and brass (the dome's glass highlight is in its spec).
export const domeGlint = vesselParts.dome.glint!;
export const fxGlint = require('../../../public/art/fx/fx-glint.webp');
export const paperLetter = require('../../../public/art/textures/paper-letter.webp');
export const cabinetWall = require('../../../public/art/cabinet/cabinet-wall.webp');
export const shelf = require('../../../public/art/shelf.webp');
export const mapAsia = require('../../../public/art/map-asia.webp');
// Display coordinates on the 1254 px stylised map, reviewed in art PR #12.
export const mapPins: Record<string, { x: number; y: number }> = {
  senado: { x: 501, y: 583 }, 'tst-clock': { x: 525, y: 578 },
  taipei101: { x: 655, y: 532 }, sensoji: { x: 978, y: 307 },
  fushimi: { x: 900, y: 340 }, gyeongbok: { x: 758, y: 249 },
  merlion: { x: 275, y: 1026 }, grandpal: { x: 218, y: 748 },
  wumen: { x: 560, y: 206 }, petronas: { x: 230, y: 970 },
  'aurele-cotai': { x: 509, y: 582 },
};
export const passportCover = require('../../../public/art/journey/passport-cover.webp');
export const passportPage = require('../../../public/art/journey/passport-page.webp');
export const stamps: Record<string, ImageSourcePropType> = {
  senado: require('../../../public/art/stamps/stamp-senado.webp'),
  'tst-clock': require('../../../public/art/stamps/stamp-tst-clock.webp'),
  taipei101: require('../../../public/art/stamps/stamp-taipei101.webp'),
  sensoji: require('../../../public/art/stamps/stamp-sensoji.webp'),
  fushimi: require('../../../public/art/stamps/stamp-fushimi.webp'),
  gyeongbok: require('../../../public/art/stamps/stamp-gyeongbok.webp'),
  merlion: require('../../../public/art/stamps/stamp-merlion.webp'),
  grandpal: require('../../../public/art/stamps/stamp-grandpal.webp'),
  wumen: require('../../../public/art/stamps/stamp-wumen.webp'),
  petronas: require('../../../public/art/stamps/stamp-petronas.webp'),
  'aurele-cotai': require('../../../public/art/stamps/stamp-aurele-cotai.webp'),
};
