import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Image, ImageBackground, Modal, PanResponder, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { cabinetWall, shelf } from '../../art/manifest';
import { router, useFocusEffect } from "expo-router";
import { DeviceMotion } from "expo-sensors";
import { Vessel, type VesselKind } from "../../components/Vessel";
import { Screen, Heading, Button, Bar, BackButton } from "../../components/Screen";
import { haptics } from "../../components/haptics";
import { useLanguage } from "../../i18n";
import { useAuth } from "../../services/auth";
import { capsules, vessels } from "../../services/data";
import { VESSELS } from "../../i18n/webStrings";
import { useReducedMotion } from "../../useReducedMotion";
import { C, motion, sans, serif } from "../../theme";
type Owned = { vessel: string; edition_no: number | null; acquired_at: string };
type VesselRow = { id: string; price_mop: number; edition_total: number | null; sort: number };
const key = (id: string): id is VesselKind => id in VESSELS;
export default function CabinetScreen() {
  const { t, language } = useLanguage();
  const { session } = useAuth();
  const reduced = useReducedMotion();
  const [all, setAll] = useState<VesselRow[]>([]);
  const [owned, setOwned] = useState<Owned[]>([]);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const { width: viewportWidth } = useWindowDimensions();
  const shelfWidth = Math.min(viewportWidth - 48, 592);
  const lift = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const spinOffset = useRef(0);
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
      sub = DeviceMotion.addListener(({ accelerationIncludingGravity: g }) => setTilt(p => ({
        x: p.x * 0.72 + Math.max(-1, Math.min(1, g.x / 7)) * 0.28,
        y: p.y * 0.72 + Math.max(-1, Math.min(1, g.y / 7)) * 0.28,
      })));
    });
    return () => { live = false; sub?.remove(); };
  }, [reduced]);
  const list = useMemo(() => [...all].sort((a, b) => {
    const rank = (v: VesselRow) => v.price_mop === 0 ? 0 : owned.some(o => o.vessel === v.id) ? 1 : 2;
    return rank(a) - rank(b) || a.sort - b.sort;
  }), [all, owned]);
  const choose = (id: string) => {
    const v = all.find(v => v.id === id);
    if (!v) return;
    if (v.price_mop !== 0 && !owned.some(o => o.vessel === id)) { router.push("/shop"); return; }
    haptics.tick();
    spin.stopAnimation(value => { spinOffset.current = value; });
    setSelected(id);
    if (reduced) Animated.timing(lift, { toValue: 1, duration: motion.fade.quick, useNativeDriver: true }).start();
    else Animated.spring(lift, { toValue: 1, useNativeDriver: true, ...motion.spring.soft }).start();
  };
  const close = () => {
    const done = () => setSelected(null);
    if (reduced) Animated.timing(lift, { toValue: 0, duration: motion.fade.quick, useNativeDriver: true }).start(done);
    else Animated.spring(lift, { toValue: 0, useNativeDriver: true, ...motion.spring.soft }).start(done);
  };
  const gesture = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 5,
    onPanResponderGrant: () => { spin.stopAnimation(value => { spinOffset.current = value; }); },
    onPanResponderMove: (_, g) => spin.setValue(spinOffset.current + g.dx * 0.55),
    onPanResponderRelease: (_, g) => {
      spinOffset.current += g.dx * 0.55;
      if (!reduced) Animated.decay(spin, { velocity: g.vx * 30, deceleration: 0.995, useNativeDriver: true }).start();
    },
  }), [reduced, spin]);
  const sel = all.find(v => v.id === selected);
  const selOwn = owned.find(o => o.vessel === selected);
  const label = (id: string) => key(id) ? VESSELS[id] : null;
  return <Screen>
    <Bar><BackButton label={t("back")} onPress={() => router.back()} /><Heading>{t("cabinet.title")}</Heading></Bar>
    <Text style={{ fontFamily: sans, color: C.muted }}>{t("cabinet.hint")}</Text>
    {!session && <Text style={{ fontFamily: sans, color: C.muted }}>{t(__DEV__ ? "cabinet.preview" : "cabinet.signIn")}</Text>}
    <ImageBackground source={cabinetWall} resizeMode="stretch" style={{ borderRadius: 20, borderWidth: 2, borderColor: C.wood, paddingHorizontal: 12, overflow: "hidden", transform: reduced ? [] : [{ translateX: tilt.y * 6 }, { translateY: tilt.x * 4 }] }}>
      {Array.from({ length: Math.ceil(list.length / 9) }, (_, group) => <View key={group} style={{ height: shelfWidth + 36 }}>
        <Image source={shelf} resizeMode="stretch" style={{ position: 'absolute', top: 60, width: '100%', height: shelfWidth - 24 }} />
        {[225, 488, 743].map((boardY, row) => <View key={row} style={{ position: 'absolute', top: 60 + (shelfWidth - 24) * boardY / 1024 - 110, left: '15%', right: '15%', height: 105, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around" }}>
          {list.slice(group * 9 + row * 3, group * 9 + row * 3 + 3).map(v => {
            const isOwned = v.price_mop === 0 || owned.some(o => o.vessel === v.id);
            return <Pressable key={v.id} accessibilityRole="button" accessibilityLabel={label(v.id)?.name[language] ?? v.id} onPress={() => choose(v.id)} style={{ width: "33%", alignItems: "center", opacity: isOwned ? 1 : 0.23, transform: reduced ? [] : [{ translateX: tilt.y * (isOwned ? 10 : 3) }] }}>
              {key(v.id) && <Vessel kind={v.id} size={Math.min(82, (shelfWidth - 24) * .24)} />}
              <Text numberOfLines={2} style={{ color: C.ink, fontFamily: sans, fontSize: v.id === 'maison' ? 9 : 10, lineHeight: 11, textAlign: "center" }}>{label(v.id)?.name[language] ?? v.id}</Text>
              {!isOwned && <Text style={{ color: C.plum, fontSize: 11 }}>{t("cabinet.shop")}</Text>}
            </Pressable>;
          })}
        </View>)}
      </View>)}
    </ImageBackground>
    {!!error && <Text style={{ color: C.wax }}>{error}</Text>}
    <Modal visible={!!sel && !!selected} transparent animationType="fade" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: "rgba(22,38,63,0.60)", justifyContent: "center", alignItems: "center", padding: 20 }}>
        <ScrollView style={{ width: "100%", maxWidth: 480, flexGrow: 0 }} contentContainerStyle={{ justifyContent: "center" }}>
          {sel && selected && <View accessibilityViewIsModal style={{ width: "100%", borderRadius: 20, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.white, padding: 18, alignItems: "center", gap: 8 }}>
            <Pressable accessibilityRole="button" onPress={close} style={{ alignSelf: "flex-end" }}><Text style={{ color: C.blue }}>{t("cabinet.close")}</Text></Pressable>
            <Animated.View {...gesture.panHandlers} style={{ transform: [{ translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }, { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }, { rotateY: spin.interpolate({ inputRange: [-360, 0, 360], outputRange: ["-360deg", "0deg", "360deg"] }) }] }}>
              {key(selected) && <Vessel kind={selected} size={230} />}
            </Animated.View>
            <Text style={{ fontFamily: serif, color: C.ink, fontSize: 24 }}>{label(selected)?.name[language] ?? selected}</Text>
            <Text style={{ fontFamily: sans, color: C.muted, textAlign: "center" }}>{label(selected)?.desc[language]}</Text>
            {!!selOwn?.edition_no && <Text style={{ color: C.brass, fontFamily: serif }}>{t("cabinet.edition", String(selOwn.edition_no).padStart(3, "0"), sel.edition_total)}</Text>}
            {!!selOwn?.acquired_at && <Text style={{ color: C.muted }}>{t("cabinet.acquired", new Date(selOwn.acquired_at).toLocaleDateString(language === "zh" ? "zh-TW" : "en-US"))}</Text>}
            <Text style={{ color: C.muted }}>{t("cabinet.used", usage[selected] ?? 0)}</Text>
          </View>}
        </ScrollView>
      </View>
    </Modal>
  </Screen>;
}
