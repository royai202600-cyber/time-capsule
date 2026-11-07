import type { ImageSourcePropType } from 'react-native';
import type { VesselKind } from '../vesselArt';

export type ArtLayer = { source: ImageSourcePropType; name: string; role: 'static' | 'hinge' | 'lift' | 'fade'; pivot?: { x: number; y: number } };
export type IllustratedParts = { assembled: ImageSourcePropType; layers: ArtLayer[] };
// Metro requires literal paths, so all assets are registered once here.
export const vesselParts: Record<VesselKind, IllustratedParts> = {
  dome: { assembled: require('../../../public/art/vessels/vessel-dome.webp'), layers: [
    { name: 'base', role: 'static', source: require('../../../public/art/vessels/vessel-dome-base.webp') },
    { name: 'rose', role: 'static', source: require('../../../public/art/vessels/vessel-dome-rose.webp') },
    { name: 'glass', role: 'lift', source: require('../../../public/art/vessels/vessel-dome-glass.webp') },
  ] },
  bottle: { assembled: require('../../../public/art/vessels/vessel-bottle.webp'), layers: [
    { name: 'waves', role: 'static', source: require('../../../public/art/vessels/vessel-bottle-waves.webp') },
    { name: 'letter', role: 'lift', source: require('../../../public/art/vessels/vessel-bottle-letter.webp') },
    { name: 'body', role: 'static', source: require('../../../public/art/vessels/vessel-bottle-body.webp') },
    { name: 'cork', role: 'hinge', pivot: { x: 724, y: 355 }, source: require('../../../public/art/vessels/vessel-bottle-cork.webp') },
  ] },
  envelope: { assembled: require('../../../public/art/vessels/vessel-envelope.webp'), layers: [
    { name: 'body', role: 'static', source: require('../../../public/art/vessels/vessel-envelope-body.webp') },
    { name: 'flap', role: 'hinge', pivot: { x: 496, y: 260 }, source: require('../../../public/art/vessels/vessel-envelope-flap.webp') },
    { name: 'seal', role: 'fade', source: require('../../../public/art/vessels/vessel-envelope-seal.webp') },
  ] },
  tin: { assembled: require('../../../public/art/vessels/vessel-tin.webp'), layers: [
    { name: 'box', role: 'static', source: require('../../../public/art/vessels/vessel-tin-box.webp') },
    { name: 'lid', role: 'hinge', pivot: { x: 505, y: 310 }, source: require('../../../public/art/vessels/vessel-tin-lid.webp') },
  ] },
  lantern: { assembled: require('../../../public/art/vessels/vessel-lantern.webp'), layers: [
    { name: 'glow', role: 'fade', source: require('../../../public/art/vessels/vessel-lantern-glow.webp') },
    { name: 'body', role: 'static', source: require('../../../public/art/vessels/vessel-lantern-body.webp') },
    { name: 'cap', role: 'lift', source: require('../../../public/art/vessels/vessel-lantern-cap.webp') },
  ] },
  musicbox: { assembled: require('../../../public/art/vessels/vessel-musicbox.webp'), layers: [
    { name: 'box', role: 'static', source: require('../../../public/art/vessels/vessel-musicbox-box.webp') },
    { name: 'lid', role: 'hinge', pivot: { x: 541, y: 292 }, source: require('../../../public/art/vessels/vessel-musicbox-lid.webp') },
  ] },
  maison: { assembled: require('../../../public/art/vessels/vessel-maison.webp'), layers: [
    { name: 'box', role: 'static', source: require('../../../public/art/vessels/vessel-maison-box.webp') },
    { name: 'ring', role: 'static', source: require('../../../public/art/vessels/vessel-maison-ring.webp') },
    { name: 'lid', role: 'hinge', pivot: { x: 605, y: 300 }, source: require('../../../public/art/vessels/vessel-maison-lid.webp') },
  ] },
};
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
// Idle glints (art A2, PR #32): a highlight streak on the dome glass and a small sparkle for wax and brass.
export const domeGlint = require('../../../public/art/vessels/vessel-dome-glint.webp');
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
