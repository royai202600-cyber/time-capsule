import React, { useEffect, useMemo, useState } from "react";
import { Animated, Image, Modal, Pressable, ScrollView, Text, View, type ImageSourcePropType } from "react-native";
import { ArtIcon } from '../../components/ArtIcon';
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as manifest from "../../art/manifest";
import type { Tables } from "../../services/database.types";
import { haptics } from "../../components/haptics";
import { useReducedMotion } from "../../useReducedMotion";
import { useLanguage } from "../../i18n";
import { PrivateStampMark } from "../hunt/PrivateHuntViews";
import { C, motion, radii, sans, serif, shadows, spacing } from "../../theme";

type Place = Tables<"places">;
type Stamp = { place: Place; openedAt: string | null };
const art = manifest as typeof manifest & { passportCover?: ImageSourcePropType; passportPage?: ImageSourcePropType; stamps?: Record<string, ImageSourcePropType> };
export function Passport({ visible, onClose, userId, stamps, hunts = [], privateHunts = [] }: {
  visible: boolean;
  onClose: () => void;
  userId: string;
  stamps: Stamp[];
  /** City Hunt stamps, one per finished hunt. */
  hunts?: { id: string; name_zh: string; name_en: string; at: string }[];
  /** Private hunt stamps, in their own brass section (docs/design/city-orienteering.md). */
  privateHunts?: { id: string; name: string; at: string }[];
}) {
  const { t, language } = useLanguage();
  const reduced = useReducedMotion();
  const [shown, setShown] = useState<string[] | null>(null);
  const key = `tc-passport-shown-${userId}`;
  useEffect(() => {
    if (!visible || !userId) return;
    let active = true;
    void AsyncStorage.getItem(key).then((value) => {
      if (active) setShown(value ? JSON.parse(value) : []);
    }).catch(() => { if (active) setShown([]); });
    return () => { active = false; };
  }, [visible, key, userId]);
  const remember = (id: string) => {
    setShown((old) => {
      const next = Array.from(new Set([...(old ?? []), id]));
      void AsyncStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  };
  const earned = stamps.filter((s) => s.openedAt && !s.place.brand_vessel).length;
  const total = stamps.filter((s) => !s.place.brand_vessel).length;
  return <Modal visible={visible} transparent animationType={reduced ? "fade" : "slide"} onRequestClose={onClose}>
    <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "#16263F77" }}>
      <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel={t("journey.closePassport")} />
      <View style={{ maxHeight: "82%", width: "100%", maxWidth: 640, alignSelf: "center", backgroundColor: C.cream, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, borderWidth: 2, borderColor: C.brass, overflow: "hidden" }}>
        <View style={{ padding: spacing.lg, minHeight: 150, backgroundColor: C.ink, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", overflow: 'hidden' }}>
          <Image source={art.passportCover} pointerEvents="none" resizeMode="stretch" style={{ position: 'absolute', width: '110%', aspectRatio: 2 / 3, left: '-5%', top: -170 }} />
          <View><Text style={{ fontFamily: serif, fontSize: 25, color: C.brass }}>{t("journey.passport")}</Text><Text style={{ fontFamily: sans, color: C.cream }}>{t("journey.stampCount", earned, total)}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel={t("journey.closePassport")} onPress={onClose} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><ArtIcon name="close" color={C.white} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.md, flexDirection: "row", flexWrap: "wrap", gap: spacing.md, backgroundColor: C.cream }}>
          <Image source={art.passportPage} resizeMode="stretch" pointerEvents="none" style={{ position: 'absolute', width: '100%', height: '100%' }} />
          {shown !== null && stamps.map((stamp) => <StampSlot key={stamp.place.id} stamp={stamp} language={language} animate={!!stamp.openedAt && !shown.includes(stamp.place.id)} reduced={reduced} onStamped={() => remember(stamp.place.id)} />)}
          {shown !== null && hunts.length > 0 && <Text style={{ width: "100%", fontFamily: serif, fontSize: 17, color: C.plum, marginTop: spacing.sm }}>{t("journey.huntStamps")}</Text>}
          {shown !== null && hunts.map((hunt) => <HuntStamp key={hunt.id} hunt={hunt} language={language} />)}
          {shown !== null && privateHunts.length > 0 && <Text style={{ width: "100%", fontFamily: serif, fontSize: 17, color: "#A9843F", marginTop: spacing.sm }}>{t("journey.privateHuntStamps")}</Text>}
          {shown !== null && privateHunts.map((hunt) => <PrivateHuntStamp key={hunt.id} hunt={hunt} language={language} />)}
        </ScrollView>
      </View>
    </View>
  </Modal>;
}
function StampSlot({ stamp, language, animate, reduced, onStamped }: {
  stamp: Stamp;
  language: "zh" | "en";
  animate: boolean;
  reduced: boolean;
  onStamped: () => void;
}) {
  const { t } = useLanguage();
  const scale = useMemo(() => new Animated.Value(animate && !reduced ? 2.5 : 1), []);
  const opacity = useMemo(() => new Animated.Value(animate ? 0 : 1), []);
  const ink = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    if (!stamp.openedAt || !animate) return;
    if (reduced) {
      Animated.timing(opacity, { toValue: 1, duration: motion.fade.quick, useNativeDriver: true }).start(() => onStamped());
      return;
    }
    scale.setValue(2.5);
    opacity.setValue(0);
    ink.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, damping: motion.spring.heavy.damping, stiffness: motion.spring.heavy.stiffness, mass: motion.spring.heavy.mass, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 230, useNativeDriver: true }),
      Animated.timing(ink, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start(({ finished }) => { if (finished) { void haptics.thump(); onStamped(); } });
  }, [animate, reduced, stamp.openedAt]);
  const name = language === "zh" ? stamp.place.name_zh : stamp.place.name_en;
  const source = art.stamps?.[stamp.place.id];
  return <View style={{ width: "47%", minHeight: 152, borderWidth: 1, borderColor: C.brass, borderStyle: "dashed", borderRadius: radii.md, padding: spacing.sm, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF9EA", ...shadows.card }}>
    {stamp.openedAt ? <View style={{ width: 86, height: 86 }}>
      {animate && !reduced && <Animated.View style={{ position: "absolute", width: 86, height: 86, borderRadius: 43, borderWidth: 5, borderColor: C.plum, opacity: ink.interpolate({ inputRange: [0, 1], outputRange: [.45, 0] }), transform: [{ scale: ink.interpolate({ inputRange: [0, 1], outputRange: [.7, 1.6] }) }] }} />}
      <Animated.View style={{ opacity, transform: [{ scale }, { rotate: stamp.place.sort % 2 ? "-5deg" : "5deg" }], width: 86, height: 86, borderRadius: 43, borderWidth: 3, borderColor: C.plum, justifyContent: "center", alignItems: "center" }}>
        {source ? <Image source={source} style={{ width: 76, height: 76 }} resizeMode="contain" /> : <ArtIcon name="check" color={C.plum} size={32} />}
      </Animated.View>
    </View> : <View style={{ width: 86, height: 86, borderRadius: 43, borderWidth: 2, borderColor: C.line, borderStyle: "dashed", alignItems: "center", justifyContent: "center" }}><ArtIcon name="pin" color={C.muted} /></View>}
    <Text numberOfLines={2} style={{ fontFamily: serif, color: C.ink, textAlign: "center", marginTop: spacing.sm }}>{name}</Text>
    {stamp.openedAt && <Text style={{ fontFamily: sans, color: C.muted, fontSize: 11 }}>{new Date(stamp.openedAt).toLocaleDateString(language === "zh" ? "zh-Hant" : "en-US")}</Text>}
    {stamp.place.brand_vessel && <Text style={{ fontFamily: sans, color: C.brass, fontSize: 10 }}>{t("journey.brandStamp")}</Text>}
  </View>;
}

/** A private hunt's stamp is brass and carries the organizer's own name for the hunt. */
function PrivateHuntStamp({ hunt, language }: { hunt: { id: string; name: string; at: string }; language: "zh" | "en" }) {
  const source = art.stamps?.["private-hunt"];
  return <View style={{ width: "47%", minHeight: 152, borderWidth: 1, borderColor: C.brass, borderStyle: "dashed", borderRadius: radii.md, padding: spacing.sm, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF9EA", ...shadows.card }}>
    <View style={{ width: 86, height: 86, alignItems: "center", justifyContent: "center", transform: [{ rotate: "4deg" }] }}>
      {source ? <Image source={source} style={{ width: 80, height: 80 }} resizeMode="contain" /> : <PrivateStampMark size={82} />}
    </View>
    <Text numberOfLines={2} style={{ fontFamily: serif, color: C.ink, textAlign: "center", marginTop: spacing.sm }}>{hunt.name}</Text>
    <Text style={{ fontFamily: sans, color: C.muted, fontSize: 11 }}>{new Date(hunt.at).toLocaleDateString(language === "zh" ? "zh-Hant" : "en-US")}</Text>
  </View>;
}

function HuntStamp({ hunt, language }: { hunt: { id: string; name_zh: string; name_en: string; at: string }; language: "zh" | "en" }) {
  const source = art.stamps?.[`hunt-${hunt.id}`];
  return <View style={{ width: "47%", minHeight: 152, borderWidth: 1, borderColor: C.brass, borderStyle: "dashed", borderRadius: radii.md, padding: spacing.sm, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF9EA", ...shadows.card }}>
    <View style={{ width: 86, height: 86, borderRadius: 43, borderWidth: 3, borderColor: C.wax, justifyContent: "center", alignItems: "center", transform: [{ rotate: "-4deg" }] }}>
      {source ? <Image source={source} style={{ width: 76, height: 76 }} resizeMode="contain" /> : <ArtIcon name="quest" color={C.wax} size={34} />}
    </View>
    <Text numberOfLines={2} style={{ fontFamily: serif, color: C.ink, textAlign: "center", marginTop: spacing.sm }}>{language === "zh" ? hunt.name_zh : hunt.name_en}</Text>
    <Text style={{ fontFamily: sans, color: C.muted, fontSize: 11 }}>{new Date(hunt.at).toLocaleDateString(language === "zh" ? "zh-Hant" : "en-US")}</Text>
  </View>;
}
