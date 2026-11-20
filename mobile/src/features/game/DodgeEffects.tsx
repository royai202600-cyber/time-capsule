import React from "react";
import { Animated as RNAnimated, Image, Platform, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedProps, useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import Svg, { Circle, Defs, Ellipse, Pattern, RadialGradient, Rect, Stop } from "react-native-svg";
import { gameArt, vesselParts } from "../../art/manifest";
import { crackOverlays } from "../../art/crackOverlays";
import type { VesselKind } from "../../components/Vessel";
import type { BallKind } from "../../services/game";
import { C, sans, serif } from "../../theme";
import { BOSS_Y, FLIGHT, GROUND, LANES, type Attack, type FightFrame, type Flight } from "./dodgeFightRules";
import { fightHandPoint, RELEASE_ANGLE, RIG_CANVAS, RIG_FEET, RIG_WIDTH, type HandGeometry } from "./fightRigs";
import { RestoreLightBurst } from "./RestoreResult";

type Scene = { width: number; height: number; motion: SharedValue<FightFrame>; reduced: boolean };
const lerp = (a: number, b: number, t: number) => {
  "worklet";
  return a + (b - a) * t;
};
const FillCircle = Animated.createAnimatedComponent(Circle);
const fillLength = Math.PI * 36;
const motes = Array.from({ length: 6 }, (_, i) => i / 6);

export function FightShadow({ kind }: { kind: "boss" | "player" }) {
  const id = `fight-${kind}-shadow`;
  const opacity = kind === "boss" ? .16 : .2;
  return <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
    <Defs>
      <RadialGradient id={id} cx="50%" cy="50%" r="50%">
        <Stop offset="0" stopColor={C.ink} stopOpacity={opacity} />
        <Stop offset=".42" stopColor={C.ink} stopOpacity={opacity * .72} />
        <Stop offset="1" stopColor={C.ink} stopOpacity={0} />
      </RadialGradient>
    </Defs>
    <Circle cx={50} cy={50} r={50} fill={`url(#${id})`} />
  </Svg>;
}

function Glow({ warning = false }: { warning?: boolean }) {
  return <Svg width="100%" height="100%" viewBox="0 0 100 100">
    <Defs>
      <RadialGradient id={warning ? "bossGlow" : "heldGlow"} cx="50%" cy="50%" r="50%">
        <Stop offset="0" stopColor={warning ? C.plum : "#FFF4D6"} stopOpacity={.92} />
        <Stop offset=".42" stopColor={warning ? C.plum : C.brass} stopOpacity={.55} />
        <Stop offset="1" stopColor={warning ? C.ink : C.brass} stopOpacity={0} />
      </RadialGradient>
    </Defs>
    <Circle cx={50} cy={50} r={50} fill={warning ? "url(#bossGlow)" : "url(#heldGlow)"} />
  </Svg>;
}

export function FightBoss({ width, height, motion, reduced, vessel, health, warning, damage, burst, finishTime }: Scene & {
  vessel: string; health: number; warning: Attack | null; damage: number; burst: RNAnimated.Value; finishTime: SharedValue<number>;
}) {
  const size = width * .36;
  const source = vesselParts[vessel as VesselKind]?.assembled;
  const cracks = crackOverlays[vessel];
  const pose = useAnimatedStyle(() => {
    const { now, hitAt } = motion.value;
    const hit = now - hitAt;
    const shakes = hit < .25 ? Math.sin(hit * 120) * (1 - hit / .25) * width * .015 : 0;
    const preparing = warning && now < warning.at + warning.warning;
    return { transform: [
      { translateX: reduced ? 0 : shakes },
      { translateY: reduced ? 0 : Math.sin(now * 2.2) * height * .008 },
      { scale: !reduced && preparing ? 1 + .03 * Math.sin(now * 18) : 1 },
    ] };
  });
  const glow = useAnimatedStyle(() => {
    const now = motion.value.now;
    const preparing = warning && now < warning.at + warning.warning;
    return { opacity: preparing ? (reduced ? .65 : .55 + .45 * Math.sin(now * 18)) : 0 };
  });
  const dust = useAnimatedStyle(() => {
    const progress = Math.min(1, (motion.value.now + finishTime.value - motion.value.hitAt) / .5);
    return { opacity: 1 - progress, transform: [{ scale: .7 + progress * .6 }] };
  });
  const floating = useAnimatedStyle(() => {
    const progress = Math.min(1, (motion.value.now + finishTime.value - motion.value.hitAt) / .7);
    return { opacity: Math.min(1, (1 - progress) / .3), transform: [{ translateY: reduced ? 0 : -progress * height * .06 }] };
  });
  const darken = Platform.OS === "web"
    ? ({ filter: "saturate(.55) brightness(.8)" } as object) : { tintColor: C.ink, opacity: .3 };
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <View style={{ position: "absolute", left: "35%", width: "30%", height: "4.5%", top: `${(BOSS_Y + .1025) * 100}%` }}>
      <FightShadow kind="boss" />
    </View>
    <View style={{ position: "absolute", top: height * BOSS_Y - size / 2, width: "100%", height: size, alignItems: "center" }}>
      {!reduced && <RestoreLightBurst size={size} burst={burst} />}
      <Animated.View style={[{ width: size, height: size }, pose]}>
        <Animated.View style={[{ position: "absolute", top: "-10%", left: "-10%", width: "120%", height: "120%" }, glow]}><Glow warning /></Animated.View>
        {source && <Image source={source} style={styles.layer} resizeMode="contain" />}
        <View style={[StyleSheet.absoluteFill, { opacity: health }]}>
          {source && <Image source={source} style={[styles.layer, darken]} resizeMode="contain" />}
          {cracks && <Image source={cracks} style={styles.layer} resizeMode="contain" />}
        </View>
        {!reduced && <Animated.Image source={gameArt.hitDust} style={[styles.layer, dust]} resizeMode="contain" />}
      </Animated.View>
    </View>
    {damage > 0 && <Animated.Text style={[styles.damage, { top: height * (BOSS_Y - .06) }, floating]}>−{damage}</Animated.Text>}
  </View>;
}

type BallScene = Scene & { hand: HandGeometry };
const ballSize = (width: number) => width * .085;

function handAt(width: number, height: number, lane: number, jump: number, hand: HandGeometry, angle: number) {
  "worklet";
  const scale = width * RIG_WIDTH / RIG_CANVAS;
  const [x, y] = fightHandPoint(hand, angle);
  return [lane * width + (x - RIG_CANVAS / 2) * scale,
    height * (GROUND - jump * .17) + (y - RIG_FEET) * scale] as const;
}

function Mote({ offset, width, height, motion, hand }: Omit<BallScene, "reduced"> & { offset: number }) {
  const style = useAnimatedStyle(() => {
    const { now, x, charge, jump, wind, scatterAt, scatterX } = motion.value;
    const scatter = Math.min(1, (now - scatterAt) / .25);
    const k = (now * 1.6 + offset) % 1;
    const angle = offset * Math.PI * 2 + now * 1.4;
    const r = width * (scatter < 1 ? lerp(.02, .22, scatter) : lerp(.18, .02, k));
    const opacity = scatter < 1 ? 1 - scatter : Math.sin(k * Math.PI) * Math.min(1, charge * 2);
    const [handX, handY] = handAt(width, height, scatter < 1 ? scatterX : x, jump, hand, wind * RELEASE_ANGLE);
    return {
      opacity,
      transform: [
        { translateX: handX + Math.cos(angle) * r },
        { translateY: handY + Math.sin(angle) * r * .9 },
        { scale: lerp(.5, 1.1, k) },
      ],
    };
  });
  return <Animated.View style={[styles.mote, { width: width * .018, height: width * .018 }, style]} />;
}

export function GatherBall({ width, height, motion, reduced, hand, ball }: BallScene & { ball: BallKind }) {
  const size = ballSize(width);
  const gather = useAnimatedStyle(() => {
    const { now, x, jump, charge, wind } = motion.value;
    const p = 1 - (1 - charge) ** 2;
    const beat = reduced ? 0 : Math.sin(now * lerp(6, 22, charge)) * .05 * charge * (1 - wind);
    const [handX, handY] = handAt(width, height, x, jump, hand, reduced ? 0 : wind * RELEASE_ANGLE);
    return {
      opacity: Math.min(1, charge * 4),
      transform: [
        { translateX: handX - size / 2 },
        { translateY: handY - size / 2 },
        { scale: lerp(.35, 1, p) + beat },
      ],
    };
  });
  const fill = useAnimatedProps(() => ({ strokeDashoffset: fillLength * (1 - motion.value.charge) }));
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    {!reduced && motes.map((offset) => <Mote key={offset} offset={offset} width={width} height={height} motion={motion} hand={hand} />)}
    <Animated.View style={[{ position: "absolute", width: size, height: size }, gather]}>
      <View style={{ position: "absolute", width: "210%", height: "210%", top: "-55%", left: "-55%" }}><Glow /></View>
      <Svg width="144%" height="144%" viewBox="0 0 40 40" style={{ position: "absolute", top: "-22%", left: "-22%" }}>
        <Circle cx={20} cy={20} r={18} stroke="rgba(255,244,214,.35)" strokeWidth={2} fill="none" />
        <FillCircle cx={20} cy={20} r={18} stroke="#FFF4D6" strokeWidth={2.6} fill="none"
          strokeLinecap="round" strokeDasharray={[fillLength, fillLength]} transform="rotate(-90 20 20)" animatedProps={fill} />
      </Svg>
      <Image source={gameArt.ball[ball]} style={styles.layer} resizeMode="contain" />
    </Animated.View>
  </View>;
}

function InFlight({ width, height, motion, reduced, hand, flight, delay = 0 }: BallScene & { flight: Flight; delay?: number }) {
  const size = ballSize(width);
  const style = useAnimatedStyle(() => {
    const age = motion.value.now - flight.at - delay;
    const k = Math.max(0, Math.min(1, age / FLIGHT));
    const [startX, startY] = handAt(width, height, flight.x, 0, hand, reduced ? 0 : RELEASE_ANGLE);
    return {
      opacity: age < 0 ? 0 : delay === 0 ? 1 : .36 - delay * 1.6,
      transform: [
        { translateX: lerp(startX, width * .5, k) - size / 2 },
        { translateY: lerp(startY, height * BOSS_Y, k) - Math.sin(Math.PI * k) * height * .16 - size / 2 },
        { scale: lerp(1, .42, k ** .8) },
        { rotate: `${reduced ? 0 : k * 720}deg` },
      ],
    };
  });
  return <Animated.Image source={gameArt.ball[flight.ball]} resizeMode="contain" style={[{ position: "absolute", width: size, height: size }, style]} />;
}

export function PlayerThrow(props: BallScene & { flight: Flight }) {
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    {!props.reduced && [.15, .1, .05].map((delay) => <InFlight key={delay} {...props} delay={delay} />)}
    <InFlight {...props} />
  </View>;
}

function AimedShot({ width, height, motion, reduced, attack, lane, label }: Scene & { attack: Attack; lane: number; label: string }) {
  const x = LANES[lane];
  const ringWidth = width * .26;
  const ringHeight = ringWidth / 2.6;
  const orbSize = width * .09;
  const reticle = useAnimatedStyle(() => ({
    opacity: motion.value.now < attack.at + attack.warning ? 1 : .7,
    transform: [{ scale: reduced ? 1 : 1 + .06 * Math.sin(motion.value.now * 16) }],
  }));
  const orb = useAnimatedStyle(() => {
    const k = Math.max(0, Math.min(1, (motion.value.now - attack.at - attack.warning) / attack.travel));
    return {
      opacity: k > 0 ? 1 : 0,
      transform: [
        { translateX: width * lerp(.5, x, k) - orbSize / 2 },
        { translateY: lerp(height * BOSS_Y, height * GROUND - width * .14, k) - Math.sin(k * Math.PI) * height * .06 - orbSize / 2 },
        { scale: lerp(.6, 1.9, k * k) },
      ],
    };
  });
  return <>
    <Animated.View style={[{ position: "absolute", alignItems: "center", top: height * GROUND - ringHeight / 2,
      left: width * x - ringWidth / 2, width: ringWidth, height: ringHeight }, reticle]}>
      <Svg width={ringWidth} height={ringHeight}>
        <Ellipse cx={ringWidth / 2} cy={ringHeight / 2} rx={ringWidth / 2 - 2} ry={ringHeight / 2 - 2}
          fill="rgba(163,54,79,.18)" stroke={C.wax} strokeWidth={2.5} strokeDasharray="5 4" />
      </Svg>
      <Text allowFontScaling={false} style={[styles.warning, { position: "absolute", top: -21, backgroundColor: C.wax }]}>{label}</Text>
    </Animated.View>
    <Animated.View style={[{ position: "absolute", width: orbSize, height: orbSize, backgroundColor: "#3B1E3D",
      borderRadius: orbSize / 2, borderWidth: 2, borderColor: C.ink, alignItems: "center", justifyContent: "center" }, orb]}>
      <View style={{ width: "45%", height: "45%", borderRadius: orbSize, backgroundColor: "#8C5B8F", opacity: .55 }} />
    </Animated.View>
  </>;
}

function DarkWave({ width, height, motion, reduced, attack, label }: Scene & { attack: Attack; label: string }) {
  const band = useAnimatedStyle(() => ({ opacity: reduced ? 1 : .84 + .16 * Math.sin(motion.value.now * 16) }));
  const ellipse = useAnimatedStyle(() => {
    const k = Math.max(0, Math.min(1, (motion.value.now - attack.at - attack.warning) / attack.travel));
    return {
      opacity: Math.min(1, k * 5),
      transform: [
        { translateY: lerp((BOSS_Y + .12) * height, GROUND * height, k) - width * .154 },
        { scale: lerp(.3 / 1.4, 1, k) },
      ],
    };
  });
  return <>
    <Animated.View style={[{ position: "absolute", top: height * (GROUND - .055), height: height * .11, width, alignItems: "center",
      justifyContent: "center", borderColor: "rgba(22,38,63,.55)", borderStyle: "dashed", borderTopWidth: 2, borderBottomWidth: 2 }, band]}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs><Pattern id="warningStripe" patternUnits="userSpaceOnUse" width={22} height={22} patternTransform="rotate(45)">
          <Rect width={22} height={22} fill="rgba(22,38,63,.08)" /><Rect width={11} height={22} fill="rgba(22,38,63,.31)" />
        </Pattern></Defs>
        <Rect width="100%" height="100%" fill="url(#warningStripe)" />
      </Svg>
      <Text style={[styles.warning, { backgroundColor: C.ink }]}>{label}</Text>
    </Animated.View>
    <Animated.View style={[{ position: "absolute", width: width * 1.4, height: width * .308, left: -width * .2,
      borderRadius: width, borderColor: "#3B1E3D", borderWidth: 6 }, ellipse]} />
  </>;
}

export function FightAttack(props: Scene & { attack: Attack; waveLabel: string; shotLabel: string }) {
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    {props.attack.kind === "wave" ? <DarkWave {...props} label={props.waveLabel} />
      : props.attack.lanes.map((lane) => <AimedShot key={lane} {...props} lane={lane} label={props.shotLabel} />)}
  </View>;
}

export function HitEdge({ motion, finishTime }: { motion: SharedValue<FightFrame>; finishTime: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - (motion.value.now + finishTime.value - motion.value.hurtAt) / .24) }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderWidth: 8, borderColor: "rgba(163,54,79,.75)" }, style]} />;
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, width: "100%", height: "100%" },
  warning: { fontFamily: sans, fontSize: 12, fontWeight: "700", color: C.white, paddingHorizontal: 8, paddingVertical: 3, overflow: "hidden", borderRadius: 20 },
  mote: { position: "absolute", backgroundColor: "#FFF4D6", borderRadius: 8, shadowColor: C.brass, shadowOpacity: 1, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } },
  damage: { position: "absolute", width: "100%", textAlign: "center", fontFamily: serif, fontSize: 20, fontWeight: "700", color: C.white,
    textShadowColor: C.plum, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
});
