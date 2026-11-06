import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Image, PanResponder, Pressable, Text, View, type ImageSourcePropType, type LayoutChangeEvent } from "react-native";
import Svg, { Path } from "react-native-svg";
import * as manifest from "../../art/manifest";
import type { Tables } from "../../services/database.types";
import { Vessel, type VesselKind } from "../../components/Vessel";
import { C, motion, sans, shadows } from "../../theme";
import type { Fix } from "./location";
import { useReducedMotion } from "../../useReducedMotion";

export type JourneyPin = { place: Tables<"places">; kind: "visited" | "waiting" | "other"; vessel?: string };
const W = 900, H = 670;
const point = (lat: number, lng: number) => ({ x: (lng - 92) / 55 * W, y: (47 - lat) / 55 * H });
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const art = manifest as typeof manifest & { mapAsia?: ImageSourcePropType };

export function JourneyMap({ pins, fix, onSelect }: {
  pins: JourneyPin[];
  fix: Fix | null;
  onSelect: (pin: JourneyPin) => void;
}) {
  const [viewport, setViewport] = useState({ width: 360, height: 490 });
  const [transform, setTransform] = useState({ x: -200, y: -100, scale: .8 });
  const live = useRef(transform);
  const gesture = useRef({ x: 0, y: 0, scale: 1, span: 0 });
  const centered = useRef(false);
  const set = (value: typeof transform) => { live.current = value; setTransform(value); };
  useEffect(() => {
    if (centered.current || viewport.width < 1) return;
    const target = fix ? point(fix.lat, fix.lng) : point(24, 121);
    const scale = .8;
    set({ x: viewport.width / 2 - clamp(target.x, 0, W) * scale, y: viewport.height / 2 - clamp(target.y, 0, H) * scale, scale });
    if (fix) centered.current = true;
  }, [fix?.lat, fix?.lng, viewport.width, viewport.height]);
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4 || g.numberActiveTouches > 1,
    onPanResponderGrant: (e) => {
      const a = live.current;
      const touches = e.nativeEvent.touches;
      const span = touches.length > 1 ? Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY) : 0;
      gesture.current = { ...a, span };
    },
    onPanResponderMove: (e, g) => {
      const start = gesture.current;
      const touches = e.nativeEvent.touches;
      let scale = start.scale;
      if (touches.length > 1 && start.span > 0) {
        const span = Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
        scale = clamp(start.scale * span / start.span, .55, 2.4);
      }
      set({
        x: clamp(start.x + g.dx - (scale - start.scale) * W / 2, viewport.width - W * scale - 40, 40),
        y: clamp(start.y + g.dy - (scale - start.scale) * H / 2, viewport.height - H * scale - 40, 40),
        scale,
      });
    },
  }), [viewport.width, viewport.height]);
  const layout = (e: LayoutChangeEvent) => setViewport(e.nativeEvent.layout);
  return <View onLayout={layout} style={{ flex: 1, overflow: "hidden", backgroundColor: C.glass, borderRadius: 20, borderWidth: 1, borderColor: C.line }} {...pan.panHandlers}>
    <View style={{ width: W, height: H, transformOrigin: "top left", transform: [{ translateX: transform.x }, { translateY: transform.y }, { scale: transform.scale }] }}>
      {art.mapAsia ? <Image source={art.mapAsia} style={{ width: W, height: H }} resizeMode="stretch" /> : <MapPlaceholder />}
      {pins.map((pin) => {
        const { x, y } = point(pin.place.lat, pin.place.lng);
        return <Pressable key={pin.place.id} accessibilityRole="button" onPress={() => onSelect(pin)} style={{ position: "absolute", left: x - 25, top: y - 25, width: 50, height: 50, borderRadius: 25, borderWidth: pin.kind === "other" ? 2 : 1, borderColor: pin.kind === "visited" ? C.brass : C.blue, backgroundColor: pin.kind === "other" ? C.white : C.cream, alignItems: "center", justifyContent: "center", ...shadows.card }}>
          <PinGlyph pin={pin} />
        </Pressable>;
      })}
      {fix && <View style={{ position: "absolute", left: point(fix.lat, fix.lng).x - 7, top: point(fix.lat, fix.lng).y - 7, width: 14, height: 14, backgroundColor: C.lightBlue, borderWidth: 2, borderColor: C.white, borderRadius: 7 }} />}
    </View>
  </View>;
}
function PinGlyph({ pin }: { pin: JourneyPin }) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (pin.kind !== "waiting" || reduced) return;
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(scale, { toValue: motion.breathe.scale, duration: motion.breathe.duration / 2, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: motion.breathe.duration / 2, useNativeDriver: true }),
    ]));
    pulse.start();
    return () => pulse.stop();
  }, [pin.kind, reduced, scale]);
  if (pin.kind === "visited") return <Text style={{ fontFamily: sans, color: C.plum, fontSize: 25 }}>✦</Text>;
  if (pin.kind === "other") return <Text style={{ color: C.blue, fontSize: 25 }}>⌖</Text>;
  return <Animated.View style={{ transform: [{ scale }] }}><Vessel kind={(pin.vessel ?? "dome") as VesselKind} size={35} /></Animated.View>;
}
function MapPlaceholder() {
  return <View style={{ width: W, height: H, backgroundColor: "#DCE8F2" }}>
    <Svg width={W} height={H} viewBox="0 0 900 670">
      <Path d="M0 0H900V135L825 136L810 175L760 184L725 165L667 189L650 220L602 227L571 202L546 218L515 196L492 155L440 151L406 174L362 164L338 183L310 197L287 178L260 215L225 231L193 260L158 267L120 304L105 349L71 369L48 337L0 327Z" fill="#C7D9C8" stroke="#9FB9AF" strokeWidth="3" />
      <Path d="M91 346L123 363L143 407L151 452L187 485L193 539L178 558L157 512L132 481L119 443L91 416Z M384 336L412 348L427 395L455 412L470 443L491 463L476 490L445 472L419 437L388 420Z M486 385L518 397L541 430L532 467L509 446Z M542 462L570 471L596 502L581 529L553 518Z M595 502L626 514L651 539L643 565L615 553Z M686 458L729 467L750 503L733 525L703 510Z" fill="#C7D9C8" stroke="#9FB9AF" strokeWidth="3" />
      <Path d="M755 260L780 281L774 328L743 347L725 319Z M793 337L812 354L804 381L786 369Z" fill="#C7D9C8" stroke="#9FB9AF" strokeWidth="3" />
    </Svg>
  </View>;
}
