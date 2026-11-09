// The live map page, shared by web (iframe srcdoc) and phones (react-native-webview, works in Expo Go).
// MapLibre GL + Protomaps vector tiles in the app's palette; falls back to tinted OSM raster tiles
// when no PMTiles URL is configured (development only).
import { C } from "../../../theme";

export const MAPLIBRE = "https://unpkg.com/maplibre-gl@5.24.0/dist";
export const PMTILES = "https://unpkg.com/pmtiles@4.5.0/dist/pmtiles.js";

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
      { id: "buildings", type: "fill-extrusion", source: "base", "source-layer": "buildings", minzoom: 15, paint: { "fill-extrusion-color": mapPalette.building, "fill-extrusion-height": ["coalesce", ["get", "height"], 9], "fill-extrusion-opacity": .82 } },
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
.pin.waypost.done{opacity:.45}
.pin.waypost.near .post,.pin.landmark.near .post{filter:drop-shadow(0 0 6px #D7B7E6) brightness(1.18)}
.pin.waypost.near .disc,.pin.landmark.near .disc{background:radial-gradient(#D7B7E6CC,transparent 70%)}
.pin.landmark{width:64px;height:88px}
.pin.landmark .disc{left:12px;width:40px;height:10px}
.pin.landmark .post{position:absolute;left:15px;bottom:12px;width:33px;height:76px;background-size:154px;background-position:-61px -15px;background-repeat:no-repeat;animation:bob 3.6s ease-in-out infinite}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@media (prefers-reduced-motion: reduce){.pin .v,.pin .post,.you .pulse{animation:none}}
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
let follow=true,you=null,state={pins:[]},marks=new Map(),youMark=null,heading=0;
// Wayposts are floating gems, clearly not buildings and clearly not capsules.
const face=src=>src?'<div class="face"><img src="'+src+'"></div>':'<div class="face"></div>';
const circle=(c,r)=>{const pts=[];for(let i=0;i<=48;i++){const a=i/48*Math.PI*2;pts.push([c.lng+r*Math.cos(a)/(111320*Math.cos(c.lat*Math.PI/180)),c.lat+r*Math.sin(a)/110540])}return{type:'Feature',geometry:{type:'Polygon',coordinates:[pts]}}};
map.on('load',()=>{
  map.addSource('reach',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
  map.addLayer({id:'reach-fill',type:'fill',source:'reach',paint:{'fill-color':'${C.brass}','fill-opacity':.12}});
  map.addLayer({id:'reach-line',type:'line',source:'reach',paint:{'line-color':'${C.brass}','line-width':1.5,'line-dasharray':[2,2]}});
  send({type:'ready'});render();
});
map.on('dragstart',()=>{if(follow){follow=false;send({type:'follow',follow:false})}});
map.on('resize',()=>{if(follow&&you)map.jumpTo({center:[you.lng,you.lat],zoom:pickupZoom(you.lat,state.reach||100),padding:cameraPadding})});
map.on('click',e=>send({type:'tap',lat:e.lngLat.lat,lng:e.lngLat.lng}));
function render(){
  if(you){
    if(!youMark){const el=document.createElement('div');el.className='you';el.innerHTML='<div class="pulse"></div><div class="cone"></div>'+face(state.portrait);youMark=new maplibregl.Marker({element:el,rotationAlignment:'viewport',pitchAlignment:'viewport'}).setLngLat([you.lng,you.lat]).addTo(map)}
    else youMark.setLngLat([you.lng,you.lat]);
    youMark.getElement().querySelector('.cone').style.transform='rotate('+((heading||0)-map.getBearing())+'deg)';
    map.getSource('reach')&&map.getSource('reach').setData({type:'FeatureCollection',features:[circle(you,state.reach||100)]});
  }
  const want=new Set(state.pins.map(p=>p.id));
  for(const [id,m] of marks){if(!want.has(id)){m.marker.remove();marks.delete(id)}}
  for(const p of state.pins){
    const html=p.kind==='waypost'||p.kind==='landmark'?'<div class="pin-body"><div class="disc"></div>'+'<div class="post" style="background-image:url('+p.vessel+')"></div></div>':'<div class="pin-body"><div class="disc"></div><img class="v" src="'+p.vessel+'">'+(p.kind==='corrupted'&&p.cracks?'<img class="v cracks" src="'+p.cracks+'">':'')+(p.portrait?'<div class="who">'+face(p.portrait)+'</div>':'')+(p.tag?'<div class="tag">'+p.tag+'</div>':'')+'</div>';
    const cls='pin '+(p.kind||'')+(p.near?' near':'')+(p.far?' far':'')+(p.selected?' sel':'')+(p.sealed?' sealed':'')+(p.rarity?' '+p.rarity:'')+(p.done?' done':'');
    let m=marks.get(p.id);
    if(!m){const el=document.createElement('div');el.addEventListener('click',ev=>{ev.stopPropagation();send({type:'select',id:p.id})});m={marker:new maplibregl.Marker({element:el,anchor:'bottom',rotationAlignment:'viewport',pitchAlignment:'viewport'}).setLngLat([p.lng,p.lat]).addTo(map),html:'',cls:''};marks.set(p.id,m)}
    const el=m.marker.getElement();
    if(m.html!==html){el.innerHTML=html;m.html=html}
    if(m.cls!==cls){if(m.cls)el.classList.remove(...m.cls.split(' '));el.classList.add(...cls.split(' '));m.cls=cls}
    el.style.zIndex=p.selected?20:p.near?5:1;
    m.marker.setLngLat([p.lng,p.lat]);
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
