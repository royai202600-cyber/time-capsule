import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking, Modal, Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { goBack } from "../../navigation";
import { useAuth } from "../../services/auth";
import { useCapsules, usePlaces } from "../../services/hooks";
import { distanceMeters } from "../../services/data";
import { useLanguage } from "../../i18n";
import { haptics } from "../../components/haptics";
import { ArtIcon } from "../../components/ArtIcon";
import { Avatar } from "../../components/Avatar";
import { Vessel, type VesselKind } from "../../components/Vessel";
import { portraits, vesselParts } from "../../art/manifest";
import { C, radii, sans, serif, shadows, spacing } from "../../theme";
import { isTestLocationUser, setFakeLocation, useForegroundLocation } from "./location";
import { JourneyMap, type JourneyPin } from "./JourneyMap";
import { Passport } from "./Passport";
import { CapsuleMapPage } from "./CapsuleMapPage";
import { LiveMap } from "./live/LiveMap";
import { JourneyViewport } from "./JourneyViewport";
import { mapHtml } from "./live/mapHtml";
import { assetUri, type LiveMapHandle, type LivePin } from "./live/types";
import { MAP_PMTILES_URL, sea, SeaError, SEA_ENABLED, SEA_PICKUP_RADIUS_M, type SeaBottle } from "../../services/sea";
import { daysSince, distanceText, useSeaText } from "../sea/strings";

const FALLBACK = { lat: 22.19358, lng: 113.53917 }; // Senado Square, Macau (development only)
type Item =
  | { kind: "sea"; id: string; lat: number; lng: number; meters: number; bottle: SeaBottle }
  | { kind: "place"; id: string; lat: number; lng: number; meters: number; pin: JourneyPin; capsuleId: string };

const portraitUri = (avatar: unknown) => {
  const a = avatar as { set?: string; id?: string } | null;
  return assetUri(a?.set === "illus" && a.id ? portraits[a.id] : portraits["01"]);
};
const vesselUri = (kind: string) => assetUri(vesselParts[kind as VesselKind]?.assembled ?? vesselParts.bottle.assembled) ?? "";

export default function JourneyScreen() {
  const insets = useSafeAreaInsets();
  const { session, profile } = useAuth();
  const userId = session?.user.id ?? "";
  const { t, language } = useLanguage();
  const s = useSeaText();
  const placeData = usePlaces();
  const capsuleData = useCapsules(userId, "inbox");
  const location = useForegroundLocation();
  const { fix, status } = location;
  const you = fix ? { lat: fix.lat, lng: fix.lng } : null;
  const map = useRef<LiveMapHandle>(null);
  const [bottles, setBottles] = useState<SeaBottle[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [walkTo, setWalkTo] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [asia, setAsia] = useState(false);
  const [passport, setPassport] = useState(false);
  const [mapPlace, setMapPlace] = useState<Extract<Item, { kind: "place" }> | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const last = useRef<{ lat: number; lng: number } | null>(null);
  // Heading from movement: the cone points the way you walked.
  useEffect(() => {
    if (!you) return;
    const prev = last.current;
    if (prev && distanceMeters(prev.lat, prev.lng, you.lat, you.lng) > 4) {
      const y = Math.sin((you.lng - prev.lng) * Math.PI / 180) * Math.cos(you.lat * Math.PI / 180);
      const x = Math.cos(prev.lat * Math.PI / 180) * Math.sin(you.lat * Math.PI / 180) - Math.sin(prev.lat * Math.PI / 180) * Math.cos(you.lat * Math.PI / 180) * Math.cos((you.lng - prev.lng) * Math.PI / 180);
      setHeading(Math.atan2(y, x) * 180 / Math.PI);
    }
    if (!prev || distanceMeters(prev.lat, prev.lng, you.lat, you.lng) > 4) last.current = you;
  }, [you?.lat, you?.lng]);
  const cell = you ? `${you.lat.toFixed(3)},${you.lng.toFixed(3)}` : "";
  const loadSea = useCallback(async () => {
    if (!SEA_ENABLED || !you) return;
    try {
      setBottles(await sea.nearby(fix ? { lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy } : null));
    } catch { /* the map still works without the sea */ }
  }, [cell]);
  useFocusEffect(useCallback(() => {
    if (userId) { void placeData.refresh(); void capsuleData.refresh(); }
    void loadSea();
  }, [userId, placeData.refresh, capsuleData.refresh, loadSea]));
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(""), 3600); return () => clearTimeout(id); }, [toast]);

  const capsules = capsuleData.data ?? [];
  const places = placeData.data ?? [];
  const pins = useMemo<JourneyPin[]>(() => places.map((place) => {
    const here = capsules.filter((capsule) => capsule.place === place.id);
    const visited = here.some((capsule) => !!capsule.opened_at);
    const waiting = here.find((capsule) => !capsule.opened_at);
    return { place, kind: visited ? "visited" : waiting ? "waiting" : "other", vessel: waiting?.vessel, waiting: !!waiting };
  }), [places, capsules]);
  const stampRows = useMemo(() => places.map((place) => {
    const openedAt = capsules.filter((capsule) => capsule.place === place.id && capsule.opened_at).map((capsule) => capsule.opened_at!).sort().at(-1) ?? null;
    return { place, openedAt };
  }), [places, capsules]);
  const earned = stampRows.filter((row) => row.openedAt && !row.place.brand_vessel).length;
  const total = places.filter((place) => !place.brand_vessel).length;

  // Nearby Sea bottles and every received place capsule, including distant/opened ones.
  const items = useMemo<Item[]>(() => {
    if (!you) return [];
    const m = (lat: number, lng: number) => distanceMeters(you.lat, you.lng, lat, lng);
    const seaItems: Item[] = bottles.map((b) => ({ kind: "sea", id: b.id, lat: b.lat, lng: b.lng, meters: m(b.lat, b.lng), bottle: b }));
    const placeItems: Item[] = capsules.flatMap((capsule) => {
      const pin = pins.find((p) => p.place.id === capsule.place);
      return pin ? [{ kind: "place" as const, id: `place-${capsule.id}`, lat: pin.place.lat, lng: pin.place.lng,
        meters: m(pin.place.lat, pin.place.lng), pin: { ...pin, vessel: capsule.vessel }, capsuleId: capsule.id }] : [];
    });
    return [...seaItems, ...placeItems].sort((a, b) => a.meters - b.meters);
  }, [bottles, pins, capsules, you?.lat, you?.lng]);
  const selected = items.find((i) => i.id === selectedId) ?? null;

  const html = useMemo(() => mapHtml({ pmtiles: MAP_PMTILES_URL, center: you ?? FALLBACK }), [!!you]);
  const mapState = useMemo(() => ({
    you, heading, reach: SEA_PICKUP_RADIUS_M,
    portrait: portraitUri(profile?.avatar),
    pins: items.map<LivePin>((i) => i.kind === "sea"
      ? { id: i.id, lat: i.lat, lng: i.lng, kind: "sea", vessel: vesselUri(i.bottle.vessel), portrait: portraitUri(i.bottle.sender.avatar), near: i.meters <= SEA_PICKUP_RADIUS_M, far: i.meters > 600, selected: i.id === selectedId, tag: i.meters <= SEA_PICKUP_RADIUS_M ? undefined : distanceText(i.meters) }
      : { id: i.id, lat: i.lat, lng: i.lng, kind: "place", vessel: vesselUri(i.pin.vessel ?? "dome"), near: i.meters <= SEA_PICKUP_RADIUS_M, selected: i.id === selectedId, tag: language === "zh" ? i.pin.place.name_zh : i.pin.place.name_en }),
  }), [you?.lat, you?.lng, heading, profile?.avatar, items, selectedId, language]);

  const select = (id: string | null) => {
    setWalkTo(null);
    setSelectedId(id);
    const item = items.find((i) => i.id === id);
    if (item) { void haptics.tick(); map.current?.focus(item.lat, item.lng); }
  };
  const step = (dir: 1 | -1) => {
    if (!items.length) return;
    const index = selected ? items.findIndex((i) => i.id === selected.id) : -1;
    select(items[(index + dir + items.length) % items.length].id);
  };
  const pickUp = async (item: Extract<Item, { kind: "sea" }>) => {
    if (busy) return;
    setBusy(true);
    try {
      const capsuleId = await sea.pickUp(item.id, fix ? { lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy } : null);
      void haptics.success();
      setSelectedId(null);
      router.push({ pathname: "/capsule/[id]", params: { id: capsuleId } });
      void loadSea();
    } catch (e) {
      void haptics.warn();
      const code = e instanceof SeaError ? e.code : "unknown";
      setToast(code === "too_far" ? s("errTooFar") : code === "taken" ? s("errTaken") : code === "own_bottle" ? s("errOwn") : s("errUnknown"));
      if (code === "taken") void loadSea();
    } finally { setBusy(false); }
  };
  const directions = (lat: number, lng: number) => {
    const at = `${lat},${lng}`;
    void Linking.openURL(Platform.OS === "ios" ? `https://maps.apple.com/?daddr=${at}` : `https://www.google.com/maps/dir/?api=1&destination=${at}`);
  };

  if (mapPlace) {
    const mapCapsule = capsules.find((capsule) => capsule.id === mapPlace.capsuleId);
    return <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("back")} onPress={() => setMapPlace(null)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><ArtIcon name="back" size={25} /></Pressable>
      <CapsuleMapPage place={mapPlace.pin.place} vessel={(mapCapsule?.vessel ?? "dome") as VesselKind} onGoOpen={() => { if (mapCapsule) router.push({ pathname: "/capsule/[id]", params: { id: mapCapsule.id } }); }} />
    </SafeAreaView>;
  }

  return <JourneyViewport>
    <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 0 }}>
    {you
      ? <LiveMap ref={map} html={html} state={mapState} onSelect={select}
        onTap={(lat, lng) => { if (selectedId) setSelectedId(null); else if (__DEV__ || isTestLocationUser(userId)) setWalkTo({ lat, lng }); }} />
      : <LocationGate status={status} onAllow={() => void location.request()} onSettings={() => void location.openSettings()} />}
    </View>

    <SafeAreaView edges={["top", "left", "right"]} pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 30 }}>
      <View pointerEvents="box-none" style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        <Chip onPress={goBack} label={t("back")}><ArtIcon name="back" size={22} /></Chip>
        <View style={{ flex: 1 }} pointerEvents="none" />
        <Chip onPress={() => { void haptics.tap(); setAsia(true); }} label={s("asia")}><ArtIcon name="map" size={22} color={C.blue} /></Chip>
        <Chip onPress={() => { void haptics.tap(); setPassport(true); }} label={s("passport")}><Text style={{ fontFamily: serif, fontSize: 12, color: C.brass }}>{earned}/{total}</Text></Chip>
      </View>
    </SafeAreaView>

    <SafeAreaView edges={["bottom", "left", "right"]} pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 20 }}>
      <View pointerEvents="box-none" style={{ width: "100%", alignSelf: "center", paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm }}>
        <View pointerEvents="box-none" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
          {walkTo ? <Pill onPress={() => { setFakeLocation(walkTo); setWalkTo(null); void haptics.tick(); }} label={s("devWalk")} /> : <View />}
          {you && <Chip onPress={() => { setSelectedId(null); setWalkTo(null); map.current?.recenter(); void haptics.tick(); }} label={s("recenter")} translucent><ArtIcon name="locate" size={24} color={C.blue} /></Chip>}
        </View>
        {!!toast && <Text accessibilityRole="alert" style={{ alignSelf: "center", backgroundColor: C.ink, color: C.white, fontFamily: sans, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, overflow: "hidden" }}>{toast}</Text>}
        {you && (selected
          ? <View style={{ width: "100%", maxWidth: 560, alignSelf: "center", backgroundColor: "rgba(255,255,255,.96)", borderRadius: 22, padding: spacing.md, borderWidth: 1, borderColor: C.line, ...shadows.card }}>
            <SelectedCard item={selected} busy={busy} onPickUp={pickUp} onDirections={directions}
              onView={(item) => router.push({ pathname: "/capsule/[id]", params: { id: item.capsuleId } })}
              onMap={setMapPlace} onStep={step} count={items.length} index={items.findIndex((i) => i.id === selected.id)} />
          </View>
          : <Pressable accessibilityRole="button" accessibilityLabel={s("kicker")} disabled={!items.length}
              onPress={() => select(items[0].id)}
              style={{ alignSelf: "flex-end", marginRight: -spacing.md - insets.right, backgroundColor: "rgba(255,255,255,.9)", borderTopLeftRadius: 12, borderBottomLeftRadius: 12, padding: 12, paddingRight: 12 + insets.right, borderWidth: 1, borderRightWidth: 0, borderColor: C.line, ...shadows.card }}>
            <Text style={{ fontFamily: sans, fontSize: 11, fontWeight: "700", letterSpacing: 1.2, color: C.blue }}>{s("kicker")}</Text>
          </Pressable>)}
        {SEA_ENABLED && !selected && <Pressable accessibilityRole="button" accessibilityLabel={s("throwCta")}
          onPress={() => { void haptics.tap(); router.push({ pathname: "/create", params: { to: "sea" } }); }}
          style={({ pressed }) => ({ alignSelf: "center", flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.wax, borderRadius: radii.pill, paddingLeft: 8, paddingRight: 20, paddingVertical: 7, opacity: pressed ? .9 : 1, ...shadows.card })}>
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.white, alignItems: "center", justifyContent: "center" }}><Vessel kind="bottle" size={26} /></View>
          <Text style={{ fontFamily: serif, fontSize: 16, color: C.white }}>{s("throwCta")}</Text>
        </Pressable>}
      </View>
    </SafeAreaView>

    <Modal visible={asia} animationType="fade" onRequestClose={() => setAsia(false)}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.paper, padding: spacing.md, gap: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Chip onPress={() => setAsia(false)} label={t("back")}><ArtIcon name="close" size={22} /></Chip>
          <Text style={{ fontFamily: serif, fontSize: 24, color: C.ink }}>{t("journey.title")} · {s("asia")}</Text>
        </View>
        <JourneyMap pins={pins} fix={fix} onSelect={(pin) => { void haptics.tick(); setAsia(false); const item = items.find((i) => i.kind === "place" && i.pin.place.id === pin.place.id); if (item?.kind === "place") { select(item.id); } }} />
      </SafeAreaView>
    </Modal>
    <Passport visible={passport} onClose={() => setPassport(false)} userId={userId} stamps={stampRows} />
  </JourneyViewport>;
}

function SelectedCard({ item, busy, count, index, onStep, onPickUp, onDirections, onView, onMap }: {
  item: Item; busy: boolean; count: number; index: number; onStep: (d: 1 | -1) => void;
  onPickUp: (i: Extract<Item, { kind: "sea" }>) => void; onDirections: (lat: number, lng: number) => void;
  onView: (i: Extract<Item, { kind: "place" }>) => void; onMap: (i: Extract<Item, { kind: "place" }>) => void;
}) {
  const s = useSeaText();
  const { t, language } = useLanguage();
  const near = item.meters <= SEA_PICKUP_RADIUS_M;
  const nav = <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
    <Small onPress={() => onStep(-1)} label="‹" />
    <Text style={{ fontFamily: sans, fontSize: 11, color: C.muted }}>{index + 1} / {count}</Text>
    <Small onPress={() => onStep(1)} label="›" />
  </View>;
  if (item.kind === "place") {
    const name = language === "zh" ? item.pin.place.name_zh : item.pin.place.name_en;
    return <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Vessel kind={(item.pin.vessel ?? "dome") as VesselKind} size={48} idle />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: sans, fontSize: 11, color: C.brass }}>{s("yourCapsule")}</Text>
          <Text style={{ fontFamily: serif, fontSize: 17, color: C.ink }}>{name}</Text>
          <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{near ? s("here") : s("away", distanceText(item.meters))}</Text>
        </View>
        {nav}
      </View>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Btn flex title={t("journey.viewCapsule")} onPress={() => onView(item)} />
        <Btn flex quiet title={t("journey.viewMap")} onPress={() => onMap(item)} />
      </View>
    </View>;
  }
  const b = item.bottle;
  return <View style={{ gap: spacing.sm }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
      <View>
        <Vessel kind={b.vessel as VesselKind} size={52} idle />
        <View style={{ position: "absolute", right: -6, top: -4, borderRadius: 14, borderWidth: 2, borderColor: C.white }}><Avatar avatar={b.sender.avatar} size={24} /></View>
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontFamily: sans, fontSize: 11, color: C.brass }}>{s("seaBottle", b.sender.name)}</Text>
        <Text numberOfLines={2} style={{ fontFamily: serif, fontSize: 17, color: C.ink }}>「{b.hint}」</Text>
        <Text numberOfLines={1} style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>
          {[b.sender.city ? s("fromCity", b.sender.city) : null, s("drifted", daysSince(b.sealed_at)), b.returns ? s("returns", b.returns) : null].filter(Boolean).join(" · ")}
        </Text>
      </View>
      {nav}
    </View>
    {near
      ? <Btn title={busy ? s("picking") : s("pickUp")} disabled={busy} onPress={() => onPickUp(item)} />
      : <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Text style={{ flex: 1, fontFamily: sans, fontSize: 13, color: C.blue }}>{s("walkCloser", distanceText(item.meters - SEA_PICKUP_RADIUS_M))}</Text>
        <Btn quiet title={s("navigate")} onPress={() => onDirections(item.lat, item.lng)} />
      </View>}
  </View>;
}

function LocationGate({ status, onAllow, onSettings }: { status: string; onAllow: () => void; onSettings: () => void }) {
  const s = useSeaText();
  return <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, gap: spacing.md, backgroundColor: C.glass }}>
    <Vessel kind="bottle" size={130} idle />
    <Text style={{ fontFamily: sans, color: C.ink, textAlign: "center", lineHeight: 22, maxWidth: 360 }}>{status === "denied" ? s("locationDenied") : status === "checking" || status === "granted" ? s("locationWaiting") : s("locationAsk")}</Text>
    {status === "denied" && <Btn title={s("openSettings")} onPress={onSettings} />}
    {(status === "explain" || status === "unavailable") && <Btn title={s("locationAllow")} onPress={onAllow} />}
  </SafeAreaView>;
}

function Chip({ children, onPress, label, translucent = false }: { children: React.ReactNode; onPress: () => void; label: string; translucent?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    style={{ minWidth: 44, height: 44, paddingHorizontal: 8, borderRadius: 22, backgroundColor: translucent ? "rgba(246,248,251,.9)" : "rgba(246,248,251,.94)", alignItems: "center", justifyContent: "center", ...shadows.card }}>{children}</Pressable>;
}
function Pill({ onPress, label }: { onPress: () => void; label: string }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={{ backgroundColor: C.ink, borderRadius: radii.pill, paddingHorizontal: 14, paddingVertical: 9, ...shadows.card }}>
    <Text style={{ fontFamily: sans, fontSize: 13, color: C.brass }}>{label}</Text>
  </Pressable>;
}
function Small({ onPress, label }: { onPress: () => void; label: string }) {
  return <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" }}>
    <Text style={{ fontFamily: serif, fontSize: 16, color: C.blue, marginTop: -2 }}>{label}</Text>
  </Pressable>;
}
function Btn({ title, onPress, quiet, disabled, flex }: { title: string; onPress: () => void; quiet?: boolean; disabled?: boolean; flex?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ flex: flex ? 1 : undefined, borderRadius: 14, paddingVertical: 12, paddingHorizontal: spacing.md, alignItems: "center", backgroundColor: quiet ? C.white : C.blue, borderWidth: quiet ? 1.5 : 0, borderColor: C.blue, opacity: disabled ? .5 : pressed ? .85 : 1 })}>
    <Text style={{ fontFamily: sans, fontWeight: "600", color: quiet ? C.blue : C.white }}>{title}</Text>
  </Pressable>;
}
