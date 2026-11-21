// A common Waypost, in one place (docs/design/hunt-first-home.md, part 1): tap it and you spin first; then its doors
// swing open onto the capsule rack, a wooden wine rack of bottles, with Leave a capsule at the bottom of the same
// screen. There is no way round the spin (spins level the Waypost up); once it is cooling down from your spin,
// it opens straight onto the rack. The map gem itself never changes.
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { gameArt, lightBurst } from "../../art/manifest";
import { ArtIcon } from "../../components/ArtIcon";
import { haptics } from "../../components/haptics";
import { Vessel } from "../../components/Vessel";
import { game, GameError, type GameState, type Waypost } from "../../services/game";
import { PUBLIC_CAPSULE_RECIPIENT } from "../../services/publicCapsule";
import { RACK_FILTERS, RackError, racks, type RackAt, type RackFilter, type RackItem, type RackPage } from "../../services/racks";
import { levelProgress, sampleAddXp, WAYPOST_LEVELS, waypostLevels, XP_POINTS, type WaypostLevel } from "../../services/waypostLevels";
import { C, radii, sans, serif, shadows, spacing } from "../../theme";
import { useReducedMotion } from "../../useReducedMotion";
import { errorKey, useGameText } from "../game/strings";
import { SpinDisc } from "../game/SpinDisc";
import { ThrowBackground, WaxBall } from "../game/ThrowScreen";
import { noWebSelect, useNoWebDrag } from "../game/noWebDrag";
import { sceneKey } from "../game/waypostScene";
import { Chip } from "../journey/JourneyControls";
import type { Item } from "../journey/journeyModel";
import { SelectedCard } from "../journey/SelectedCard";
import { RackCabinet, RackDoors } from "./RackCabinet";
import { useRackText } from "./strings";

const NATIVE = Platform.OS !== "web";
const STAGGER = .09;

export function WaypostScreen({ waypost, meters, at, language, onState, onSpun, onSampleLetter, onClose }: {
  waypost: Waypost; meters: number; at: () => RackAt; language: "zh" | "en";
  onState: (s: GameState) => void;
  /** After a spin: reload the game and pass back the fresh Waypost, so the rack's next-spin countdown shows at once. */
  onSpun: () => void; onClose: () => void;
  /** The development sample has no real capsule pages, so an opened sample capsule shows as a letter card instead. */
  onSampleLetter?: (capsule: Extract<Item, { kind: "publicCapsule" }>["publicCapsule"], message: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const g = useGameText();
  const r = useRackText();
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  useNoWebDrag();
  const name = language === "zh" ? waypost.name_zh : waypost.name_en;
  const cooling = !!waypost.cooldown_until && new Date(waypost.cooldown_until).getTime() > Date.now();
  // Opened while cooling down: straight to the rack. Otherwise the spin comes first.
  const [phase, setPhase] = useState<"spin" | "rack">(cooling ? "rack" : "spin");
  const [reward, setReward] = useState<{ wax: number; gold: number; vessel: string | null } | null>(null);
  const [note, setNote] = useState("");
  const [disc, setDisc] = useState(0);
  const [doorsShown, setDoorsShown] = useState(false);
  const doorIn = useRef(new Animated.Value(0)).current;
  const doorOpen = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(0)).current;
  const tally = useRef(new Animated.Value(0)).current;
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  // ---- the rack ----
  const [filter, setFilter] = useState<RackFilter>("all");
  const [page, setPage] = useState<RackPage | null>(null);
  const [newest, setNewest] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const request = useRef(0);
  const loadingMore = useRef(false);
  const load = useCallback(async (f: RackFilter, more = false) => {
    const req = ++request.current;
    try {
      const next = await racks.list(waypost.id, f, more ? page?.next_cursor ?? null : null);
      if (req !== request.current || !alive.current) return;
      setPage((prev) => {
        // A capsule that wasn't on the rack last time (one you just left) slides into its cubby.
        if (!more && prev) setNewest(next.items.find((x) => !prev.items.some((y) => y.capsule_id === x.capsule_id))?.capsule_id ?? null);
        return more && prev ? { ...next, items: [...prev.items, ...next.items] } : next;
      });
    } catch { if (req === request.current && !more) setPage({ count: 0, items: [], next_cursor: null }); }
  }, [waypost.id, page?.next_cursor]);
  // Also on coming back from Create, so a capsule just left shows on the rack.
  useFocusEffect(useCallback(() => { void load(filter); void refreshLevel(true); }, [filter, waypost.id]));
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(""), 3000); return () => clearTimeout(id); }, [toast]);
  const pickFilter = (f: RackFilter) => {
    if (f === filter) return;
    void haptics.tick(); setSelected(null); setFilter(f); setPage(null);
  };
  const more = async () => {
    if (!page?.next_cursor || loadingMore.current) return;
    loadingMore.current = true;
    try { await load(filter, true); } finally { loadingMore.current = false; }
  };

  // ---- the level (not on the map: only here) ----
  const [level, setLevel] = useState<WaypostLevel | null>(null);
  const [levelOpen, setLevelOpen] = useState(false);
  const [levelUp, setLevelUp] = useState<WaypostLevel | null>(null);
  const shownLevel = useRef<number | null>(null);
  const refreshLevel = async (celebrate: boolean) => {
    if (!WAYPOST_LEVELS) return;
    try {
      const next = await waypostLevels.get(waypost.id);
      if (!alive.current) return;
      if (celebrate && shownLevel.current !== null && next.level > shownLevel.current) { void haptics.success(); setLevelUp(next); }
      shownLevel.current = next.level;
      setLevel(next);
    } catch { /* the Waypost still works without its level */ }
  };

  // ---- spin, then the doors ----
  const openDoors = () => {
    if (!alive.current) return;
    if (reduced) { setPhase("rack"); return; }
    doorIn.setValue(0); doorOpen.setValue(0); setDoorsShown(true);
    Animated.timing(doorIn, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }).start(() => {
      if (!alive.current) return;
      setPhase("rack");
      void haptics.tick();
      Animated.timing(doorOpen, { toValue: 1, duration: 950, delay: 180, easing: Easing.inOut(Easing.cubic), useNativeDriver: NATIVE })
        .start(() => { if (alive.current) setDoorsShown(false); });
    });
  };
  const spin = async () => {
    try {
      const out = await game.spin(waypost.id);
      onState(out.state);
      sampleAddXp(waypost.id, "spin");
      setTimeout(() => {
        if (!alive.current) return;
        void haptics.success();
        setReward({ wax: out.wax, gold: out.gold, vessel: out.vessel ?? null });
        rise.setValue(0); tally.setValue(0);
        Animated.timing(rise, { toValue: 1, duration: 1500, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }).start();
        Animated.timing(tally, { toValue: 1, duration: 2600, easing: Easing.linear, useNativeDriver: NATIVE }).start();
        setTimeout(openDoors, reduced ? 900 : 1700);
        // The spin added XP: refresh the level once the doors have opened, so a level-up shows over the rack.
        setTimeout(() => void refreshLevel(true), reduced ? 1000 : 3200);
      }, 700);
      onSpun();
    } catch (e) {
      void haptics.warn();
      const code = e instanceof GameError ? e.code : "unknown";
      setNote(g(errorKey(code)));
      // The rack opens only after a spin, because spins are what level a Waypost up. Already spun (cooling down):
      // open it. Anything else (no signal, too far): the disc comes back to try again.
      if (code === "cooldown") setTimeout(openDoors, 1300);
      else setTimeout(() => { if (alive.current) { setNote(""); setDisc((n) => n + 1); } }, 2200);
    }
  };

  // ---- opening a bottle ----
  const items = page?.items ?? [];
  const pick = items[selected ?? -1];
  const asItem = (e: RackItem): Extract<Item, { kind: "publicCapsule" }> => ({
    kind: "publicCapsule", id: e.capsule_id, lat: waypost.lat, lng: waypost.lng, meters,
    publicCapsule: { id: e.capsule_id, hint: e.hint ?? "", vessel: "bottle", lat: waypost.lat, lng: waypost.lng, spot_zh: waypost.name_zh, spot_en: waypost.name_en,
      sealed_at: e.opens_at, available_at: e.opens_at, returns: 0, sender: { ...e.sender, city: null } },
  });
  const step = (dir: 1 | -1) => {
    if (selected === null || !items.length) return;
    void haptics.tick();
    setSelected((selected + dir + items.length) % items.length);
  };
  const open = async (item: Extract<Item, { kind: "publicCapsule" }>, answer?: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const out = await racks.open(item.id, at(), answer);
      void haptics.success();
      sampleAddXp(waypost.id, "open");
      setSelected(null);
      setPage((prev) => prev && { ...prev, count: prev.count - 1, items: prev.items.filter((x) => x.capsule_id !== item.id) });
      if (onSampleLetter) onSampleLetter(item.publicCapsule, out.message ?? "");
      else router.push({ pathname: "/capsule/[id]", params: { id: item.id } });
    } catch (e) {
      void haptics.warn();
      const code = e instanceof RackError ? e.code : "unknown";
      setToast(r.err[code]);
      if (code === "taken") { setSelected(null); void load(filter); }
    } finally { setBusy(false); }
  };
  const leave = () => {
    void haptics.tap();
    router.push({ pathname: "/create", params: { to: PUBLIC_CAPSULE_RECIPIENT, waypost: waypost.id, waypostZh: waypost.name_zh, waypostEn: waypost.name_en } });
  };

  const balls: ("wax" | "gold")[] = reward ? [...Array<"wax">(Math.min(reward.wax, 14)).fill("wax"), ...Array<"gold">(reward.gold).fill("gold")] : [];
  const lines = reward ? [{ kind: "wax" as const, count: reward.wax }, ...(reward.gold ? [{ kind: "gold" as const, count: reward.gold }] : [])] : [];
  const shelfWidth = Math.min(width - 28, 520);

  return <View style={[{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 40, backgroundColor: C.paper }, noWebSelect]}>
    {phase === "spin" && <ThrowBackground />}

    {/* Header: close, the Waypost's name, and its level when levels are on. */}
    <SafeAreaView edges={["top", "left", "right"]} style={{ zIndex: 3 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        <Chip onPress={onClose} label={g("close")}><ArtIcon name="close" size={20} /></Chip>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text numberOfLines={1} style={{ fontFamily: serif, fontSize: 19, color: C.ink }}>{name}</Text>
          <Text style={{ fontFamily: sans, fontSize: 11.5, color: C.muted }}>{r.waypost}</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>
      {level && <LevelBar level={level} onPress={() => { void haptics.tap(); setLevelOpen(true); }} />}
    </SafeAreaView>

    {phase === "spin" ? <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg, paddingBottom: insets.bottom + 40 }}>
      <View pointerEvents="none" style={{ position: "absolute", top: spacing.sm, right: spacing.md, alignItems: "flex-end", gap: 8 }}>
        {lines.map((line, i) => <Animated.View key={line.kind} style={{
          flexDirection: "row", alignItems: "center", gap: 6,
          opacity: tally.interpolate({ inputRange: [0, .08 + i * .06, .85, 1], outputRange: [0, 1, 1, 0] }),
          transform: [{ translateX: tally.interpolate({ inputRange: [0, .08 + i * .06, 1], outputRange: [28, 0, 0] }) }],
        }}>
          <Text style={{ fontFamily: serif, fontSize: 22, color: C.ink }}>+{line.count}</Text>
          <WaxBall kind={line.kind} size={32} />
        </Animated.View>)}
        {reward?.vessel && <Animated.View style={{ opacity: tally.interpolate({ inputRange: [0, .2, .85, 1], outputRange: [0, 1, 1, 0] }), flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Vessel kind={reward.vessel as never} size={34} />
        </Animated.View>}
      </View>
      <SpinDisc key={disc} source={gameArt.wheel[sceneKey(waypost)]} spinnable={!reward && !note} dim={!!note} label={g("spinHint")} onSpin={() => void spin()}>
        {balls.map((kind, i) => {
          const start = Math.min(.5, i * STAGGER), end = Math.min(1, start + .55), drift = (i % 2 ? 1 : -1) * (24 + (i % 3) * 22);
          return <Animated.View key={i} pointerEvents="none" style={{
            position: "absolute", width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center",
            backgroundColor: "rgba(255,255,255,.34)", borderWidth: 1, borderColor: "rgba(255,255,255,.75)",
            opacity: rise.interpolate({ inputRange: [start, start + .08, end - .15, end], outputRange: [0, 1, 1, 0], extrapolate: "clamp" }),
            transform: [
              { translateX: rise.interpolate({ inputRange: [start, end], outputRange: [0, drift], extrapolate: "clamp" }) },
              { translateY: rise.interpolate({ inputRange: [start, end], outputRange: [20, -190], extrapolate: "clamp" }) },
            ],
          }}><WaxBall kind={kind} size={38} /></Animated.View>;
        })}
      </SpinDisc>
      {!reward && <Text style={{ fontSize: 14, color: C.ink, backgroundColor: "rgba(246,248,251,.9)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill, overflow: "hidden" }}>{note || g("spinHint")}</Text>}
    </View> : <View style={{ flex: 1 }}>
      <View style={{ gap: 6, paddingTop: spacing.sm, paddingBottom: 6 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: spacing.md }} style={{ flexGrow: 0 }}>
          {RACK_FILTERS.map((f) => { const on = filter === f; return <Pressable key={f} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => pickFilter(f)}
            style={{ borderWidth: 1.5, borderColor: on ? C.blue : C.line, backgroundColor: on ? C.glass : C.white, borderRadius: radii.pill, paddingHorizontal: 11, paddingVertical: 5 }}>
            <Text style={{ fontFamily: sans, fontSize: 12.5, color: on ? C.blue : C.ink, fontWeight: on ? "500" : "400" }}>{r.filters[f]}</Text>
          </Pressable>; })}
        </ScrollView>
        <Cooldown until={waypost.cooldown_until} text={r.nextSpin} />
      </View>
      <ScrollView scrollEventThrottle={64} contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 4, paddingBottom: insets.bottom + 110 }}
        onScroll={(e) => { const n = e.nativeEvent; if (n.contentOffset.y + n.layoutMeasurement.height > n.contentSize.height - 300) void more(); }}>
        {page ? <RackCabinet items={items} width={shelfWidth} newest={newest} onPick={(i) => { void haptics.tap(); setSelected(i); }}
          footer={<Text style={{ fontFamily: sans, fontSize: 12, color: C.muted, textAlign: "center", marginTop: spacing.sm + 2 }}>{page.count ? r.rackCount(page.count.toLocaleString()) : filter === "all" ? r.rackEmpty : r.filterEmpty}</Text>} />
          : <View style={{ height: 240 }} />}
      </ScrollView>
      <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: insets.bottom + spacing.md, backgroundColor: "rgba(246,248,251,.94)" }}>
        <Pressable accessibilityRole="button" onPress={leave}
          style={({ pressed }) => ({ width: "100%", maxWidth: 520, alignSelf: "center", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: C.wax, borderRadius: radii.pill, paddingVertical: 14, opacity: pressed ? .9 : 1, ...shadows.card })}>
          <ArtIcon name="plus" size={18} color={C.white} />
          <Text style={{ fontFamily: serif, fontSize: 16, color: C.white }}>{r.leaveHere}</Text>
        </Pressable>
      </View>
    </View>}

    {doorsShown && <RackDoors fade={doorIn} open={doorOpen} top={insets.top + (level ? 112 : 64)} />}

    {pick && <>
      <Pressable accessibilityRole="button" accessibilityLabel={g("close")} onPress={() => setSelected(null)} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 5, backgroundColor: "rgba(22,38,63,.25)" }} />
      <View style={{ position: "absolute", left: spacing.md, right: spacing.md, bottom: insets.bottom + spacing.md, zIndex: 6, maxWidth: 560, alignSelf: "center", width: width - spacing.md * 2, backgroundColor: "rgba(255,255,255,.98)", borderRadius: 22, padding: spacing.md, borderWidth: 1, borderColor: C.line, ...shadows.card }}>
        <SelectedCard key={pick.capsule_id} item={asItem(pick)} rack={pick} busy={busy} count={page?.count ?? items.length} index={selected ?? 0}
          onStep={step} onPickUp={(item, answer) => void open(item, answer)} onDirections={() => {}} onView={() => {}} onMap={() => {}} />
      </View>
    </>}

    {!!toast && <Text accessibilityRole="alert" style={{ position: "absolute", zIndex: 8, alignSelf: "center", top: insets.top + 70, backgroundColor: C.ink, color: C.white, fontFamily: sans, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, overflow: "hidden" }}>{toast}</Text>}
    {levelOpen && level && <LevelSheet level={level} onClose={() => setLevelOpen(false)} />}
    {levelUp && <LevelUp level={levelUp} name={name} onClose={() => setLevelUp(null)} />}
  </View>;
}

function Cooldown({ until, text }: { until: string | null; text: (t: string) => string }) {
  const [now, setNow] = useState(Date.now());
  const end = until ? new Date(until).getTime() : 0;
  useEffect(() => { if (end <= now) return; const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, [end > now]);
  if (end <= now) return null;
  const s = Math.ceil((end - now) / 1000);
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md }}>
    <ArtIcon name="alarm" size={14} color={C.muted} />
    <Text style={{ fontFamily: sans, fontSize: 12.5, color: C.muted }}>{text(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`)}</Text>
  </View>;
}

function LevelBar({ level, onPress }: { level: WaypostLevel; onPress: () => void }) {
  const r = useRackText();
  const p = levelProgress(level);
  const fill = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(fill, { toValue: p, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(); }, [p]);
  return <Pressable accessibilityRole="button" accessibilityLabel={`${r.levelTitle} ${r.level(level.level)}`} onPress={onPress}
    style={{ marginHorizontal: spacing.md, marginTop: spacing.sm, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,255,255,.95)", borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, maxWidth: 520, alignSelf: "center", width: "100%" }}>
    <Text style={{ fontFamily: serif, fontSize: 14, color: C.blue }}>{r.level(level.level)}</Text>
    <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: "#E6EBF1", overflow: "hidden" }}>
      <Animated.View style={{ height: "100%", borderRadius: 4, backgroundColor: C.blue, width: fill.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }) }} />
    </View>
    <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{level.next_xp == null ? r.topLevel : r.toNext(p, level.level + 1)}</Text>
  </Pressable>;
}

function LevelSheet({ level, onClose }: { level: WaypostLevel; onClose: () => void }) {
  const r = useRackText();
  const insets = useSafeAreaInsets();
  const row = (label: string, points: number) => <View key={label} style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.sm }}>
    <Text style={{ flex: 1, fontFamily: sans, fontSize: 13.5, color: C.ink }}>{label}</Text>
    <Text style={{ fontFamily: serif, fontSize: 14, color: C.blue }}>+{points}</Text>
  </View>;
  return <>
    <Pressable accessibilityRole="button" onPress={onClose} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9, backgroundColor: "rgba(22,38,63,.3)" }} />
    <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 10, maxHeight: "86%", backgroundColor: C.paper, borderTopLeftRadius: 22, borderTopRightRadius: 22, ...shadows.card }}>
      <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, alignSelf: "center", marginTop: 8 }} />
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + spacing.lg, gap: spacing.md, maxWidth: 560, alignSelf: "center", width: "100%" }}>
        <Text style={{ fontFamily: serif, fontSize: 18, color: C.ink, textAlign: "center" }}>{r.levelTitle}</Text>
        <View style={box}>
          <Text style={{ fontFamily: serif, fontSize: 22, color: C.blue }}>{r.level(level.level)}</Text>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: "#E6EBF1", overflow: "hidden" }}><View style={{ height: "100%", width: `${levelProgress(level)}%`, backgroundColor: C.blue }} /></View>
          <Text style={{ fontFamily: sans, fontSize: 13, color: C.muted }}>{level.next_xp == null ? r.atTop : r.toGo(level.next_xp - level.xp, level.level + 1)}</Text>
        </View>
        <View style={box}>
          <Text style={{ fontFamily: serif, fontSize: 16, color: C.ink }}>{r.eachSpin}</Text>
          <Drops items={level.items} />
          {level.next_items && <>
            <Text style={{ fontFamily: serif, fontSize: 14, color: C.muted, marginTop: 4 }}>{r.level(level.level + 1)}</Text>
            <Drops items={level.next_items} muted />
          </>}
        </View>
        <View style={box}>
          <Text style={{ fontFamily: serif, fontSize: 16, color: C.ink }}>{r.howGrow}</Text>
          {row(r.xpSpin, XP_POINTS.spin)}{row(r.xpLeave, XP_POINTS.leave)}{row(r.xpOpen, XP_POINTS.open)}
          <Text style={{ fontFamily: sans, fontSize: 12.5, lineHeight: 19, color: C.muted }}>{r.youHelped(level.me.spins, level.me.capsules, level.me.opened)}</Text>
        </View>
      </ScrollView>
    </View>
  </>;
}
const box = { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14, gap: 8 } as const;

function Drops({ items, muted }: { items: WaypostLevel["items"]; muted?: boolean }) {
  const r = useRackText();
  return <View style={{ gap: 6 }}>{items.map((i, n) => <View key={n} style={{ flexDirection: "row", alignItems: "center", gap: 8, opacity: muted ? .65 : 1 }}>
    {i.kind === "vessel" ? <Vessel kind={(i.vessel ?? "bottle") as never} size={22} /> : <WaxBall kind={i.kind === "gold" ? "gold" : "wax"} size={22} />}
    <Text style={{ flex: 1, fontFamily: sans, fontSize: 13.5, color: C.ink }}>{r.item(i)}</Text>
  </View>)}</View>;
}

/** The moment a Waypost reaches a new level: the same plain gem, a light burst and what each spin now gives. */
function LevelUp({ level, name, onClose }: { level: WaypostLevel; name: string; onClose: () => void }) {
  const r = useRackText();
  const reduced = useReducedMotion();
  const grow = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const turn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    Animated.spring(grow, { toValue: 1, friction: 5, tension: 70, useNativeDriver: NATIVE }).start();
    const loop = Animated.loop(Animated.timing(turn, { toValue: 1, duration: 12000, easing: Easing.linear, useNativeDriver: NATIVE }));
    loop.start();
    return () => loop.stop();
  }, []);
  return <View accessibilityViewIsModal style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 20, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.lg, backgroundColor: "rgba(240,245,250,.97)" }}>
    <View style={{ width: 260, height: 220, alignItems: "center", justifyContent: "center" }}>
      <Animated.Image source={lightBurst} style={{ position: "absolute", width: 300, height: 300, opacity: .75, transform: [{ rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }} />
      <Animated.Image source={gameArt.waypostGemBlue} resizeMode="contain" style={{ width: 120, height: 120, transform: [{ scale: grow.interpolate({ inputRange: [0, 1], outputRange: [.5, 1] }) }] }} />
    </View>
    <Text accessibilityRole="header" style={{ fontFamily: serif, fontSize: 28, color: C.blue }}>{r.levelUp(level.level)}</Text>
    <Text style={{ fontFamily: sans, fontSize: 14, lineHeight: 21, color: C.ink, textAlign: "center", maxWidth: 300 }}>{r.levelUpLine(name)}</Text>
    <View style={{ ...box, minWidth: 260 }}>
      <Text style={{ fontFamily: serif, fontSize: 14, color: C.muted }}>{r.nowDrops}</Text>
      <Drops items={level.items} />
    </View>
    <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => ({ minWidth: 180, alignItems: "center", backgroundColor: C.blue, borderRadius: radii.pill, paddingVertical: 13, opacity: pressed ? .88 : 1, ...shadows.card })}>
      <Text style={{ fontFamily: serif, fontSize: 16, color: C.white }}>{r.nice}</Text>
    </Pressable>
  </View>;
}

