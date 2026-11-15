// One city on the live map (docs/design/admin.md): its Wayposts, the Corrupted Capsules out in this wave,
// and the hunts' Keepers and quests. Same map and pins as Journey; view only until phase 2.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { characters, gameArt } from "../../art/manifest";
import { crackOverlays } from "../../art/crackOverlays";
import { useLanguage } from "../../i18n";
import { VESSELS } from "../shop/strings";
import { keeperPortrait } from "../hunt/HuntViews";
import { questImageUri } from "../hunt/questImage";
import { vesselUri } from "../journey/journeyModel";
import { LiveMap } from "../journey/live/LiveMap";
import { mapHtml } from "../journey/live/mapHtml";
import { assetUri, type LiveMapHandle, type LivePin } from "../journey/live/types";
import { MAP_PMTILES_URL } from "../../services/publicCapsule";
import { admin, minutesLeft, type CityMap } from "../../services/admin";
import { C, radii, sans, serif, spacing } from "../../theme";
import { useAdminText } from "./strings";
import { Card, Failed, Loading, Pill, Stat, VesselThumb, useLoad, useWide } from "./ui";

type Layer = "wayposts" | "wave" | "hunts";
/** Pins reach full size a couple of zooms in from the whole city, and stay readable (never vanish) out at city scale. */
const CITY_REACH = 400;

export default function CityMapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useLoad(() => admin.cityMap(id), [id]);
  const waveEnd = data.data?.wave[0]?.expires_at;
  useEffect(() => {
    if (!waveEnd) return;
    const timer = setTimeout(data.reload, Math.max(1000, Date.parse(waveEnd) - Date.now() + 500));
    return () => clearTimeout(timer);
  }, [waveEnd, data.reload]);
  if (data.error) return <Failed onRetry={data.reload} />;
  if (!data.data) return <Loading />;
  return <CityMapView key={id} map={data.data} />;
}

function CityMapView({ map }: { map: CityMap }) {
  const a = useAdminText();
  const { language } = useLanguage();
  const zh = language === "zh";
  const wide = useWide();
  const ref = useRef<LiveMapHandle>(null);
  const [layers, setLayers] = useState<Record<Layer, boolean>>({ wayposts: true, wave: true, hunts: true });
  const [selected, setSelected] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);

  const html = useMemo(() => mapHtml({ pmtiles: MAP_PMTILES_URL, follow: false, center: map.region.center, cityWave: true }), []);
  const everything = useMemo(() => [...map.wayposts, ...map.wave, ...map.keepers, ...map.private_quests].map((p) => ({ lat: p.lat, lng: p.lng })), [map]);
  useEffect(() => { const t = setTimeout(() => ref.current?.fit(everything), 400); return () => clearTimeout(t); }, []);

  const out = map.wave.filter((w) => !w.caught);
  const groups = useMemo(() => map.region.vessels.map((vessel) => {
    const all = map.wave.filter((w) => w.vessel === vessel);
    return { vessel, rarity: all[0]?.rarity ?? "common", out: all.filter((w) => !w.caught), caught: all.filter((w) => w.caught).length };
  }).filter((g) => g.out.length || g.caught), [map]);
  const left = map.wave[0] ? minutesLeft(map.wave[0].expires_at, now) : null;
  const pins = useMemo<LivePin[]>(() => [
    ...(layers.wayposts ? map.wayposts.filter((w) => w.game_enabled).map<LivePin>((w) => ({
      id: `w:${w.id}`, lat: w.lat, lng: w.lng, kind: w.kind === "landmark" ? "landmark" : "waypost",
      vessel: assetUri(w.kind === "landmark" ? gameArt.landmarkGem : gameArt.waypostGemBlue) ?? "", selected: selected === `w:${w.id}`,
    })) : []),
    ...(layers.wave ? map.wave.map<LivePin>((c) => ({
      id: `c:${c.spot}`, lat: c.lat, lng: c.lng, kind: "corrupted", vessel: vesselUri(c.vessel),
      cracks: assetUri(crackOverlays[c.vessel]) ?? undefined, rarity: c.rarity, done: c.caught, selected: selected === `c:${c.spot}`,
    })) : []),
    ...(layers.hunts ? [
      ...map.keepers.map<LivePin>((k) => ({ id: `k:${k.hunt}`, lat: k.lat, lng: k.lng, kind: "keeper", vessel: "", portrait: assetUri(keeperPortrait), figure: assetUri(characters.keeper) })),
      ...map.private_quests.map<LivePin>((q) => ({ id: `q:${q.id}`, lat: q.lat, lng: q.lng, kind: "quest", vessel: "", quest: "arrive", photo: questImageUri(q.picture) })),
    ] : []),
  ], [map, layers, selected]);
  const state = useMemo(() => ({ you: null, reach: CITY_REACH, pins }), [pins]);

  const focus = (pinId: string, lat: number, lng: number) => { setSelected(pinId); ref.current?.focus(lat, lng); };
  const name = zh ? map.region.name_zh : map.region.name_en;

  const mapView = <View style={wide ? { flex: 1 } : { height: 420, borderBottomWidth: 1, borderBottomColor: C.line }}>
    <LiveMap ref={ref} html={html} state={state} onSelect={setSelected} onTap={() => setSelected(null)} />
  </View>;

  const panel = <View style={wide ? { width: 380, borderLeftWidth: 1, borderLeftColor: C.line, backgroundColor: C.paper } : undefined}><ScrollView style={wide ? { flex: 1 } : undefined}
    contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}>
    <View style={{ gap: 4 }}>
      <Pressable accessibilityRole="link" onPress={() => router.push("/admin" as any)}>
        <Text style={{ fontFamily: sans, fontSize: 13, color: C.blue }}>← {a.nav.overview}</Text>
      </Pressable>
      <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{zh ? map.region.country_zh : map.region.country_en} · {map.region.timezone}</Text>
      <Text accessibilityRole="header" style={{ fontFamily: serif, fontSize: 28, color: C.ink }}>{name}</Text>
    </View>
    <View style={{ flexDirection: "row", gap: spacing.sm }}>
      <Stat label={a.wayposts} value={map.region.wayposts.common} tone={C.blue} />
      <Stat label={a.landmarks} value={map.region.wayposts.landmark} tone="#8A6A2E" />
      <Stat label={a.outNow} value={out.length} tone={C.plum} />
    </View>
    <View style={{ gap: spacing.sm }}>
      <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{a.mapLayers}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {(["wayposts", "wave", "hunts"] as Layer[]).map((l) => <Chip key={l} label={a.layer[l]} on={layers[l]} onPress={() => setLayers((x) => ({ ...x, [l]: !x[l] }))} />)}
      </View>
    </View>
    {selected ? <Detail map={map} id={selected} now={now} /> : <Text style={{ fontFamily: sans, fontSize: 13, color: C.muted }}>{a.tapAPin}</Text>}
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Text style={{ fontFamily: serif, fontSize: 17, color: C.ink }}>{a.layer.wave}</Text>
        {left != null && <Text style={{ fontFamily: sans, fontSize: 12, color: C.plum }}>{a.waveEnds(left)}</Text>}
      </View>
      <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{a.inWave(out.length, map.wave.length - out.length)}</Text>
      {groups.map((g) => {
        const on = g.out.some((c) => selected === `c:${c.spot}`);
        return <Pressable key={g.vessel} accessibilityRole="button" disabled={!g.out.length} onPress={() => {
          // Each tap moves on to the next one of this vessel, so every capsule can be found on the map.
          const at = g.out.findIndex((c) => selected === `c:${c.spot}`);
          const next = g.out[(at + 1) % g.out.length];
          focus(`c:${next.spot}`, next.lat, next.lng);
        }}
          style={({ hovered }: any) => ({ flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: 6, borderRadius: radii.sm,
            backgroundColor: on ? "#E6EEF7" : hovered && g.out.length ? C.white : "transparent", opacity: g.out.length ? 1 : 0.5 })}>
          <VesselThumb kind={g.vessel} size={40} faded={!g.out.length} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: sans, fontSize: 14, color: C.ink }}>{(VESSELS as any)[g.vessel]?.name[language] ?? g.vessel}</Text>
            <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{a.inWave(g.out.length, g.caught)}</Text>
          </View>
          <Pill tone={g.rarity === "rare" ? "brass" : g.rarity === "uncommon" ? "plum" : "blue"} label={a.rarity[g.rarity]} />
        </Pressable>;
      })}
    </View>
    <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{a.editLater}</Text>
  </ScrollView></View>;

  return wide
    ? <View style={{ flex: 1, flexDirection: "row" }}>{mapView}{panel}</View>
    : <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>{mapView}{panel}</ScrollView>;
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="switch" accessibilityState={{ checked: on }} onPress={onPress}
    style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: radii.pill, borderWidth: 1, borderColor: on ? C.blue : C.line, backgroundColor: on ? "#E6EEF7" : C.white, paddingHorizontal: 12, paddingVertical: 6 }}>
    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: on ? C.blue : C.line }} />
    <Text style={{ fontFamily: sans, fontSize: 13, color: on ? C.blue : C.muted }}>{label}</Text>
  </Pressable>;
}

function Detail({ map, id, now }: { map: CityMap; id: string; now: number }) {
  const a = useAdminText();
  const { language } = useLanguage();
  const zh = language === "zh";
  const [kind, key] = [id.slice(0, 1), id.slice(2)];
  const coords = (lat: number, lng: number) => `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  if (kind === "w") {
    const w = map.wayposts.find((x) => x.id === key); if (!w) return null;
    return <Card style={{ gap: 6 }}>
      <Pill tone={w.kind === "landmark" ? "brass" : "blue"} label={w.kind === "landmark" ? a.landmark : a.commonWaypost} />
      <Text style={{ fontFamily: serif, fontSize: 18, color: C.ink }}>{zh ? w.name_zh : w.name_en}</Text>
      <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{zh ? w.name_en : w.name_zh} · {coords(w.lat, w.lng)}</Text>
    </Card>;
  }
  if (kind === "c") {
    const c = map.wave.find((x) => x.spot === key); if (!c) return null;
    return <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
      <VesselThumb kind={c.vessel} size={64} />
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={{ fontFamily: serif, fontSize: 18, color: C.ink }}>{(VESSELS as any)[c.vessel]?.name[language] ?? c.vessel}</Text>
        <View style={{ flexDirection: "row", gap: 6 }}>
          <Pill tone={c.rarity === "rare" ? "brass" : c.rarity === "uncommon" ? "plum" : "blue"} label={a.rarity[c.rarity]} />
          <Pill tone="plum" label={a.minutesLeft(minutesLeft(c.expires_at, now))} />
        </View>
        <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{coords(c.lat, c.lng)}</Text>
      </View>
    </Card>;
  }
  if (kind === "k") {
    const k = map.keepers.find((x) => x.hunt === key); if (!k) return null;
    return <Card style={{ gap: 6 }}>
      <Text style={{ fontFamily: serif, fontSize: 18, color: C.ink }}>{a.keeper(zh ? k.name_zh : k.name_en)}</Text>
      <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{k.hunt} · {coords(k.lat, k.lng)}</Text>
    </Card>;
  }
  const q = map.private_quests.find((x) => x.id === key); if (!q) return null;
  return <Card style={{ gap: 6 }}>
    <Text style={{ fontFamily: serif, fontSize: 18, color: C.ink }}>{a.privateQuest(q.hunt_name)}</Text>
    <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{q.hunt} · {coords(q.lat, q.lng)}</Text>
  </Card>;
}
