import React, { useCallback, useEffect, useRef, useState } from "react";
import { isSeaCapsule, SEA_AVATAR } from "../../services/sea";
import { seaText } from "../sea/strings";
import { Animated, FlatList, Image, Pressable, Text, View, useWindowDimensions } from "react-native";
import { SealLoader } from "../../components/SealLoader";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { PagerDots } from "../../components/PagerControls";
import { Avatar } from "../../components/Avatar";
import { ArtIcon, type IconName } from "../../components/ArtIcon";
import { CabinetIcon, JourneyIcon, SealPlusIcon } from "../../components/DockIcons";
import { scenes } from "../../art/manifest";
import { Vessel } from "../../components/Vessel";
import { haptics } from "../../components/haptics";
import { useLanguage } from "../../i18n";
import { useF1Text } from "../../i18n/f1";
import { useAuth } from "../../services/auth";
import { C, handwriting, sans, serif, shadows } from "../../theme";
import { useReducedMotion } from "../../useReducedMotion";
import type { VesselKind } from "../../vesselArt";
import { usePlaceDistance } from "../journey/location";
import { distance, formatDate, loadBundle, pointOpeningPlace, status, type Bundle, type Row } from "../capsule/model";
import { isPrediction } from "../../services/prediction";
import { predictionText } from "../prediction/strings";

const W = 300, GAP = 16, STEP = W + GAP;
const empty: Bundle = { capsules: [], people: {}, places: {}, vessels: {} };

// Only the centred card's vessel runs its idle loop; the others rest, so a long stack costs nothing.
function CardVessel({ kind, state, reduced, active }: { kind: VesselKind; state: string; reduced: boolean; active: boolean }) {
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (state !== "ready" || reduced) return;
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 1300, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 1300, useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, [glow, reduced, state]);
  return <Animated.View style={{ width: 180, height: 180, alignItems: "center", justifyContent: "center", opacity: state === "opened" ? 0.55 : 1 }}>
    {state === "ready" && <Animated.View style={{ position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: C.lightBlue, opacity: reduced ? 0.16 : glow.interpolate({ inputRange: [0, 1], outputRange: [0.10, 0.28] }), transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }] }} />}
    <Vessel kind={kind} size={150} ready={state === "ready"} idle={active && state !== "opened"} />
  </Animated.View>;
}

export default function HomeScreen() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const { profile, session } = useAuth();
  const { language, setLanguage } = useLanguage();
  const t = useF1Text();
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const [side, setSide] = useState<"inbox" | "sent">(tab === "sent" ? "sent" : "inbox");
  const [bundle, setBundle] = useState<Bundle>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);
  const [now, setNow] = useState(Date.now());
  const scroll = useRef(new Animated.Value(0)).current;
  const scrollOffset = useRef(0);
  const indexRef = useRef(0);
  const dotPosition = useRef(new Animated.Value(0)).current;
  const list = useRef<FlatList<Row>>(null);
  const rows = bundle.capsules.filter(c => side === "inbox" ? c.recipient === session?.user.id : c.sender === session?.user.id);
  const active = rows[index] ?? rows[0];
  const placeFor = (c: Row) => c.place ? bundle.places[c.place] : pointOpeningPlace(c);
  const activePlace = active ? placeFor(active) : undefined;
  const { fix, meters: activeMeters } = usePlaceDistance(activePlace);
  const inset = Math.max(0, (Math.min(width, 640) - W) / 2);
  const refresh = useCallback(async () => {
    if (!session?.user.id) return;
    setLoading(true);
    try {
      const b = await loadBundle(session.user.id);
      setBundle(b);
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, [session?.user.id]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  useEffect(() => { setSide(tab === "sent" ? "sent" : "inbox"); }, [tab]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => { scrollOffset.current = 0; indexRef.current = 0; dotPosition.setValue(0); setIndex(0); list.current?.scrollToOffset({ offset: 0, animated: false }); }, [side]);
  const person = (c: Row) => {
    const id = side === "inbox" ? c.sender : c.recipient;
    if (side === "sent" && id === session?.user.id) return { name: t("home.future"), avatar: { set: "illus", id: "future" } };
    if (side === "sent" && isSeaCapsule(c) && !c.recipient) return { name: seaText(language)("toTheSea"), avatar: SEA_AVATAR };
    return (id ? bundle.people[id] : undefined) ?? { name: t("home.future"), avatar: null };
  };
  const headline = (c: Row) => {
    const state = status(c, side, fix, placeFor(c), now);
    if (state === "opened") return t(side === "inbox" ? "home.openedIn" : "home.openedOut", formatDate(c.opened_at, language));
    if (state === "waiting") return t("home.waiting");
    if (state === "ready") return t("home.ready");
    if (state === "place") { const d = c.id === active?.id ? activeMeters : distance(c, fix, placeFor(c)); return d === null ? t("home.placeUnknown") : t("home.place", (d / 1000).toFixed(1)); }
    const s = Math.max(0, Math.ceil((new Date(c.open_at).getTime() - now) / 1000));
    const unit = s >= 86400 ? "days" : s >= 3600 ? "hours" : "minutes";
    return t("home.time", Math.ceil(s / (unit === "days" ? 86400 : unit === "hours" ? 3600 : 60)), t(`home.${unit}`));
  };
  const headlineView = (c: Row, state: string) => {
    const value = headline(c);
    if (state !== "time" && state !== "place") return <Text numberOfLines={2} style={{ height: 84, textAlignVertical: "center", fontFamily: serif, color: C.ink, fontSize: 20, textAlign: "center" }}>{value}</Text>;
    const pieces = value.split(/(\d+(?:\.\d+)?)/);
    return <Text numberOfLines={2} style={{ height: 84, textAlignVertical: "center", fontFamily: serif, color: C.ink, fontSize: 20, textAlign: "center", lineHeight: 52 }}>{pieces.map((part, n) => /^\d/.test(part) ? <Text key={n} style={{ color: C.blue, fontFamily: serif, fontSize: 46, fontWeight: "700" }}>{part}</Text> : <Text key={n}>{part}</Text>)}</Text>;
  };
  const open = (c: Row) => {
    void haptics.tap();
    router.push({ pathname: "/capsule/[id]", params: { id: c.id, side } });
  };
  const ready = rows.filter(c => status(c, side, fix, placeFor(c), now) === "ready").length;
  return <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}><View style={{ flex: 1, width: "100%", maxWidth: 640, alignSelf: "center" }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingTop: 8 }}>
      <Pressable onPress={() => router.push("/me")} accessibilityLabel={t("home.my")} style={{ alignItems: "center" }}><Avatar avatar={profile?.avatar} size={36} /><Text style={{ color: C.ink, fontFamily: sans, fontSize: 11 }}>{t("home.my")}</Text></Pressable>
      <View style={{ flexDirection: "row", backgroundColor: C.glass, borderRadius: 999, padding: 4 }}>{(["inbox", "sent"] as const).map(tab => <Pressable key={tab} onPress={() => { setSide(tab); void haptics.tick(); }} accessibilityRole="tab" accessibilityState={{ selected: side === tab }} style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: side === tab ? C.white : "transparent" }}><Text style={{ color: C.ink, fontFamily: sans }}>{t(`home.${tab}`)}</Text></Pressable>)}</View>
      <View style={{ flexDirection: "row", alignItems: "center" }}><Pressable onPress={() => setLanguage(language === "zh" ? "en" : "zh")} accessibilityLabel={language === "zh" ? "English" : "繁體中文"}><Text style={{ color: C.plum, padding: 7, fontFamily: serif }}>{language === "zh" ? "EN" : "中"}</Text></Pressable><Pressable onPress={() => router.push("/shop")} accessibilityLabel={t("home.shop")} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><ArtIcon name="shop" color={C.plum} /></Pressable></View>
    </View>
    {loading ? <View style={{ flex: 1, justifyContent: "center" }}><SealLoader /></View> : error ? <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Text style={{ color: C.wax }}>{error}</Text><Pressable onPress={() => void refresh()}><Text style={{ color: C.blue, padding: 16 }}>{t("capsule.retry")}</Text></Pressable></View> : rows.length ? <>
      <View style={{ flex: 1, justifyContent: "center", minHeight: 450 }}><Animated.FlatList ref={list as any} data={rows} getItemLayout={(_, i) => ({ length: STEP, offset: STEP * i, index: i })} horizontal keyExtractor={(c: Row) => c.id} showsHorizontalScrollIndicator={false} snapToInterval={STEP} decelerationRate="fast" contentContainerStyle={{ paddingHorizontal: inset, gap: GAP, alignItems: "center" }} onScroll={e => { const x = e.nativeEvent.contentOffset.x; scrollOffset.current = x; scroll.setValue(x); dotPosition.setValue(x / STEP); const next = Math.max(0, Math.min(rows.length - 1, Math.round(x / STEP))); if (next !== indexRef.current) { indexRef.current = next; setIndex(next); void haptics.page(); } }} scrollEventThrottle={16} renderItem={({ item: c, index: i }: { item: Row; index: number }) => {
        const state = status(c, side, fix, placeFor(c), now), p = person(c), pl = placeFor(c), v = bundle.vessels[c.vessel];
        const inputRange = [(i - 1) * STEP, i * STEP, (i + 1) * STEP];
        return <Animated.View style={{ opacity: scroll.interpolate({ inputRange, outputRange: [0.5, 1, 0.5], extrapolate: "clamp" }), transform: [{ perspective: 900 }, { scale: scroll.interpolate({ inputRange, outputRange: [0.9, 1, 0.9], extrapolate: "clamp" }) }, { rotateY: scroll.interpolate({ inputRange, outputRange: ["8deg", "0deg", "-8deg"], extrapolate: "clamp" }) }] }}><Pressable onPress={() => { const centre = Math.max(0, Math.min(rows.length - 1, Math.round(scrollOffset.current / STEP))); if (i === centre) open(c); else { list.current?.scrollToIndex({ index: i, animated: true }); setIndex(i); void haptics.tick(); } }} accessibilityRole="button" accessibilityLabel={`${headline(c)}, ${p.name}`} style={{ width: W, height: 430, backgroundColor: C.white, borderWidth: 1.5, borderColor: "#5B6474", borderRadius: 20, padding: 18, alignItems: "center", justifyContent: "space-between", ...shadows.card }}>
          <View style={{ height: 26, flexDirection: "row", gap: 6, alignItems: "center" }}>{side === "inbox" && !c.seen_at && !c.opened_at && <Text style={{ color: C.wax, fontSize: 11 }}>{t("home.newTag")}</Text>}{c.handwritten && <Text style={{ color: C.wax, fontFamily: handwriting }}>{t("home.handTag")}</Text>}{isPrediction(c) && <Text style={{ color: C.plum, fontFamily: handwriting }}>{predictionText(language)("tag")}</Text>}{c.edition_no && v?.brand && <Text style={{ color: C.brass, fontSize: 11 }}>{v.brand} No.{String(c.edition_no).padStart(3, "0")}</Text>}</View>
          <CardVessel kind={c.vessel as VesselKind} state={state} reduced={reduced} active={i === index} />
          {headlineView(c, state)}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: "center", gap: 6, maxWidth: "100%", marginBottom: 12 }}><ArtIcon name="pin" size={18} color="#4A5466" /><Text numberOfLines={1} style={{ color: "#4A5466", fontFamily: serif, fontSize: 15, flexShrink: 1 }}>{pl ? pl[language === "zh" ? "name_zh" : "name_en"] : t("home.anywhere")}</Text></View>
          <View style={{ width: "100%", borderTopWidth: 1, borderColor: C.line, paddingTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><View style={{ flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 1 }}><Text style={{ color: C.muted, fontSize: 11 }}>{t(side === "inbox" ? "home.from" : "home.to")}</Text><Avatar avatar={p.avatar as any} size={30} future={side === "sent" && c.recipient === session?.user.id} /><Text numberOfLines={1} style={{ color: C.ink, fontSize: 11, flexShrink: 1 }}>{p.name}</Text></View><Text style={{ color: C.muted, fontSize: 10 }}>{formatDate(c.sealed_at, language)}</Text></View>
        </Pressable></Animated.View>;
      }} /></View>
      <View style={{ alignItems: "center", gap: 2, paddingBottom: 6 }}><PagerDots count={rows.length} index={index} position={dotPosition} onSelect={i => list.current?.scrollToIndex({ index: i, animated: !reduced })} label={n => t("capsule.page", n)} /><Text style={{ color: C.muted, fontFamily: sans, fontSize: 12 }}>{side === "inbox" ? t("home.summaryIn", rows.length, ready) : t("home.summaryOut", rows.length, rows.filter(c => !c.opened_at).length)}</Text></View>
    </> : <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10 }}><Image source={side === 'inbox' ? scenes.emptyInbox : scenes.emptySent} style={{ width: '100%', height: 240 }} resizeMode="contain" /><Text style={{ fontFamily: serif, fontSize: 22, color: C.ink }}>{t(side === "inbox" ? "home.emptyIn" : "home.emptyOut")}</Text><Text style={{ color: C.muted }}>{t("home.emptyHint")}</Text></View>}
    <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 32, paddingBottom: 14 }}><Dock label={t("home.journey")} icon={<JourneyIcon />} onPress={() => router.push("/journey")} /><Pressable onPress={() => router.push("/create")} accessibilityRole="button" accessibilityLabel={t("home.new")} style={({ pressed }) => ({ width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center", transform: [{ scale: pressed ? 0.95 : 1 }], ...shadows.card })}><SealPlusIcon /></Pressable><Dock label={t("home.cabinet")} icon={<CabinetIcon />} onPress={() => router.push("/cabinet")} /></View>
  </View></SafeAreaView>;
}

function Dock({ label, icon, onPress }: { label: string; icon: React.ReactNode; onPress: () => void }) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => ({ alignItems: "center", gap: 2, transform: [{ scale: pressed ? 0.95 : 1 }] })}><View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" }}>{icon}</View><Text style={{ color: C.muted, fontSize: 11 }}>{label}</Text></Pressable>;
}
