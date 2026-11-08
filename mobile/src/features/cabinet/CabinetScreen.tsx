import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, FlatList, Image, Modal, PanResponder, Platform, Pressable, ScrollView, Text, View, useWindowDimensions, type ImageSourcePropType } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GestureDetector, GestureHandlerRootView, usePanGesture } from "react-native-gesture-handler";
import { cabinetTiles, vesselParts } from "../../art/manifest";
import { router, useFocusEffect } from "expo-router";
import { goBack } from "../../navigation";
import { DeviceMotion } from "expo-sensors";
import { Vessel, type VesselKind } from "../../components/Vessel";
import { Heading, Bar, BackButton } from "../../components/Screen";
import { haptics } from "../../components/haptics";
import { useLanguage } from "../../i18n";
import { useAuth } from "../../services/auth";
import { game, GAME_ENABLED } from "../../services/game";
import { useGameText } from "../game/strings";
import { isCollected } from "../../services/vesselAccess";
import { capsules, vessels } from "../../services/data";
import { VESSELS } from "../../i18n/webStrings";
import { useReducedMotion } from "../../useReducedMotion";
import { C, motion, sans, serif } from "../../theme";

type Owned = { vessel: string; edition_no: number | null; acquired_at: string };
type VesselRow = { earned_place?: string | null; id: string; price_mop: number; edition_total: number | null; sort: number };
type SlotRect = { x: number; y: number; width: number; height: number };
/** One vessel on the shelves. `key` is unique even when the same kind appears more than once. */
export type CabinetItem = {
  key: string; kind: VesselKind; owned: boolean;
  editionNo?: number | null; editionTotal?: number | null; acquiredAt?: string; used: number;
  no?: number; stars?: number;
};
type Selection = { item: CabinetItem; rect: SlotRect };
const isVessel = (id: string): id is VesselKind => id in VESSELS;

type Crop = { x: number; y: number; w: number; h: number };
type Piece = { source: ImageSourcePropType; size: { w: number; h: number }; crop: Crop };
/**
 * The cabinet is a crown, one shelf row repeated per row of vessels, and a base (art A3, PR #44).
 * All numbers are art px on the 1024 px wide tiles, as measured in design/art/manifest.json:
 * posts x 25–89 / 935–999, stretch zone x 176–848, row standing surface y 300, plaque face y 300–352,
 * usable x 112–912. Heights: crown 256, row 384, base 192.
 */
const tile = (source: ImageSourcePropType, h: number): Piece => ({ source, size: { w: 1024, h }, crop: { x: 0, y: 0, w: 1024, h } });
const ART = {
  crown: tile(cabinetTiles.crown, 256),
  row: tile(cabinetTiles.row, 384),
  base: tile(cabinetTiles.base, 192),
  cap: 176,          // Left/right edge (posts and brackets) drawn unstretched; the middle stretches.
  inset: 112,        // From each edge to the usable width.
  slot: 800 / 3,     // Width per vessel; a three-column row is exactly 2 × inset + 3 × slot = 1024 wide.
  surface: 300,      // Standing surface inside the row.
  face: [300, 352],  // Board front face, where plaques sit.
};
// Where a vessel's base sits, as a fraction of its square: the manifest's `baseY` (lowest opaque
// row on the 1024 canvas) when present, so new vessels need no Cabinet edit. The table is only a
// fallback for the seven original vessels until the manifest carries `baseY` for them (PR #42).
const legacyBaseY: Partial<Record<string, number>> = {
  dome: 920, bottle: 812, envelope: 814, tin: 776, lantern: 956, musicbox: 818, maison: 784,
};
const baseFraction = (id: VesselKind) =>
  ((vesselParts[id] as { baseY?: number } | undefined)?.baseY ?? legacyBaseY[id] ?? 870) / 1024;

/** Draws a piece at any width: the edge caps keep their shape and the middle stretches sideways. */
function PieceView({ piece, width, height, scale }: { piece: Piece; width: number; height: number; scale: number }) {
  const { crop } = piece;
  const capW = Math.round(ART.cap * scale);
  const sy = height / crop.h;
  const part = (x: number, w: number, left: number, dw: number) => {
    const sx = dw / w;
    return <View key={x} style={{ position: "absolute", left, top: 0, width: dw, height, overflow: "hidden" }}>
      <Image source={piece.source} resizeMode="stretch" style={{
        position: "absolute", left: -(crop.x + x) * sx, top: -crop.y * sy,
        width: piece.size.w * sx, height: piece.size.h * sy,
      }} />
    </View>;
  };
  return <>
    {part(ART.cap, crop.w - 2 * ART.cap, capW - 1, width - 2 * capW + 2)}
    {part(0, ART.cap, 0, capW)}
    {part(crop.w - ART.cap, ART.cap, width - capW, capW)}
  </>;
}

function ShelfSlot({ item, name, selected, left, surface, size, face, slotWidth, parallaxX, parallaxY, reduced, onChoose }: {
  item: CabinetItem; name: string; selected: boolean; left: number; surface: number; size: number;
  face: [number, number]; slotWidth: number; parallaxX: Animated.Value; parallaxY: Animated.Value;
  reduced: boolean; onChoose: (rect: SlotRect) => void;
}) {
  const id = item.kind;
  const [hovered, setHovered] = useState(false);
  const hover = useRef(new Animated.Value(0)).current;
  const pressed = useRef(new Animated.Value(1)).current;
  const vesselRef = useRef<React.ComponentRef<typeof Pressable>>(null);
  const top = surface - size * baseFraction(id);
  const faceHeight = face[1] - face[0];
  const plaqueHeight = Math.max(14, faceHeight - 2);
  const plaqueWidth = Math.min(slotWidth * .82, size + 16);
  const moveHover = (value: number) => {
    Animated.spring(hover, { toValue: value, useNativeDriver: true, ...motion.spring.snappy }).start();
    setHovered(value > 0);
  };
  const movePress = (value: number) => {
    Animated.spring(pressed, { toValue: value, useNativeDriver: true, ...motion.spring.snappy }).start();
  };
  const glassName = id === "bottle" ? "body" : "glass"; // The bottle's glass layer predates the naming rule.
  const glass = vesselParts[id]?.layers.find(layer => layer.name === glassName)?.source ?? null;
  return <>
    <Animated.View pointerEvents="box-none" style={{
      position: "absolute", left: left - size / 2, top, width: size, height: size,
      transform: reduced ? [] : [
        { translateX: parallaxX.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] }) },
        { translateY: parallaxY.interpolate({ inputRange: [-1, 1], outputRange: [-3, 3] }) },
      ],
    }}>
      <Animated.View pointerEvents="none" style={{
        position: "absolute", top: surface - top - 2, left: size * .22, width: size * .56, height: 5,
        borderRadius: 99, backgroundColor: C.ink,
        opacity: hover.interpolate({ inputRange: [0, 1], outputRange: [.20, .10] }),
        transform: [{ scaleX: hover.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }],
      }} />
      <Animated.View style={{
        opacity: selected ? .16 : item.owned ? 1 : .23,
        transform: [
          { translateY: hover.interpolate({ inputRange: [0, 1], outputRange: [0, reduced ? 0 : -6] }) },
          { scale: Animated.multiply(pressed, hover.interpolate({ inputRange: [0, 1], outputRange: [1, reduced ? 1 : 1.05] })) },
        ],
      }}>
        <Pressable ref={vesselRef} disabled={selected} accessibilityRole="button" accessibilityLabel={name}
          onPressIn={() => { void haptics.tick(); movePress(.96); }}
          onPressOut={() => movePress(1)}
          onHoverIn={event => {
            if (Platform.OS === "web" && (event.nativeEvent as any).pointerType !== "touch" && !reduced) moveHover(1);
          }}
          onHoverOut={() => moveHover(0)}
          onPress={() => vesselRef.current?.measureInWindow((x: number, y: number, width: number, height: number) => onChoose({ x, y, width, height }))}
          style={[{ width: size, height: size }, Platform.OS === "web" ? { cursor: "pointer" } as any : null]}>
          <Vessel kind={id} size={size} />
          {glass && Platform.OS === "web" && !reduced && <Animated.Image pointerEvents="none" source={glass}
            resizeMode="contain" style={{ position: "absolute", width: size, height: size,
              opacity: hover.interpolate({ inputRange: [0, 1], outputRange: [0, .13] }),
              transform: [{ translateX: parallaxX.interpolate({ inputRange: [-1, 1], outputRange: [-3, 3] }) }],
            }} />}
        </Pressable>
      </Animated.View>
    </Animated.View>
    <View pointerEvents="none" style={{
      position: "absolute", top: face[0] + (faceHeight - plaqueHeight) / 2, left: left - plaqueWidth / 2,
      width: plaqueWidth, height: plaqueHeight, alignItems: "center", justifyContent: "center",
      borderRadius: 4, backgroundColor: hovered ? "#F9E9BD" : "#F1DFB4",
      borderWidth: 1, borderColor: hovered ? C.brass : "#D4B476", opacity: item.owned ? 1 : .65,
    }}>
      <Text numberOfLines={1} style={{
        fontFamily: sans, fontSize: Math.max(7.5, Math.min(12, plaqueHeight * .55)),
        color: hovered ? C.plum : C.ink, textAlign: "center", paddingHorizontal: 3,
      }}>{name}</Text>
    </View>
  </>;
}

/** The scrolling cabinet itself. Rows are virtualised, so it holds a few vessels or thousands. */
export function CabinetView({ items, notice, error }: { items: CabinetItem[]; notice?: string; error?: string }) {
  const g = useGameText();
  const { t, language } = useLanguage();
  const reduced = useReducedMotion();
  const [selected, setSelected] = useState<Selection | null>(null);
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const width = Math.max(280, Math.min(viewportWidth - (viewportWidth < 700 ? 24 : 48), 960));
  const columns = width < 560 ? 3 : width < 760 ? 4 : 5;
  const scale = width / (2 * ART.inset + ART.slot * columns);
  const rowHeight = Math.round(ART.row.crop.h * scale);
  const sy = rowHeight / ART.row.crop.h;
  const slotWidth = ART.slot * scale;
  const face: [number, number] = [ART.face[0] * sy, ART.face[1] * sy];
  const parallaxX = useRef(new Animated.Value(0)).current;
  const parallaxY = useRef(new Animated.Value(0)).current;
  const fly = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const spinOffset = useRef(0);
  const selectedRef = useRef(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const rows = useMemo(() => Array.from({ length: Math.ceil(items.length / columns) },
    (_, row) => items.slice(row * columns, row * columns + columns)), [items, columns]);

  useEffect(() => {
    if (reduced || Platform.OS === "web") return;
    let sub: { remove: () => void } | undefined;
    let live = true;
    void DeviceMotion.isAvailableAsync().then(available => {
      if (!live || !available) return;
      DeviceMotion.setUpdateInterval(80);
      sub = DeviceMotion.addListener(({ accelerationIncludingGravity: g }) => {
        if (selectedRef.current) return;
        parallaxX.setValue(Math.max(-1, Math.min(1, g.y / 7)));
        parallaxY.setValue(Math.max(-1, Math.min(1, g.x / 7)));
      });
    });
    return () => { live = false; sub?.remove(); };
  }, [reduced, parallaxX, parallaxY]);
  const choose = (item: CabinetItem, rect: SlotRect) => {
    if (!item.owned) { router.push("/shop"); return; }
    selectedRef.current = true;
    fly.setValue(0);
    spin.stopAnimation();
    spin.setValue(0);
    spinOffset.current = 0;
    setSelected({ item, rect });
  };
  useEffect(() => {
    if (!selected) return;
    if (reduced) Animated.timing(fly, { toValue: 1, duration: motion.fade.quick, useNativeDriver: true }).start();
    else Animated.spring(fly, { toValue: 1, useNativeDriver: true, ...motion.spring.soft }).start();
  }, [selected, reduced, fly]);
  const close = () => {
    if (!selectedRef.current) return;
    const done = () => { selectedRef.current = false; setSelected(null); void haptics.tap(); };
    spin.stopAnimation();
    spinOffset.current = 0;
    if (reduced) spin.setValue(0);
    else Animated.spring(spin, { toValue: 0, useNativeDriver: true, ...motion.spring.heavy }).start();
    if (reduced) Animated.timing(fly, { toValue: 0, duration: motion.fade.quick, useNativeDriver: true }).start(done);
    else Animated.spring(fly, { toValue: 0, useNativeDriver: true, ...motion.spring.heavy }).start(done);
  };
  const gesture = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 5,
    onPanResponderGrant: () => { spin.stopAnimation(value => { spinOffset.current = value; }); },
    onPanResponderMove: (_, g) => spin.setValue(spinOffset.current + g.dx * .55),
    onPanResponderRelease: (_, g) => {
      spinOffset.current += g.dx * .55;
      if (!reduced) Animated.decay(spin, { velocity: g.vx * 30, deceleration: .995, useNativeDriver: true }).start();
    },
  }), [reduced, spin]);
  // Expo Go needs a native pan recognizer in the modal's own gesture root.
  // Keep the working web responder and convert native px/s to its px/ms velocity.
  const spinPan = usePanGesture({
    enabled: Platform.OS !== "web" && !reduced,
    minDistance: 5,
    runOnJS: true,
    shouldCancelWhenOutside: false,
    onBegin: () => spin.stopAnimation(value => { spinOffset.current = value; }),
    onUpdate: event => spin.setValue(spinOffset.current + event.translationX * .55),
    onDeactivate: event => {
      if (!event.canceled && !reduced) Animated.decay(spin, {
        velocity: event.velocityX * .03, deceleration: .995, useNativeDriver: true,
      }).start();
    },
  });
  const sel = selected?.item;
  const label = (id: VesselKind) => VESSELS[id];
  const targetTop = Math.max(30, (viewportHeight - 520) / 2);
  const cardWidth = Math.min(viewportWidth - 40, 480);
  const onPointerMove = (event: any) => {
    if (reduced || selectedRef.current || Platform.OS !== "web") return;
    const rect = event.currentTarget?.getBoundingClientRect?.();
    if (!rect) return;
    parallaxX.setValue(Math.max(-1, Math.min(1, ((event.nativeEvent.clientX - rect.left) / rect.width - .5) * 2)));
    parallaxY.setValue(Math.max(-1, Math.min(1, ((event.nativeEvent.clientY - rect.top) / rect.height - .5) * 2)));
  };
  const onPointerLeave = () => {
    if (selectedRef.current) return;
    Animated.spring(parallaxX, { toValue: 0, useNativeDriver: true, ...motion.spring.soft }).start();
    Animated.spring(parallaxY, { toValue: 0, useNativeDriver: true, ...motion.spring.soft }).start();
  };
  const artMotion = reduced ? undefined : { transform: [
    { translateX: parallaxX.interpolate({ inputRange: [-1, 1], outputRange: [-4, 4] }) },
    { translateY: parallaxY.interpolate({ inputRange: [-1, 1], outputRange: [-2, 2] }) },
  ] };
  const piece = (p: Piece, height: number) => <Animated.View pointerEvents="none"
    style={[{ position: "absolute", left: 0, top: 0, width, height }, artMotion]}>
    <PieceView piece={p} width={width} height={height} scale={scale} />
  </Animated.View>;
  const crownHeight = Math.round(ART.crown.crop.h * scale);
  const baseHeight = Math.round(ART.base.crop.h * scale);
  const closeup = sel && selected ? <Animated.View collapsable={false}
    {...(Platform.OS === "web" ? gesture.panHandlers : {})} style={{
      position: "absolute", left: (viewportWidth - 230) / 2, top: targetTop, width: 230, height: 230,
      transform: [
        { translateX: fly.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : selected.rect.x + selected.rect.width / 2 - viewportWidth / 2, 0] }) },
        { translateY: fly.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : selected.rect.y + selected.rect.height / 2 - targetTop - 115, 0] }) },
        { scale: fly.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 1 : selected.rect.width / 230, 1] }) },
        { rotateY: spin.interpolate({ inputRange: [-360, 0, 360], outputRange: ["-360deg", "0deg", "360deg"] }) },
      ], opacity: reduced ? fly : 1,
    }}>
    <Vessel kind={sel.kind} size={230} idle />
  </Animated.View> : null;

  return <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
    <View style={{ flex: 1 }} {...(Platform.OS === "web" ? { onPointerMove, onPointerLeave } : {})}>
      <FlatList data={rows} keyExtractor={(_, index) => String(index)}
        initialNumToRender={8} windowSize={7} maxToRenderPerBatch={8} removeClippedSubviews={Platform.OS === "android"}
        getItemLayout={(_, index) => ({ length: rowHeight, offset: headerHeight + rowHeight * index, index })}
        contentContainerStyle={{ paddingBottom: 32 }}
        ListHeaderComponent={<View style={{ width, alignSelf: "center" }} onLayout={event => setHeaderHeight(event.nativeEvent.layout.height)}>
          <View style={{ paddingTop: 24, paddingBottom: 12, gap: 16, paddingHorizontal: viewportWidth < 700 ? 12 : 0 }}>
            <Bar><BackButton label={t("back")} onPress={goBack} /><Heading>{t("cabinet.title")}</Heading>{GAME_ENABLED && <Pressable accessibilityRole="button" onPress={() => { void haptics.tap(); router.push("/album"); }} style={{ marginLeft: "auto", minHeight: 44, justifyContent: "center" }}><Text style={{ fontFamily: sans, fontSize: 14, color: C.blue }}>{g("albumShort")}</Text></Pressable>}</Bar>
            <Text style={{ fontFamily: sans, color: C.muted }}>{t("cabinet.hint")}</Text>
            {!!notice && <Text style={{ fontFamily: sans, color: C.muted }}>{notice}</Text>}
          </View>
          <View style={{ width, height: crownHeight }}>{piece(ART.crown, crownHeight)}</View>
        </View>}
        ListFooterComponent={<View style={{ width, alignSelf: "center" }}>
          <View style={{ width, height: baseHeight }}>{piece(ART.base, baseHeight)}</View>
          {!!error && <Text style={{ color: C.wax, marginTop: 12 }}>{error}</Text>}
        </View>}
        renderItem={({ item: row }) => <View style={{ width, height: rowHeight, alignSelf: "center" }}>
          {piece(ART.row, rowHeight)}
          {row.map((item, column) => <ShelfSlot key={item.key} item={item} name={label(item.kind).name[language]}
            selected={selected?.item.key === item.key}
            left={(ART.inset + ART.slot * (column + .5)) * scale}
            surface={ART.surface * sy} size={slotWidth * (item.kind === "lantern" ? .78 : .92)}
            face={face} slotWidth={slotWidth} parallaxX={parallaxX} parallaxY={parallaxY} reduced={reduced}
            onChoose={rect => choose(item, rect)} />)}
        </View>} />
    </View>
    <Modal visible={!!selected} transparent animationType="none" onRequestClose={close}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View pointerEvents="none" style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: C.ink, opacity: fly.interpolate({ inputRange: [0, 1], outputRange: [0, .60] }),
        }} />
        <Pressable onPress={close} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} accessibilityLabel={t("cabinet.close")} />
        {sel && selected && <>
          {Platform.OS === "web" ? closeup : <GestureDetector gesture={spinPan}>{closeup}</GestureDetector>}
          <Animated.View accessibilityViewIsModal style={{
            position: "absolute", left: (viewportWidth - cardWidth) / 2, top: targetTop + 212,
            width: cardWidth, maxHeight: Math.max(185, viewportHeight - targetTop - 230),
            borderRadius: 20, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.white,
            transform: [{ translateY: fly.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : 60, 0] }) }],
            opacity: fly,
          }}>
            <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 28, alignItems: "center", gap: 8 }}>
              <Pressable accessibilityRole="button" onPress={close} style={{ alignSelf: "flex-end", minHeight: 44, justifyContent: "center" }}><Text style={{ color: C.blue }}>{t("cabinet.close")}</Text></Pressable>
              <Text style={{ fontFamily: serif, color: C.ink, fontSize: 24, textAlign: "center" }}>{label(sel.kind).name[language]}</Text>
              {!!sel.no && <Text style={{ fontFamily: serif, color: C.brass, letterSpacing: 2 }}>No.{String(sel.no).padStart(3, "0")}{sel.stars ? `  ${"★".repeat(sel.stars)}` : ""}</Text>}
              <Text style={{ fontFamily: sans, color: C.muted, textAlign: "center" }}>{label(sel.kind).desc[language]}</Text>
              {!!sel.editionNo && <Text style={{ color: C.brass, fontFamily: serif }}>{t("cabinet.edition", String(sel.editionNo).padStart(3, "0"), sel.editionTotal)}</Text>}
              {!!sel.acquiredAt && <Text style={{ color: C.muted }}>{t("cabinet.acquired", new Date(sel.acquiredAt).toLocaleDateString(language === "zh" ? "zh-TW" : "en-US"))}</Text>}
              <Text style={{ color: C.muted }}>{t("cabinet.used", sel.used)}</Text>
            </ScrollView>
          </Animated.View>
        </>}
      </GestureHandlerRootView>
    </Modal>
  </SafeAreaView>;
}

export default function CabinetScreen() {
  const { t } = useLanguage();
  const { session } = useAuth();
  const [all, setAll] = useState<VesselRow[]>([]);
  const [owned, setOwned] = useState<Owned[]>([]);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [caught, setCaught] = useState<Record<string, { copies: number; stars: number }>>({});

  useFocusEffect(useCallback(() => {
    let alive = true;
    if (GAME_ENABLED) void game.collection().then(next => { if (alive) setCaught(next); }).catch(() => undefined);
    if (!session) {
      if (__DEV__) setAll(Object.keys(VESSELS).map((id, sort) => {
        const meta = VESSELS[id as VesselKind] as { price: number; edition?: number };
        return { id, price_mop: meta.price, edition_total: meta.edition ?? null, sort };
      }));
      return () => { alive = false; };
    }
    void Promise.all([vessels.list(), vessels.owned(session.user.id), capsules.sent(session.user.id)]).then(([v, o, c]) => {
      if (!alive) return;
      const e = [v, o, c].find(r => r.error)?.error;
      if (e) setError(e.message);
      setAll(v.data ?? []);
      setOwned(o.data ?? []);
      const counts: Record<string, number> = {};
      (c.data ?? []).forEach(item => { counts[item.vessel] = (counts[item.vessel] ?? 0) + 1; });
      setUsage(counts);
    });
    return () => { alive = false; };
  }, [session?.user.id]));
  const items = useMemo(() => {
    const collected = caught;
    // The Cabinet only ever shows what you have; the Capsule Album is where the gaps are.
    return [...all].sort((a, b) => a.sort - b.sort).flatMap((v, index): CabinetItem[] => {
      if (!isVessel(v.id)) return [];
      const own = owned.find(o => o.vessel === v.id);
      if (!isCollected(v, !!own || !!collected[v.id], GAME_ENABLED)) return [];
      return [{
        key: v.id, kind: v.id, owned: true, no: index + 1, stars: collected[v.id]?.stars,
        editionNo: own?.edition_no, editionTotal: v.edition_total, acquiredAt: own?.acquired_at, used: usage[v.id] ?? 0,
      }];
    });
  }, [all, owned, usage, caught]);
  return <CabinetView items={items} error={error}
    notice={session ? undefined : t(__DEV__ ? "cabinet.preview" : "cabinet.signIn")} />;
}
