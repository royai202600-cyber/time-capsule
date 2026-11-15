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
  /** Stays put while the rest of the vessel idles (e.g. the water under a bobbing vessel). Ground layers come first. */
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
        open: [{ at: 0, y: 0, scale: 1, opacity: .85 }, { at: .22, y: 0, scale: 1, opacity: .85 }, { at: .77, y: -.035, scale: 1.22, opacity: 1 }] },
      { name: 'lid', role: 'hinge', pivot: { x: 605, y: 300 }, source: require('../../../public/art/vessels/vessel-maison-lid.webp'),
        open: [{ at: 0, rotate: 0, scaleY: 1 }, { at: 1, rotate: -22, scaleY: .7 }], idle: [{ type: 'peek', deg: -6, pivot: { x: 605, y: 300 } }] },
    ],
  },
  // Batch 1 (art PR #46, VESSEL-SOP): generated from design/art/manifest.json vessel blocks.
  'mixtape': {
    assembled: require('../../../public/art/vessels/vessel-mixtape.webp'),
    opening: 'F',
    idleMs: 4000,
    idle: [{type: 'bob', amount: 0.03}],
    mouth: {x: 490, y: 451},
    baseY: 900,
    sparkle: {x: 266, y: 402},
    glint: require('../../../public/art/vessels/vessel-mixtape-glint.webp'),
    layers: [
      { name: 'case', role: 'static', source: require('../../../public/art/vessels/vessel-mixtape-case.webp') },
      { name: 'cassette', role: 'slide', source: require('../../../public/art/vessels/vessel-mixtape-cassette.webp'), open: [{at: 0, x: 0, y: 0, rotate: 0, opacity: 1}, {at: 1, y: -0.55, opacity: 0}] },
      { name: 'reel-left', role: 'slide', source: require('../../../public/art/vessels/vessel-mixtape-reel-left.webp'), pivot: {x: 344, y: 663}, open: [{at: 0, y: 0, opacity: 1}, {at: 1, y: -0.55, opacity: 0}], idle: [{type: 'spin', pivot: {x: 344, y: 663}, turns: 1}] },
      { name: 'reel-right', role: 'slide', source: require('../../../public/art/vessels/vessel-mixtape-reel-right.webp'), pivot: {x: 605, y: 663}, open: [{at: 0, y: 0, opacity: 1}, {at: 1, y: -0.55, opacity: 0}], idle: [{type: 'spin', pivot: {x: 605, y: 663}, turns: 1}] },
    ],
  },
  'instant-camera': {
    assembled: require('../../../public/art/vessels/vessel-instant-camera.webp'),
    opening: 'F',
    idleMs: 4000,
    idle: [{type: 'bob', amount: 0.03}],
    mouth: {x: 430, y: 802},
    baseY: 900,
    sparkle: {x: 613, y: 496},
    layers: [
      { name: 'camera', role: 'static', source: require('../../../public/art/vessels/vessel-instant-camera-camera.webp') },
      { name: 'photo', role: 'slide', source: require('../../../public/art/vessels/vessel-instant-camera-photo.webp'), pivot: {x: 421, y: 847}, open: [{at: 0, scaleY: 0.06, y: 0}, {at: 0.25, scaleY: 0.4, y: 0.08}, {at: 1, scaleY: 1, y: 0.17}] },
    ],
  },
  'ramen': {
    assembled: require('../../../public/art/vessels/vessel-ramen.webp'),
    opening: 'B',
    idleMs: 4000,
    idle: [{type: 'bob', amount: 0.025}],
    mouth: {x: 509, y: 581},
    baseY: 900,
    sparkle: {x: 501, y: 430},
    layers: [
      { name: 'bowl', role: 'static', source: require('../../../public/art/vessels/vessel-ramen-bowl.webp') },
      { name: 'steam', role: 'fade', source: require('../../../public/art/vessels/vessel-ramen-steam.webp'), open: [{at: 0, opacity: 1}, {at: 1, opacity: 0}], idle: [{type: 'drift', amount: 0.03}] },
      { name: 'lid', role: 'lift', source: require('../../../public/art/vessels/vessel-ramen-lid.webp'), open: [{at: 0, x: 0, y: 0, rotate: 0, opacity: 1}, {at: 1, y: -0.45, opacity: 0}] },
    ],
  },
  'fortune-cookie': {
    assembled: require('../../../public/art/vessels/vessel-fortune-cookie.webp'),
    opening: 'H',
    idleMs: 4000,
    idle: [{type: 'bob', amount: 0.025}],
    mouth: {x: 511, y: 622},
    baseY: 900,
    sparkle: {x: 511, y: 368},
    layers: [
      { name: 'plate', role: 'static', source: require('../../../public/art/vessels/vessel-fortune-cookie-plate.webp') },
      { name: 'slip', role: 'static', source: require('../../../public/art/vessels/vessel-fortune-cookie-slip.webp') },
      { name: 'left', role: 'hinge', source: require('../../../public/art/vessels/vessel-fortune-cookie-left.webp'), pivot: {x: 315, y: 744}, open: [{at: 0, x: 0, y: 0, rotate: 0, opacity: 1}, {at: 1, x: -0.13, rotate: -32}] },
      { name: 'right', role: 'hinge', source: require('../../../public/art/vessels/vessel-fortune-cookie-right.webp'), pivot: {x: 686, y: 748}, open: [{at: 0, x: 0, y: 0, rotate: 0, opacity: 1}, {at: 1, x: 0.13, rotate: 32}] },
    ],
  },
  'red-packet': {
    assembled: require('../../../public/art/vessels/vessel-red-packet.webp'),
    opening: 'E',
    idleMs: 4000,
    idle: [{type: 'sway', deg: 3, pivot: {x: 512, y: 300}}],
    mouth: {x: 505, y: 219},
    baseY: 900,
    sparkle: {x: 484, y: 407},
    layers: [
      { name: 'packet', role: 'static', source: require('../../../public/art/vessels/vessel-red-packet-packet.webp') },
      { name: 'flap', role: 'hinge', source: require('../../../public/art/vessels/vessel-red-packet-flap.webp'), pivot: {x: 505, y: 190}, open: [{at: 0, x: 0, y: 0, rotate: 0, opacity: 1}, {at: 1, scaleY: -1}] },
      { name: 'seal', role: 'fade', source: require('../../../public/art/vessels/vessel-red-packet-seal.webp'), open: [{at: 0, opacity: 1}, {at: 1, opacity: 0}] },
    ],
  },
  'snow-globe': {
    assembled: require('../../../public/art/vessels/vessel-snow-globe.webp'),
    opening: 'B',
    idleMs: 4000,
    mouth: {x: 512, y: 724},
    letterDrop: 230,
    baseY: 902,
    sparkle: {x: 340, y: 270},
    glint: require('../../../public/art/vessels/vessel-snow-globe-glint.webp'),
    layers: [
      { name: 'base', role: 'static', source: require('../../../public/art/vessels/vessel-snow-globe-base.webp') },
      { name: 'scene', role: 'static', source: require('../../../public/art/vessels/vessel-snow-globe-scene.webp') },
      { name: 'snow', role: 'fade', source: require('../../../public/art/vessels/vessel-snow-globe-snow.webp'), open: [{at: 0, opacity: 1}, {at: 0.5, opacity: 0.5}, {at: 1, opacity: 0}], idle: [{type: 'drift', amount: 0.03, direction: 'down'}] },
      { name: 'globe', role: 'lift', source: require('../../../public/art/vessels/vessel-snow-globe-globe.webp'), open: [{at: 0, y: 0, opacity: 1}, {at: 0.5, y: -0.175, opacity: 0.5}, {at: 1, y: -0.35, opacity: 0}] },
    ],
  },
  'phone-booth': {
    assembled: require('../../../public/art/vessels/vessel-phone-booth.webp'),
    opening: 'J',
    idleMs: 4000,
    idle: [{type: 'breathe', amount: 0.025}],
    mouth: {x: 506, y: 499},
    baseY: 900,
    sparkle: {x: 571, y: 564},
    layers: [
      { name: 'booth', role: 'static', source: require('../../../public/art/vessels/vessel-phone-booth-booth.webp') },
      { name: 'light', role: 'fade', source: require('../../../public/art/vessels/vessel-phone-booth-light.webp'), open: [{at: 0, opacity: 1}, {at: 1, opacity: 1}], idle: [{type: 'glow', base: 0.35, range: 0.4}] },
      { name: 'door', role: 'hinge', source: require('../../../public/art/vessels/vessel-phone-booth-door.webp'), pivot: {x: 355, y: 564}, open: [{at: 0, x: 0, y: 0, rotate: 0, opacity: 1}, {at: 1, scaleX: 0.08}] },
    ],
  },
  'firefly-jar': {
    assembled: require('../../../public/art/vessels/vessel-firefly-jar.webp'),
    opening: 'G',
    idleMs: 4000,
    mouth: {x: 512, y: 332},
    baseY: 900,
    sparkle: {x: 296, y: 511},
    layers: [
      { name: 'jar', role: 'static', source: require('../../../public/art/vessels/vessel-firefly-jar-jar.webp') },
      { name: 'fireflies', role: 'fade', source: require('../../../public/art/vessels/vessel-firefly-jar-fireflies.webp'), open: [{at: 0, y: 0, opacity: 1}, {at: 1, y: -0.25, opacity: 0}], idle: [{type: 'drift', amount: 0.03}, {type: 'glow', base: 0.65, range: 0.3}] },
      { name: 'lid', role: 'lift', source: require('../../../public/art/vessels/vessel-firefly-jar-lid.webp'), pivot: {x: 512, y: 360}, open: [{at: 0, y: 0, rotate: 0, opacity: 1}, {at: 0.25, y: 0, rotate: -12, opacity: 1}, {at: 1, y: -0.5, rotate: -12, opacity: 0}] },
    ],
  },
  'hourglass': {
    assembled: require('../../../public/art/vessels/vessel-hourglass.webp'),
    opening: 'C',
    idleMs: 4000,
    idle: [{type: 'sway', deg: 2.5, pivot: {x: 512, y: 900}}],
    mouth: {x: 513, y: 260},
    baseY: 900,
    sparkle: {x: 407, y: 170},
    layers: [
      { name: 'frame-and-glass', role: 'static', source: require('../../../public/art/vessels/vessel-hourglass-frame-and-glass.webp') },
      { name: 'sand', role: 'static', source: require('../../../public/art/vessels/vessel-hourglass-sand.webp') }, // still at rest: this layer includes the settled pile, so a drift would fade it away
      { name: 'cap', role: 'lift', source: require('../../../public/art/vessels/vessel-hourglass-cap.webp'), open: [{at: 0, x: 0, y: 0, rotate: 0, opacity: 1}, {at: 1, y: -0.35, opacity: 0}] },
    ],
  },
  'gashapon': {
    assembled: require('../../../public/art/vessels/vessel-gashapon.webp'),
    opening: 'H',
    idleMs: 4000,
    idle: [{type: 'tick', deg: 3, pivot: {x: 510, y: 832}}],
    mouth: {x: 510, y: 587},
    baseY: 900,
    sparkle: {x: 371, y: 334},
    layers: [
      { name: 'bottom', role: 'hinge', source: require('../../../public/art/vessels/vessel-gashapon-bottom.webp'), pivot: {x: 428, y: 644}, open: [{at: 0, rotate: 0, x: 0, y: 0}, {at: 0.25, rotate: -6, x: 0, y: 0}, {at: 1, rotate: -23, x: -0.1, y: 0.08}] },
      { name: 'top', role: 'hinge', source: require('../../../public/art/vessels/vessel-gashapon-top.webp'), pivot: {x: 592, y: 644}, open: [{at: 0, rotate: 0, x: 0, y: 0}, {at: 0.25, rotate: 6, x: 0, y: 0}, {at: 1, rotate: 27, x: 0.12, y: -0.22, opacity: 0.2}] },
    ],
  },
  // Wave 2 (art PRs #56 B3, #57 B2, #59 B4): generated from design/art/manifest.json vessel blocks.
  'vinyl': {
    assembled: require('../../../public/art/vessels/vessel-vinyl.webp'),
    opening: 'F',
    idleMs: 4000,
    idle: [{type: 'sway', deg: 2.5, pivot: {x: 512, y: 899}}],
    mouth: {x: 512, y: 393},
    baseY: 899,
    sparkle: {x: 764, y: 411},
    layers: [
      { name: 'record', role: 'slide', source: require('../../../public/art/vessels/vessel-vinyl-record.webp'), open: [{at: 0, x: 0, y: 0, scale: 1, opacity: 1}, {at: 0.5, x: 0.06, y: -0.08, scale: 0.82, opacity: 1}, {at: 1, x: 0.12, y: -0.245, scale: 0.65, opacity: 1}] },
      { name: 'sleeve', role: 'static', source: require('../../../public/art/vessels/vessel-vinyl-sleeve.webp') },
    ],
  },
  'vhs': {
    assembled: require('../../../public/art/vessels/vessel-vhs.webp'),
    opening: 'F',
    idleMs: 4000,
    idle: [{type: 'bob', amount: 0.025}],
    mouth: {x: 502, y: 407},
    baseY: 900,
    sparkle: {x: 694, y: 427},
    layers: [
      { name: 'tape', role: 'slide', source: require('../../../public/art/vessels/vessel-vhs-tape.webp'), open: [{at: 0, x: 0, y: 0, scale: 1, opacity: 1}, {at: 0.5, x: 0.06, y: -0.07, scale: 0.84, opacity: 1}, {at: 1, x: 0.13, y: -0.21, scale: 0.63, opacity: 1}] },
      { name: 'sleeve', role: 'static', source: require('../../../public/art/vessels/vessel-vhs-sleeve.webp') },
    ],
  },
  'photo-strip': {
    assembled: require('../../../public/art/vessels/vessel-photo-strip.webp'),
    opening: 'F',
    idleMs: 4000,
    idle: [{type: 'sway', deg: 3, pivot: {x: 514, y: 286}}],
    mouth: {x: 514, y: 425},
    baseY: 898,
    sparkle: {x: 514, y: 624},
    layers: [
      { name: 'strip', role: 'slide', source: require('../../../public/art/vessels/vessel-photo-strip-strip.webp'), open: [{at: 0, x: 0, y: 0, opacity: 1}, {at: 0.5, x: 0.12, y: -0.05, opacity: 1}, {at: 1, x: 0.25, y: -0.1, opacity: 1}] },
      { name: 'sleeve', role: 'static', source: require('../../../public/art/vessels/vessel-photo-strip-sleeve.webp') },
    ],
  },
  'arcade': {
    assembled: require('../../../public/art/vessels/vessel-arcade.webp'),
    opening: 'J',
    idleMs: 4000,
    idle: [{type: 'breathe', amount: 0.025}],
    mouth: {x: 442, y: 716},
    baseY: 900,
    sparkle: {x: 402, y: 578},
    layers: [
      { name: 'cabinet', role: 'static', source: require('../../../public/art/vessels/vessel-arcade-cabinet.webp') },
      { name: 'screen', role: 'fade', source: require('../../../public/art/vessels/vessel-arcade-screen.webp'), open: [{at: 0, opacity: 0.55}, {at: 1, opacity: 1}], idle: [{type: 'glow', base: 0.55, range: 0.4, flicker: 0.08}] },
      { name: 'door', role: 'door', source: require('../../../public/art/vessels/vessel-arcade-door.webp'), pivot: {x: 560, y: 776}, open: [{at: 0, scaleX: 1, opacity: 1}, {at: 1, scaleX: 0.08, opacity: 1}] },
    ],
  },
  'pager': {
    assembled: require('../../../public/art/vessels/vessel-pager.webp'),
    opening: 'F',
    idleMs: 4000,
    idle: [{type: 'tick', deg: 3, pivot: {x: 512, y: 899}}],
    mouth: {x: 499, y: 519},
    baseY: 899,
    sparkle: {x: 437, y: 690},
    layers: [
      { name: 'body', role: 'static', source: require('../../../public/art/vessels/vessel-pager-body.webp') },
      { name: 'screen', role: 'fade', source: require('../../../public/art/vessels/vessel-pager-screen.webp'), open: [{at: 0, opacity: 0.55}, {at: 1, opacity: 1}], idle: [{type: 'glow', base: 0.55, range: 0.4}] },
      { name: 'cover', role: 'slide', source: require('../../../public/art/vessels/vessel-pager-cover.webp'), open: [{at: 0, x: 0, y: 0, scale: 1, opacity: 1}, {at: 0.5, x: 0.05, y: -0.1, scale: 0.85, opacity: 1}, {at: 1, x: 0.15, y: -0.37, scale: 0.68, opacity: 1}] },
    ],
  },
  'rotary-phone': {
    assembled: require('../../../public/art/vessels/vessel-rotary-phone.webp'),
    opening: 'C',
    idleMs: 4000,
    idle: [{type: 'tick', deg: 3, pivot: {x: 512, y: 900}}],
    mouth: {x: 509, y: 428},
    baseY: 900,
    sparkle: {x: 492, y: 657},
    layers: [
      { name: 'phone', role: 'static', source: require('../../../public/art/vessels/vessel-rotary-phone-phone.webp') },
      { name: 'handset', role: 'lift', source: require('../../../public/art/vessels/vessel-rotary-phone-handset.webp'), open: [{at: 0, x: 0, y: 0, scale: 1, opacity: 1}, {at: 0.5, x: 0.04, y: -0.1, scale: 0.9, opacity: 1}, {at: 1, x: 0.09, y: -0.24, scale: 0.78, opacity: 1}] },
    ],
  },
  'umbrella': {
    assembled: require('../../../public/art/vessels/vessel-umbrella.webp'),
    opening: 'F',
    idleMs: 4000,
    idle: [{type: 'sway', deg: 3, pivot: {x: 512, y: 899}}],
    mouth: {x: 507, y: 483},
    baseY: 899,
    sparkle: {x: 470, y: 818},
    layers: [
      { name: 'umbrella', role: 'static', source: require('../../../public/art/vessels/vessel-umbrella-umbrella.webp') },
      { name: 'note', role: 'slide', source: require('../../../public/art/vessels/vessel-umbrella-note.webp'), open: [{at: 0, x: 0, y: 0, opacity: 1}, {at: 0.5, x: 0.13, y: -0.04, opacity: 1}, {at: 1, x: 0.28, y: -0.08, opacity: 1}] },
      { name: 'strap', role: 'fade', source: require('../../../public/art/vessels/vessel-umbrella-strap.webp'), open: [{at: 0, opacity: 1}, {at: 1, opacity: 0}] },
    ],
  },
  'love-padlock': {
    assembled: require('../../../public/art/vessels/vessel-love-padlock.webp'),
    opening: 'A',
    idleMs: 4000,
    idle: [{type: 'sway', deg: 3, pivot: {x: 511, y: 128}}],
    mouth: {x: 511, y: 394},
    baseY: 901,
    sparkle: {x: 658, y: 410},
    layers: [
      { name: 'lock', role: 'static', source: require('../../../public/art/vessels/vessel-love-padlock-lock.webp') },
      { name: 'shackle', role: 'hinge', source: require('../../../public/art/vessels/vessel-love-padlock-shackle.webp'), pivot: {x: 352, y: 402}, open: [{at: 0, rotate: 0}, {at: 0.5, rotate: -18}, {at: 1, rotate: -36}] },
    ],
  },
  'lucky-stars': {
    assembled: require('../../../public/art/vessels/vessel-lucky-stars.webp'),
    opening: 'G',
    idleMs: 4000,
    idle: [{type: 'breathe', amount: 0.025}],
    mouth: {x: 513, y: 276},
    baseY: 900,
    sparkle: {x: 359, y: 357},
    glint: require('../../../public/art/vessels/vessel-lucky-stars-glint.webp'),
    layers: [
      { name: 'jar', role: 'static', source: require('../../../public/art/vessels/vessel-lucky-stars-jar.webp') },
      { name: 'lid', role: 'twist', source: require('../../../public/art/vessels/vessel-lucky-stars-lid.webp'), pivot: {x: 512, y: 227}, open: [{at: 0, x: 0, y: 0, rotate: 0, opacity: 1}, {at: 0.4, x: 0, y: 0, rotate: -12, opacity: 1}, {at: 1, x: 0.25, y: -0.1, rotate: -18, scale: 0.85, opacity: 1}] },
    ],
  },
  'paper-plane': {
    assembled: require('../../../public/art/vessels/vessel-paper-plane.webp'),
    opening: 'E',
    idleMs: 4000,
    idle: [{type: 'float', amount: 0.03}],
    mouth: {x: 507, y: 712},
    baseY: 900,
    sparkle: {x: 530, y: 596},
    layers: [
      { name: 'plane', role: 'static', source: require('../../../public/art/vessels/vessel-paper-plane-plane.webp') },
      { name: 'fold', role: 'hinge', source: require('../../../public/art/vessels/vessel-paper-plane-fold.webp'), pivot: {x: 510, y: 589}, open: [{at: 0, scaleY: 1}, {at: 0.5, scaleY: 0.18}, {at: 1, scaleY: -0.8}] },
    ],
  },
  'lucky-cat': {
    assembled: require('../../../public/art/vessels/vessel-lucky-cat.webp'),
    opening: 'F',
    idleMs: 4000,
    mouth: {x: 534, y: 796},
    baseY: 899,
    sparkle: {x: 530, y: 443},
    layers: [
      { name: 'cat', role: 'static', source: require('../../../public/art/vessels/vessel-lucky-cat-cat.webp') },
      { name: 'paw', role: 'static', source: require('../../../public/art/vessels/vessel-lucky-cat-paw.webp'), pivot: {x: 652, y: 420}, idle: [{type: 'sway', deg: 6, pivot: {x: 652, y: 420}}] },
      { name: 'drawer-closed', role: 'fade', source: require('../../../public/art/vessels/vessel-lucky-cat-drawer-closed.webp'), open: [{at: 0, opacity: 1}, {at: 0.16, opacity: 0}, {at: 1, opacity: 0}] },
      { name: 'drawer', role: 'slide', source: require('../../../public/art/vessels/vessel-lucky-cat-drawer.webp'), pivot: {x: 532, y: 812}, open: [{at: 0, y: 0, scale: 1, opacity: 0}, {at: 0.16, y: 0.016, scale: 1.013, opacity: 1}, {at: 1, y: 0.1, scale: 1.08, opacity: 1}] },
    ],
  },
  'mooncake-tin': {
    assembled: require('../../../public/art/vessels/vessel-mooncake-tin.webp'),
    opening: 'A',
    idleMs: 4000,
    idle: [{type: 'breathe', amount: 0.025}],
    mouth: {x: 512, y: 508},
    baseY: 899,
    sparkle: {x: 460, y: 356},
    layers: [
      { name: 'tin', role: 'static', source: require('../../../public/art/vessels/vessel-mooncake-tin-tin.webp') },
      { name: 'lid', role: 'hinge', source: require('../../../public/art/vessels/vessel-mooncake-tin-lid.webp'), pivot: {x: 512, y: 326}, open: [{at: 0, scaleY: 1, opacity: 1}, {at: 1, scaleY: -0.85, opacity: 1}] },
    ],
  },
  'cake-box': {
    assembled: require('../../../public/art/vessels/vessel-cake-box.webp'),
    opening: 'B',
    idleMs: 4000,
    idle: [{type: 'bob', amount: 0.025}],
    mouth: {x: 496, y: 362},
    baseY: 899,
    sparkle: {x: 447, y: 533},
    layers: [
      { name: 'box', role: 'static', source: require('../../../public/art/vessels/vessel-cake-box-box.webp') },
      { name: 'flame', role: 'fade', source: require('../../../public/art/vessels/vessel-cake-box-flame.webp'), open: [{at: 0, opacity: 1}, {at: 1, opacity: 0}], idle: [{type: 'glow', base: 0.7, range: 0.3, flicker: 0.12}] },
      { name: 'lid', role: 'lift', source: require('../../../public/art/vessels/vessel-cake-box-lid.webp'), open: [{at: 0, y: 0, opacity: 1}, {at: 1, y: -0.55, opacity: 0}] },
    ],
  },
  'candy-box': {
    assembled: require('../../../public/art/vessels/vessel-candy-box.webp'),
    opening: 'A',
    idleMs: 4000,
    idle: [{type: 'breathe', amount: 0.025}],
    mouth: {x: 512, y: 466},
    baseY: 901,
    sparkle: {x: 508, y: 400},
    layers: [
      { name: 'box', role: 'static', source: require('../../../public/art/vessels/vessel-candy-box-box.webp') },
      { name: 'lid', role: 'hinge', source: require('../../../public/art/vessels/vessel-candy-box-lid.webp'), pivot: {x: 512, y: 233}, open: [{at: 0, scaleY: 1, opacity: 1}, {at: 1, scaleY: -0.85, opacity: 1}] },
    ],
  },
  'chocolate-heart': {
    assembled: require('../../../public/art/vessels/vessel-chocolate-heart.webp'),
    opening: 'B',
    idleMs: 4000,
    idle: [{type: 'breathe', amount: 0.03}],
    mouth: {x: 506, y: 480},
    baseY: 899,
    sparkle: {x: 469, y: 439},
    layers: [
      { name: 'box', role: 'static', source: require('../../../public/art/vessels/vessel-chocolate-heart-box.webp') },
      { name: 'lid', role: 'lift', source: require('../../../public/art/vessels/vessel-chocolate-heart-lid.webp'), open: [{at: 0, y: 0, opacity: 1}, {at: 1, y: -0.55, opacity: 0}] },
    ],
  },
  'stocking': {
    assembled: require('../../../public/art/vessels/vessel-stocking.webp'),
    opening: 'K',
    idleMs: 4000,
    mouth: {x: 428, y: 330},
    baseY: 899,
    sparkle: {x: 493, y: 181},
    layers: [
      { name: 'hook', role: 'static', source: require('../../../public/art/vessels/vessel-stocking-hook.webp') },
      { name: 'stocking', role: 'static', source: require('../../../public/art/vessels/vessel-stocking-stocking.webp'), idle: [{type: 'sway', deg: 3, pivot: {x: 494, y: 181}}] },
      { name: 'letter', role: 'pop', source: require('../../../public/art/vessels/vessel-stocking-letter.webp'), pivot: {x: 413, y: 249}, open: [{at: 0, y: 0, scaleY: 0.6}, {at: 0.8, y: -0.22, scaleY: 1}, {at: 1, y: -0.19, scaleY: 1}], idle: [{type: 'sway', deg: 3, pivot: {x: 494, y: 181}}] },
    ],
  },
  'pumpkin': {
    assembled: require('../../../public/art/vessels/vessel-pumpkin.webp'),
    opening: 'C',
    idleMs: 4000,
    mouth: {x: 517, y: 374},
    baseY: 901,
    sparkle: {x: 525, y: 280},
    layers: [
      { name: 'interior', role: 'static', source: require('../../../public/art/vessels/vessel-pumpkin-interior.webp') },
      { name: 'glow', role: 'fade', source: require('../../../public/art/vessels/vessel-pumpkin-glow.webp'), open: [{at: 0, opacity: 1}, {at: 1, opacity: 0}], idle: [{type: 'glow', base: 0.7, range: 0.3, flicker: 0.15}] },
      { name: 'pumpkin', role: 'static', source: require('../../../public/art/vessels/vessel-pumpkin-pumpkin.webp') },
      { name: 'lid', role: 'lift', source: require('../../../public/art/vessels/vessel-pumpkin-lid.webp'), open: [{at: 0, y: 0, opacity: 1}, {at: 1, y: -0.55, opacity: 0}] },
    ],
  },
  'rice-dumpling': {
    assembled: require('../../../public/art/vessels/vessel-rice-dumpling.webp'),
    opening: 'E',
    idleMs: 4000,
    idle: [{type: 'bob', amount: 0.025}],
    mouth: {x: 509, y: 483},
    baseY: 899,
    sparkle: {x: 508, y: 633},
    layers: [
      { name: 'dumpling', role: 'static', source: require('../../../public/art/vessels/vessel-rice-dumpling-dumpling.webp') },
      { name: 'string', role: 'fade', source: require('../../../public/art/vessels/vessel-rice-dumpling-string.webp'), open: [{at: 0, opacity: 1}, {at: 0.2, opacity: 0}, {at: 1, opacity: 0}] },
      { name: 'leaf', role: 'hinge', source: require('../../../public/art/vessels/vessel-rice-dumpling-leaf.webp'), pivot: {x: 523, y: 234}, open: [{at: 0, rotate: 0, opacity: 1}, {at: 0.2, rotate: 0, opacity: 1}, {at: 1, rotate: -105, opacity: 0.3}] },
    ],
  },
  'wish-tag': {
    assembled: require('../../../public/art/vessels/vessel-wish-tag.webp'),
    opening: 'B',
    idleMs: 4000,
    idle: [{type: 'sway', deg: 3, pivot: {x: 406, y: 840}}],
    mouth: {x: 546, y: 399},
    baseY: 900,
    sparkle: {x: 543, y: 400},
    layers: [
      { name: 'bamboo', role: 'static', source: require('../../../public/art/vessels/vessel-wish-tag-bamboo.webp') },
      { name: 'knot', role: 'fade', source: require('../../../public/art/vessels/vessel-wish-tag-knot.webp'), open: [{at: 0, opacity: 1}, {at: 0.25, opacity: 0}, {at: 1, opacity: 0}] },
      { name: 'tag', role: 'lift', source: require('../../../public/art/vessels/vessel-wish-tag-tag.webp'), open: [{at: 0, y: 0, opacity: 1}, {at: 0.25, y: 0, opacity: 1}, {at: 1, y: -0.55, opacity: 0}] },
    ],
  },
  'river-lantern': {
    assembled: require('../../../public/art/vessels/vessel-river-lantern.webp'),
    opening: 'C',
    idleMs: 4000,
    idle: [{type: 'float', amount: 0.03}],
    mouth: {x: 513, y: 547},
    baseY: 903,
    sparkle: {x: 513, y: 320},
    layers: [
      { name: 'water', role: 'static', source: require('../../../public/art/vessels/vessel-river-lantern-water.webp'), ground: true },
      { name: 'interior', role: 'static', source: require('../../../public/art/vessels/vessel-river-lantern-interior.webp') },
      { name: 'glow', role: 'fade', source: require('../../../public/art/vessels/vessel-river-lantern-glow.webp'), open: [{at: 0, opacity: 1}, {at: 1, opacity: 1}], idle: [{type: 'glow', base: 0.7, range: 0.3}] },
      { name: 'lantern', role: 'static', source: require('../../../public/art/vessels/vessel-river-lantern-lantern.webp') },
      { name: 'top', role: 'lift', source: require('../../../public/art/vessels/vessel-river-lantern-top.webp'), open: [{at: 0, y: 0, opacity: 1}, {at: 1, y: -0.55, opacity: 0}] },
    ],
  },
  'red-bird': {
    assembled: require('../../../public/art/vessels/vessel-red-bird.webp'),
    opening: 'A', idleMs: 4200, idle: [],
    mouth: { x: 513, y: 668 }, baseY: 900, sparkle: { x: 297, y: 754 },
    layers: [
      { name: 'box', role: 'static', source: require('../../../public/art/vessels/vessel-red-bird-box.webp') },
      { name: 'lid', role: 'hinge', pivot: { x: 664, y: 550 }, source: require('../../../public/art/vessels/vessel-red-bird-lid.webp'),
        open: [{ at: 0, rotate: 0, y: 0, scaleY: 1, opacity: 1 }, { at: 1, rotate: -15, y: -.12, scaleY: .65, opacity: 1 }] },
      { name: 'shadow', role: 'hinge', pivot: { x: 664, y: 550 }, source: require('../../../public/art/vessels/vessel-red-bird-shadow.webp'),
        open: [{ at: 0, rotate: 0, y: 0, scaleY: 1, opacity: 1 }, { at: 1, rotate: -15, y: -.12, scaleY: .65, opacity: 1 }],
        idle: [{ type: 'sway', deg: 4, pivot: { x: 517, y: 672 } }] },
    ],
  },
  'clock-tower': {
    assembled: require('../../../public/art/vessels/vessel-clock-tower.webp'),
    opening: 'J',
    idleMs: 4200,
    idle: [{type: 'breathe', amount: 0.025}],
    mouth: {x: 494, y: 371},
    baseY: 899,
    sparkle: {x: 554, y: 399},
    layers: [
      { name: 'tower', role: 'static', source: require('../../../public/art/vessels/vessel-clock-tower-tower.webp') },
      { name: 'door', role: 'door', source: require('../../../public/art/vessels/vessel-clock-tower-door.webp'), pivot: {x: 444, y: 397}, open: [{at: 0, scaleX: 1}, {at: 0.3, scaleX: 1}, {at: 1, scaleX: 0.04}] },
      { name: 'hands', role: 'fade', source: require('../../../public/art/vessels/vessel-clock-tower-hands.webp'), pivot: {x: 495, y: 399}, open: [{at: 0, opacity: 1}, {at: 0.3, opacity: 0}, {at: 1, opacity: 0}], idle: [{type: 'tick', deg: 6, pivot: {x: 495, y: 399}}] },
    ],
  },
  'senado-fountain': {
    assembled: require('../../../public/art/vessels/vessel-senado-fountain.webp'),
    opening: 'B',
    idleMs: 4000,
    idle: [{type: 'breathe', amount: 0.025}],
    mouth: {x: 511, y: 545},
    baseY: 900,
    sparkle: {x: 535, y: 455},
    layers: [
      { name: 'box', role: 'static', source: require('../../../public/art/vessels/vessel-senado-fountain-box.webp') },
      { name: 'lid', role: 'lift', source: require('../../../public/art/vessels/vessel-senado-fountain-lid.webp'), pivot: {x: 511, y: 586}, open: [{at: 0, y: 0, opacity: 1}, {at: 0.65, y: -0.4, opacity: 0.65}, {at: 1, y: -0.65, opacity: 0}] },
    ],
  },
  'bamboo-tower': {
    assembled: require('../../../public/art/vessels/vessel-bamboo-tower.webp'),
    opening: 'C',
    idleMs: 4000,
    idle: [{type: 'sway', deg: 2.5, pivot: {x: 513, y: 898}}],
    mouth: {x: 513, y: 538},
    baseY: 899,
    sparkle: {x: 435, y: 540},
    layers: [
      { name: 'tin', role: 'static', source: require('../../../public/art/vessels/vessel-bamboo-tower-tin.webp') },
      { name: 'top', role: 'lift', source: require('../../../public/art/vessels/vessel-bamboo-tower-top.webp'), pivot: {x: 513, y: 540}, open: [{at: 0, y: 0, opacity: 1}, {at: 0.65, y: -0.4, opacity: 0.65}, {at: 1, y: -0.65, opacity: 0}] },
    ],
  },
  'gate-lantern': {
    assembled: require('../../../public/art/vessels/vessel-gate-lantern.webp'),
    opening: 'C',
    idleMs: 4000,
    idle: [{type: 'sway', deg: 3, pivot: {x: 511, y: 153}}],
    mouth: {x: 507, y: 267},
    baseY: 899,
    sparkle: {x: 503, y: 197},
    layers: [
      { name: 'glow', role: 'fade', source: require('../../../public/art/vessels/vessel-gate-lantern-glow.webp'), open: [{at: 0, opacity: 1}, {at: 1, opacity: 0}], idle: [{type: 'glow', base: 0.35, range: 0.65}] },
      { name: 'lantern', role: 'static', source: require('../../../public/art/vessels/vessel-gate-lantern-lantern.webp') },
      { name: 'cap', role: 'lift', source: require('../../../public/art/vessels/vessel-gate-lantern-cap.webp'), pivot: {x: 511, y: 274}, open: [{at: 0, y: 0, opacity: 1}, {at: 0.65, y: -0.4, opacity: 0.65}, {at: 1, y: -0.65, opacity: 0}] },
    ],
  },
  'torii-scroll': {
    assembled: require('../../../public/art/vessels/vessel-torii-scroll.webp'),
    opening: 'F',
    idleMs: 4000,
    idle: [{type: 'bob', amount: 0.025}],
    mouth: {x: 497, y: 768},
    baseY: 899,
    sparkle: {x: 340, y: 785},
    layers: [
      { name: 'gate', role: 'static', source: require('../../../public/art/vessels/vessel-torii-scroll-gate.webp') },
      { name: 'scroll', role: 'slide', source: require('../../../public/art/vessels/vessel-torii-scroll-scroll.webp'), open: [{at: 0, x: 0, y: 0, scale: 1}, {at: 1, x: 0.025, y: -0.36, scale: 1.08}] },
    ],
  },
  'palace-pavilion': {
    assembled: require('../../../public/art/vessels/vessel-palace-pavilion.webp'),
    opening: 'B',
    idleMs: 4000,
    idle: [{type: 'breathe', amount: 0.025}],
    mouth: {x: 508, y: 590},
    baseY: 899,
    sparkle: {x: 865, y: 503},
    layers: [
      { name: 'base', role: 'static', source: require('../../../public/art/vessels/vessel-palace-pavilion-base.webp') },
      { name: 'roof', role: 'lift', source: require('../../../public/art/vessels/vessel-palace-pavilion-roof.webp'), pivot: {x: 508, y: 640}, open: [{at: 0, y: 0, opacity: 1}, {at: 0.65, y: -0.4, opacity: 0.65}, {at: 1, y: -0.65, opacity: 0}] },
    ],
  },
  'lionfish-fountain': {
    assembled: require('../../../public/art/vessels/vessel-lionfish-fountain.webp'),
    opening: 'D',
    idleMs: 4000,
    idle: [{type: 'bob', amount: 0.025}],
    mouth: {x: 516, y: 330},
    baseY: 899,
    sparkle: {x: 358, y: 563},
    layers: [
      { name: 'bottle', role: 'static', source: require('../../../public/art/vessels/vessel-lionfish-fountain-bottle.webp') },
      { name: 'spray', role: 'fade', source: require('../../../public/art/vessels/vessel-lionfish-fountain-spray.webp'), open: [{at: 0, opacity: 1}, {at: 1, y: -0.16, opacity: 0}], idle: [{type: 'drift', amount: 0.03}] },
      { name: 'stopper', role: 'hinge', source: require('../../../public/art/vessels/vessel-lionfish-fountain-stopper.webp'), pivot: {x: 516, y: 345}, open: [{at: 0, y: 0, rotate: 0, opacity: 1}, {at: 0.35, y: -0.12, rotate: -12, opacity: 1}, {at: 1, x: 0.17, y: -0.3, rotate: -25, opacity: 0}] },
    ],
  },
  'golden-roof': {
    assembled: require('../../../public/art/vessels/vessel-golden-roof.webp'),
    opening: 'B',
    idleMs: 4000,
    idle: [{type: 'breathe', amount: 0.025}],
    mouth: {x: 509, y: 636},
    baseY: 899,
    sparkle: {x: 679, y: 556},
    layers: [
      { name: 'box', role: 'static', source: require('../../../public/art/vessels/vessel-golden-roof-box.webp') },
      { name: 'roof', role: 'lift', source: require('../../../public/art/vessels/vessel-golden-roof-roof.webp'), pivot: {x: 509, y: 674}, open: [{at: 0, y: 0, opacity: 1}, {at: 0.65, y: -0.4, opacity: 0.65}, {at: 1, y: -0.65, opacity: 0}] },
    ],
  },
  'gate-lacquer': {
    assembled: require('../../../public/art/vessels/vessel-gate-lacquer.webp'),
    opening: 'B',
    idleMs: 4000,
    idle: [{type: 'breathe', amount: 0.025}],
    mouth: {x: 510, y: 546},
    baseY: 899,
    sparkle: {x: 400, y: 685},
    layers: [
      { name: 'box', role: 'static', source: require('../../../public/art/vessels/vessel-gate-lacquer-box.webp') },
      { name: 'roof', role: 'lift', source: require('../../../public/art/vessels/vessel-gate-lacquer-roof.webp'), pivot: {x: 510, y: 593}, open: [{at: 0, y: 0, opacity: 1}, {at: 0.65, y: -0.4, opacity: 0.65}, {at: 1, y: -0.65, opacity: 0}] },
    ],
  },
  'twin-towers': {
    assembled: require('../../../public/art/vessels/vessel-twin-towers.webp'),
    opening: 'C',
    idleMs: 4000,
    mouth: {x: 362, y: 330},
    baseY: 899,
    sparkle: {x: 510, y: 541},
    layers: [
      { name: 'towers', role: 'static', source: require('../../../public/art/vessels/vessel-twin-towers-towers.webp') },
      { name: 'glow', role: 'fade', source: require('../../../public/art/vessels/vessel-twin-towers-glow.webp'), open: [{at: 0, opacity: 1}, {at: 1, opacity: 0}], idle: [{type: 'glow', base: 0.25, range: 0.75}] },
      { name: 'tops', role: 'lift', source: require('../../../public/art/vessels/vessel-twin-towers-tops.webp'), pivot: {x: 510, y: 348}, open: [{at: 0, y: 0, opacity: 1}, {at: 0.65, y: -0.4, opacity: 0.65}, {at: 1, y: -0.65, opacity: 0}] },
    ],
  },
  // Final 20 vessels: copied from the approved art manifest.
  "hot-air-balloon": {
    "assembled": require('../../../public/art/vessels/vessel-hot-air-balloon.webp'),
    "opening": "B",
    "idleMs": 4000,
    "idle": [
      {
        "type": "float",
        "amount": 0.03
      }
    ],
    "mouth": {
      "x": 512,
      "y": 719
    },
    "baseY": 899,
    "sparkle": {
      "x": 407,
      "y": 760
    },
    "layers": [
      {
        "name": "basket",
        "role": "static",
        "source": require('../../../public/art/vessels/vessel-hot-air-balloon-basket.webp')
      },
      {
        "name": "balloon",
        "role": "lift",
        "pivot": {
          "x": 512,
          "y": 678
        },
        "open": [
          {
            "at": 0,
            "y": 0,
            "opacity": 1
          },
          {
            "at": 0.5,
            "y": -0.1,
            "opacity": 0.85
          },
          {
            "at": 1,
            "y": -0.65,
            "opacity": 0
          }
        ],
        "source": require('../../../public/art/vessels/vessel-hot-air-balloon-balloon.webp')
      }
    ]
  },
  "bubble-tea": {
    "assembled": require('../../../public/art/vessels/vessel-bubble-tea.webp'),
    "opening": "C",
    "idleMs": 4000,
    "idle": [
      {
        "type": "bob",
        "amount": 0.025
      }
    ],
    "mouth": {
      "x": 513,
      "y": 395
    },
    "baseY": 899,
    "sparkle": {
      "x": 321,
      "y": 462
    },
    "layers": [
      {
        "name": "cup",
        "role": "static",
        "source": require('../../../public/art/vessels/vessel-bubble-tea-cup.webp')
      },
      {
        "name": "lid",
        "role": "lift",
        "pivot": {
          "x": 513,
          "y": 391
        },
        "open": [
          {
            "at": 0,
            "y": 0,
            "opacity": 1
          },
          {
            "at": 1,
            "y": -0.45,
            "opacity": 0
          }
        ],
        "source": require('../../../public/art/vessels/vessel-bubble-tea-lid.webp')
      }
    ]
  },
  "dim-sum-steamer": {
    "assembled": require('../../../public/art/vessels/vessel-dim-sum-steamer.webp'),
    "opening": "B",
    "idleMs": 4000,
    "idle": [
      {
        "type": "breathe",
        "amount": 0.025
      }
    ],
    "mouth": {
      "x": 522,
      "y": 478
    },
    "baseY": 898,
    "sparkle": {
      "x": 673,
      "y": 608
    },
    "layers": [
      {
        "name": "steamer",
        "role": "static",
        "source": require('../../../public/art/vessels/vessel-dim-sum-steamer-steamer.webp')
      },
      {
        "name": "steam",
        "role": "fade",
        "open": [
          {
            "at": 0,
            "opacity": 1
          },
          {
            "at": 1,
            "opacity": 0
          }
        ],
        "idle": [
          {
            "type": "drift",
            "amount": 0.03
          }
        ],
        "source": require('../../../public/art/vessels/vessel-dim-sum-steamer-steam.webp')
      },
      {
        "name": "lid",
        "role": "lift",
        "pivot": {
          "x": 522,
          "y": 519
        },
        "open": [
          {
            "at": 0,
            "y": 0,
            "opacity": 1
          },
          {
            "at": 1,
            "y": -0.45,
            "opacity": 0
          }
        ],
        "source": require('../../../public/art/vessels/vessel-dim-sum-steamer-lid.webp')
      }
    ]
  },
  "bento": {
    "assembled": require('../../../public/art/vessels/vessel-bento.webp'),
    "opening": "B",
    "idleMs": 4000,
    "idle": [
      {
        "type": "breathe",
        "amount": 0.025
      }
    ],
    "mouth": {
      "x": 518,
      "y": 507
    },
    "baseY": 899,
    "sparkle": {
      "x": 816,
      "y": 666
    },
    "layers": [
      {
        "name": "box",
        "role": "static",
        "source": require('../../../public/art/vessels/vessel-bento-box.webp')
      },
      {
        "name": "lid",
        "role": "lift",
        "pivot": {
          "x": 518,
          "y": 503
        },
        "open": [
          {
            "at": 0,
            "y": 0,
            "opacity": 1
          },
          {
            "at": 0.35,
            "y": 0,
            "opacity": 1
          },
          {
            "at": 1,
            "y": -0.48,
            "opacity": 0
          }
        ],
        "source": require('../../../public/art/vessels/vessel-bento-lid.webp')
      },
      {
        "name": "knot",
        "role": "fade",
        "open": [
          {
            "at": 0,
            "opacity": 1
          },
          {
            "at": 0.35,
            "opacity": 0
          },
          {
            "at": 1,
            "opacity": 0
          }
        ],
        "source": require('../../../public/art/vessels/vessel-bento-knot.webp')
      }
    ]
  },
  "paper-cranes": {
    "assembled": require('../../../public/art/vessels/vessel-paper-cranes.webp'),
    "opening": "G",
    "idleMs": 4000,
    "idle": [
      {
        "type": "breathe",
        "amount": 0.025
      }
    ],
    "mouth": {
      "x": 514,
      "y": 321
    },
    "baseY": 900,
    "sparkle": {
      "x": 281,
      "y": 427
    },
    "glint": require('../../../public/art/vessels/vessel-paper-cranes-glint.webp'),
    "layers": [
      {
        "name": "jar",
        "role": "static",
        "source": require('../../../public/art/vessels/vessel-paper-cranes-jar.webp')
      },
      {
        "name": "lid",
        "role": "twist",
        "pivot": {
          "x": 514,
          "y": 329
        },
        "open": [
          {
            "at": 0,
            "rotate": 0,
            "y": 0,
            "opacity": 1
          },
          {
            "at": 0.3,
            "rotate": -12,
            "y": 0,
            "opacity": 1
          },
          {
            "at": 1,
            "rotate": -12,
            "y": -0.4,
            "opacity": 0
          }
        ],
        "source": require('../../../public/art/vessels/vessel-paper-cranes-lid.webp')
      }
    ]
  },
  "heart-locket": {
    "assembled": require('../../../public/art/vessels/vessel-heart-locket.webp'),
    "opening": "J",
    "idleMs": 4000,
    "idle": [],
    "mouth": {
      "x": 584,
      "y": 458
    },
    "baseY": 899,
    "sparkle": {
      "x": 341,
      "y": 220
    },
    "layers": [
      {
        "name": "stand",
        "role": "static",
        "source": require('../../../public/art/vessels/vessel-heart-locket-stand.webp')
      },
      {
        "name": "back",
        "role": "static",
        "idle": [
          {
            "type": "sway",
            "deg": 4,
            "pivot": {
              "x": 584,
              "y": 204
            }
          }
        ],
        "source": require('../../../public/art/vessels/vessel-heart-locket-back.webp')
      },
      {
        "name": "front",
        "role": "hinge",
        "pivot": {
          "x": 414,
          "y": 550
        },
        "open": [
          {
            "at": 0,
            "scaleX": 1
          },
          {
            "at": 1,
            "scaleX": 0.03
          }
        ],
        "idle": [
          {
            "type": "sway",
            "deg": 4,
            "pivot": {
              "x": 584,
              "y": 204
            }
          }
        ],
        "source": require('../../../public/art/vessels/vessel-heart-locket-front.webp')
      }
    ]
  },
  "suitcase": {
    "assembled": require('../../../public/art/vessels/vessel-suitcase.webp'),
    "opening": "A",
    "idleMs": 4000,
    "idle": [
      {
        "type": "bob",
        "amount": 0.025
      }
    ],
    "mouth": {
      "x": 507,
      "y": 514
    },
    "baseY": 899,
    "sparkle": {
      "x": 792,
      "y": 445
    },
    "layers": [
      {
        "name": "case",
        "role": "static",
        "source": require('../../../public/art/vessels/vessel-suitcase-case.webp')
      },
      {
        "name": "lid",
        "role": "hinge",
        "pivot": {
          "x": 507,
          "y": 397
        },
        "open": [
          {
            "at": 0,
            "rotate": 0,
            "opacity": 1
          },
          {
            "at": 0.5,
            "rotate": -30,
            "opacity": 0.8
          },
          {
            "at": 1,
            "rotate": -65,
            "opacity": 0
          }
        ],
        "source": require('../../../public/art/vessels/vessel-suitcase-lid.webp')
      }
    ]
  },
  "postbox": {
    "assembled": require('../../../public/art/vessels/vessel-postbox.webp'),
    "opening": "J",
    "idleMs": 4000,
    "idle": [
      {
        "type": "breathe",
        "amount": 0.025
      }
    ],
    "mouth": {
      "x": 508,
      "y": 417
    },
    "baseY": 900,
    "sparkle": {
      "x": 394,
      "y": 400
    },
    "layers": [
      {
        "name": "box",
        "role": "static",
        "source": require('../../../public/art/vessels/vessel-postbox-box.webp')
      },
      {
        "name": "door",
        "role": "hinge",
        "pivot": {
          "x": 635,
          "y": 602
        },
        "open": [
          {
            "at": 0,
            "scaleX": 1
          },
          {
            "at": 1,
            "scaleX": 0.03
          }
        ],
        "source": require('../../../public/art/vessels/vessel-postbox-door.webp')
      }
    ]
  },
  "camp-lantern": {
    "assembled": require('../../../public/art/vessels/vessel-camp-lantern.webp'),
    "opening": "C",
    "idleMs": 4000,
    "idle": [],
    "mouth": {
      "x": 518,
      "y": 407
    },
    "baseY": 899,
    "sparkle": {
      "x": 388,
      "y": 672
    },
    "layers": [
      {
        "name": "backing",
        "role": "static",
        "source": require('../../../public/art/vessels/vessel-camp-lantern-backing.webp')
      },
      {
        "name": "glow",
        "role": "fade",
        "open": [
          {
            "at": 0,
            "opacity": 1
          },
          {
            "at": 1,
            "opacity": 1
          }
        ],
        "idle": [
          {
            "type": "glow",
            "base": 0.65,
            "range": 0.3,
            "flicker": 0.06
          }
        ],
        "source": require('../../../public/art/vessels/vessel-camp-lantern-glow.webp')
      },
      {
        "name": "lantern",
        "role": "static",
        "source": require('../../../public/art/vessels/vessel-camp-lantern-lantern.webp')
      },
      {
        "name": "cap",
        "role": "lift",
        "pivot": {
          "x": 518,
          "y": 357
        },
        "open": [
          {
            "at": 0,
            "y": 0,
            "opacity": 1
          },
          {
            "at": 1,
            "y": -0.45,
            "opacity": 0
          }
        ],
        "source": require('../../../public/art/vessels/vessel-camp-lantern-cap.webp')
      }
    ]
  },
  "treasure-chest": {
    "assembled": require('../../../public/art/vessels/vessel-treasure-chest.webp'),
    "opening": "A",
    "idleMs": 4000,
    "idle": [
      {
        "type": "breathe",
        "amount": 0.025
      }
    ],
    "mouth": {
      "x": 502,
      "y": 530
    },
    "baseY": 899,
    "sparkle": {
      "x": 600,
      "y": 591
    },
    "layers": [
      {
        "name": "chest",
        "role": "static",
        "source": require('../../../public/art/vessels/vessel-treasure-chest-chest.webp')
      },
      {
        "name": "lid",
        "role": "hinge",
        "pivot": {
          "x": 502,
          "y": 444
        },
        "open": [
          {
            "at": 0,
            "rotate": 0,
            "opacity": 1
          },
          {
            "at": 0.5,
            "rotate": -30,
            "opacity": 0.8
          },
          {
            "at": 1,
            "rotate": -65,
            "opacity": 0
          }
        ],
        "source": require('../../../public/art/vessels/vessel-treasure-chest-lid.webp')
      }
    ]
  },
  "spellbook": {
    "assembled": require('../../../public/art/vessels/vessel-spellbook.webp'),
    "opening": "J",
    "idleMs": 3900,
    "idle": [
      {
        "type": "breathe",
        "amount": 0.025
      }
    ],
    "mouth": {
      "x": 551,
      "y": 518
    },
    "baseY": 898,
    "sparkle": {
      "x": 735,
      "y": 283
    },
    "layers": [
      {
        "name": "book",
        "role": "static",
        "source": require('../../../public/art/vessels/vessel-spellbook-book.webp')
      },
      {
        "name": "glow",
        "role": "fade",
        "open": [
          {
            "at": 0,
            "opacity": 1
          },
          {
            "at": 1,
            "opacity": 1
          }
        ],
        "idle": [
          {
            "type": "glow",
            "base": 0.85,
            "range": 0.15
          }
        ],
        "source": require('../../../public/art/vessels/vessel-spellbook-glow.webp')
      },
      {
        "name": "cover",
        "role": "hinge",
        "pivot": {
          "x": 312,
          "y": 587
        },
        "open": [
          {
            "at": 0,
            "scaleX": 1,
            "opacity": 1
          },
          {
            "at": 0.5,
            "scaleX": 0.55,
            "opacity": 1
          },
          {
            "at": 1,
            "scaleX": 0.04,
            "opacity": 0
          }
        ],
        "source": require('../../../public/art/vessels/vessel-spellbook-cover.webp')
      },
      {
        "name": "clasp",
        "role": "fade",
        "open": [
          {
            "at": 0,
            "opacity": 1
          },
          {
            "at": 0.25,
            "opacity": 0
          }
        ],
        "source": require('../../../public/art/vessels/vessel-spellbook-clasp.webp')
      }
    ]
  },
  "escape-pod": {
    "assembled": require('../../../public/art/vessels/vessel-escape-pod.webp'),
    "opening": "A",
    "idleMs": 4000,
    "idle": [
      {
        "type": "float",
        "amount": 0.03
      }
    ],
    "mouth": {
      "x": 619,
      "y": 508
    },
    "baseY": 899,
    "sparkle": {
      "x": 402,
      "y": 469
    },
    "layers": [
      {
        "name": "pod",
        "role": "static",
        "source": require('../../../public/art/vessels/vessel-escape-pod-pod.webp')
      },
      {
        "name": "glow",
        "role": "fade",
        "open": [
          {
            "at": 0,
            "opacity": 1
          },
          {
            "at": 1,
            "opacity": 1
          }
        ],
        "idle": [
          {
            "type": "glow",
            "base": 0.8,
            "range": 0.2
          }
        ],
        "source": require('../../../public/art/vessels/vessel-escape-pod-glow.webp')
      },
      {
        "name": "hatch",
        "role": "hinge",
        "pivot": {
          "x": 776,
          "y": 527
        },
        "open": [
          {
            "at": 0,
            "scaleX": 1,
            "opacity": 1
          },
          {
            "at": 1,
            "scaleX": 0.05,
            "opacity": 0
          }
        ],
        "source": require('../../../public/art/vessels/vessel-escape-pod-hatch.webp')
      }
    ]
  },
  "crystal-ball": {
    "assembled": require('../../../public/art/vessels/vessel-crystal-ball.webp'),
    "opening": "B",
    "idleMs": 4200,
    "idle": [
      {
        "type": "breathe",
        "amount": 0.025
      }
    ],
    "mouth": {
      "x": 512,
      "y": 647
    },
    "baseY": 900,
    "sparkle": {
      "x": 283,
      "y": 251
    },
    "layers": [
      {
        "name": "stand",
        "role": "static",
        "source": require('../../../public/art/vessels/vessel-crystal-ball-stand.webp')
      },
      {
        "name": "mist",
        "role": "fade",
        "open": [
          {
            "at": 0,
            "opacity": 1
          },
          {
            "at": 1,
            "opacity": 0
          }
        ],
        "idle": [
          {
            "type": "glow",
            "base": 0.75,
            "range": 0.25
          }
        ],
        "source": require('../../../public/art/vessels/vessel-crystal-ball-mist.webp')
      },
      {
        "name": "ball",
        "role": "lift",
        "open": [
          {
            "at": 0,
            "y": 0,
            "opacity": 1
          },
          {
            "at": 1,
            "y": -0.45,
            "opacity": 0
          }
        ],
        "source": require('../../../public/art/vessels/vessel-crystal-ball-ball.webp')
      }
    ]
  },
  "wishing-lamp": {
    "assembled": require('../../../public/art/vessels/vessel-wishing-lamp.webp'),
    "opening": "C",
    "idleMs": 4000,
    "idle": [
      {
        "type": "bob",
        "amount": 0.025
      }
    ],
    "mouth": {
      "x": 542,
      "y": 685
    },
    "baseY": 889,
    "sparkle": {
      "x": 532,
      "y": 662
    },
    "layers": [
      {
        "name": "lamp",
        "role": "static",
        "source": require('../../../public/art/vessels/vessel-wishing-lamp-lamp.webp')
      },
      {
        "name": "smoke",
        "role": "fade",
        "open": [
          {
            "at": 0,
            "opacity": 1
          },
          {
            "at": 1,
            "opacity": 0
          }
        ],
        "idle": [
          {
            "type": "drift",
            "amount": 0.03
          }
        ],
        "source": require('../../../public/art/vessels/vessel-wishing-lamp-smoke.webp')
      },
      {
        "name": "lid",
        "role": "lift",
        "pivot": {
          "x": 542,
          "y": 685
        },
        "open": [
          {
            "at": 0,
            "opacity": 1
          },
          {
            "at": 1,
            "y": -0.4,
            "opacity": 0
          }
        ],
        "source": require('../../../public/art/vessels/vessel-wishing-lamp-lid.webp')
      }
    ]
  },
  "potion": {
    "assembled": require('../../../public/art/vessels/vessel-potion.webp'),
    "opening": "D",
    "idleMs": 4000,
    "idle": [
      {
        "type": "bob",
        "amount": 0.025
      }
    ],
    "mouth": {
      "x": 516,
      "y": 306
    },
    "baseY": 899,
    "sparkle": {
      "x": 450,
      "y": 298
    },
    "layers": [
      {
        "name": "flask",
        "role": "static",
        "source": require('../../../public/art/vessels/vessel-potion-flask.webp')
      },
      {
        "name": "bubbles",
        "role": "fade",
        "open": [
          {
            "at": 0,
            "opacity": 1
          },
          {
            "at": 1,
            "opacity": 0
          }
        ],
        "idle": [
          {
            "type": "drift",
            "amount": 0.03
          }
        ],
        "source": require('../../../public/art/vessels/vessel-potion-bubbles.webp')
      },
      {
        "name": "cork",
        "role": "hinge",
        "pivot": {
          "x": 403,
          "y": 153
        },
        "open": [
          {
            "at": 0,
            "opacity": 1
          },
          {
            "at": 1,
            "y": -0.36,
            "rotate": -10,
            "opacity": 0
          }
        ],
        "source": require('../../../public/art/vessels/vessel-potion-cork.webp')
      }
    ]
  },
  "pocket-watch": {
    "assembled": require('../../../public/art/vessels/vessel-pocket-watch.webp'),
    "opening": "A",
    "idleMs": 4000,
    "idle": [
      {
        "type": "sway",
        "deg": 4,
        "pivot": {
          "x": 461,
          "y": 175
        }
      }
    ],
    "mouth": {
      "x": 429,
      "y": 811
    },
    "baseY": 890,
    "sparkle": {
      "x": 291,
      "y": 441
    },
    "layers": [
      {
        "name": "watch",
        "role": "static",
        "source": require('../../../public/art/vessels/vessel-pocket-watch-watch.webp')
      },
      {
        "name": "cover",
        "role": "hinge",
        "pivot": {
          "x": 651,
          "y": 598
        },
        "open": [
          {
            "at": 0,
            "opacity": 1
          },
          {
            "at": 1,
            "scaleX": 0.03,
            "opacity": 0
          }
        ],
        "source": require('../../../public/art/vessels/vessel-pocket-watch-cover.webp')
      }
    ]
  },
  "diploma-tube": {
    "assembled": require('../../../public/art/vessels/vessel-diploma-tube.webp'),
    "opening": "D",
    "idleMs": 4000,
    "idle": [
      {
        "type": "bob",
        "amount": 0.025
      }
    ],
    "mouth": {
      "x": 511,
      "y": 278
    },
    "baseY": 899,
    "sparkle": {
      "x": 445,
      "y": 190
    },
    "layers": [
      {
        "name": "tube",
        "role": "static",
        "source": require('../../../public/art/vessels/vessel-diploma-tube-tube.webp')
      },
      {
        "name": "diploma",
        "role": "slide",
        "open": [
          {
            "at": 0,
            "opacity": 0,
            "y": 0.15
          },
          {
            "at": 0.35,
            "opacity": 0,
            "y": 0.15
          },
          {
            "at": 1,
            "opacity": 1,
            "y": -0.08
          }
        ],
        "source": require('../../../public/art/vessels/vessel-diploma-tube-diploma.webp')
      },
      {
        "name": "cap",
        "role": "hinge",
        "pivot": {
          "x": 357,
          "y": 155
        },
        "open": [
          {
            "at": 0,
            "opacity": 1
          },
          {
            "at": 1,
            "y": -0.36,
            "rotate": -10,
            "opacity": 0
          }
        ],
        "source": require('../../../public/art/vessels/vessel-diploma-tube-cap.webp')
      }
    ]
  },
  "baby-shoes": {
    "assembled": require('../../../public/art/vessels/vessel-baby-shoes.webp'),
    "opening": "B",
    "idleMs": 4000,
    "idle": [
      {
        "type": "breathe",
        "amount": 0.025
      }
    ],
    "mouth": {
      "x": 512,
      "y": 590
    },
    "baseY": 889,
    "sparkle": {
      "x": 436,
      "y": 384
    },
    "layers": [
      {
        "name": "box",
        "role": "static",
        "source": require('../../../public/art/vessels/vessel-baby-shoes-box.webp')
      },
      {
        "name": "lid",
        "role": "lift",
        "pivot": {
          "x": 512,
          "y": 224
        },
        "open": [
          {
            "at": 0,
            "opacity": 1
          },
          {
            "at": 1,
            "y": -0.4,
            "opacity": 0
          }
        ],
        "source": require('../../../public/art/vessels/vessel-baby-shoes-lid.webp')
      }
    ]
  },
  "memorial-candle": {
    "assembled": require('../../../public/art/vessels/vessel-memorial-candle.webp'),
    "opening": "C",
    "idleMs": 4000,
    "idle": [
      {
        "type": "breathe",
        "amount": 0.025
      }
    ],
    "mouth": {
      "x": 512,
      "y": 395
    },
    "baseY": 899,
    "sparkle": {
      "x": 300,
      "y": 341
    },
    "layers": [
      {
        "name": "glow",
        "role": "fade",
        "open": [
          {
            "at": 0,
            "opacity": 1
          },
          {
            "at": 1,
            "opacity": 1
          }
        ],
        "idle": [
          {
            "type": "glow",
            "base": 0.8,
            "range": 0.2,
            "flicker": 0.1
          }
        ],
        "source": require('../../../public/art/vessels/vessel-memorial-candle-glow.webp')
      },
      {
        "name": "jar",
        "role": "static",
        "source": require('../../../public/art/vessels/vessel-memorial-candle-jar.webp')
      },
      {
        "name": "lid",
        "role": "lift",
        "pivot": {
          "x": 220,
          "y": 150
        },
        "open": [
          {
            "at": 0,
            "opacity": 1
          },
          {
            "at": 1,
            "y": -0.36,
            "rotate": 0,
            "opacity": 0
          }
        ],
        "source": require('../../../public/art/vessels/vessel-memorial-candle-lid.webp')
      }
    ]
  },
  "rocket-tin": {
    "assembled": require('../../../public/art/vessels/vessel-rocket-tin.webp'),
    "opening": "C",
    "idleMs": 4000,
    "idle": [
      {
        "type": "float",
        "amount": 0.03
      }
    ],
    "mouth": {
      "x": 514,
      "y": 317
    },
    "baseY": 889,
    "sparkle": {
      "x": 512,
      "y": 321
    },
    "layers": [
      {
        "name": "rocket",
        "role": "static",
        "source": require('../../../public/art/vessels/vessel-rocket-tin-rocket.webp')
      },
      {
        "name": "flame",
        "role": "fade",
        "open": [
          {
            "at": 0,
            "opacity": 1
          },
          {
            "at": 1,
            "opacity": 1
          }
        ],
        "idle": [
          {
            "type": "glow",
            "base": 0.8,
            "range": 0.2,
            "flicker": 0.1
          }
        ],
        "source": require('../../../public/art/vessels/vessel-rocket-tin-flame.webp')
      },
      {
        "name": "cone",
        "role": "lift",
        "pivot": {
          "x": 514,
          "y": 149
        },
        "open": [
          {
            "at": 0,
            "opacity": 1
          },
          {
            "at": 1,
            "y": -0.4,
            "opacity": 0
          }
        ],
        "source": require('../../../public/art/vessels/vessel-rocket-tin-cone.webp')
      }
    ]
  },
  'pineapple-cake': {
    assembled: require('../../../public/art/vessels/vessel-pineapple-cake.webp'),
    opening: "H",
    idleMs: 4000,
    idle: [{"type": "bob", "amount": 0.03}],
    mouth: {"x": 473, "y": 552},
    baseY: 904,
    sparkle: {"x": 482, "y": 436},
    layers: [
      { name: "right-filling", role: "split", pivot: {"x": 396, "y": 836}, open: [{"at": 0, "opacity": 0}, {"at": 0.08, "x": 0.0021875, "y": -0.0040625, "rotate": 1.2, "opacity": 0}, {"at": 0.2, "x": 0.0054687500000000005, "y": -0.01015625, "rotate": 3.0, "opacity": 1}, {"at": 1, "x": 0.02734375, "y": -0.05078125, "rotate": 15, "opacity": 1}], idle: [{"type": "glow", "base": 0, "range": 0}], source: require('../../../public/art/vessels/vessel-pineapple-cake-right-filling.webp') },
      { name: "left-filling", role: "split", pivot: {"x": 393, "y": 834}, open: [{"at": 0, "opacity": 0}, {"at": 0.08, "x": -0.005, "y": -0.003046875, "rotate": -1.12, "opacity": 0}, {"at": 0.2, "x": -0.0125, "y": -0.007617187500000001, "rotate": -2.8000000000000003, "opacity": 1}, {"at": 1, "x": -0.0625, "y": -0.0380859375, "rotate": -14, "opacity": 1}], idle: [{"type": "glow", "base": 0, "range": 0}], source: require('../../../public/art/vessels/vessel-pineapple-cake-left-filling.webp') },
      { name: "left", role: "split", pivot: {"x": 393, "y": 834}, open: [{"at": 0}, {"at": 1, "x": -0.0625, "y": -0.0380859375, "rotate": -14}], source: require('../../../public/art/vessels/vessel-pineapple-cake-left.webp') },
      { name: "right", role: "split", pivot: {"x": 396, "y": 836}, open: [{"at": 0}, {"at": 1, "x": 0.02734375, "y": -0.05078125, "rotate": 15}], source: require('../../../public/art/vessels/vessel-pineapple-cake-right.webp') },
      { name: "letter", role: "lift", open: [{"at": 0, "y": 0.19, "scale": 0.71, "opacity": 0}, {"at": 0.19, "y": 0.19, "scale": 0.71, "opacity": 0}, {"at": 0.54, "y": 0.06, "scale": 0.93, "opacity": 1}, {"at": 1, "y": 0, "scale": 1, "opacity": 1}], idle: [{"type": "glow", "base": 0, "range": 0}], source: require('../../../public/art/vessels/vessel-pineapple-cake-letter.webp') },
    ],
  },
  'teapot': {
    assembled: require('../../../public/art/vessels/vessel-teapot.webp'),
    opening: "B",
    idleMs: 4100,
    idle: [],
    mouth: {"x": 478, "y": 524},
    baseY: 903,
    sparkle: {"x": 455, "y": 419},
    layers: [
      { name: "pot", role: "static", source: require('../../../public/art/vessels/vessel-teapot-pot.webp') },
      { name: "lid", role: "lift", pivot: {"x": 478, "y": 523}, open: [{"at": 0}, {"at": 1, "y": -0.242}], source: require('../../../public/art/vessels/vessel-teapot-lid.webp') },
      { name: "steam", role: "fade", open: [{"at": 0, "opacity": 0}, {"at": 0.23, "y": -0.018, "opacity": 0.8}, {"at": 0.52, "y": -0.06, "opacity": 1}, {"at": 1, "y": -0.11, "opacity": 0}], idle: [{"type": "drift", "amount": 0.046}], source: require('../../../public/art/vessels/vessel-teapot-steam.webp') },
    ],
  },
  'sky-lantern': {
    assembled: require('../../../public/art/vessels/vessel-sky-lantern.webp'),
    opening: "B",
    idleMs: 4400,
    idle: [{"type": "bob", "amount": 0.029}],
    mouth: {"x": 577, "y": 832},
    baseY: 903,
    sparkle: {"x": 501, "y": 897},
    layers: [
      { name: "ring", role: "static", source: require('../../../public/art/vessels/vessel-sky-lantern-ring.webp') },
      { name: "paper", role: "lift", pivot: {"x": 509, "y": 492}, open: [{"at": 0}, {"at": 0.35, "y": -0.078, "scale": 0.94}, {"at": 1, "y": -0.169, "scale": 0.83}], source: require('../../../public/art/vessels/vessel-sky-lantern-paper.webp') },
      { name: "glow", role: "fade", pivot: {"x": 509, "y": 492}, open: [{"at": 0, "opacity": 0.46}, {"at": 0.35, "y": -0.078, "scale": 0.94, "opacity": 0.39}, {"at": 1, "y": -0.169, "scale": 0.83, "opacity": 0.17}], idle: [{"type": "glow", "base": 0.46, "range": 0.24, "flicker": 0.09}], source: require('../../../public/art/vessels/vessel-sky-lantern-glow.webp') },
    ],
  },
  'rwb-bag': {
    assembled: require('../../../public/art/vessels/vessel-rwb-bag.webp'),
    opening: "K",
    idleMs: 4100,
    idle: [{"type": "sway", "deg": 3.5, "pivot": {"x": 512, "y": 894}}],
    mouth: {"x": 508, "y": 357},
    sparkle: {"x": 773, "y": 333},
    baseY: 897,
    layers: [
      { name: "bag", role: "static", open: [{"at": 0}], source: require('../../../public/art/vessels/vessel-rwb-bag-bag.webp') },
      { name: "letter", role: "pop", open: [{"at": 0, "x": 0.0, "y": 0.0, "opacity": 0, "scale": 0.93}, {"at": 0.29, "x": 0.0, "y": 0.0, "opacity": 0, "scale": 0.93}, {"at": 0.37, "x": 0.0, "y": -0.04296875, "opacity": 1, "scale": 0.98}, {"at": 0.6, "x": 0.0, "y": -0.1259765625, "opacity": 1, "scale": 1.045}, {"at": 0.78, "x": 0.0, "y": -0.1533203125, "opacity": 1, "scale": 1.035}, {"at": 1, "x": 0.0, "y": -0.1328125, "opacity": 1, "scale": 1}], pivot: {"x": 508, "y": 490}, idle: [{"type": "glow", "base": 0, "range": 0}], source: require('../../../public/art/vessels/vessel-rwb-bag-letter.webp') },
      { name: "front", role: "static", open: [{"at": 0}], source: require('../../../public/art/vessels/vessel-rwb-bag-front.webp') },
      { name: "zip", role: "fade", open: [{"at": 0, "opacity": 1}, {"at": 0.3, "opacity": 0}, {"at": 1, "opacity": 0}], source: require('../../../public/art/vessels/vessel-rwb-bag-zip.webp') },
    ],
  },
  'bolo-bun': {
    assembled: require('../../../public/art/vessels/vessel-bolo-bun.webp'),
    opening: "A",
    idleMs: 4200,
    mouth: {"x": 428, "y": 639},
    baseY: 900,
    layers: [
      { name: "bottom", role: "static", source: require('../../../public/art/vessels/vessel-bolo-bun-bottom.webp') },
      { name: "letter", role: "static", source: require('../../../public/art/vessels/vessel-bolo-bun-letter.webp') },
      { name: "top", role: "hinge", pivot: {"x": 782, "y": 589}, open: [{"at": 0, "rotate": 0}, {"at": 1, "rotate": 55, "scaleY": 0.83}], source: require('../../../public/art/vessels/vessel-bolo-bun-top.webp') },
      { name: "steam", role: "fade", open: [{"at": 0, "opacity": 0}, {"at": 1, "opacity": 0}], idle: [{"type": "drift", "amount": 0.035, "direction": "up"}], source: require('../../../public/art/vessels/vessel-bolo-bun-steam.webp') },
    ],
  },
  'tram': {
    assembled: require('../../../public/art/vessels/vessel-tram.webp'),
    opening: "B",
    idleMs: 4200,
    idle: [{"type": "bob", "amount": 0.028}],
    mouth: {"x": 525, "y": 239},
    baseY: 902,
    sparkle: {"x": 280, "y": 748},
    layers: [
      { name: "body", role: "static", source: require('../../../public/art/vessels/vessel-tram-body.webp') },
      { name: "roof", role: "lift", pivot: {"x": 466, "y": 237}, open: [{"at": 0, "y": 0, "opacity": 1}, {"at": 0.5, "y": -0.067, "opacity": 0.88}, {"at": 0.8, "y": -0.098, "opacity": 0.34}, {"at": 1, "y": -0.108, "opacity": 0}], source: require('../../../public/art/vessels/vessel-tram-roof.webp') },
      { name: "bell", role: "static", idle: [{"type": "tick", "deg": 8, "pivot": {"x": 217, "y": 673}}], source: require('../../../public/art/vessels/vessel-tram-bell.webp') },
    ],
  },
  'tiffin': {
    assembled: require('../../../public/art/vessels/vessel-tiffin.webp'),
    opening: "B",
    idleMs: 4200,
    idle: [],
    mouth: {"x": 515, "y": 510},
    sparkle: {"x": 405, "y": 144},
    baseY: 897,
    layers: [
      { name: "stack", role: "static", open: [{"at": 0}], source: require('../../../public/art/vessels/vessel-tiffin-stack.webp') },
      { name: "top", role: "lift", open: [{"at": 0, "x": 0.0, "y": 0.0, "opacity": 1}, {"at": 0.23, "x": 0.0, "y": -0.0478515625, "opacity": 1}, {"at": 0.5, "x": 0.0, "y": -0.0859375, "opacity": 0.56}, {"at": 0.73, "x": 0.0, "y": -0.091796875, "opacity": 0}, {"at": 1, "x": 0.0, "y": -0.091796875, "opacity": 0}], pivot: {"x": 515, "y": 145}, source: require('../../../public/art/vessels/vessel-tiffin-top.webp') },
      { name: "steam", role: "fade", open: [{"at": 0, "x": 0.0, "y": 0.0, "opacity": 0.55}, {"at": 0.3, "x": 0.0, "y": -0.01171875, "opacity": 0.66}, {"at": 1, "x": 0.0, "y": -0.0498046875, "opacity": 1}], idle: [{"type": "drift", "amount": 0.04}], source: require('../../../public/art/vessels/vessel-tiffin-steam.webp') },
    ],
  },
  'kamcheng': {
    assembled: require('../../../public/art/vessels/vessel-kamcheng.webp'),
    opening: "B",
    idleMs: 4200,
    idle: [],
    mouth: {"x": 509, "y": 371},
    baseY: 900,
    sparkle: {"x": 489, "y": 224},
    layers: [
      { name: "jar", role: "static", source: require('../../../public/art/vessels/vessel-kamcheng-jar.webp') },
      { name: "lid", role: "lift", pivot: {"x": 510, "y": 393}, open: [{"at": 0, "y": 0, "opacity": 1}, {"at": 0.5, "y": -0.15, "opacity": 1}, {"at": 0.76, "y": -0.16, "opacity": 0.65}, {"at": 1, "y": -0.166, "opacity": 0}], idle: [{"type": "float", "amount": 0.025}], source: require('../../../public/art/vessels/vessel-kamcheng-lid.webp') },
    ],
  },
  'orchid': {
    assembled: require('../../../public/art/vessels/vessel-orchid.webp'),
    opening: "H",
    idleMs: 4200,
    idle: [{"type": "sway", "deg": 3.25, "pivot": {"x": 503, "y": 722}}],
    mouth: {"x": 759, "y": 275},
    baseY: 900,
    sparkle: {"x": 717, "y": 308},
    layers: [
      { name: "pot", role: "static", ground: true, source: require('../../../public/art/vessels/vessel-orchid-pot.webp') },
      { name: "stem", role: "static", source: require('../../../public/art/vessels/vessel-orchid-stem.webp') },
      { name: "left", role: "hinge", pivot: {"x": 746, "y": 256}, open: [{"at": 0, "scaleX": 0.002, "scaleY": 0.002, "x": 0.007, "y": 0.023, "rotate": 28, "opacity": 0}, {"at": 0.18, "scaleX": 0.25, "scaleY": 0.44, "x": 0.007, "y": 0.014, "rotate": 24, "opacity": 0}, {"at": 0.36, "scaleX": 0.73, "scaleY": 0.85, "x": 0, "y": 0.008, "rotate": 9, "opacity": 1}, {"at": 0.56, "scaleX": 0.89, "scaleY": 0.95, "x": 0, "y": 0.003, "rotate": 3, "opacity": 1}, {"at": 1, "scaleX": 1, "scaleY": 1, "x": 0, "y": 0, "rotate": 0, "opacity": 1}], idle: [{"type": "glow", "base": 0, "range": 0}], source: require('../../../public/art/vessels/vessel-orchid-left.webp') },
      { name: "right", role: "hinge", pivot: {"x": 770, "y": 256}, open: [{"at": 0, "scaleX": 0.002, "scaleY": 0.002, "x": -0.007, "y": 0.023, "rotate": -28, "opacity": 0}, {"at": 0.18, "scaleX": 0.25, "scaleY": 0.44, "x": -0.007, "y": 0.014, "rotate": -24, "opacity": 0}, {"at": 0.36, "scaleX": 0.73, "scaleY": 0.85, "x": 0, "y": 0.008, "rotate": -9, "opacity": 1}, {"at": 0.56, "scaleX": 0.89, "scaleY": 0.95, "x": 0, "y": 0.003, "rotate": -3, "opacity": 1}, {"at": 1, "scaleX": 1, "scaleY": 1, "x": 0, "y": 0, "rotate": 0, "opacity": 1}], idle: [{"type": "glow", "base": 0, "range": 0}], source: require('../../../public/art/vessels/vessel-orchid-right.webp') },
      { name: "throat", role: "fade", pivot: {"x": 759, "y": 275}, open: [{"at": 0, "scale": 0.002, "x": -0.014, "y": 0.016, "opacity": 0}, {"at": 0.21, "scale": 0.36, "x": -0.009, "y": 0.012, "opacity": 0}, {"at": 0.39, "scale": 0.87, "x": -0.004, "y": 0.008, "opacity": 1}, {"at": 0.6, "scale": 0.96, "x": 0, "y": 0, "opacity": 1}, {"at": 1, "scale": 1, "x": 0, "y": 0, "opacity": 1}], idle: [{"type": "glow", "base": 0, "range": 0}], source: require('../../../public/art/vessels/vessel-orchid-throat.webp') },
      { name: "bud-right", role: "hinge", pivot: {"x": 724, "y": 300}, open: [{"at": 0, "x": 0, "y": 0, "rotate": 0, "scale": 1, "opacity": 1}, {"at": 0.19, "x": 0.004, "y": 0, "rotate": 13, "scale": 0.99, "opacity": 1}, {"at": 0.34, "x": 0.012, "y": -0.002, "rotate": 27, "scale": 0.9, "opacity": 0.47}, {"at": 0.47, "x": 0.023, "y": 0.008, "rotate": 42, "scale": 0.76, "opacity": 0}, {"at": 1, "x": 0.023, "y": 0.008, "rotate": 42, "scale": 0.76, "opacity": 0}], source: require('../../../public/art/vessels/vessel-orchid-bud-right.webp') },
      { name: "bud-left", role: "hinge", pivot: {"x": 710, "y": 300}, open: [{"at": 0, "x": 0, "y": 0, "rotate": 0, "scale": 1, "opacity": 1}, {"at": 0.19, "x": -0.004, "y": 0, "rotate": -13, "scale": 0.99, "opacity": 1}, {"at": 0.34, "x": -0.012, "y": -0.002, "rotate": -27, "scale": 0.9, "opacity": 0.47}, {"at": 0.47, "x": -0.023, "y": 0.008, "rotate": -42, "scale": 0.76, "opacity": 0}, {"at": 1, "x": -0.023, "y": 0.008, "rotate": -42, "scale": 0.76, "opacity": 0}], source: require('../../../public/art/vessels/vessel-orchid-bud-left.webp') },
    ],
  },
  'egg-tart': {
    assembled: require('../../../public/art/vessels/vessel-egg-tart.webp'),
    opening: "B",
    idleMs: 4200,
    idle: [],
    mouth: {"x": 511, "y": 646},
    baseY: 901,
    sparkle: {"x": 237, "y": 742},
    layers: [
      { name: "cup", role: "static", source: require('../../../public/art/vessels/vessel-egg-tart-cup.webp') },
      { name: "tart", role: "lift", pivot: {"x": 512, "y": 611}, open: [{"at": 0}, {"at": 0.5, "y": -0.23, "scale": 0.85}, {"at": 1, "y": -0.36, "scale": 0.61}], source: require('../../../public/art/vessels/vessel-egg-tart-tart.webp') },
      { name: "steam", role: "fade", open: [{"at": 0, "opacity": 0}, {"at": 0.18, "opacity": 0.72, "y": -0.024}, {"at": 0.52, "opacity": 0, "y": -0.1}, {"at": 1, "opacity": 0, "y": -0.1}], idle: [{"type": "drift", "amount": 0.065}], source: require('../../../public/art/vessels/vessel-egg-tart-steam.webp') },
    ],
  },
  'rooster': {
    assembled: require('../../../public/art/vessels/vessel-rooster.webp'),
    opening: "C",
    idleMs: 4200,
    idle: [{"type": "sway", "deg": 4, "pivot": {"x": 483, "y": 902}}],
    mouth: {"x": 588, "y": 506},
    sparkle: {"x": 286, "y": 357},
    baseY: 909,
    layers: [
      { name: "body", role: "static", source: require('../../../public/art/vessels/vessel-rooster-body.webp') },
      { name: "back", role: "lift", pivot: {"x": 595, "y": 495}, open: [{"at": 0}, {"at": 0.5, "x": 0.043, "y": -0.113}, {"at": 1, "x": 0.084, "y": -0.215, "opacity": 0.94}], source: require('../../../public/art/vessels/vessel-rooster-back.webp') },
    ],
  },
  'pedicab': {
    assembled: require('../../../public/art/vessels/vessel-pedicab.webp'),
    opening: "A",
    idleMs: 3900,
    idle: [{"type": "bob", "amount": 0.028}],
    mouth: {"x": 631, "y": 614},
    sparkle: {"x": 850, "y": 418},
    baseY: 904,
    layers: [
      { name: "wheel", role: "static", idle: [{"type": "tick", "deg": 4.5, "pivot": {"x": 264, "y": 770}}], source: require('../../../public/art/vessels/vessel-pedicab-wheel.webp') },
      { name: "folded-hood", role: "hinge", pivot: {"x": 822, "y": 598}, open: [{"at": 0, "opacity": 0, "x": -0.16, "y": -0.141, "rotate": 0, "scale": 0}, {"at": 0.52, "opacity": 0, "x": 0.02, "y": -0.137, "rotate": -56, "scale": 1}, {"at": 0.56, "opacity": 0.9, "x": 0.028, "y": -0.111, "rotate": -52, "scale": 1}, {"at": 0.6, "opacity": 1, "x": 0.037, "y": -0.092, "rotate": -44, "scale": 1}, {"at": 0.64, "opacity": 1, "x": 0.042, "y": -0.067, "rotate": -34, "scale": 1}, {"at": 0.77, "opacity": 1, "x": 0.025, "y": -0.033, "rotate": -13, "scale": 1}, {"at": 1, "opacity": 1, "x": 0, "y": 0, "rotate": 10, "scale": 1}], idle: [{"type": "glow", "base": 0, "range": 0}], source: require('../../../public/art/vessels/vessel-pedicab-folded-hood.webp') },
      { name: "cab", role: "static", source: require('../../../public/art/vessels/vessel-pedicab-cab.webp') },
      { name: "rear-bow", role: "hinge", pivot: {"x": 822, "y": 598}, open: [{"at": 0, "rotate": 0, "scaleY": 1, "opacity": 1}, {"at": 0.18, "rotate": 0, "scaleY": 1, "opacity": 1}, {"at": 0.38, "rotate": 12, "scaleY": 0.94, "opacity": 1}, {"at": 0.52, "rotate": 28, "scaleY": 0.72, "opacity": 1}, {"at": 0.56, "rotate": 32, "scaleY": 0.65, "opacity": 0.86}, {"at": 0.6, "rotate": 36, "scaleY": 0.58, "opacity": 0.53}, {"at": 0.64, "rotate": 40, "scaleY": 0.51, "opacity": 0.12}, {"at": 0.69, "rotate": 46, "scaleY": 0.41, "opacity": 0}, {"at": 0.77, "rotate": 52, "scaleY": 0.32, "opacity": 0}, {"at": 1, "rotate": 65, "scaleY": 0.18, "opacity": 0}], source: require('../../../public/art/vessels/vessel-pedicab-rear-bow.webp') },
      { name: "canopy", role: "hinge", pivot: {"x": 850, "y": 418}, open: [{"at": 0, "x": 0.0, "y": 0.0, "rotate": 0, "scaleX": 1, "scaleY": 1, "opacity": 1}, {"at": 0.18, "x": 0.0, "y": 0.0, "rotate": 23, "scaleX": 0.8, "scaleY": 0.87, "opacity": 1}, {"at": 0.38, "x": 0.033757, "y": 0.019843, "rotate": 54, "scaleX": 0.5, "scaleY": 0.71, "opacity": 1}, {"at": 0.52, "x": 0.056217, "y": 0.07687, "rotate": 79, "scaleX": 0.37, "scaleY": 0.65, "opacity": 1}, {"at": 0.56, "x": 0.056392, "y": 0.093375, "rotate": 87, "scaleX": 0.35, "scaleY": 0.6, "opacity": 0.9}, {"at": 0.6, "x": 0.054704, "y": 0.109372, "rotate": 96, "scaleX": 0.32, "scaleY": 0.56, "opacity": 0.14}, {"at": 0.64, "x": 0.051228, "y": 0.124683, "rotate": 105, "scaleX": 0.3, "scaleY": 0.53, "opacity": 0}, {"at": 0.69, "x": 0.043494, "y": 0.145386, "rotate": 121, "scaleX": 0.26, "scaleY": 0.48, "opacity": 0}, {"at": 0.77, "x": 0.033816, "y": 0.162697, "rotate": 139, "scaleX": 0.23, "scaleY": 0.43, "opacity": 0}, {"at": 1, "x": 0.012888, "y": 0.187191, "rotate": 155, "scaleX": 0.22, "scaleY": 0.38, "opacity": 0}], source: require('../../../public/art/vessels/vessel-pedicab-canopy.webp') },
      { name: "hinge-pin", role: "hinge", pivot: {"x": 850, "y": 418}, open: [{"at": 0, "x": 0.0, "y": 0.0, "opacity": 1}, {"at": 0.18, "x": 0.0, "y": 0.0, "opacity": 1}, {"at": 0.38, "x": 0.033757, "y": 0.019843, "opacity": 1}, {"at": 0.52, "x": 0.056217, "y": 0.07687, "opacity": 1}, {"at": 0.56, "x": 0.056392, "y": 0.093375, "opacity": 0.86}, {"at": 0.6, "x": 0.054704, "y": 0.109372, "opacity": 0.53}, {"at": 0.64, "x": 0.051228, "y": 0.124683, "opacity": 0.12}, {"at": 0.69, "x": 0.043494, "y": 0.145386, "opacity": 0}, {"at": 0.77, "x": 0.033816, "y": 0.162697, "opacity": 0}, {"at": 1, "x": 0.012888, "y": 0.187191, "opacity": 0}], source: require('../../../public/art/vessels/vessel-pedicab-hinge-pin.webp') },
    ],
  },
  'north-gate': {
    assembled: require('../../../public/art/vessels/vessel-north-gate.webp'),
    opening: "B",
    idleMs: 4200,
    idle: [],
    mouth: {"x": 520, "y": 437},
    baseY: 900,
    sparkle: {"x": 640, "y": 288},
    layers: [
      { name: "base", role: "static", source: require('../../../public/art/vessels/vessel-north-gate-base.webp') },
      { name: "interior", role: "fade", open: [{"at": 0, "opacity": 0}, {"at": 0.16, "opacity": 0}, {"at": 0.7, "opacity": 1}], idle: [{"type": "glow", "base": 0, "range": 0}], source: require('../../../public/art/vessels/vessel-north-gate-interior.webp') },
      { name: "roof", role: "lift", open: [{"at": 0, "y": 0, "opacity": 1}, {"at": 1, "y": -0.157, "opacity": 1}], idle: [{"type": "float", "amount": 0.025}], source: require('../../../public/art/vessels/vessel-north-gate-roof.webp') },
    ],
  },
  'durian': {
    assembled: require('../../../public/art/vessels/vessel-durian.webp'),
    opening: "H",
    idleMs: 4100,
    idle: [{"type": "breathe", "amount": 0.027}],
    mouth: {"x": 570, "y": 530},
    baseY: 900,
    sparkle: {"x": 462, "y": 391},
    layers: [
      { name: "pods", role: "fade", open: [{"at": 0, "opacity": 0, "x": 0.065, "y": 0.06, "scale": 0.75}, {"at": 0.18, "opacity": 0, "x": 0.065, "y": 0.06, "scale": 0.75}, {"at": 0.72, "opacity": 1, "x": 0.065, "y": 0.06, "scale": 0.75}], idle: [{"type": "glow", "base": 0, "range": 0}], source: require('../../../public/art/vessels/vessel-durian-pods.webp') },
      { name: "left-pith", role: "split", pivot: {"x": 464, "y": 828}, open: [{"at": 0, "opacity": 0}, {"at": 0.42, "opacity": 0.6, "x": -0.039, "y": 0, "rotate": -7}, {"at": 1, "opacity": 1, "x": -0.097, "y": 0.012, "rotate": -16}], idle: [{"type": "glow", "base": 0, "range": 0}], source: require('../../../public/art/vessels/vessel-durian-left-pith.webp') },
      { name: "right-pith", role: "split", pivot: {"x": 499, "y": 833}, open: [{"at": 0, "opacity": 0}, {"at": 0.42, "opacity": 0.6, "x": 0.03, "y": 0, "rotate": 7}, {"at": 1, "opacity": 1, "x": 0.071, "y": 0.02, "rotate": 18}], idle: [{"type": "glow", "base": 0, "range": 0}], source: require('../../../public/art/vessels/vessel-durian-right-pith.webp') },
      { name: "left", role: "split", pivot: {"x": 464, "y": 828}, open: [{"at": 0, "opacity": 1}, {"at": 0.42, "opacity": 1, "x": -0.039, "y": 0, "rotate": -7}, {"at": 1, "opacity": 1, "x": -0.097, "y": 0.012, "rotate": -16}], source: require('../../../public/art/vessels/vessel-durian-left.webp') },
      { name: "right", role: "split", pivot: {"x": 499, "y": 833}, open: [{"at": 0, "opacity": 1}, {"at": 0.42, "opacity": 1, "x": 0.03, "y": 0, "rotate": 7}, {"at": 1, "opacity": 1, "x": 0.071, "y": 0.02, "rotate": 18}], source: require('../../../public/art/vessels/vessel-durian-right.webp') },
    ],
  },
  'lighthouse': {
    assembled: require('../../../public/art/vessels/vessel-lighthouse.webp'),
    opening: "C",
    idleMs: 4200,
    idle: [],
    mouth: {"x": 508, "y": 238},
    baseY: 901,
    layers: [
      { name: "tower", role: "static", source: require('../../../public/art/vessels/vessel-lighthouse-tower.webp') },
      { name: "letter", role: "fade", idle: [{"type": "glow", "base": 0, "range": 0}], open: [{"at": 0, "opacity": 0}, {"at": 0.08, "opacity": 0}, {"at": 0.65, "opacity": 1}], source: require('../../../public/art/vessels/vessel-lighthouse-letter.webp') },
      { name: "beam", role: "fade", pivot: {"x": 593, "y": 314}, open: [{"at": 0, "opacity": 0}, {"at": 0.52, "opacity": 0.7}, {"at": 1, "opacity": 0.32}], idle: [{"type": "glow", "base": 0, "range": 0.92}, {"type": "sway", "deg": 9, "pivot": {"x": 593, "y": 314}}], source: require('../../../public/art/vessels/vessel-lighthouse-beam.webp') },
      { name: "cap", role: "lift", pivot: {"x": 512, "y": 270}, open: [{"at": 0, "y": 0}, {"at": 1, "y": -0.1}], source: require('../../../public/art/vessels/vessel-lighthouse-cap.webp') },
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
  // "To whoever passes by" recipient: not a person preset, so the profile picker never lists it.
  publicCapsule: require('../../../public/art/portraits/portrait-passerby.webp'),
};
/** Full-body map figures (City Hunt art, PR #92): portrait NN → figure NN; old SVG avatars use 01.
 * Square canvas, feet at (0.5, 0.879) of it, standing height ≈ 0.72 of its height; they face the viewer's right. */
export const characters = {
  figures: {
    '01': require('../../../public/art/characters/figure-01.webp'), '02': require('../../../public/art/characters/figure-02.webp'),
    '03': require('../../../public/art/characters/figure-03.webp'), '04': require('../../../public/art/characters/figure-04.webp'),
    '05': require('../../../public/art/characters/figure-05.webp'), '06': require('../../../public/art/characters/figure-06.webp'),
    '07': require('../../../public/art/characters/figure-07.webp'), '08': require('../../../public/art/characters/figure-08.webp'),
  } as Record<string, ImageSourcePropType>,
  keeper: require('../../../public/art/characters/keeper.webp'),
  /** The Letter Keeper's round dialog portrait (standard portrait disc; not a profile choice). */
  keeperPortrait: require('../../../public/art/portraits/portrait-keeper.webp'),
  feetY: 0.879,
  standing: 0.72,
};
export const scenes = {
  welcome: require('../../../public/art/scenes/scene-welcome.webp'),
  emptyInbox: require('../../../public/art/scenes/scene-empty-inbox.webp'),
  emptySent: require('../../../public/art/scenes/scene-empty-sent.webp'),
  sealed: require('../../../public/art/scenes/scene-sealed.webp'),
  publicCapsuleSealed: require('../../../public/art/scenes/scene-passerby-sealed.webp'),
};
export const gameArt = {
  ball: { wax: require('../../../public/art/game/ball-wax.webp'), gold: require('../../../public/art/game/ball-gold.webp') },
  hitDust: require('../../../public/art/game/hit-dust.webp'),
  catchBackground: require('../../../public/art/game/catch-background.webp'),
  waypostGem: require('../../../public/art/game/waypost-gem.webp'),
  /** Ready to spin (ink blue); the purple file is the after-spin state. */
  waypostGemBlue: require('../../../public/art/game/waypost-gem-blue.webp'),
  landmarkGem: require('../../../public/art/game/landmark-gem.webp'),
  wheel: {
    park: require('../../../public/art/game/wheel/scene-park.webp'),
    garden: require('../../../public/art/game/wheel/scene-garden.webp'),
    waterfront: require('../../../public/art/game/wheel/scene-waterfront.webp'),
    square: require('../../../public/art/game/wheel/scene-square.webp'),
    publicArt: require('../../../public/art/game/wheel/scene-public-art.webp'),
    taipei101: require('../../../public/art/game/wheel/scene-landmark-taipei.webp'),
    merlion: require('../../../public/art/game/wheel/scene-landmark-singapore.webp'),
    senado: require('../../../public/art/game/wheel/scene-landmark-macau.webp'),
  },
};
/** Private-hunt quest pictures (PR #115, approved by Roy): the organizer's choices, keyed as stored ("tpl:<key>"). */
export const questTemplates = {
  park: require('../../../public/art/quest-templates/quest-template-park.webp'),
  garden: require('../../../public/art/quest-templates/quest-template-garden.webp'),
  waterfront: require('../../../public/art/quest-templates/quest-template-waterfront.webp'),
  square: require('../../../public/art/quest-templates/quest-template-square.webp'),
  publicArt: require('../../../public/art/quest-templates/quest-template-public-art.webp'),
  oldStreet: require('../../../public/art/quest-templates/quest-template-old-street.webp'),
};
export const sealWax = require('../../../public/art/seal-wax.webp');
export const lightBurst = require('../../../public/art/fx/fx-light-burst.webp');
// Idle glints (art A2, PR #32): a small sparkle for wax and brass (the dome's glass highlight is in its spec).
export const domeGlint = vesselParts.dome.glint!;
export const fxGlint = require('../../../public/art/fx/fx-glint.webp');
export const paperLetter = require('../../../public/art/textures/paper-letter.webp');
export const cabinetWall = require('../../../public/art/cabinet/cabinet-wall.webp');
// A3 tiling cabinet (PR #44): crown, one row repeated per row of vessels, base. Geometry is in design/art/manifest.json.
export const cabinetTiles = {
  crown: require('../../../public/art/cabinet/cabinet-crown.webp'),
  row: require('../../../public/art/cabinet/cabinet-row.webp'),
  base: require('../../../public/art/cabinet/cabinet-base.webp'),
};
export const shelf = require('../../../public/art/shelf.webp');
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
  hkust: require('../../../public/art/stamps/stamp-hkust.webp'),
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
  'hunt-xinyi-2026-11': require('../../../public/art/stamps/stamp-hunt-xinyi-2026-11.webp'),
  'hunt-hkust-2026-11': require('../../../public/art/stamps/stamp-hunt-hkust-2026-11.webp'),
};
