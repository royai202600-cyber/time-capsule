import React from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { FightShadow } from "./DodgeEffects";
import { GROUND, INVULNERABLE, THROW_RECOVERY, type FightFrame } from "./dodgeFightRules";
import { RELEASE_ANGLE, RIG_CANVAS, RIG_FEET, RIG_WIDTH, type FightRig } from "./fightRigs";

type Pose = { size: number; motion: SharedValue<FightFrame>; reduced: boolean };

function StandingLeg({ leg, direction, size, motion, reduced }: Pose & { leg: FightRig["legLeft"]; direction: number }) {
  const pose = useAnimatedStyle(() => ({
    opacity: motion.value.jump > 0 ? 0 : 1,
    transform: [{ rotate: `${reduced ? 0 : motion.value.moving * direction * 7}deg` }],
  }));
  return <Animated.View style={[StyleSheet.absoluteFill, {
    transformOrigin: [size * leg.pivot[0] / RIG_CANVAS, size * leg.pivot[1] / RIG_CANVAS, 0],
  }, pose]}>
    <Image source={leg.source} resizeMode="contain" style={styles.layer} />
  </Animated.View>;
}

export function DodgePlayer({ figure, width, height, motion, reduced }: {
  figure: FightRig; width: number; height: number; motion: SharedValue<FightFrame>; reduced: boolean;
}) {
  const size = width * RIG_WIDTH;
  const feet = size * RIG_FEET / RIG_CANVAS;
  const player = useAnimatedStyle(() => {
    const { x, now, jump, hurtAt } = motion.value;
    const blinking = now - hurtAt < INVULNERABLE;
    return {
      opacity: blinking && (reduced || Math.floor(now * 14) % 2) ? .4 : 1,
      transform: [{ translateX: x * width - size / 2 }, { translateY: -jump * height * .17 }],
    };
  });
  const shadow = useAnimatedStyle(() => ({
    transform: [{ translateX: (motion.value.x - .085) * width }, { scale: 1 - motion.value.jump * .45 }],
  }));
  const jumpLegs = useAnimatedStyle(() => ({ opacity: motion.value.jump > 0 ? 1 : 0 }));
  const armDown = useAnimatedStyle(() => {
    const { now, throwAt, charge, moving, jump } = motion.value;
    const raised = !moving && !jump && (charge > 0 || now - throwAt < THROW_RECOVERY);
    return { opacity: raised ? 0 : 1 };
  });
  const armUp = useAnimatedStyle(() => {
    const { now, charge, throwAt, wind, moving, jump } = motion.value;
    const follow = (now - throwAt) / THROW_RECOVERY;
    const releasing = follow < 1;
    const angle = releasing ? RELEASE_ANGLE - 12 * follow : RELEASE_ANGLE * wind;
    return {
      opacity: !moving && !jump && (charge > 0 || releasing) ? 1 : 0,
      transform: [{ rotate: `${reduced ? 0 : angle}deg` }],
    };
  });

  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <Animated.View style={[styles.shadow, {
      width: width * .17, top: height * .847, height: height * .036,
    }, shadow]}><FightShadow kind="player" /></Animated.View>
    <Animated.View style={[styles.figure, {
      width: size, height: size, top: height * GROUND - feet,
    }, player]}>
      <StandingLeg leg={figure.legLeft} direction={-1} size={size} motion={motion} reduced={reduced} />
      <StandingLeg leg={figure.legRight} direction={1} size={size} motion={motion} reduced={reduced} />
      <Animated.Image source={figure.legsJump} resizeMode="contain" style={[styles.layer, jumpLegs]} />
      <Animated.Image source={figure.armDown} resizeMode="contain" style={[styles.layer, armDown]} />
      <Animated.View style={[StyleSheet.absoluteFill, {
        transformOrigin: [size * figure.hand.shoulder[0] / RIG_CANVAS, size * figure.hand.shoulder[1] / RIG_CANVAS, 0],
      }, armUp]}>
        <Image source={figure.armUp} resizeMode="contain" style={styles.layer} />
      </Animated.View>
      <Image source={figure.body} resizeMode="contain" style={styles.layer} />
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  shadow: { position: "absolute", left: 0 },
  figure: { position: "absolute", left: 0 },
  layer: { ...StyleSheet.absoluteFill, width: "100%", height: "100%" },
});
