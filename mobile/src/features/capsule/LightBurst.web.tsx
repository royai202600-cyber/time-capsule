import React, { useEffect, useRef } from "react";
import { Animated, View } from "react-native";
import { lightBurst } from "../../art/manifest";
import { useReducedMotion } from "../../useReducedMotion";
import { C } from "../../theme";

export function LightBurst({ intensity, bloom = false }: { intensity: number; bloom?: boolean }) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (bloom) Animated.timing(progress, { toValue: 1, duration: reduced ? 200 : 700, useNativeDriver: true }).start();
    else progress.setValue(0);
    return () => progress.stopAnimation();
  }, [bloom, progress, reduced]);
  const scale = reduced ? 1 : progress.interpolate({ inputRange: [0, 1], outputRange: [.6, 1.3] });
  return <View pointerEvents="none" style={{ position: "absolute", width: 220, height: 220 }}><Animated.View style={{ position: "absolute", width: 220, height: 220, borderRadius: 110, backgroundColor: C.brass, opacity: bloom ? progress.interpolate({ inputRange: [0, reduced ? 1 : .35, 1], outputRange: [0, reduced ? .08 : .28, .08] }) : Math.min(.1, intensity * .18), transform: [{ scale }] }} /><Animated.Image source={lightBurst} resizeMode="contain" style={{ position: "absolute", width: 220, height: 220, opacity: bloom ? progress.interpolate({ inputRange: [0, reduced ? 1 : .35, 1], outputRange: [0, reduced ? .35 : 1, .35] }) : Math.min(1, intensity), transform: [{ scale }] }} /></View>;
}
