import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Image, PanResponder, Pressable, Text, View, type ImageSourcePropType, type LayoutChangeEvent } from "react-native";
import Svg, { Path } from "react-native-svg";
import * as manifest from "../../art/manifest";
import type { Tables } from "../../services/database.types";
import { Vessel, type VesselKind } from "../../components/Vessel";
import { C, motion, sans, shadows } from "../../theme";
import type { Fix } from "./location";
import { useReducedMotion } from "../../useReducedMotion";
import { useLanguage } from "../../i18n";
import { haptics } from "../../components/haptics";
import { clusterPins, mapPoint, nextClusterScale, MAP_HEIGHT, MAP_WIDTH, MAX_MAP_SCALE } from "./pinClusters";

export type JourneyPin = { place: Tables<"places">; kind: "visited" | "waiting" | "other"; vessel?: string; waiting?: boolean };
const W = MAP_WIDTH, H = MAP_HEIGHT;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const art = manifest as typeof manifest & { mapAsia?: ImageSourcePropType };

export function JourneyMap({ pins, fix, onSelect }: {
  pins: JourneyPin[];
  fix: Fix | null;
  onSelect: (pin: JourneyPin) => void;
}) {
  const [viewport, setViewport] = useState({ width: 360, height: 490 });
  const [transform, setTransform] = useState({ x: -200, y: -100, scale: .8 });
  const reduced = useReducedMotion();
  const { t } = useLanguage();
  const live = useRef(transform);
  const gesture = useRef({ x: 0, y: 0, scale: 1, span: 0 });
  const centered = useRef(false);
  const fade = useRef(new Animated.Value(1)).current;
  const stopZoom = useRef<(() => void) | null>(null);
  const set = (value: typeof transform) => { live.current = value; setTransform(value); };
  const groups = useMemo(() => clusterPins(pins, transform.scale), [pins, transform.scale]);
  useEffect(() => {
    if (centered.current || viewport.width < 1) return;
    const target = fix ? mapPoint(fix.lat, fix.lng) : mapPoint(24, 121);
    const scale = .8;
    set({ x: viewport.width / 2 - clamp(target.x, 0, W) * scale, y: viewport.height / 2 - clamp(target.y, 0, H) * scale, scale });
    if (fix) centered.current = true;
  }, [fix?.lat, fix?.lng, viewport.width, viewport.height]);
  useEffect(() => () => stopZoom.current?.(), []);
  const zoomTo = (x: number, y: number, scale: number) => {
    stopZoom.current?.();
    const next = {
      x: clamp(viewport.width / 2 - x * scale, viewport.width - W * scale - 40, 40),
      y: clamp(viewport.height / 2 - y * scale, viewport.height - H * scale - 40, 40),
      scale,
    };
    if (reduced) {
      fade.setValue(0);
      set(next);
      Animated.timing(fade, { toValue: 1, duration: motion.fade.quick, useNativeDriver: true }).start();
      return;
    }
    const from = live.current;
    const progress = new Animated.Value(0);
    const listener = progress.addListener(({ value }) => set({
      x: from.x + (next.x - from.x) * value,
      y: from.y + (next.y - from.y) * value,
      scale: from.scale + (next.scale - from.scale) * value,
    }));
    const animation = Animated.spring(progress, { toValue: 1, ...motion.spring.soft, useNativeDriver: false });
    const stop = () => { animation.stop(); progress.removeListener(listener); };
    stopZoom.current = stop;
    animation.start(({ finished }) => {
      progress.removeListener(listener);
      if (finished) set(next);
      if (stopZoom.current === stop) stopZoom.current = null;
    });
  };
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4 || g.numberActiveTouches > 1,
    onPanResponderGrant: (e) => {
      stopZoom.current?.();
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
        scale = clamp(start.scale * span / start.span, .55, MAX_MAP_SCALE);
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
    <Animated.View pointerEvents="none" style={{ width: W, height: H, opacity: fade, transformOrigin: "top left", transform: [{ translateX: transform.x }, { translateY: transform.y }, { scale: transform.scale }] }}>
      {art.mapAsia ? <Image source={art.mapAsia} style={{ width: W, height: H }} resizeMode="stretch" /> : <MapPlaceholder />}
    </Animated.View>
    <Animated.View pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: fade }}>
      {groups.map((group) => {
        const clustered = group.pins.length > 1;
        const waiting = group.pins.some((pin) => pin.waiting || pin.kind === "waiting");
        const pin = group.pins[0];
        const size = 50;
        return <Pressable key={group.id} accessibilityRole="button"
          accessibilityLabel={clustered ? t("journey.clusterCount", group.pins.length) : (t("journey.pinAt", pin.place.name_zh, pin.place.name_en))}
          onPress={() => {
            if (clustered) {
              void haptics.tick();
              zoomTo(group.x, group.y, nextClusterScale(group, live.current.scale));
            } else onSelect(pin);
          }}
          style={{ position: "absolute", left: transform.x + group.x * transform.scale - size / 2, top: transform.y + group.y * transform.scale - size / 2, width: size, height: size, borderRadius: size / 2, borderWidth: clustered || pin.kind === "other" ? 2 : 1, borderColor: clustered ? C.plum : pin.kind === "visited" ? C.brass : C.blue, backgroundColor: clustered ? C.cream : pin.kind === "other" ? C.white : C.cream, alignItems: "center", justifyContent: "center", ...shadows.card }}>
          {clustered ? <ClusterGlyph count={group.pins.length} waiting={waiting} /> : <PinGlyph pin={pin} />}
        </Pressable>;
      })}
      {fix && <View style={{ position: "absolute", left: transform.x + mapPoint(fix.lat, fix.lng).x * transform.scale - 7, top: transform.y + mapPoint(fix.lat, fix.lng).y * transform.scale - 7, width: 14, height: 14, backgroundColor: C.lightBlue, borderWidth: 2, borderColor: C.white, borderRadius: 7 }} />}
    </Animated.View>
  </View>;
}
function ClusterGlyph({ count, waiting }: { count: number; waiting: boolean }) {
  const reduced = useReducedMotion();
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!waiting || reduced) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: motion.breathe.scale, duration: motion.breathe.duration / 2, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: motion.breathe.duration / 2, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [waiting, reduced, pulse]);
  return <Animated.View style={{ transform: [{ scale: pulse }], alignItems: "center", justifyContent: "center" }}>
    <Text style={{ fontFamily: sans, fontWeight: "700", color: C.plum, fontSize: 20 }}>{count}</Text>
  </Animated.View>;
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
