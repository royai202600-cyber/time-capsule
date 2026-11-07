import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Modal, PanResponder, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { cabinetWall, shelf, vesselParts } from "../../art/manifest";
import { router, useFocusEffect } from "expo-router";
import { goBack } from "../../navigation";
import { DeviceMotion } from "expo-sensors";
import { Vessel, type VesselKind } from "../../components/Vessel";
import { Screen, Heading, Bar, BackButton } from "../../components/Screen";
import { haptics } from "../../components/haptics";
import { useLanguage } from "../../i18n";
import { useAuth } from "../../services/auth";
import { capsules, vessels } from "../../services/data";
import { VESSELS } from "../../i18n/webStrings";
import { useReducedMotion } from "../../useReducedMotion";
import { C, motion, sans, serif } from "../../theme";

type Owned = { vessel: string; edition_no: number | null; acquired_at: string };
type VesselRow = { id: string; price_mop: number; edition_total: number | null; sort: number };
type SlotRect = { x: number; y: number; width: number; height: number };
type Selection = { id: string; rect: SlotRect };
const isVessel = (id: string): id is VesselKind => id in VESSELS;
const boards = [250, 510, 765];
const columns = [287.5, 512.5, 737.5]; // Evenly within x=175–850 on the 1024 px shelf.
// Alpha bounds of the assembled 512 px WebP files, measured at alpha > 32.
const baseY: Record<VesselKind, number> = {
  dome: 460 / 512, bottle: 406 / 512, envelope: 407 / 512,
  tin: 388 / 512, lantern: 478 / 512, musicbox: 409 / 512, maison: 392 / 512,
};

function ShelfSlot({ id, name, isOwned, selected, row, column, scale, parallaxX, parallaxY, reduced, onChoose }: {
  id: VesselKind; name: string; isOwned: boolean; selected: boolean;
  row: number; column: number; scale: number; parallaxX: Animated.Value; parallaxY: Animated.Value;
  reduced: boolean; onChoose: (rect: SlotRect) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const hover = useRef(new Animated.Value(0)).current;
  const pressed = useRef(new Animated.Value(1)).current;
  const vesselRef = useRef<React.ComponentRef<typeof Pressable>>(null);
  const size = (id === "lantern" ? 180 : 220) * scale;
  const surface = boards[row] * scale;
  const top = surface - size * baseY[id];
  const plaqueTop = surface - top + 47 * scale;
  const moveHover = (value: number) => {
    Animated.spring(hover, { toValue: value, useNativeDriver: true, ...motion.spring.snappy }).start();
    setHovered(value > 0);
  };
  const movePress = (value: number) => {
    Animated.spring(pressed, { toValue: value, useNativeDriver: true, ...motion.spring.snappy }).start();
  };
  const glass = id === "dome" ? vesselParts.dome.layers[2].source
    : id === "bottle" ? vesselParts.bottle.layers[2].source : null;
  return <Animated.View pointerEvents="box-none" style={{
    position: "absolute", left: columns[column] * scale - size / 2, top, width: size, height: size + 30,
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
      opacity: selected ? .16 : isOwned ? 1 : .23,
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
        <Vessel kind={id} size={size} idle={isOwned && !selected} />
        {glass && Platform.OS === "web" && !reduced && <Animated.Image pointerEvents="none" source={glass}
          resizeMode="contain" style={{ position: "absolute", width: size, height: size,
            opacity: hover.interpolate({ inputRange: [0, 1], outputRange: [0, .13] }),
            transform: [{ translateX: parallaxX.interpolate({ inputRange: [-1, 1], outputRange: [-3, 3] }) }],
          }} />}
      </Pressable>
    </Animated.View>
    <View pointerEvents="none" style={{
      position: "absolute", top: plaqueTop, left: -6, width: size + 12,
      alignItems: "center", justifyContent: "center", minHeight: 14,
      borderRadius: 4, backgroundColor: hovered ? "#F9E9BD" : "#F1DFB4",
      borderWidth: 1, borderColor: hovered ? C.brass : "#D4B476", opacity: isOwned ? 1 : .65,
    }}>
      <Text numberOfLines={2} style={{
        fontFamily: sans, fontSize: id === "maison" ? 8 : 7.5, lineHeight: 9,
        color: hovered ? C.plum : C.ink, textAlign: "center", paddingHorizontal: 2,
      }}>{name}</Text>
    </View>
  </Animated.View>;
}

export default function CabinetScreen() {
  const { t, language } = useLanguage();
  const { session } = useAuth();
  const reduced = useReducedMotion();
  const [all, setAll] = useState<VesselRow[]>([]);
  const [owned, setOwned] = useState<Owned[]>([]);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Selection | null>(null);
  const [error, setError] = useState("");
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const cabinetWidth = Math.min(viewportWidth - 48, 592);
  const artSize = cabinetWidth - 24;
  const scale = artSize / 1024;
  const parallaxX = useRef(new Animated.Value(0)).current;
  const parallaxY = useRef(new Animated.Value(0)).current;
  const fly = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const spinOffset = useRef(0);
  const selectedRef = useRef(false);

  useFocusEffect(useCallback(() => {
    let alive = true;
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
  const list = useMemo(() => [...all].sort((a, b) => {
    const rank = (v: VesselRow) => v.price_mop === 0 ? 0 : owned.some(o => o.vessel === v.id) ? 1 : 2;
    return rank(a) - rank(b) || a.sort - b.sort;
  }), [all, owned]);
  const choose = (id: string, rect: SlotRect) => {
    const v = all.find(v => v.id === id);
    if (!v) return;
    if (v.price_mop !== 0 && !owned.some(o => o.vessel === id)) { router.push("/shop"); return; }
    selectedRef.current = true;
    fly.setValue(0);
    spin.stopAnimation();
    spin.setValue(0);
    spinOffset.current = 0;
    setSelected({ id, rect });
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
  const sel = all.find(v => v.id === selected?.id);
  const selOwn = owned.find(o => o.vessel === selected?.id);
  const label = (id: string) => isVessel(id) ? VESSELS[id] : null;
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

  return <Screen>
    <Bar><BackButton label={t("back")} onPress={goBack} /><Heading>{t("cabinet.title")}</Heading></Bar>
    <Text style={{ fontFamily: sans, color: C.muted }}>{t("cabinet.hint")}</Text>
    {!session && <Text style={{ fontFamily: sans, color: C.muted }}>{t(__DEV__ ? "cabinet.preview" : "cabinet.signIn")}</Text>}
    <View style={{ width: cabinetWidth, alignSelf: "center", borderRadius: 20, borderWidth: 2, borderColor: C.wood, overflow: "hidden" }}
      {...(Platform.OS === "web" ? { onPointerMove, onPointerLeave } : {})}>
      {Array.from({ length: Math.ceil(list.length / 9) }, (_, group) => <View key={group} style={{ width: cabinetWidth - 4, height: artSize + 24 }}>
        <Animated.Image pointerEvents="none" source={cabinetWall} resizeMode="cover" style={{
          position: "absolute", left: -6, top: -6, width: cabinetWidth + 8, height: artSize + 36,
          transform: reduced ? [] : [
            { translateX: parallaxX.interpolate({ inputRange: [-1, 1], outputRange: [-2, 2] }) },
            { translateY: parallaxY.interpolate({ inputRange: [-1, 1], outputRange: [-2, 2] }) },
          ],
        }} />
        <View style={{ position: "absolute", left: 10, top: 10, width: artSize, height: artSize }}>
          <Animated.Image pointerEvents="none" source={shelf} resizeMode="contain" style={{
            width: artSize, height: artSize,
            transform: reduced ? [] : [
              { translateX: parallaxX.interpolate({ inputRange: [-1, 1], outputRange: [-4, 4] }) },
              { translateY: parallaxY.interpolate({ inputRange: [-1, 1], outputRange: [-2, 2] }) },
            ],
          }} />
          {boards.flatMap((_, row) => columns.map((__, column) => {
            const v = list[group * 9 + row * 3 + column];
            if (!v || !isVessel(v.id)) return null;
            return <ShelfSlot key={v.id} id={v.id} name={label(v.id)?.name[language] ?? v.id}
              isOwned={v.price_mop === 0 || owned.some(o => o.vessel === v.id)}
              selected={selected?.id === v.id} row={row} column={column} scale={scale}
              parallaxX={parallaxX} parallaxY={parallaxY} reduced={reduced}
              onChoose={rect => choose(v.id, rect)} />;
          }))}
        </View>
      </View>)}
    </View>
    {!!error && <Text style={{ color: C.wax }}>{error}</Text>}
    <Modal visible={!!sel && !!selected} transparent animationType="none" onRequestClose={close}>
      <View style={{ flex: 1 }}>
        <Animated.View pointerEvents="none" style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: C.ink, opacity: fly.interpolate({ inputRange: [0, 1], outputRange: [0, .60] }),
        }} />
        <Pressable onPress={close} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} accessibilityLabel={t("cabinet.close")} />
        {sel && selected && isVessel(selected.id) && <>
          <Animated.View {...gesture.panHandlers} style={{
            position: "absolute", left: (viewportWidth - 230) / 2, top: targetTop, width: 230, height: 230,
            transform: [
              { translateX: fly.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : selected.rect.x + selected.rect.width / 2 - viewportWidth / 2, 0] }) },
              { translateY: fly.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : selected.rect.y + selected.rect.height / 2 - targetTop - 115, 0] }) },
              { scale: fly.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 1 : selected.rect.width / 230, 1] }) },
              { rotateY: spin.interpolate({ inputRange: [-360, 0, 360], outputRange: ["-360deg", "0deg", "360deg"] }) },
            ], opacity: reduced ? fly : 1,
          }}>
            <Vessel kind={selected.id} size={230} idle />
          </Animated.View>
          <Animated.View accessibilityViewIsModal style={{
            position: "absolute", left: (viewportWidth - cardWidth) / 2, top: targetTop + 212,
            width: cardWidth, maxHeight: Math.max(185, viewportHeight - targetTop - 230),
            borderRadius: 20, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.white,
            transform: [{ translateY: fly.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : 60, 0] }) }],
            opacity: fly,
          }}>
            <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 28, alignItems: "center", gap: 8 }}>
              <Pressable accessibilityRole="button" onPress={close} style={{ alignSelf: "flex-end", minHeight: 44, justifyContent: "center" }}><Text style={{ color: C.blue }}>{t("cabinet.close")}</Text></Pressable>
              <Text style={{ fontFamily: serif, color: C.ink, fontSize: 24, textAlign: "center" }}>{label(selected.id)?.name[language] ?? selected.id}</Text>
              <Text style={{ fontFamily: sans, color: C.muted, textAlign: "center" }}>{label(selected.id)?.desc[language]}</Text>
              {!!selOwn?.edition_no && <Text style={{ color: C.brass, fontFamily: serif }}>{t("cabinet.edition", String(selOwn.edition_no).padStart(3, "0"), sel.edition_total)}</Text>}
              {!!selOwn?.acquired_at && <Text style={{ color: C.muted }}>{t("cabinet.acquired", new Date(selOwn.acquired_at).toLocaleDateString(language === "zh" ? "zh-TW" : "en-US"))}</Text>}
              <Text style={{ color: C.muted }}>{t("cabinet.used", usage[selected.id] ?? 0)}</Text>
            </ScrollView>
          </Animated.View>
        </>}
      </View>
    </Modal>
  </Screen>;
}
