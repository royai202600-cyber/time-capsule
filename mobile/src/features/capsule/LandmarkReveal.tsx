import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, Pressable, Text, View } from "react-native";
import { Vessel, type VesselKind } from "../../components/Vessel";
import { fxGlint, lightBurst } from "../../art/manifest";
import { haptics } from "../../components/haptics";
import { useReducedMotion } from "../../useReducedMotion";
import { C, sans, serif } from "../../theme";

// Celebrates a landmark vessel earned by opening a capsule at its place: the light opens up,
// a brass passport-style ring stamps down, the vessel rises into it and sparkles, then the card.
const SPARKS = [{ x: -96, y: -70, d: 0 }, { x: 92, y: -88, d: 140 }, { x: 108, y: 40, d: 280 }, { x: -110, y: 52, d: 420 }, { x: 4, y: -120, d: 560 }];
export function LandmarkReveal({ kind, vesselName, placeName, labels, onCabinet, onClose }: {
  kind: VesselKind; vesselName: string; placeName: string;
  labels: { kicker: string; title: string; body: string; cabinet: string; close: string };
  onCabinet: () => void; onClose: () => void;
}) {
  const reduced = useReducedMotion();
  const veil = useRef(new Animated.Value(0)).current, rays = useRef(new Animated.Value(0)).current, spin = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current, rise = useRef(new Animated.Value(0)).current, words = useRef(new Animated.Value(0)).current;
  const sparks = useRef(SPARKS.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    if (reduced) {
      Animated.timing(veil, { toValue: 1, duration: 250, useNativeDriver: true }).start();
      [rays, ring, rise, words].forEach(v => v.setValue(1));
      void haptics.success();
      return;
    }
    const turn = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 16000, easing: Easing.linear, useNativeDriver: true }));
    turn.start();
    const stamp = setTimeout(() => void haptics.thump(), 650);
    const chime = setTimeout(() => void haptics.success(), 1050);
    Animated.sequence([
      Animated.timing(veil, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(rays, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.sequence([Animated.delay(250), Animated.spring(ring, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true })]),
        Animated.sequence([Animated.delay(420), Animated.spring(rise, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true })]),
        Animated.stagger(110, sparks.map(s => Animated.sequence([Animated.delay(700), Animated.timing(s, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true })]))),
        Animated.sequence([Animated.delay(900), Animated.timing(words, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true })]),
      ]),
    ]).start();
    return () => { turn.stop(); clearTimeout(stamp); clearTimeout(chime); };
  }, [reduced, veil, rays, spin, ring, rise, words, sparks]);
  const up = (v: Animated.Value, from = 18) => ({ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }] });
  return <Animated.View accessibilityViewIsModal accessibilityLabel={`${labels.kicker}. ${labels.title} ${vesselName}`}
    style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 50, elevation: 50, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(22,38,63,.62)", opacity: veil }}>
    <View style={{ width: "100%", maxWidth: 360, alignItems: "center", backgroundColor: C.paper, borderRadius: 22, borderWidth: 1.5, borderColor: C.brass, paddingTop: 28, paddingBottom: 22, paddingHorizontal: 22, overflow: "hidden" }}>
      <View style={{ width: 260, height: 240, alignItems: "center", justifyContent: "center" }}>
        <Animated.Image source={lightBurst} resizeMode="contain" style={{ position: "absolute", width: 300, height: 300, opacity: rays.interpolate({ inputRange: [0, 1], outputRange: [0, .9] }),
          transform: [{ scale: rays.interpolate({ inputRange: [0, 1], outputRange: [.4, 1.1] }) }, { rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }} />
        {/* passport-style brass ring that stamps down */}
        <Animated.View style={{ position: "absolute", width: 196, height: 196, borderRadius: 98, borderWidth: 3, borderColor: C.brass, borderStyle: "dashed", backgroundColor: "rgba(201,161,90,.10)",
          opacity: ring, transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1.6, 1] }) }, { rotate: "-8deg" }] }} />
        <Animated.View style={{ opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }, { scale: rise.interpolate({ inputRange: [0, 1], outputRange: [.5, 1] }) }] }}>
          <Vessel kind={kind} size={170} idle />
        </Animated.View>
        {!reduced && SPARKS.map((p, i) => <Animated.Image key={i} source={fxGlint} resizeMode="contain" style={{ position: "absolute", width: 34, height: 34,
          opacity: sparks[i].interpolate({ inputRange: [0, .3, 1], outputRange: [0, 1, 0] }),
          transform: [{ translateX: p.x }, { translateY: p.y }, { scale: sparks[i].interpolate({ inputRange: [0, .3, 1], outputRange: [.2, 1.2, .6] }) }, { rotate: sparks[i].interpolate({ inputRange: [0, 1], outputRange: ["0deg", "60deg"] }) }] }} />)}
      </View>
      <Animated.View style={[{ alignItems: "center", gap: 6, marginTop: 4 }, up(words)]}>
        <Text style={{ color: C.brass, fontFamily: sans, fontSize: 12, letterSpacing: 2 }}>{labels.kicker.toUpperCase()}</Text>
        <Text style={{ color: "#4A5466", fontFamily: sans, fontSize: 14, textAlign: "center" }}>{labels.title}</Text>
        <Text style={{ color: C.ink, fontFamily: serif, fontSize: 24, textAlign: "center" }}>{vesselName}</Text>
        <Text style={{ color: C.muted, fontFamily: sans, fontSize: 13, textAlign: "center", lineHeight: 20, marginTop: 2 }}>{labels.body}</Text>
      </Animated.View>
      <Animated.View style={[{ width: "100%", gap: 10, marginTop: 18 }, up(words, 10)]}>
        <Pressable accessibilityRole="button" onPress={onCabinet} style={({ pressed }) => ({ backgroundColor: C.blue, borderRadius: 14, padding: 15, alignItems: "center", transform: [{ scale: pressed ? .97 : 1 }] })}>
          <Text style={{ color: "white", fontWeight: "700" }}>{labels.cabinet}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onClose} style={{ padding: 10, alignItems: "center" }}>
          <Text style={{ color: C.blue, fontFamily: sans }}>{labels.close}</Text>
        </Pressable>
      </Animated.View>
    </View>
  </Animated.View>;
}
