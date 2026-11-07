import React, { useEffect, useRef } from "react";
import { Animated, Easing, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { RING_LEN, RING_R, SealHoldIcon } from "./DockIcons";
import { useReducedMotion } from "../useReducedMotion";
import { C, sans } from "../theme";

/** Loading state: the hold-to-open keyhole seal with a short brass arc circling its groove.
 *  Reduce Motion keeps the arc still. Replaces ActivityIndicator. */
export function SealLoader({ size = 56, label }: { size?: number; label?: string }) {
  const reduced = useReducedMotion();
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) { spin.setValue(0); return; }
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [reduced, spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return <View accessibilityRole="progressbar" accessibilityLabel={label} style={{ alignItems: "center", gap: 10 }}>
    <View style={{ width: size, height: size }}>
      <SealHoldIcon size={size} />
      <Animated.View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width: size, height: size, transform: [{ rotate }] }}>
        <Svg width={size} height={size} viewBox="0 0 68 68" fill="none">
          <Circle cx={34} cy={34} r={RING_R} stroke="#E2B867" strokeWidth={3.6} strokeLinecap="round"
            strokeDasharray={`${RING_LEN * 0.22} ${RING_LEN}`} transform="rotate(-90 34 34)" />
        </Svg>
      </Animated.View>
    </View>
    {!!label && <Text style={{ color: C.muted, fontFamily: sans, fontSize: 13 }}>{label}</Text>}
  </View>;
}
