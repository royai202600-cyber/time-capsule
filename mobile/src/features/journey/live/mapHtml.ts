// The live map page, shared by web (iframe srcdoc) and phones (react-native-webview, works in Expo Go).
// MapLibre GL + Protomaps vector tiles in the app's palette; falls back to tinted OSM raster tiles
// when no PMTiles URL is configured (development only).
import { C } from "../../../theme";

export const MAPLIBRE = "https://unpkg.com/maplibre-gl@5.24.0/dist";
export const PMTILES = "https://unpkg.com/pmtiles@4.5.0/dist/pmtiles.js";

// Toy-scale city: buildings at a third of their height, never above 40 m, so they never wall off the game.
const TOY_SCALE = 0.35;
const TOY_MAX_M = 40;

// Landmarks drawn as stacked brass boxes at their real spot: [south-west-north-east box half-width m, base m, top m].
type Tier = [number, number, number];
const flare = (from: number, h: number, narrow: number, wide: number): Tier[] => [[narrow, from, from + h * .35], [(narrow + wide) / 2, from + h * .35, from + h * .7], [wide, from + h * .7, from + h]];
/** The monument's top, where its Landmark seal floats. */
export const monumentTop = (m: { tiers: Tier[] }) => Math.max(...m.tiers.map((t) => t[2]));
export const MONUMENTS: { id: string; lat: number; lng: number; tiers: Tier[] }[] = [
  { id: "taipei101", lat: 25.033667, lng: 121.56481, tiers: [ // spire axis from the OSM building data in our tiles; Wikipedia agrees within ~20 m
    // A wide low base covers the real (grey) mall around the tower foot.
    [62, 0, 18], [36, 18, 24], [24, 24, 30], [21, 30, 36],
    ...Array.from({ length: 8 }, (_, i) => flare(36 + i * 8, 8, 14, 18.5)).flat(),
    [12, 100, 106], [8, 106, 112], [4, 112, 116], [1.6, 116, 142],
  ] },
];
function monumentGeoJson() {
  const features = MONUMENTS.flatMap((m) => m.tiers.map(([half, base, top], i) => {
    const dLat = half / 110540, dLng = half / (111320 * Math.cos(m.lat * Math.PI / 180));
    const ring = [[m.lng - dLng, m.lat - dLat], [m.lng + dLng, m.lat - dLat], [m.lng + dLng, m.lat + dLat], [m.lng - dLng, m.lat + dLat], [m.lng - dLng, m.lat - dLat]];
    return { type: "Feature", properties: { id: m.id, base, top, t: i / (m.tiers.length - 1) }, geometry: { type: "Polygon", coordinates: [ring] } };
  }));
  return { type: "FeatureCollection", features };
}
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
      { id: "buildings", type: "fill-extrusion", source: "base", "source-layer": "buildings", minzoom: 15, paint: { "fill-extrusion-color": mapPalette.building, "fill-extrusion-height": ["min", ["*", ["coalesce", ["get", "height"], 9], TOY_SCALE], TOY_MAX_M], "fill-extrusion-opacity": .82 } },
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
html,body,#map{--ready:hue-rotate(-130deg) saturate(1.5);margin:0;height:100%;width:100%;background:${C.paper};overflow:hidden;-webkit-tap-highlight-color:transparent;font-family:-apple-system,"Noto Sans TC",sans-serif}
.maplibregl-ctrl-attrib{font-size:9px;background:rgba(246,248,251,.7)!important}
.you{position:absolute;width:52px;height:52px}
.you .pulse{position:absolute;left:-14px;top:-14px;width:80px;height:80px;border-radius:50%;background:${C.lightBlue}33;animation:pulse 2.6s ease-out infinite}
.you .cone{position:absolute;left:6px;top:-30px;width:40px;height:40px;background:conic-gradient(from -25deg at 50% 100%,${C.lightBlue}88 0deg,transparent 50deg);border-radius:50% 50% 0 0;transform-origin:50% 100%}
.face{position:absolute;inset:0;border-radius:50%;overflow:hidden;border:3px solid #fff;box-shadow:0 3px 10px rgba(22,38,63,.3);background:${C.cream}}
.face img{position:absolute;width:119.07%;height:119.07%;left:-8.72%;top:-11.16%}
@keyframes pulse{0%{transform:scale(.55);opacity:.9}100%{transform:scale(1.25);opacity:0}}
/* MapLibre owns the anchor transform: never animate or scale this element. */
.pin{position:absolute;width:80px;height:96px;cursor:pointer;transition:opacity .25s}
.pin-body{position:absolute;inset:0;transform-origin:50% 100%}
.pin .disc{position:absolute;left:18px;bottom:0;width:44px;height:12px;border-radius:50%;background:radial-gradient(${C.ink}40,transparent 70%)}
.pin .v{position:absolute;left:0;bottom:2px;width:80px;height:80px;object-fit:contain;animation:bob 3.6s ease-in-out infinite}
.pin .who{position:absolute;right:2px;top:4px;width:28px;height:28px}
.pin .who .face{border-width:2px}
.pin .tag{position:absolute;left:50%;bottom:-20px;transform:translateX(-50%);white-space:nowrap;font-size:10px;letter-spacing:.04em;padding:2px 7px;border-radius:9px;background:rgba(255,255,255,.92);color:${C.blue};box-shadow:0 1px 4px rgba(22,38,63,.15)}
.pin.near .tag{background:${C.brass};color:#fff}
.pin.place .tag{background:${C.ink};color:${C.brass}}
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
/* Ready to spin: ink blue (tinted until the blue gem art lands). Spun: the original purple. */
.pin.waypost .post{filter:var(--ready)}
.pin.waypost.done .post{filter:none}
.pin.waypost.near:not(.done) .post{filter:var(--ready) drop-shadow(0 0 6px ${C.lightBlue}) brightness(1.12)}
.pin.waypost.near:not(.done) .disc{background:radial-gradient(${C.lightBlue}AA,transparent 70%)}
/* The Letter Keeper: a person, with a brass wax seal over his head (! or ✓). */
.pin.keeper{width:56px;height:96px;z-index:6}
.pin.keeper .disc{left:10px;width:36px;height:10px}
.pin.keeper .fig{position:absolute;left:4px;bottom:6px;width:48px;height:48px}
.pin.keeper .fig .face{border-color:${C.brass}}
.pin.keeper .fig.full{left:-12px;bottom:2px;width:80px;height:80px;background-size:contain;background-position:center bottom;background-repeat:no-repeat}
.pin.keeper .seal{position:absolute;left:14px;top:0;width:28px;height:28px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#E2C58A,${C.brass} 60%,#A9843F);box-shadow:0 2px 6px rgba(22,38,63,.35),inset 0 0 0 2px #E8D3A3;color:#fff;font:700 17px/28px Georgia,serif;text-align:center;animation:float 2.2s ease-in-out infinite}
/* With full-body art the seal sits above his head. */
.pin.keeper .fig.full+.seal{top:-22px}
@keyframes labelIn{from{opacity:0;transform:translate(-50%,6px)}to{opacity:1;transform:translateX(-50%)}}
@keyframes float{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-4px) scale(1.06)}}
.you .label{animation:labelIn .3s ease-out;position:absolute;left:50%;bottom:66px;transform:translateX(-50%);white-space:nowrap;font-size:12px;font-weight:600;letter-spacing:.04em;padding:5px 10px;border-radius:12px;background:${C.ink};color:${C.brass};box-shadow:0 2px 8px rgba(22,38,63,.3);cursor:pointer}
.you .label:after{content:"";position:absolute;left:50%;top:100%;margin-left:-5px;border:5px solid transparent;border-top-color:${C.ink}}
/* Landmark: a floating seal badge (on top of its monument when it has one), never a gem. Plum once beaten. */
.pin.landmark{width:40px;height:44px;--lm:${C.brass};--lm-hi:#E8D3A3;--lm-lo:#9C7B3C}
.pin.landmark.done{--lm:${C.plum};--lm-hi:#B98494;--lm-lo:#4A1C2A}
.pin.landmark .badge{position:absolute;left:6px;bottom:8px;width:28px;height:28px;border-radius:50%;background:radial-gradient(circle at 35% 30%,var(--lm-hi),var(--lm) 62%,var(--lm-lo));box-shadow:0 2px 6px rgba(22,38,63,.35),inset 0 0 0 2px var(--lm-hi);display:flex;align-items:center;justify-content:center;animation:bob 3.6s ease-in-out infinite}
.pin.landmark .badge svg{width:16px;height:16px}
.pin.landmark.top{height:30px;width:28px}
.pin.landmark.top .badge{bottom:1px;left:0}
.pin.landmark.near .badge{box-shadow:0 0 10px var(--lm),inset 0 0 0 2px var(--lm-hi)}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@media (prefers-reduced-motion: reduce){.pin .v,.pin .post,.pin .badge,.you .pulse,.pin.keeper .seal{animation:none}}
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
const face=src=>src?'<div class="face"><img src="'+src+'"></div>':'<div class="face"></div>';
const circle=(c,r)=>{const pts=[];for(let i=0;i<=48;i++){const a=i/48*Math.PI*2;pts.push([c.lng+r*Math.cos(a)/(111320*Math.cos(c.lat*Math.PI/180)),c.lat+r*Math.sin(a)/110540])}return{type:'Feature',geometry:{type:'Polygon',coordinates:[pts]}}};
map.on('load',()=>{
  map.addSource('monuments',{type:'geojson',data:${JSON.stringify(monumentGeoJson())}});
  map.addLayer({id:'monuments',type:'fill-extrusion',source:'monuments',paint:{'fill-extrusion-base':['get','base'],'fill-extrusion-height':['get','top'],'fill-extrusion-color':['interpolate',['linear'],['get','t'],0,'#B98F45',0.6,'${C.brass}',1,'#F3E2BB'],'fill-extrusion-opacity':1,'fill-extrusion-vertical-gradient':true}});
  map.addSource('reach',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
  map.addLayer({id:'reach-fill',type:'fill',source:'reach',paint:{'fill-color':'${C.brass}','fill-opacity':.12}});
  map.addLayer({id:'reach-line',type:'line',source:'reach',paint:{'line-color':'${C.brass}','line-width':1.5,'line-dasharray':[2,2]}});
  send({type:'ready'});render();
});
map.on('dragstart',()=>{if(follow){follow=false;send({type:'follow',follow:false})}});
map.on('resize',()=>{if(follow&&you)map.jumpTo({center:[you.lng,you.lat],zoom:pickupZoom(you.lat,state.reach||100),padding:cameraPadding})});
// Tapping a monument building opens its Landmark; anywhere else is a plain map tap.
map.on('click',e=>{const hit=map.getLayer('monuments')&&map.queryRenderedFeatures(e.point,{layers:['monuments']})[0];if(hit){send({type:'select',id:'monument-'+hit.properties.id});return}send({type:'tap',lat:e.lngLat.lat,lng:e.lngLat.lng})});
map.on('mousemove',e=>{const c=map.getCanvas();const over=map.getLayer('monuments')&&map.queryRenderedFeatures(e.point,{layers:['monuments']}).length;c.style.cursor=over?'pointer':''});
// A badge "on top" of a building: the screen offset from its ground point to the same point raised
// to the building's height, through the camera's own perspective, so it stays on the spire as the map moves.
const liftOffset=(ll,meters)=>{const t=map.transform;const mc=maplibregl.MercatorCoordinate.fromLngLat(ll);
  if(typeof t.coordinatePoint!=='function')return [0,0];const a=t.coordinatePoint(mc,0),b=t.coordinatePoint(mc,meters);return [b.x-a.x,b.y-a.y]};
const relift=()=>{for(const [,m] of marks){if(m.lift)m.marker.setOffset(liftOffset(m.marker.getLngLat(),m.lift))}};
map.on('move',relift);map.on('resize',relift);
function render(){
  if(you){
    if(!youMark){const el=document.createElement('div');el.className='you';el.innerHTML='<div class="pulse"></div><div class="cone"></div>'+face(state.portrait);youMark=new maplibregl.Marker({element:el,rotationAlignment:'viewport',pitchAlignment:'viewport'}).setLngLat([you.lng,you.lat]).addTo(map)}
    else youMark.setLngLat([you.lng,you.lat]);
    const yel=youMark.getElement();let lab=yel.querySelector('.label');
    if(state.youLabel){if(!lab){lab=document.createElement('div');lab.className='label';lab.addEventListener('click',ev=>{ev.stopPropagation();send({type:'select',id:'you'})});yel.appendChild(lab)}lab.textContent=state.youLabel}else if(lab&&!lab.dataset.out){lab.dataset.out='1';lab.style.transition='opacity .4s';lab.style.opacity='0';setTimeout(()=>lab.remove(),420)}
    youMark.getElement().querySelector('.cone').style.transform='rotate('+((heading||0)-map.getBearing())+'deg)';
    map.getSource('reach')&&map.getSource('reach').setData({type:'FeatureCollection',features:[circle(you,state.reach||100)]});
  }
  const want=new Set(state.pins.map(p=>p.id));
  for(const [id,m] of marks){if(!want.has(id)){m.marker.remove();marks.delete(id)}}
  for(const p of state.pins){
    const html=p.kind==='keeper'?'<div class="pin-body"><div class="disc"></div>'+(p.figure?'<div class="fig full" style="background-image:url('+p.figure+')"></div>':'<div class="fig">'+face(p.portrait)+'</div>')+(p.mark?'<div class="seal">'+p.mark+'</div>':'')+'</div>'
      :p.kind==='landmark'?'<div class="pin-body"><div class="badge"><svg viewBox="0 0 24 24" fill="#fff"><path d="M11.4 1h1.2v4h-1.2zM10 5h4v2.5h-4zM9 7.5h6v2.6H9zM9 10.1h6v2.6H9zM8.5 12.7h7v2.6h-7zM8 15.3h8v2.6H8zM6 17.9h12V21H6z"/></svg></div></div>'
      :p.kind==='waypost'?'<div class="pin-body"><div class="disc"></div>'+'<div class="post" style="background-image:url('+p.vessel+')"></div></div>':'<div class="pin-body"><div class="disc"></div><img class="v" src="'+p.vessel+'">'+(p.kind==='corrupted'&&p.cracks?'<img class="v cracks" src="'+p.cracks+'">':'')+(p.portrait?'<div class="who">'+face(p.portrait)+'</div>':'')+(p.tag?'<div class="tag">'+p.tag+'</div>':'')+'</div>';
    const cls='pin '+(p.kind||'')+(p.near?' near':'')+(p.far?' far':'')+(p.selected?' sel':'')+(p.sealed?' sealed':'')+(p.rarity?' '+p.rarity:'')+(p.done?' done':'')+(p.hunt?' hunt':'')+(p.lift?' top':'');
    let m=marks.get(p.id);
    if(!m){const el=document.createElement('div');el.addEventListener('click',ev=>{ev.stopPropagation();send({type:'select',id:p.id})});m={marker:new maplibregl.Marker({element:el,anchor:'bottom',rotationAlignment:'viewport',pitchAlignment:'viewport'}).setLngLat([p.lng,p.lat]).addTo(map),html:'',cls:''};marks.set(p.id,m)}
    const el=m.marker.getElement();
    if(m.html!==html){el.innerHTML=html;m.html=html}
    if(m.cls!==cls){if(m.cls)el.classList.remove(...m.cls.split(' '));el.classList.add(...cls.split(' '));m.cls=cls}
    el.style.zIndex=p.selected?20:p.kind==="keeper"?8:p.near?5:1;
    m.marker.setLngLat([p.lng,p.lat]);
    if(m.lift!==(p.lift||0)){m.lift=p.lift||0;m.marker.setOffset(m.lift?liftOffset(m.marker.getLngLat(),m.lift):[0,0])}
  }
}
function recv(m){
  if(m.type==='state'){const moved=!you||!m.you||Math.abs(you.lat-m.you.lat)+Math.abs(you.lng-m.you.lng)>1e-6;you=m.you;state=m;heading=m.heading||heading;render();if(follow&&you&&moved)map.easeTo({center:[you.lng,you.lat],duration:you?900:0,padding:cameraPadding})}
  if(m.type==='recenter'&&you){follow=true;map.easeTo({center:[you.lng,you.lat],zoom:pickupZoom(you.lat,state.reach||100),pitch:40,bearing:0,duration:900,padding:cameraPadding})}
  if(m.type==='focus'){follow=false;send({type:'follow',follow:false});map.easeTo({center:[m.lng,m.lat],zoom:pickupZoom(m.lat,state.reach||100),duration:700})}
}
window.__tcmap=recv;
window.addEventListener('message',e=>{if(e.data&&e.data.__tcin)recv(JSON.parse(e.data.__tcin))});
}
init().catch(e=>send({type:'error',message:String(e)}));
</script></body></html>`;
}
