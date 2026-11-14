// The live map page, shared by web (iframe srcdoc) and phones (react-native-webview, works in Expo Go).
// MapLibre GL + Protomaps vector tiles in the app's palette; falls back to tinted OSM raster tiles
// when no PMTiles URL is configured (development only).
import { C } from "../../../theme";

export const MAPLIBRE = "https://unpkg.com/maplibre-gl@5.24.0/dist";
export const PMTILES = "https://unpkg.com/pmtiles@4.5.0/dist/pmtiles.js";

// Toy-scale city: buildings at a third of their height, never above 40 m, so they never wall off the game.
const TOY_SCALE = 0.35;
const TOY_MAX_M = 40;

// Landmarks drawn in blues at their real spot (docs/sop/landmark-monument.md). Two ways, mixable:
// - tile: the real building outline already in our map tiles, picked by feature id and repainted in ink blue;
// - tiers: hand-stacked boxes for shapes the tiles don't have (fountains, statues, flared towers).
/**
 * [half-width m, base m, top m, options]: a box centred on the monument. Options: `round` (a disc of that radius),
 * `dx`/`dy` (shift east/north in m), `arc` (a curved band from radius `inner` to the half-width, between two
 * compass-free angles in degrees: 0 = east, 90 = north).
 */
type Tier = [number, number, number, { round?: boolean; dx?: number; dy?: number; arc?: { inner: number; from: number; to: number } }?];
type Monument = {
  id: string; lat: number; lng: number; tiers?: Tier[];
  /** Tile buildings: their feature ids, the real height of the tallest one, and the toy height it is drawn at. */
  tile?: { ids: number[]; realTop: number; top: number };
};
const flare = (from: number, h: number, narrow: number, wide: number): Tier[] => [[narrow, from, from + h * .35], [(narrow + wide) / 2, from + h * .35, from + h * .7], [wide, from + h * .7, from + h]];
/** The monument's top, where its Landmark seal floats. */
export const monumentTop = (m: Monument) => Math.max(m.tile?.top ?? 0, ...(m.tiers ?? []).map((t) => t[2]));
export const MONUMENTS: Monument[] = [
  { id: "taipei101", lat: 25.033667, lng: 121.56481, tiers: [ // spire axis from the OSM building data in our tiles; Wikipedia agrees within ~20 m
    // A wide low base covers the real (grey) mall around the tower foot.
    [62, 0, 18], [36, 18, 24], [24, 24, 30], [21, 30, 36],
    ...Array.from({ length: 8 }, (_, i) => flare(36 + i * 8, 8, 14, 18.5)).flat(),
    [12, 100, 106], [8, 106, 112], [4, 112, 116], [1.6, 116, 142],
  ] },
  // Senado Square: the fountain (wide round basin, inner bowl, small armillary globe) at the fountain basin in our tiles, and
  // the buildings lining the square (tile buildings within 3 m of OSM way 192573684; Leal Senado is across the road).
  { id: "senado", lat: 22.193683, lng: 113.53989, tile: { ids: [35184577873359, 35185133855962, 35185133855963, 35184763410348, 35185029968552, 35185133855967, 35185133855964, 35185133855966, 35185133855960, 35185133855961, 35184763410351, 35185190550958, 35185133855953, 35184637522361, 35184702457087, 35185152337983, 35184702457086], realTop: 26.2, top: 12 }, tiers: [
    // Low and wide, like the real one: a round step, a thick hollow basin rim (two half-rings) around the water,
    // a dark inner bowl, and a small armillary globe just above the jets.
    [13, 0, .5, { round: true }],
    [9, .5, 3.5, { arc: { inner: 7.4, from: 0, to: 180 } }], [9, .5, 3.5, { arc: { inner: 7.4, from: 180, to: 360 } }],
    [7.4, .5, 1.6, { round: true }],
    [4, 1.6, 5, { round: true }], [1.6, 5, 7.5, { round: true }],
    [2.2, 7.5, 8.5, { round: true }], [3.2, 8.5, 10, { round: true }], [3.6, 10, 11.5, { round: true }], [3.2, 11.5, 13, { round: true }], [2.2, 13, 14, { round: true }],
    [1.5, 14, 15, { round: true }],
    // The armillary's ring band around the globe's middle.
    [4.6, 10.3, 11.2, { arc: { inner: 4.1, from: 0, to: 180 } }], [4.6, 10.3, 11.2, { arc: { inner: 4.1, from: 180, to: 360 } }],
  ] },
  // HKUST: the curved academic building that wraps the Piazza, opening west towards the gate. The Piazza
  // (OSM way 235913807) is a ring centred here; the seal floats over the Piazza. Roy (2026-11-10): the whole
  // campus is the landmark, so every tile building inside the campus outline (OSM way 40664120) is blue too.
  { id: "hkust", lat: 22.3374255, lng: 114.2629606,
    tile: { realTop: 38, top: 14, ids: [
      35184588150781, 35184588150874, 35184588151507, 35184588151845, 35184604980730, 35184604980739, 35184605712876, 35184605712877,
      35184605712878, 35184605712879, 35184605712885, 35184607417841, 35184607417844, 35184607417847, 35184607417851, 35184607946900,
      35184607946908, 35184608001582, 35184608002636, 35184608003256, 35184608003258, 35184608003259, 35184608003393, 35184608118220,
      35184608118222, 35184608118225, 35184608118226, 35184608118228, 35184608234791, 35184608234793, 35184608234794, 35184609084167,
      35184612483705, 35184612483717, 35184612546772, 35184612546783, 35184612546784, 35184635582360, 35184635582361, 35184650365030,
      35184650365035, 35184650365036, 35184650365040, 35184650365043, 35184650365055, 35184650365059, 35184660294276, 35184675660611,
      35184687662679, 35184687793739, 35184740860876, 35184961096812, 35185113745772, 35185113746500, 35185113746501, 35185113746502,
      35185132194864, 35185133480445, 35185133480455, 35185301575605, 35185382178161, 35185478357636, 35185478357638, 35185478357639,
      35185478357640, 35185684953432, 35185684953433, 35185684953434, 35185684953436, 35185797136924, 35185797136925, 35185797136926,
      35185797136927, 35185797247856, 35185797247857, 35185930730155, 35185932128835, 35185932223402, 35185932693361, 35185932930162,
      35185932930163, 35185933216948, 52776561307952,
    ] },
    tiers: [
    [64, 0, 14, { arc: { inner: 50, from: -80, to: 100 } }], [62, 14, 18, { arc: { inner: 53, from: -76, to: 96 } }],
    // The Red Bird (OSM node 2439950828, exactly this lat/lng) in front of the arc, so the seal sits on its tip:
    // the round sundial it stands on, a curling foot, and a neck that sways up into a beak. Tallest piece (20 m).
    [8, 0, .5, { round: true }],
    [2.6, .5, 1.5, { round: true, dx: -9 }], [2.6, .5, 1.5, { round: true, dx: -7.5, dy: -1 }],
    [1.7, .5, 3, { round: true, dx: -8, dy: 3.5 }], [1.5, 3, 5, { round: true, dx: -9, dy: 4.5 }],
    [2.5, .5, 2.5, { round: true, dx: -5.5 }], [2.4, 2.5, 4.5, { round: true, dx: -3.5 }], [2.3, 4.5, 6.5, { round: true, dx: -1.5 }],
    [2.2, 6.5, 8.5, { round: true }], [2, 8.5, 10.5, { round: true, dx: .8 }], [1.9, 10.5, 12.5, { round: true, dx: .8 }],
    [1.8, 12.5, 14.5, { round: true }], [1.7, 14.5, 16, { round: true, dx: 1.5 }], [1.6, 16, 17.5, { round: true, dx: 3 }],
    [1.5, 17.5, 19, { round: true, dx: 4.5 }], [1.5, 19, 20, { round: true, dx: 6 }],
  ] },
] as Monument[];
const TILE_IDS = MONUMENTS.flatMap((m) => m.tile?.ids ?? []);
/** Which monument a tile building belongs to, for taps. */
const TILE_OWNER = Object.fromEntries(MONUMENTS.flatMap((m) => (m.tile?.ids ?? []).map((id) => [id, m.id])));
/** Per tile building: real metres → toy metres. */
const tileScale = (): unknown => TILE_IDS.length
  ? ["match", ["id"], ...MONUMENTS.flatMap((m) => m.tile ? [m.tile.ids, m.tile.top / m.tile.realTop] : []), 0]
  : 0;
function monumentGeoJson() {
  const features = MONUMENTS.flatMap((m) => (m.tiers ?? []).map(([half, base, top, o]) => {
    const mLat = 110540, mLng = 111320 * Math.cos(m.lat * Math.PI / 180);
    const cLat = m.lat + (o?.dy ?? 0) / mLat, cLng = m.lng + (o?.dx ?? 0) / mLng;
    const at = (r: number, deg: number) => [cLng + r * Math.cos(deg * Math.PI / 180) / mLng, cLat + r * Math.sin(deg * Math.PI / 180) / mLat];
    const arc = o?.arc, steps = arc ? Math.max(6, Math.ceil(Math.abs(arc.to - arc.from) / 7.5)) : 0;
    const ring = arc
      ? [...Array.from({ length: steps + 1 }, (_, k) => at(half, arc.from + (arc.to - arc.from) * k / steps)),
         ...Array.from({ length: steps + 1 }, (_, k) => at(arc.inner, arc.to - (arc.to - arc.from) * k / steps)), at(half, arc.from)]
      : o?.round
      ? Array.from({ length: 25 }, (_, k) => { const a = k / 24 * Math.PI * 2; return [cLng + half * Math.cos(a) / mLng, cLat + half * Math.sin(a) / mLat]; })
      : [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]].map(([x, y]) => [cLng + x * half / mLng, cLat + y * half / mLat]);
    return { type: "Feature", properties: { id: m.id, base, top, t: (base + top) / 2 / monumentTop(m) }, geometry: { type: "Polygon", coordinates: [ring] } };
  }));
  return { type: "FeatureCollection", features };
}
// Everything of ours on the map is blue; brass is kept for private hunts (docs/design/city-orienteering.md).
const MONUMENT_RAMP = (t: unknown) => ["interpolate", ["linear"], t, 0, C.ink, 0.35, C.blue, 0.75, C.lightBlue, 1, C.glass];
export const mapPalette = {
  water: "#BCD3E6", waterLine: "#9DBBD6", land: "#F3EFE6", park: "#DCE6CF", sand: "#EFE3C6",
  building: "#E6E0D3", buildingTop: "#EEE9DE", road: "#FFFFFF", roadCase: "#D5DDE7", major: "#F1E2BF", label: C.blue, halo: "#F6F8FB",
};

function vectorStyle(pmtiles: string) {
  return {
    version: 8,
    glyphs: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
    sources: { base: { type: "vector", url: `pmtiles://${pmtiles}`, attribution: "© OpenStreetMap · Protomaps" } },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": mapPalette.water } },
      { id: "earth", type: "fill", source: "base", "source-layer": "earth", paint: { "fill-color": mapPalette.land } },
      { id: "parks", type: "fill", source: "base", "source-layer": "landuse", filter: ["in", ["get", "kind"], ["literal", ["park", "garden", "grass", "wood", "forest", "recreation_ground", "nature_reserve", "playground", "cemetery"]]], paint: { "fill-color": mapPalette.park } },
      { id: "beach", type: "fill", source: "base", "source-layer": "landuse", filter: ["in", ["get", "kind"], ["literal", ["beach", "sand"]]], paint: { "fill-color": mapPalette.sand } },
      { id: "water", type: "fill", source: "base", "source-layer": "water", paint: { "fill-color": mapPalette.water } },
      { id: "shore", type: "line", source: "base", "source-layer": "water", paint: { "line-color": mapPalette.waterLine, "line-width": 1.2 } },
      { id: "road-case", type: "line", source: "base", "source-layer": "roads", filter: ["in", ["get", "kind"], ["literal", ["highway", "major_road", "minor_road"]]], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": mapPalette.roadCase, "line-width": ["interpolate", ["linear"], ["zoom"], 13, 2, 17, 12, 19, 22] } },
      { id: "roads", type: "line", source: "base", "source-layer": "roads", filter: ["in", ["get", "kind"], ["literal", ["highway", "major_road", "minor_road", "path"]]], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["match", ["get", "kind"], ["highway", "major_road"], mapPalette.major, mapPalette.road], "line-width": ["interpolate", ["linear"], ["zoom"], 13, 1, 17, ["match", ["get", "kind"], "path", 2, 9], 19, ["match", ["get", "kind"], "path", 4, 18]] } },
      { id: "buildings", type: "fill-extrusion", source: "base", "source-layer": "buildings", minzoom: 15, filter: ["!", ["in", ["id"], ["literal", TILE_IDS]]], paint: { "fill-extrusion-color": mapPalette.building, "fill-extrusion-height": ["min", ["*", ["coalesce", ["get", "height"], 9], TOY_SCALE], TOY_MAX_M], "fill-extrusion-opacity": .82 } },
      // Landmark buildings from the tiles, repainted in the monument blue.
      { id: "monument-tiles", type: "fill-extrusion", source: "base", "source-layer": "buildings", minzoom: 15, filter: ["in", ["id"], ["literal", TILE_IDS]], paint: { "fill-extrusion-base": ["*", ["coalesce", ["get", "min_height"], 0], tileScale()], "fill-extrusion-height": ["*", ["coalesce", ["get", "height"], 9], tileScale()], "fill-extrusion-color": C.blue, "fill-extrusion-opacity": 1, "fill-extrusion-vertical-gradient": true } },
      { id: "places", type: "symbol", source: "base", "source-layer": "places", filter: ["in", ["get", "kind"], ["literal", ["neighbourhood", "locality", "macrohood"]]], layout: { "text-field": ["coalesce", ["get", "name:zh-Hant"], ["get", "name"]], "text-font": ["Noto Sans Regular"], "text-size": 12, "text-letter-spacing": .08 }, paint: { "text-color": mapPalette.label, "text-halo-color": mapPalette.halo, "text-halo-width": 1.6 } },
    ],
  };
}

function rasterStyle() {
  return {
    version: 8,
    sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 19, attribution: "© OpenStreetMap" } },
    layers: [{ id: "osm", type: "raster", source: "osm", paint: { "raster-saturation": -.8, "raster-contrast": -.3, "raster-brightness-min": .28, "raster-hue-rotate": -6 } }],
  };
}

export function mapHtml({ pmtiles, center }: { pmtiles: string | null; center: { lat: number; lng: number } }) {
  const style = pmtiles ? vectorStyle(pmtiles) : rasterStyle();
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="${MAPLIBRE}/maplibre-gl.css">
<script src="${MAPLIBRE}/maplibre-gl.js"></script>${pmtiles ? `<script src="${PMTILES}"></script>` : ""}
<style>
html,body,#map{margin:0;height:100%;width:100%;background:${C.paper};overflow:hidden;-webkit-tap-highlight-color:transparent;font-family:-apple-system,"Noto Sans TC",sans-serif}
.maplibregl-ctrl-attrib{font-size:9px;background:rgba(246,248,251,.7)!important}
.you{position:absolute;width:52px;height:52px;z-index:9}
.you .pulse{position:absolute;left:-14px;top:-14px;width:80px;height:80px;border-radius:50%;background:${C.lightBlue}33;animation:pulse 2.6s ease-out infinite}
.you .cone{position:absolute;left:6px;top:-30px;width:40px;height:40px;background:conic-gradient(from -25deg at 50% 100%,${C.lightBlue}88 0deg,transparent 50deg);border-radius:50% 50% 0 0;transform-origin:50% 100%}
.face{position:absolute;inset:0;border-radius:50%;overflow:hidden;border:3px solid #fff;box-shadow:0 3px 10px rgba(22,38,63,.3);background:${C.cream}}
.face img{position:absolute;width:119.07%;height:119.07%;left:-8.72%;top:-11.16%}
@keyframes pulse{0%{transform:scale(.55);opacity:.9}100%{transform:scale(1.25);opacity:0}}
/* MapLibre owns the anchor transform: never animate or scale this element. */
.pin{position:absolute;width:80px;height:96px;cursor:pointer;transition:opacity .25s}
.pin-body{position:absolute;inset:0;transform-origin:50% 100%}
/* Pins shrink with the map when you zoom out (--z, set from the zoom), like the buildings; only you and the
   Keeper keep their size. Taps only land on what you can see, so a smaller pin has a smaller tap area.
   A tapped stack fans out with --fx/--fy, kept separate from the scale so both can change smoothly. */
.pin{pointer-events:none}.pin-body>*{pointer-events:auto}.pin .disc{pointer-events:none}
.pin-body{scale:var(--z,1);translate:var(--fx,0) var(--fy,0);transition:translate .22s ease-out,opacity .25s}
.pin.keeper .pin-body{scale:1}
.pin.fanned{z-index:30!important}
#map.tiny .pin:not(.keeper) .pin-body{opacity:0}#map.tiny .pin:not(.keeper) .pin-body>*{pointer-events:none}
.fan-dot{width:8px;height:8px;border-radius:50%;background:${C.ink};border:2px solid #fff;box-shadow:0 1px 3px rgba(22,38,63,.3);pointer-events:none}
.pin .disc{position:absolute;left:18px;bottom:0;width:44px;height:12px;border-radius:50%;background:radial-gradient(${C.ink}40,transparent 70%)}
.pin .v{position:absolute;left:0;bottom:2px;width:80px;height:80px;object-fit:contain;animation:bob 3.6s ease-in-out infinite}
.pin .who{position:absolute;right:2px;top:4px;width:28px;height:28px}
.pin .who .face{border-width:2px}
.pin .tag{position:absolute;left:50%;bottom:-20px;transform:translateX(-50%);white-space:nowrap;font-size:10px;letter-spacing:.04em;padding:2px 7px;border-radius:9px;background:rgba(255,255,255,.92);color:${C.blue};box-shadow:0 1px 4px rgba(22,38,63,.15)}
.pin.near .tag{background:${C.brass};color:#fff}
.pin.place .tag{background:${C.ink};color:${C.brass}}
/* Private capsules: the sender's picture wears a plum ring and a small wax seal; public ones never do. */
.pin.private .who .face{border-color:${C.plum}}
.pin .who .lock{position:absolute;left:-4px;bottom:-4px;width:13px;height:13px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#C4526B,${C.wax} 62%,#7E2438);box-shadow:0 1px 2px rgba(22,38,63,.35)}
.pin .who .lock:after{content:"";position:absolute;left:5px;top:3px;width:3px;height:3px;border-radius:50%;background:#F3D9DF;box-shadow:0 2px 0 -.5px #F3D9DF}
.pin .tag.timer{bottom:-16px;display:flex;align-items:center;gap:3px;font-size:10px;padding:1px 6px}
.pin.opened .pin-body{opacity:.6}
/* The player never blocks a tap on what is behind them (only their "this is you" label is tappable). */
.you.walking .me{animation:stride .36s ease-in-out infinite}
@keyframes stride{0%,100%{translate:0 0}50%{translate:0 -3px}}
.you,.you *{pointer-events:none}.you .label{pointer-events:auto}
.pin.far{opacity:.75}
.pin.far .pin-body{transform:scale(.72)}
.pin.sea.far .pin-body,.pin.sea.sel .pin-body{transform:none}
.pin.sel{z-index:10}
.pin.sel .pin-body{transform:scale(1.18)}
.pin.sel .v{filter:drop-shadow(0 0 8px ${C.brass})}
.pin.sealed .v{filter:grayscale(.2)}
.pin .cracks{pointer-events:none}
.pin.corrupted .v:not(.cracks){filter:saturate(.55) brightness(.84)}
.pin.corrupted.rare .disc{background:radial-gradient(${C.brass}AA,transparent 70%)}
.pin.corrupted.uncommon .disc{background:radial-gradient(${C.lightBlue}99,transparent 70%)}
.pin.waypost{width:40px;height:50px}
.pin.waypost .disc{left:6px;width:28px;height:8px}
.pin.waypost .post{position:absolute;left:7px;bottom:9px;width:26px;height:41px;background-size:122px;background-position:center;background-repeat:no-repeat;animation:bob 3.6s ease-in-out infinite}
/* Ready to spin: the blue gem art. Spun: the purple one (the app swaps the file). */
.pin.waypost.near:not(.done) .post{filter:drop-shadow(0 0 6px ${C.lightBlue}) brightness(1.08)}
.pin.waypost.near:not(.done) .disc{background:radial-gradient(${C.lightBlue}AA,transparent 70%)}
/* The Letter Keeper: a person, with a brass wax seal over his head (! or ✓). */
.pin.keeper{width:56px;height:100px;z-index:6}
.pin.keeper .disc{left:10px;width:36px;height:10px}
.pin.keeper .fig{position:absolute;left:4px;bottom:6px;width:48px;height:48px}
.pin.keeper .fig .face{border-color:${C.brass}}
.pin.keeper .fig.full{left:-14px;bottom:-8px;width:84px;height:84px;background-size:contain;background-position:center;background-repeat:no-repeat;filter:drop-shadow(0 2px 3px rgba(22,38,63,.25))}
.pin.keeper .seal{position:absolute;left:14px;top:0;width:28px;height:28px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#E2C58A,${C.brass} 60%,#A9843F);box-shadow:0 2px 6px rgba(22,38,63,.35),inset 0 0 0 2px #E8D3A3;color:#fff;font:700 17px/28px Georgia,serif;text-align:center;animation:float 2.2s ease-in-out infinite}
/* With full-body art the seal sits above his head. */
.pin.keeper .fig.full+.seal{top:4px}
@keyframes labelIn{from{opacity:0;transform:translate(-50%,6px)}to{opacity:1;transform:translateX(-50%)}}
@keyframes float{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-4px) scale(1.06)}}
.you .me{position:absolute;left:-17px;top:-49px;width:86px;height:86px;background-size:contain;background-position:center;background-repeat:no-repeat;filter:drop-shadow(0 2px 3px rgba(22,38,63,.25));transition:transform .25s}
.you .me.left{transform:scaleX(-1)}
.you.fig .label{bottom:96px}
.you .label{animation:labelIn .3s ease-out;position:absolute;left:50%;bottom:66px;transform:translateX(-50%);white-space:nowrap;font-size:12px;font-weight:600;letter-spacing:.04em;padding:5px 10px;border-radius:12px;background:${C.ink};color:${C.brass};box-shadow:0 2px 8px rgba(22,38,63,.3);cursor:pointer}
.you .label:after{content:"";position:absolute;left:50%;top:100%;margin-left:-5px;border:5px solid transparent;border-top-color:${C.ink}}
/* Landmark: a floating seal badge with a four-point star, the same for every Landmark (on top of its monument when it has one), never a gem. Plum once beaten. */
.pin.landmark{width:40px;height:44px;--lm:${C.lightBlue};--lm-hi:#C3DAF5;--lm-lo:${C.blue}}
.pin.landmark.done{--lm:${C.plum};--lm-hi:#B98494;--lm-lo:#4A1C2A}
.pin.landmark .badge{position:absolute;left:6px;bottom:8px;width:28px;height:28px;border-radius:50%;background:radial-gradient(circle at 35% 30%,var(--lm-hi),var(--lm) 62%,var(--lm-lo));box-shadow:0 2px 6px rgba(22,38,63,.35),inset 0 0 0 2px var(--lm-hi);display:flex;align-items:center;justify-content:center;animation:bob 3.6s ease-in-out infinite}
.pin.landmark .badge svg{width:16px;height:16px}
.pin.landmark.top{height:30px;width:28px}
.pin.landmark.top .badge{bottom:1px;left:0}
/* Private-hunt waypoint: a brass location pin, not a gem, so it never reads as one of ours
   (docs/design/city-orienteering.md). Done: cream with a tick. Locked by an in-order route: dashed. */
.pin.mission{width:36px;height:52px;--mp:${C.brass};--mp-hi:#E2C58A;--mp-lo:#A9843F;--mg:#fff}
.pin.mission.done{--mp:${C.cream};--mp-hi:#FBF2DC;--mp-lo:#D9C291;--mg:${C.brass}}
.pin.mission .disc{left:6px;width:24px;height:7px;background:radial-gradient(${C.brass}66,transparent 70%)}
.pin.mission .loc{position:absolute;left:0;bottom:4px;width:36px;height:46px;filter:drop-shadow(0 2px 4px rgba(22,38,63,.3));animation:bob 3.6s ease-in-out infinite}
.pin.mission.locked .loc{opacity:.6}
.pin.mission.near:not(.done):not(.locked) .loc{filter:drop-shadow(0 0 7px ${C.brass})}
.pin.mission.near:not(.done):not(.locked) .disc{background:radial-gradient(${C.brass}AA,transparent 70%)}
.pin.mission .tag{bottom:-14px;background:${C.brass};color:#fff}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@media (prefers-reduced-motion: reduce){.pin .v,.pin .post,.pin .badge,.pin.mission .loc,.you .pulse,.pin.keeper .seal{animation:none}}
</style></head><body><div id="map"></div>
<script>
const send=m=>{const s=JSON.stringify(m);if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(s);else parent.postMessage({__tcmap:s},'*')};
window.onerror=(e)=>send({type:'error',message:String(e)});
async function init(){
// MapLibre's CDN blob worker can silently fail inside an iframe/WebView.
// Load its classic worker explicitly before creating the map.
const workerCode=await fetch('${MAPLIBRE}/maplibre-gl-csp-worker.js').then(r=>{if(!r.ok)throw Error('map worker '+r.status);return r.text()});
maplibregl.setWorkerUrl(URL.createObjectURL(new Blob([workerCode],{type:'text/javascript'})));
${pmtiles ? "const protocol=new pmtiles.Protocol();maplibregl.addProtocol('pmtiles',protocol.tile);" : ""}
// Mercator's 512 px world tile: the 200 m pickup circle spans 75% of a phone's width (height limits it on wide windows).
const pickupZoom=(lat,r=100)=>Math.log2(40075016.686*Math.cos(lat*Math.PI/180)*Math.min(innerWidth,innerHeight)*.75/(512*2*r));
const cameraPadding={top:80,bottom:160,left:0,right:0};
const map=new maplibregl.Map({container:'map',style:${JSON.stringify(style)},center:[${center.lng},${center.lat}],zoom:pickupZoom(${center.lat}),padding:cameraPadding,pitch:40,maxPitch:70,bearing:0,attributionControl:{compact:true},localIdeographFontFamily:'"PingFang TC","Noto Sans TC",sans-serif'});
window.__tcmapInstance=map;
let follow=true,you=null,state={pins:[]},marks=new Map(),youMark=null,heading=0;
// Wayposts are floating gems, clearly not buildings and clearly not capsules.
const HOURGLASS='<svg viewBox="0 0 10 12" width="8" height="10"><path d="M1 1h8M1 11h8M2 1c0 3 3 3.5 3 5S2 8 2 11M8 1c0 3-3 3.5-3 5s3 2 3 5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
// A private hunt's brass location pin, with one glyph per mission type (a tick once it is done, a padlock while the route locks it).
const MISSION_GLYPH={arrive:'M-4 5V-5l8 2-8 3',spin:'M0-5.4a5.4 5.4 0 1 0 0 10.8 5.4 5.4 0 0 0 0-10.8M0-5.4V5.4M-5.4 0H5.4',puzzle:'M-2.6-2.4a2.7 2.7 0 1 1 2.8 3.1V2.4M0 4.8v.1',done:'M-4 0 -1 3 4-3',locked:'M-3.2-.6h6.4V4h-6.4ZM-2-.6v-1.8a2 2 0 0 1 4 0v1.8'};
const locPin=(kind,fill)=>'<svg class="loc" viewBox="0 0 36 46" fill="none">'
  +'<path d="M18 45C18 45 4.5 28 4.5 17.5a13.5 13.5 0 0 1 27 0C31.5 28 18 45 18 45Z" fill="'+(fill||'var(--mp)')+'" stroke="var(--mp-lo)" stroke-width="1.6"'+(kind==='locked'?' stroke-dasharray="4 3"':'')+'/>'
  +'<path d="M18 7.5a10 10 0 0 1 8.4 4.6" stroke="var(--mp-hi)" stroke-width="2" stroke-linecap="round"/>'
  +'<g transform="translate(18 17.5)"><path d="'+MISSION_GLYPH[kind]+'" fill="none" stroke="var(--mg)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g></svg>';
const face=src=>src?'<div class="face"><img src="'+src+'"></div>':'<div class="face"></div>';
const circle=(c,r)=>{const pts=[];for(let i=0;i<=48;i++){const a=i/48*Math.PI*2;pts.push([c.lng+r*Math.cos(a)/(111320*Math.cos(c.lat*Math.PI/180)),c.lat+r*Math.sin(a)/110540])}return{type:'Feature',geometry:{type:'Polygon',coordinates:[pts]}}};
map.on('load',()=>{
  map.addSource('monuments',{type:'geojson',data:${JSON.stringify(monumentGeoJson())}});
  map.addLayer({id:'monuments',type:'fill-extrusion',source:'monuments',paint:{'fill-extrusion-base':['get','base'],'fill-extrusion-height':['get','top'],'fill-extrusion-color':${JSON.stringify(MONUMENT_RAMP(["get", "t"]))},'fill-extrusion-opacity':1,'fill-extrusion-vertical-gradient':true}});
  map.addSource('reach',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
  map.addLayer({id:'reach-fill',type:'fill',source:'reach',paint:{'fill-color':'${C.brass}','fill-opacity':.12}});
  map.addLayer({id:'reach-line',type:'line',source:'reach',paint:{'line-color':'${C.brass}','line-width':1.5,'line-dasharray':[2,2]}});
  send({type:'ready'});render();rescale();
});
map.on('dragstart',()=>{if(follow){follow=false;send({type:'follow',follow:false})}});
// Pin size follows the zoom: full size at the pickup zoom (never bigger), half per level out, at least 40%;
// three levels out they fade away. Recomputed on every zoom.
const mapEl=document.getElementById('map');let zNow=1;
const rescale=()=>{const base=pickupZoom(you?you.lat:map.getCenter().lat,state.reach||100),d=map.getZoom()-base;
  zNow=Math.max(.4,Math.min(1,Math.pow(2,d)));mapEl.style.setProperty('--z',zNow.toFixed(3));mapEl.classList.toggle('tiny',d<-3)};
map.on('zoom',rescale);
// Overlapping pins: the first tap on a stack fans it out around its spot (pins never move on the map itself);
// tapping one then opens it. Tapping the map or moving it folds the fan back.
let fan=null;
const fold=()=>{if(!fan)return;for(const id of fan.ids){const m=marks.get(id);if(m){const b=m.marker.getElement();b.style.removeProperty('--fx');b.style.removeProperty('--fy');b.classList.remove('fanned')}}fan.dot.remove();fan=null};
const screenOf=m=>{const p=map.project(m.marker.getLngLat()),o=m.marker.getOffset();return{x:p.x+o.x,y:p.y+o.y}};
// The pictures you can see (not the transparent box around them), so "overlapping" means what it looks like.
const artBox=el=>{let b=null;for(const x of el.querySelectorAll('.pin-body>*:not(.disc)')){const r=x.getBoundingClientRect();if(!r.width)continue;b=b?{l:Math.min(b.l,r.left),t:Math.min(b.t,r.top),r:Math.max(b.r,r.right),b:Math.max(b.b,r.bottom)}:{l:r.left,t:r.top,r:r.right,b:r.bottom}}return b};
const stackOf=id=>{const at=new Map();for(const [k,m] of marks){const box=artBox(m.marker.getElement());if(box)at.set(k,{p:screenOf(m),w:box.r-box.l,box})}
  const A=at.get(id);if(!A)return{out:[id],at,me:null};const ov=(a,b)=>a.l+6<b.r&&b.l+6<a.r&&a.t+6<b.b&&b.t+6<a.b;
  // The player counts too: whatever they cover joins the stack, and the ring forms around them.
  const meEl=youMark&&youMark.getElement().querySelector('.me,.face'),r0=meEl&&meEl.getBoundingClientRect();
  const me=r0&&r0.width?{l:r0.left,t:r0.top,r:r0.right,b:r0.bottom}:null,underMe=me&&ov(A.box,me);
  const out=[id];for(const [k,B] of at)if(k!==id&&out.length<10&&(ov(A.box,B.box)||(underMe&&ov(me,B.box))))out.push(k);
  return{out,at,me:underMe?me:null}};
const tapPin=id=>{
  if(fan&&fan.ids.includes(id)){fold();send({type:'select',id});return}
  fold();const{out,at,me}=stackOf(id);if(out.length<2&&!me){send({type:'select',id});return}
  // Around the player's feet when they were in the way (they stay put), otherwise around the stack's middle.
  const c=me?{x:(me.l+me.r)/2,y:(me.t+me.b)/2+40*zNow}:out.reduce((s,k)=>({x:s.x+at.get(k).p.x/out.length,y:s.y+at.get(k).p.y/out.length}),{x:0,y:0});
  const w=Math.max(...out.map(k=>at.get(k).w)),n=out.length+(me?1:0),r=Math.max(w*.75+(me?Math.max(me.r-me.l,me.b-me.t)/2:0),w/2/Math.sin(Math.PI/n));
  out.forEach((k,i)=>{const a=(me?-Math.PI/4:-Math.PI/2)+i*2*Math.PI/out.length,p=at.get(k).p,b=marks.get(k).marker.getElement();
    b.style.setProperty('--fx',(c.x+r*Math.cos(a)-p.x).toFixed(1)+'px');b.style.setProperty('--fy',(c.y+r*Math.sin(a)-p.y).toFixed(1)+'px');b.classList.add('fanned')});
  const d=document.createElement('div');d.className='fan-dot';fan={ids:out,dot:new maplibregl.Marker({element:d}).setLngLat(map.unproject([c.x,c.y])).addTo(map)}};
map.on('movestart',fold);
map.on('resize',()=>{if(follow&&you)map.jumpTo({center:[you.lng,you.lat],zoom:pickupZoom(you.lat,state.reach||100),padding:cameraPadding})});
// Tapping a monument building opens its Landmark; anywhere else is a plain map tap.
const TILE_OWNER=${JSON.stringify(TILE_OWNER)};
const monumentAt=p=>{const layers=['monuments','monument-tiles'].filter(l=>map.getLayer(l));const hit=layers.length&&map.queryRenderedFeatures(p,{layers})[0];return hit?(hit.layer.id==='monuments'?hit.properties.id:TILE_OWNER[hit.id]):null};
map.on('click',e=>{if(fan){fold();return}const id=monumentAt(e.point);if(id){send({type:'select',id:'monument-'+id});return}send({type:'tap',lat:e.lngLat.lat,lng:e.lngLat.lng})});
map.on('mousemove',e=>{map.getCanvas().style.cursor=monumentAt(e.point)?'pointer':''});
// A badge "on top" of a building: the screen offset from its ground point to the same point raised
// to the building's height, through the camera's own perspective, so it stays on the spire as the map moves.
const liftOffset=(ll,meters)=>{const t=map.transform;const mc=maplibregl.MercatorCoordinate.fromLngLat(ll);
  if(typeof t.coordinatePoint!=='function')return [0,0];const a=t.coordinatePoint(mc,0),b=t.coordinatePoint(mc,meters);return [b.x-a.x,b.y-a.y]};
const relift=()=>{for(const [,m] of marks){if(m.lift)m.marker.setOffset(liftOffset(m.marker.getLngLat(),m.lift))}};
map.on('move',relift);map.on('resize',relift);
// Tap-to-walk: inside the pickup circle the figure strolls to where you tapped. Only the picture moves: the
// circle, the camera and every server check stay on your real position. Once you really move about 10 m,
// the figure walks back to you.
let walkAt=null,walkFrom=null,walkLeft=null,strolling=false,strollId=0;
const shown=()=>walkAt?[walkAt.lng,walkAt.lat]:[you.lng,you.lat];
const metres=(a,b)=>Math.hypot((a.lng-b.lng)*111320*Math.cos(a.lat*Math.PI/180),(a.lat-b.lat)*110540);
const still=matchMedia('(prefers-reduced-motion: reduce)').matches;
function stroll(to,after){if(!youMark)return;const from=youMark.getLngLat(),f={lat:from.lat,lng:from.lng},d=metres(f,to);
  const a=map.project([f.lng,f.lat]),b=map.project([to.lng,to.lat]);if(Math.abs(b.x-a.x)>4)walkLeft=b.x<a.x;
  const ms=still?0:Math.min(2200,Math.max(350,d/30*1000)),t0=performance.now(),yel=youMark.getElement(),id=++strollId;strolling=true;yel.classList.add('walking');render();
  const step=now=>{if(id!==strollId)return;const k=ms?Math.min(1,(now-t0)/ms):1,e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
    youMark.setLngLat([f.lng+(to.lng-f.lng)*e,f.lat+(to.lat-f.lat)*e]);
    if(k<1)requestAnimationFrame(step);else{strolling=false;yel.classList.remove('walking');after&&after();render()}};
  requestAnimationFrame(step)}
const walkTo=to=>{if(!you)return;walkFrom={lat:you.lat,lng:you.lng};walkAt={lat:to.lat,lng:to.lng};stroll(walkAt)};
const walkHome=()=>{walkAt=null;walkFrom=null;stroll({lat:you.lat,lng:you.lng},()=>{walkLeft=null})};
function render(){
  if(you){
    if(!youMark){const el=document.createElement('div');el.className='you'+(state.figure?' fig':'');el.innerHTML='<div class="pulse"></div><div class="cone"></div>'+(state.figure?'<div class="me" style="background-image:url('+state.figure+')"></div>':face(state.portrait));youMark=new maplibregl.Marker({element:el,rotationAlignment:'viewport',pitchAlignment:'viewport'}).setLngLat(shown()).addTo(map)}
    else if(!strolling)youMark.setLngLat(shown());
    const yel=youMark.getElement();
    // Swap face ↔ figure if the profile arrived after the map.
    const want=state.figure||'';if((yel.dataset.fig||'')!==want){yel.dataset.fig=want;yel.classList.toggle('fig',!!want);const old=yel.querySelector('.me,.face');const n=document.createElement('div');n.innerHTML=want?'<div class="me" style="background-image:url('+want+')"></div>':face(state.portrait);old?old.replaceWith(n.firstChild):yel.appendChild(n.firstChild)}
    let lab=yel.querySelector('.label');
    if(state.youLabel){if(!lab){lab=document.createElement('div');lab.className='label';lab.addEventListener('click',ev=>{ev.stopPropagation();send({type:'select',id:'you'})});yel.appendChild(lab)}lab.textContent=state.youLabel}else if(lab&&!lab.dataset.out){lab.dataset.out='1';lab.style.transition='opacity .4s';lab.style.opacity='0';setTimeout(()=>lab.remove(),420)}
    youMark.getElement().querySelector('.cone').style.transform='rotate('+((heading||0)-map.getBearing())+'deg)';
    // The figure faces right in the art: mirror it when walking toward the left of the screen.
    const me=yel.querySelector('.me');if(me)me.classList.toggle('left',walkLeft!==null?walkLeft:Math.sin(((heading||0)-map.getBearing())*Math.PI/180)<-.2);
    map.getSource('reach')&&map.getSource('reach').setData({type:'FeatureCollection',features:[circle(you,state.reach||100)]});
  }
  const want=new Set(state.pins.map(p=>p.id));
  for(const [id,m] of marks){if(!want.has(id)){m.marker.remove();marks.delete(id)}}
  for(const p of state.pins){
    const html=p.kind==='keeper'?'<div class="pin-body"><div class="disc"></div>'+(p.figure?'<div class="fig full" style="background-image:url('+p.figure+')"></div>':'<div class="fig">'+face(p.portrait)+'</div>')+(p.mark?'<div class="seal">'+p.mark+'</div>':'')+'</div>'
      :p.kind==='landmark'?'<div class="pin-body"><div class="badge"><svg viewBox="0 0 24 24" fill="#fff"><path d="M12 1.5C12.8 8.2 15.8 11.2 22.5 12 15.8 12.8 12.8 15.8 12 22.5 11.2 15.8 8.2 12.8 1.5 12 8.2 11.2 11.2 8.2 12 1.5Z"/></svg></div></div>'
      :p.kind==='mission'?'<div class="pin-body"><div class="disc"></div>'+locPin(p.done?'done':p.locked?'locked':(p.mission||'arrive'))+(p.tag?'<div class="tag">'+p.tag+'</div>':'')+'</div>'
      :p.kind==='waypost'?'<div class="pin-body"><div class="disc"></div>'+'<div class="post" style="background-image:url('+p.vessel+')"></div></div>':'<div class="pin-body"><div class="disc"></div><img class="v" src="'+p.vessel+'">'+(p.kind==='corrupted'&&p.cracks?'<img class="v cracks" src="'+p.cracks+'">':'')+(p.portrait!==undefined&&(p.portrait||p.private)?'<div class="who">'+face(p.portrait)+(p.private?'<div class="lock"></div>':'')+'</div>':'')+(p.timer?'<div class="tag timer">'+HOURGLASS+p.timer+'</div>':p.tag?'<div class="tag">'+p.tag+'</div>':'')+'</div>';
    const cls='pin '+(p.kind||'')+(p.near?' near':'')+(p.far?' far':'')+(p.selected?' sel':'')+(p.sealed?' sealed':'')+(p.rarity?' '+p.rarity:'')+(p.done?' done':'')+(p.hunt?' hunt':'')+(p.lift?' top':'')+(p.private?' private':'')+(p.opened?' opened':'')+(p.locked?' locked':'');
    let m=marks.get(p.id);
    if(!m){const el=document.createElement('div');el.addEventListener('click',ev=>{ev.stopPropagation();tapPin(p.id)});m={marker:new maplibregl.Marker({element:el,anchor:'bottom',rotationAlignment:'viewport',pitchAlignment:'viewport'}).setLngLat([p.lng,p.lat]).addTo(map),html:'',cls:''};marks.set(p.id,m)}
    const el=m.marker.getElement();
    if(m.html!==html){el.innerHTML=html;m.html=html}
    if(m.cls!==cls){if(m.cls)el.classList.remove(...m.cls.split(' '));el.classList.add(...cls.split(' '));m.cls=cls}
    el.style.zIndex=p.selected?20:p.kind==="keeper"?8:p.near?5:1;
    m.marker.setLngLat([p.lng,p.lat]);
    if(m.lift!==(p.lift||0)){m.lift=p.lift||0;m.marker.setOffset(m.lift?liftOffset(m.marker.getLngLat(),m.lift):[0,0])}
  }
}
function recv(m){
  if(m.type==='state'){if(fan&&m.pins.map(p=>p.id).join()!==state.pins.map(p=>p.id).join())fold();const moved=!you||!m.you||Math.abs(you.lat-m.you.lat)+Math.abs(you.lng-m.you.lng)>1e-6;if(walkFrom&&m.you&&metres(walkFrom,m.you)>10){you=m.you;walkHome()}you=m.you;state=m;heading=m.heading||heading;render();rescale();if(follow&&you&&moved)map.easeTo({center:[you.lng,you.lat],duration:you?900:0,padding:cameraPadding})}
  if(m.type==='recenter'&&you){follow=true;map.easeTo({center:[you.lng,you.lat],zoom:pickupZoom(you.lat,state.reach||100),pitch:40,bearing:0,duration:900,padding:cameraPadding})}
  if(m.type==='walk'&&you)walkTo({lat:m.lat,lng:m.lng});
  if(m.type==='focus'){follow=false;send({type:'follow',follow:false});map.easeTo({center:[m.lng,m.lat],zoom:pickupZoom(m.lat,state.reach||100),duration:700})}
}
window.__tcmap=recv;
window.addEventListener('message',e=>{if(e.data&&e.data.__tcin)recv(JSON.parse(e.data.__tcin))});
}
init().catch(e=>send({type:'error',message:String(e)}));
</script></body></html>`;
}
