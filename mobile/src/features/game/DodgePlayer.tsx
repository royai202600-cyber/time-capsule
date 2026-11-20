import React from "react";
import { Image, StyleSheet, View, type ImageSourcePropType } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { C } from "../../theme";
import { GROUND, INVULNERABLE, type FightFrame } from "./dodgeFightRules";

type Limb = { source: ImageSourcePropType; pivot: readonly [number, number] };
export type FightFigure = {
  body: ImageSourcePropType;
  feetY: number;
  // The approved back-view art uses co-registered layers and normalized pivots.
  arm?: Limb;
  leftLeg?: Limb;
  rightLeg?: Limb;
};

function FigureLimb({ limb, size, motion, reduced, part }: {
  limb: Limb; size: number; motion: SharedValue<FightFrame>; reduced: boolean; part: "arm" | "left" | "right";
}) {
  const pose = useAnimatedStyle(() => {
    const { now, throwAt, wind, moving, jump } = motion.value;
    const followThrough = Math.max(0, 1 - (now - throwAt) / .18);
    const angle = part === "arm" ? (wind ? -35 : followThrough * 75)
      : (part === "left" ? -1 : 1) * (moving * 20 + jump * 14);
    return { transform: [{ rotate: `${reduced ? 0 : angle}deg` }] };
  });
  return <Animated.View style={[StyleSheet.absoluteFill, {
    transformOrigin: [limb.pivot[0] * size, limb.pivot[1] * size, 0],
  }, pose]}>
    <Image source={limb.source} resizeMode="contain" style={styles.layer} />
  </Animated.View>;
}

export function DodgePlayer({ figure, width, height, motion, reduced }: {
  figure: FightFigure; width: number; height: number; motion: SharedValue<FightFrame>; reduced: boolean;
}) {
  const size = width * .4;
  const player = useAnimatedStyle(() => {
    const { x, now, jump, charge, wind, throwAt, moving, hurtAt } = motion.value;
    const followThrough = Math.max(0, 1 - (now - throwAt) / .18);
    const stretch = wind ? -.06 : .07 * followThrough - .03 * charge;
    const blinking = now - hurtAt < INVULNERABLE;
    return {
      opacity: blinking && (reduced || Math.floor(now * 14) % 2) ? .4 : 1,
      transform: [
        { translateX: x * width - size / 2 },
        { translateY: -jump * height * .17 },
        { scaleX: reduced ? 1 : 1 - stretch / 2 + moving * .06 },
        { scaleY: reduced ? 1 : 1 + stretch },
      ],
    };
  });
  const shadow = useAnimatedStyle(() => ({
    transform: [{ translateX: (motion.value.x - .085) * width }, { scale: 1 - motion.value.jump * .45 }],
  }));

  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <Animated.View style={[styles.shadow, {
      width: width * .17, top: height * .847, height: height * .036,
    }, shadow]} />
    <Animated.View style={[styles.figure, {
      width: size, height: size, top: height * GROUND - size * figure.feetY,
      transformOrigin: [size / 2, size * figure.feetY, 0],
    }, player]}>
      {figure.leftLeg && <FigureLimb limb={figure.leftLeg} size={size} motion={motion} reduced={reduced} part="left" />}
      {figure.rightLeg && <FigureLimb limb={figure.rightLeg} size={size} motion={motion} reduced={reduced} part="right" />}
      <Image source={figure.body} resizeMode="contain" style={styles.layer} />
      {figure.arm && <FigureLimb limb={figure.arm} size={size} motion={motion} reduced={reduced} part="arm" />}
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  shadow: { position: "absolute", left: 0, borderRadius: 1000, backgroundColor: C.ink, opacity: .2 },
  figure: { position: "absolute", left: 0 },
  layer: { ...StyleSheet.absoluteFill, width: "100%", height: "100%" },
});
