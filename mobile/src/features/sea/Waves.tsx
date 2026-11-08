import React, { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { C } from "../../theme";
import { useReducedMotion } from "../../useReducedMotion";

// Two thin line-drawn swells drifting in opposite directions, in the vessels' ink style.
const PERIOD = 60;
const swell = (width: number, y: number, amp: number) => {
  let d = `M0 ${y}`;
  for (let x = 0; x < width + PERIOD * 2; x += PERIOD) d += ` q ${PERIOD / 4} ${-amp} ${PERIOD / 2} 0 t ${PERIOD / 2} 0`;
  return d;
};

export function Waves({ width, height = 26 }: { width: number; height?: number }) {
  const reduced = useReducedMotion();
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(Animated.timing(a, { toValue: 1, duration: 4200, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [reduced, a]);
  const w = width + PERIOD * 2;
  return <View pointerEvents="none" style={{ width, height, overflow: "hidden" }}>
    <Animated.View style={{ position: "absolute", left: -PERIOD, transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [0, PERIOD] }) }] }}>
      <Svg width={w} height={height}><Path d={swell(w, height * .45, 6)} stroke={C.lightBlue} strokeWidth={1.6} fill="none" strokeLinecap="round" /></Svg>
    </Animated.View>
    <Animated.View style={{ position: "absolute", left: -PERIOD, transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [PERIOD, 0] }) }] }}>
      <Svg width={w} height={height}><Path d={swell(w, height * .8, 4)} stroke={C.blue} strokeOpacity={.55} strokeWidth={1.2} fill="none" strokeLinecap="round" /></Svg>
    </Animated.View>
  </View>;
}
