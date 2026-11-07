import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { paperLetter } from '../../art/manifest';
import { ArtIcon } from '../../components/ArtIcon';
import { router, useLocalSearchParams } from "expo-router";
import { goBack } from "../../navigation";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { Avatar } from "../../components/Avatar";
import { PagerDots, PagerArrows } from "../../components/PagerControls";
import { usePagerDiscovery } from "./usePagerDiscovery";
import { Countdown } from "../../components/Countdown";
import { Vessel } from "../../components/Vessel";
import { haptics } from "../../components/haptics";
import { useLanguage } from "../../i18n";
import { useF1Text } from "../../i18n/f1";
import { VESSELS } from "../../i18n/webStrings";
import { STR } from "../../i18n/webStrings";
import { useAuth } from "../../services/auth";
import { capsules } from "../../services/data";
import { C, handwriting, motion, sans, serif, shadows } from "../../theme";
import { useReducedMotion } from "../../useReducedMotion";
import type { VesselKind } from "../../vesselArt";
import { CapsuleMapPage } from "../journey/CapsuleMapPage";
import { openingCoordinates, usePlaceDistance } from "../journey/location";
import { GiftQr } from "./GiftQr";
import { LightBurst } from "./LightBurst";
import { RitualHold } from "./RitualHold";
import { SealedLines } from "./SealedLines";
import { useAlarmText } from "../alarm/strings";
import { LetterVoice } from "../voice/LetterVoice";
import { isPrediction, openedPrediction, senderPrediction, type SenderPrediction } from "../../services/prediction";
import { PredictionStamp, SenderPredictionCard } from "../prediction/PredictionParts";
import { usePredictionText } from "../prediction/strings";
import { formatDate, loadOne, openForRecipient, status, type Bundle, type Opened, type Row } from "./model";

const blank: Bundle = { capsules: [], people: {}, places: {}, vessels: {} };

function Label({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  return <Text style={{ color: muted ? C.muted : C.ink, fontFamily: sans, fontSize: 15 }}>{children}</Text>;
}
function Action({ title, onPress, disabled = false, ghost = false, icon }: { title: string; onPress: () => void; disabled?: boolean; ghost?: boolean; icon?: "pin" }) {
  return <Pressable disabled={disabled} onPress={onPress} accessibilityRole="button" style={{ backgroundColor: ghost ? C.white : C.blue, borderColor: C.blue, borderWidth: 1, borderRadius: 14, padding: 15, alignItems: "center", opacity: disabled ? 0.5 : 1, flexDirection: "row", justifyContent: "center", gap: 6 }}>{icon && <ArtIcon name={icon} size={18} color={ghost ? C.blue : C.white} />}<Text style={{ color: ghost ? C.blue : C.white, fontFamily: sans, fontSize: 16 }}>{title}</Text></Pressable>;
}
function Story({ value, language }: { value: string; language: "zh" | "en" }) {
  return <Text style={{ color: "#4A5466", fontFamily: serif, fontSize: 16, lineHeight: 31, letterSpacing: language === "zh" ? .3 : 0 }}>{value.split(/(<em>.*?<\/em>)/g).map((part, i) => part.startsWith("<em>") ? <Text key={i} style={{ color: C.blue, fontFamily: serif }}>{part.slice(4, -5)}</Text> : <Text key={i}>{part}</Text>)}</Text>;
}

export default function CapsuleScreen() {
  const { id, side: sideParam } = useLocalSearchParams<{ id: string; side?: string }>();
  const side = sideParam === "sent" ? "sent" : "inbox";
  const { session } = useAuth();
  const { language } = useLanguage();
  const t = useF1Text();
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const pageWidth = width;
  const [bundle, setBundle] = useState<Bundle>(blank);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [page, setPage] = useState(0);
  const [pagerHeight, setPagerHeight] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [charge, setCharge] = useState(0);
  const [burst, setBurst] = useState(false);
  const pages = useRef<React.ElementRef<typeof ScrollView>>(null);
  const pagePosition = useRef(new Animated.Value(0)).current;
  const pageIndex = useRef(0);
  const discovery = usePagerDiscovery(pages, !loading && side === "inbox" && !opened && pagerHeight > 0, reduced);
  const lid = useSharedValue(0);
  const letterRise = useRef(new Animated.Value(0)).current;
  const c = bundle.capsules[0];
  const pl = c?.place ? bundle.places[c.place] : undefined;
  const { fix } = usePlaceDistance(pl);
  const v = c ? bundle.vessels[c.vessel] : undefined;
  const sender = c ? bundle.people[c.sender] : undefined;
  const receiver = c ? bundle.people[c.recipient] : undefined;
  const name = side === "sent" && c?.recipient === session?.user.id ? t("home.future") : (side === "sent" ? receiver?.name : sender?.name) ?? t("home.future");
  const placeName = pl ? pl[language === "zh" ? "name_zh" : "name_en"] : "";
  const state = c ? status(c, side, pl && fix ? openingCoordinates() : null, pl, now) : "time";
  const waitMs = c ? Math.max(0, new Date(c.open_at).getTime() - now) : 0;
  const waitUnit = waitMs >= 86400000 ? "days" : waitMs >= 3600000 ? "hours" : "minutes";
  const waitValue = Math.max(1, Math.ceil(waitMs / (waitUnit === "days" ? 86400000 : waitUnit === "hours" ? 3600000 : 60000)));
  const waitLabel = t(waitUnit === "days" ? "capsule.waitDay" : waitUnit === "hours" ? "capsule.waitHour" : "capsule.waitMinute", waitValue);
  const pageCount = pl ? 3 : 2;
  const openPage = pageCount - 1;

  const refresh = useCallback(async () => {
    if (!session?.user.id || !id) return;
    setLoading(true);
    try {
      const b = await loadOne(id, session.user.id);
      if (!b.capsules[0]) throw new Error(t("capsule.error"));
      setBundle(b);
      setError("");
      if (side === "inbox" && b.capsules[0].recipient === session.user.id && !b.capsules[0].seen_at) {
        void capsules.markSeen(id);
      }
      if (side === "inbox" && b.capsules[0].opened_at) {
        const result = await openForRecipient(id, null);
        if (result.error) throw result.error;
        setOpened(result.data?.[0] ?? null);
      }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, [session?.user.id, id, side]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (opened) Animated.spring(letterRise, { toValue: 1, useNativeDriver: true, ...motion.spring.soft }).start(); }, [opened]);
  const goPage = (n: number) => { discovery.beginDrag(); discovery.dismiss(); pages.current?.scrollTo({ x: n * pageWidth, animated: !reduced }); };
  const openCapsule = async () => {
    if (!c || busy) return;
    setBusy(true);
    setError("");
    const latestFix = c.place ? openingCoordinates() : null;
    if (c.place && !latestFix) {
      setBusy(false);
      setCharge(0);
      goPage(1);
      return;
    }
    setBurst(true);
    lid.value = reduced ? 1 : withSpring(1, motion.spring.heavy);
    const [result] = await Promise.all([
      openForRecipient(c.id, latestFix),
      new Promise(resolve => setTimeout(resolve, reduced ? 0 : 850)),
    ]);
    if (result.error || !result.data?.[0]) {
      lid.value = reduced ? 0 : withSpring(0, motion.spring.heavy);
      setBurst(false);
      setCharge(0);
      setBusy(false);
      const hint = result.error?.hint;
      const known = ["locked", "far", "inaccurate", "no_location", "brand_place"];
      setError(t((known.includes(hint ?? "") ? `capsule.${hint}` : "capsule.error") as any));
      void haptics.warn();
      return;
    }
    setOpened(result.data[0]);
    void haptics.success();
    setBundle(old => ({ ...old, capsules: old.capsules.map(row => row.id === c.id ? { ...row, opened_at: result.data![0].opened_at, seen_at: row.seen_at ?? new Date().toISOString() } : row) }));
    setBusy(false);
    setCharge(0);
  };
  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: C.paper, justifyContent: "center" }}><ActivityIndicator color={C.blue} /></SafeAreaView>;
  if (!c) return <SafeAreaView style={{ flex: 1, backgroundColor: C.paper, padding: 24 }}><Label>{error || t("capsule.error")}</Label><Action title={t("capsule.retry")} onPress={() => void refresh()} /></SafeAreaView>;
  return <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}><View style={{ flex: 1, width: "100%" }}>
    <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Pressable onPress={() => goBack()} accessibilityLabel={t("capsule.back")} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><ArtIcon name="back" color={C.plum} /></Pressable><Text style={{ fontFamily: serif, fontSize: 18, color: C.ink }}>{side === "sent" ? t("capsule.sentTitle", name) : opened ? (c.sender === session?.user.id ? t("capsule.letterSelf") : t("capsule.letterFrom", name)) : t("capsule.title")}</Text><View style={{ width: 44 }} /></View>
    {side === "sent" ? <SenderView c={c} name={name} placeName={placeName} language={language} t={t} /> : opened ? <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 50 }}><Animated.View style={{ opacity: letterRise, transform: [{ translateY: letterRise.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : 70, 0] }) }] }}><LetterView c={c} content={opened} name={name} placeName={placeName} self={c.sender === session?.user.id} language={language} t={t} /></Animated.View></ScrollView> : <>
      <View style={{ flex: 1 }}><ScrollView ref={pages} horizontal pagingEnabled={!discovery.nudgeActive} showsHorizontalScrollIndicator={false} onScrollBeginDrag={discovery.beginDrag} scrollEventThrottle={16} onScroll={e => {
        const x = e.nativeEvent.contentOffset.x;
        pagePosition.setValue(x / pageWidth);
        if (discovery.nudging.current) return;
        const n = Math.max(0, Math.min(pageCount - 1, Math.round(x / pageWidth)));
        if (n !== pageIndex.current) { pageIndex.current = n; setPage(n); void haptics.page(); }
        if (x > 8) discovery.dismiss();
      }} onLayout={e => setPagerHeight(e.nativeEvent.layout.height)} style={{ flex: 1 }}>
        <View style={{ width: pageWidth, height: pagerHeight || undefined, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 6 }}><View style={{ flex: 1, width: "100%", maxWidth: 600, alignSelf: "center", paddingHorizontal: 22, paddingTop: 18, paddingBottom: 12, backgroundColor: C.white, borderRadius: 14, borderWidth: 1.5, borderColor: "#5B6474", marginBottom: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}><Text style={{ color: "#4A5466", fontFamily: serif, fontSize: 15 }}>{t("home.from")}</Text><Avatar avatar={sender?.avatar as any} size={24} /><Text style={{ color: "#4A5466", fontFamily: serif, fontSize: 15 }}>{name}</Text></View>
          {!!c.edition_no && v?.brand && <Text style={{ color: C.brass, textAlign: "center", marginTop: 6 }}>{v.brand} No.{String(c.edition_no).padStart(3, "0")}</Text>}
          <View style={{ alignItems: "center", marginTop: 14, marginBottom: 10 }}><Vessel kind={c.vessel as VesselKind} size={160} idle={page === 0} /></View>
          <Story language={language} value={now < new Date(c.open_at).getTime() ? (STR[language] as any).storyWaiting(formatDate(c.sealed_at, language, true), Math.max(0, Math.floor((now - new Date(c.sealed_at).getTime()) / 86400000)), waitValue, waitLabel, formatDate(c.open_at, language, true)) : (STR[language] as any).storyArrived(formatDate(c.sealed_at, language, true), Math.max(0, Math.floor((new Date(c.open_at).getTime() - new Date(c.sealed_at).getTime()) / 86400000)), formatDate(c.open_at, language, true)) + (pl ? (STR[language] as any)[state === "ready" ? "storyHere" : "storyGo"] : (STR[language] as any).storyNow)} />
          {state === "time" && <Countdown until={c.open_at} />}
          <View style={{ marginTop: "auto", alignItems: "center", paddingTop: 8, minHeight: 58 }}>{pl ? <><Text style={{ color: "#4A5466", fontFamily: sans, fontSize: 14, letterSpacing: language === "zh" ? 1 : 0, marginBottom: 6 }}>{state === "time" ? (STR[language] as any).goLater : (STR[language] as any).goNow}</Text><Pressable accessibilityRole="button" onPress={() => goPage(1)} style={{ flexDirection: "row", alignItems: "center", gap: 6, borderBottomWidth: 1, borderBottomColor: C.blue, paddingBottom: 2 }}><ArtIcon name="pin" size={18} color={C.blue} /><Text style={{ color: C.blue, fontFamily: serif, fontWeight: "700", fontSize: 17 }}>{placeName}</Text></Pressable></> : state !== "time" ? <Action title={t("capsule.goOpen")} onPress={() => goPage(openPage)} /> : null}</View>

        </View><PageNumber n={1} label={t("capsule.page", 1)} /></View>
        {pl && <View style={{ width: pageWidth, height: pagerHeight || undefined, paddingHorizontal: 20 }}><ScrollView style={{ width: "100%", marginBottom: 50 }} contentContainerStyle={{ flexGrow: 1 }}><CapsuleMapPage place={pl} vessel={c.vessel as VesselKind} onGoOpen={() => goPage(openPage)} /></ScrollView><PageNumber n={2} label={t("capsule.page", 2)} /></View>}
        <View style={{ width: pageWidth, height: pagerHeight || undefined, paddingHorizontal: 20 }}><ScrollView style={{ width: "100%", maxWidth: 600, alignSelf: "center", backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.line, marginBottom: 8 }} contentContainerStyle={{ padding: 18, paddingBottom: 60, alignItems: "center", gap: 13 }}><View style={{ width: 220, height: 210, alignItems: "center", justifyContent: "center" }}><LightBurst intensity={charge * 0.65 + (state === "ready" ? 0.12 : 0)} bloom={burst} /><Animated.View style={{ transform: [{ translateX: reduced ? 0 : Math.sin(charge * 70) * charge * 3 }] }}><Vessel kind={c.vessel as VesselKind} size={180} lidLift={lid} ready={state === "ready"} /></Animated.View></View><View style={{ width: "100%", gap: 9 }}><Checklist label={t("capsule.time")} value={formatDate(c.open_at, language, true)} done={now >= new Date(c.open_at).getTime()} />{pl && <Checklist label={t("capsule.place")} value={placeName} done={state === "ready"} />}</View><View style={{ backgroundColor: C.paper, padding: 14, borderRadius: 12, width: "100%" }}><Text style={{ fontFamily: handwriting, fontSize: 19, color: C.plum }}>「{c.hint || t("capsule.defaultHint")}」</Text><Text style={{ color: C.muted, marginTop: 5 }}>{t("capsule.hint", name)}</Text></View>{v?.brand && pl?.brand_vessel === c.vessel && <Label>{t("capsule.brandNote")}</Label>}{state === "ready" && !busy ? <RitualHold title={t("capsule.hold")} onProgress={setCharge} onComplete={() => void openCapsule()} /> : <Action disabled title={busy ? t("capsule.opening") : state === "time" ? t("capsule.wait") : t("capsule.needPlace")} onPress={() => {}} />}{state === "ready" && <Label muted>{t("capsule.holdNote")}</Label>}{!!error && <Text accessibilityRole="alert" style={{ color: C.wax, textAlign: "center" }}>{error}</Text>}</ScrollView><PageNumber n={pageCount} label={t("capsule.page", pageCount)} /></View>
      </ScrollView><PagerArrows count={pageCount} index={page} onSelect={goPage} /></View>
      <PagerDots count={pageCount} index={page} position={pagePosition} onSelect={goPage} label={n => t("capsule.page", n)} />
      <Animated.Text style={{ opacity: discovery.hintOpacity, color: C.muted, fontFamily: sans, fontSize: 12, textAlign: "center", paddingBottom: 6 }}>{t("pager.swipe")}</Animated.Text>
    </>}
  </View></SafeAreaView>;
}

function PageNumber({ n, label }: { n: number; label: string }) {
  return <View pointerEvents="none" style={{ position: "absolute", zIndex: 2, bottom: 26, left: 18, right: 18, alignItems: "center" }}><View style={{ width: "100%", maxWidth: 600, paddingRight: 22 }}><Text accessibilityLabel={label} style={{ alignSelf: "flex-end", color: C.blue, fontFamily: serif, fontSize: 22 }}>{n}</Text></View></View>;
}
function Checklist({ label, value, done }: { label: string; value: string; done: boolean }) {
  return <View style={{ flexDirection: "row", gap: 12, alignItems: "center", borderBottomWidth: 1, borderColor: C.line, paddingBottom: 8 }}><ArtIcon name={done ? "check" : "lock"} size={22} color={done ? C.blue : C.muted} /><View><Text style={{ color: C.ink, fontFamily: sans }}>{label}</Text><Text style={{ color: C.muted, fontSize: 12 }}>{value}</Text></View></View>;
}

function SenderView({ c, name, placeName, language, t }: { c: Row; name: string; placeName: string; language: "zh" | "en"; t: ReturnType<typeof useF1Text> }) {
  const predicted = isPrediction(c);
  const [own, setOwn] = useState<SenderPrediction | null>(null);
  useEffect(() => {
    if (!predicted || !c.opened_at) return;
    let alive = true;
    senderPrediction(c.id).then(row => { if (alive) setOwn(row); }).catch(() => {});
    return () => { alive = false; };
  }, [predicted, c.id, c.opened_at]);
  const stages = [
    [t("capsule.timelineSent"), formatDate(c.sealed_at, language, true), true],
    [t("capsule.timelineDelivered", name), formatDate(c.open_at, language, true), Date.now() >= new Date(c.open_at).getTime()],
    [t("capsule.timelineOpened", name), c.opened_at ? formatDate(c.opened_at, language, true) + (placeName ? ` · ${placeName}` : "") : placeName ? t("capsule.timelinePlace", placeName) : t("capsule.timelineAny"), !!c.opened_at],
  ] as const;
  return <ScrollView contentContainerStyle={{ width: "100%", maxWidth: 600, alignSelf: "center", paddingHorizontal: 22, paddingTop: 8, paddingBottom: 50, gap: 14 }}><View style={{ alignItems: "center" }}><Vessel kind={c.vessel as VesselKind} size={190} idle /><Text style={{ fontFamily: serif, fontSize: 19, color: "#4A5466", marginTop: 2 }}>{(VESSELS as any)[c.vessel]?.name[language] ?? c.vessel}</Text>{!c.opened_at && <Countdown until={c.open_at} />}</View>
    <View style={{ paddingLeft: 8, gap: 0 }}>{stages.map(([label, date, done], i) => <View key={i} style={{ flexDirection: "row", gap: 16, minHeight: 56, opacity: done ? 1 : .7 }}><View style={{ width: 1, backgroundColor: i === stages.length - 1 ? "transparent" : "#CDD5DF", marginLeft: 6, position: "absolute", top: 14, bottom: -4 }} /><View style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: done ? C.blue : "#CDD5DF", backgroundColor: done ? C.blue : C.white, marginTop: 3 }} /><View style={{ flex: 1 }}><Text style={{ fontFamily: sans, color: C.ink, fontSize: 15 }}>{label}</Text><Text style={{ color: C.muted, fontFamily: sans, fontSize: 13, marginTop: 3 }}>{date}</Text></View></View>)}</View>
    {predicted && <SenderPredictionCard opened={!!c.opened_at} prediction={own?.prediction ?? null} verdict={own?.verdict ?? null} />}
    <View style={{ borderWidth: 1.5, borderStyle: "dashed", borderColor: "#CDD5DF", borderRadius: 12, paddingHorizontal: 22, paddingVertical: 20, gap: 7, backgroundColor: "rgba(255,255,255,.25)" }}><SealedLines /><Text style={{ color: C.muted, fontFamily: sans, fontSize: 13, textAlign: "center", lineHeight: 21, marginTop: 12 }}>{t("capsule.sealed")}</Text></View>
    <View style={{ alignItems: "center", paddingTop: 4 }}><Text style={{ fontFamily: serif, fontSize: 18, color: C.ink, textAlign: "center" }}>「{c.hint || t("capsule.defaultHint")}」</Text><Text style={{ color: C.muted, fontFamily: sans, fontSize: 13, textAlign: "center", marginTop: 4 }}>{t("capsule.yourHint")}</Text></View>
  </ScrollView>;
}

function LetterView({ c, content, name, placeName, self, language, t }: { c: Row; content: Opened; name: string; placeName: string; self: boolean; language: "zh" | "en"; t: ReturnType<typeof useF1Text> }) {
  const brand = c.edition_no ? "Maison Aurèle" : "";
  const p = usePredictionText();
  const predicted = openedPrediction(c.id, content as Record<string, unknown>);
  return <View style={{ gap: 18 }}><View style={{ alignItems: "center", opacity: 0.55 }}><Vessel kind={c.vessel as VesselKind} size={95} /></View>
    {predicted && <PredictionStamp capsuleId={c.id} prediction={predicted.prediction} initial={predicted.verdict} who={self ? p("fromSelf") : p("fromName", name)} />}<View style={{ width: '100%', overflow: 'hidden', backgroundColor: "#FFFDF8", borderWidth: 1, borderColor: C.line, padding: 22, borderRadius: 6, minHeight: 240, ...shadows.card }}>
    <Image source={paperLetter} pointerEvents="none" resizeMode="repeat" style={[StyleSheet.absoluteFill, { opacity: .55 }]} />
    {c.handwritten && <Text style={{ color: C.wax, fontFamily: handwriting, alignSelf: "flex-end" }}>{t("home.handTag")}</Text>}
    {!!content.drawing && <Image source={{ uri: content.drawing }} resizeMode="contain" accessibilityLabel={t("home.handTag")} style={{ width: "100%", height: 240 }} />}
    {!!content.message && <Text style={{ color: C.ink, fontFamily: c.handwritten ? handwriting : serif, fontSize: 19, lineHeight: 32, marginTop: 12 }}>{content.message}</Text>}
    <LetterVoice capsuleId={c.id} content={content} name={name} self={self} />
    {!!content.photo && <Image source={{ uri: content.photo }} resizeMode="contain" style={{ width: "100%", height: 230, marginTop: 20, borderRadius: 4 }} />}
    <Text style={{ color: C.plum, fontFamily: handwriting, fontSize: 19, textAlign: "right", marginTop: 25 }}>{self ? t("capsule.pastMe") : name}</Text><Text style={{ color: C.muted, fontSize: 12, textAlign: "right" }}>{t("capsule.sealedOn", formatDate(c.sealed_at, language, true))}</Text>
  </View>{!!content.gift_code && <View style={{ backgroundColor: C.ink, borderRadius: 16, padding: 22, alignItems: "center", gap: 12 }}><Text style={{ color: C.cream, fontFamily: serif, fontSize: 19, textAlign: "center" }}>{t("capsule.giftHead", brand)}</Text><Text style={{ color: C.white }}>{t("capsule.giftItem")}</Text><Text style={{ color: C.cream, fontFamily: serif, fontSize: 23 }}>{content.gift_code}</Text><GiftQr value={content.gift_code} label={t("capsule.qr")} /><Text style={{ color: C.white, textAlign: "center" }}>{t("capsule.giftNote")}</Text></View>}
    <Text style={{ color: C.blue, fontFamily: serif, textAlign: "center", marginTop: 8 }}>{t("capsule.record", formatDate(content.opened_at, language, true), placeName)}</Text><Action ghost title={self ? t("capsule.replySelf") : t("capsule.reply", name)} onPress={() => router.push({ pathname: "/create", params: { recipient: self ? "future" : c.sender } })} />
    <WakeMe c={c} name={name} self={self} />
  </View>;
}

/** Turn this opened capsule into a daily wake-up alarm (features/alarm). */
function WakeMe({ c, name, self }: { c: Row; name: string; self: boolean }) {
  const at = useAlarmText();
  return <Pressable accessibilityRole="button" onPress={() => { void haptics.tap(); router.push({ pathname: "/alarms/edit", params: { capsule: c.id, vessel: c.vessel, name, self: self ? "1" : "0" } }); }}
    style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: C.brass, backgroundColor: "#FBF6EA" }}>
    <ArtIcon name="alarm" size={20} color="#8A6A2E" /><Text style={{ color: "#8A6A2E", fontFamily: sans, fontSize: 16 }}>{at("wakeMe")}</Text>
  </Pressable>;
}
