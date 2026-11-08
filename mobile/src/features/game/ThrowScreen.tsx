import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, PanResponder, Platform, Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from "react-native-svg";
import { vesselParts } from "../../art/manifest";
import { ArtIcon } from "../../components/ArtIcon";
import { haptics } from "../../components/haptics";
import type { VesselKind } from "../../components/Vessel";
import { useLanguage } from "../../i18n";
import { game, GameError, type BallKind, type GameState, type LostCapsule, type Rarity, type ThrowResult } from "../../services/game";
import { C, radii, sans, serif, shadows, spacing } from "../../theme";
import { useReducedMotion } from "../../useReducedMotion";
import { useGameText } from "./strings";

const NATIVE = Platform.OS !== "web";
const RING = 196;
const VESSEL = 170;
const BALL = 92;
const MIN_RING = .24;
const HIT_HALF_WIDTH = 74;
const STRONG_FLICK = -.7;
const RING_HALF_MS: Record<Rarity, number> = { common: 1200, uncommon: 900, rare: 650 };
const RING_COLOR: Record<Rarity, string> = { common: C.brass, uncommon: C.blue, rare: C.wax };
const DUST = Array.from({ length: 14 }, (_, i) => ({
  angle: (i / 14) * Math.PI * 2, reach: 70 + (i % 3) * 26, size: 5 + (i % 4) * 2, gold: i % 2 === 0,
}));

/** Stand-in until the chosen ball art arrives: a solid wax ball, never two-tone. */
function WaxBall({ kind, size }: { kind: BallKind; size: number }) {
  const [light, mid, dark] = kind === "gold" ? ["#EBD08F", C.brass, "#8E6E33"] : ["#C9607A", C.wax, "#74233A"];
  return <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs><RadialGradient id={`ball-${kind}`} cx="38%" cy="32%" r="72%">
      <Stop offset="0" stopColor={light} /><Stop offset=".55" stopColor={mid} /><Stop offset="1" stopColor={dark} />
    </RadialGradient></Defs>
    <Circle cx={50} cy={50} r={46} fill={`url(#ball-${kind})`} />
    <Path d="M22 62c6 8 12 4 15 11 3 6 10 7 14 2 4-6 12-2 17-8" stroke={dark} strokeOpacity={.35} strokeWidth={3} fill="none" strokeLinecap="round" />
    <Circle cx={36} cy={32} r={7} fill="#fff" opacity={.45} />
  </Svg>;
}

/** Stand-in for the shared cracked look until the chosen art arrives. */
function Cracks({ size }: { size: number }) {
  return <Svg width={size} height={size} viewBox="0 0 100 100">
    <Circle cx={50} cy={52} r={38} fill={C.ink} opacity={.14} />
    <Path d="M30 22l9 15-6 9 11 12-4 12 8 12M70 26l-8 13 7 10-12 9 5 13-7 9M18 54l13-2 7 7M84 50l-12 3-6 8" stroke={C.ink} strokeOpacity={.72} strokeWidth={1.6} fill="none" strokeLinejoin="round" strokeLinecap="round" />
  </Svg>;
}

export function ThrowScreen({ capsule, state, onState, onClose }: {
  capsule: LostCapsule; state: GameState; onState: (s: GameState) => void; onClose: (caught: boolean) => void;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const s = useGameText();
  const reduced = useReducedMotion();
  const [height, setHeight] = useState(0);
  const [kind, setKind] = useState<BallKind>("wax");
  const [attempts, setAttempts] = useState(capsule.attempts_left);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<ThrowResult | null>(null);

  const ringPhase = useRef(new Animated.Value(1)).current;
  const hop = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const ball = useRef(new Animated.ValueXY()).current;
  const ballScale = useRef(new Animated.Value(1)).current;
  const ballOpacity = useRef(new Animated.Value(1)).current;
  const crack = useRef(new Animated.Value(1)).current;
  const dust = useRef(new Animated.Value(0)).current;

  const ringStart = useRef(Date.now());
  const busy = useRef(false);
  const jumping = useRef(false);
  const alive = useRef(true);
  const halfMs = RING_HALF_MS[capsule.rarity];
  const latest = useRef({ kind, state, height });
  latest.current = { kind, state, height };

  // The ring's size is a pure function of time, so the throw can read it without a native round trip.
  const ringNow = () => {
    const phase = (Date.now() - ringStart.current) % (halfMs * 2);
    const size = phase < halfMs ? 1 - phase / halfMs : (phase - halfMs) / halfMs;
    return 1 - size;
  };

  useEffect(() => {
    ringStart.current = Date.now();
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(ringPhase, { toValue: 0, duration: halfMs, easing: Easing.linear, useNativeDriver: NATIVE }),
      Animated.timing(ringPhase, { toValue: 1, duration: halfMs, easing: Easing.linear, useNativeDriver: NATIVE }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [halfMs, ringPhase]);

  useEffect(() => () => { alive.current = false; }, []);

  // The capsule sometimes jumps, and a ball thrown mid-jump passes underneath it.
  useEffect(() => {
    if (reduced || result) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        jumping.current = true;
        Animated.sequence([
          Animated.timing(hop, { toValue: -74, duration: 230, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }),
          Animated.timing(hop, { toValue: 0, duration: 270, easing: Easing.bounce, useNativeDriver: NATIVE }),
        ]).start(() => { jumping.current = false; schedule(); });
      }, 2400 + Math.random() * 2800);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [hop, reduced, result]);

  const flash = (text: string) => setMessage(text);
  const reset = () => {
    if (!alive.current) return;
    ball.setValue({ x: 0, y: 0 });
    ballScale.setValue(1);
    Animated.timing(ballOpacity, { toValue: 1, duration: 160, useNativeDriver: NATIVE }).start(() => { busy.current = false; });
  };
  const nudge = () => Animated.sequence([-14, 14, -8, 8, 0].map((toValue) =>
    Animated.timing(shake, { toValue, duration: 70, useNativeDriver: NATIVE }))).start();

  const settle = async (hit: boolean, ring: number) => {
    const ballKind = latest.current.kind;
    try {
      const out = await game.throwBall({ id: capsule.id, ball: ballKind, ring, hit });
      if (!alive.current) return;
      onState(out.state);
      setAttempts(out.attempts_left);
      if (out.result === "miss") {
        void haptics.warn();
        flash(s("miss"));
        Animated.timing(ballOpacity, { toValue: 0, duration: 260, useNativeDriver: NATIVE }).start(reset);
        return;
      }
      ballOpacity.setValue(0);
      dust.setValue(0);
      Animated.timing(dust, { toValue: 1, duration: 620, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE }).start();
      if (out.result === "restored") {
        void haptics.success();
        setMessage("");
        Animated.timing(crack, { toValue: 0, duration: 620, useNativeDriver: NATIVE }).start(() => { if (alive.current) setResult(out); });
        return;
      }
      void haptics.warn();
      nudge();
      if (out.attempts_left <= 0) {
        flash(s("gone"));
        setTimeout(() => { if (alive.current) onClose(false); }, 1200);
      } else {
        flash(s("brokeFree"));
        setTimeout(reset, 520);
      }
    } catch (e) {
      if (!alive.current) return;
      const code = e instanceof GameError ? e.code : "unknown";
      flash(code === "no_balls" ? s("noBalls") : code === "expired" || code === "no_attempts" ? s("expired") : s("error"));
      reset();
    }
  };

  const release = (dx: number, vx: number, vy: number) => {
    const { height: h, kind: ballKind, state: st } = latest.current;
    if ((ballKind === "gold" ? st.gold_balls : st.wax_balls) <= 0) {
      flash(s("noBalls"));
      Animated.spring(ball, { toValue: { x: 0, y: 0 }, useNativeDriver: NATIVE }).start(() => { busy.current = false; });
      return;
    }
    void haptics.tap();
    setMessage("");
    const travel = capsuleY(h) - ballY(h, insets.bottom);
    const strong = vy < STRONG_FLICK;
    const landX = Math.max(-220, Math.min(220, dx + vx * 170));
    const landY = strong ? travel : travel * .62;
    Animated.parallel([
      Animated.timing(ball, { toValue: { x: landX, y: landY }, duration: 460, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }),
      Animated.timing(ballScale, { toValue: .42, duration: 460, useNativeDriver: NATIVE }),
    ]).start(() => {
      if (!alive.current) return;
      void settle(strong && Math.abs(landX) < HIT_HALF_WIDTH && !jumping.current, ringNow());
    });
  };
  const releaseRef = useRef(release);
  releaseRef.current = release;

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !busy.current,
    onMoveShouldSetPanResponder: () => !busy.current,
    onPanResponderGrant: () => { busy.current = true; },
    onPanResponderMove: (_, g) => ball.setValue({ x: g.dx, y: g.dy }),
    onPanResponderRelease: (_, g) => {
      if (g.dy < -50 && g.vy < -.3) releaseRef.current(g.dx, g.vx, g.vy);
      else Animated.spring(ball, { toValue: { x: 0, y: 0 }, useNativeDriver: NATIVE }).start(() => { busy.current = false; });
    },
    onPanResponderTerminate: () => { ball.setValue({ x: 0, y: 0 }); busy.current = false; },
  }), [ball]);

  const count = kind === "gold" ? state.gold_balls : state.wax_balls;
  const source = vesselParts[capsule.vessel as VesselKind]?.assembled;
  const name = t(`shop.vessel.${capsule.vessel}`);
  const ringScale = ringPhase.interpolate({ inputRange: [0, 1], outputRange: [MIN_RING, 1] });

  return <View onLayout={(e: LayoutChangeEvent) => setHeight(e.nativeEvent.layout.height)}
    style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 40, backgroundColor: "rgba(246,248,251,.14)" }}>
    {height > 0 && <>
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: capsuleY(height) - VESSEL / 2, height: VESSEL, alignItems: "center" }}>
        <Animated.View style={{ width: VESSEL, height: VESSEL, alignItems: "center", justifyContent: "center", transform: [{ translateY: hop }, { translateX: shake }] }}>
          {source ? <Image source={source} style={{ width: VESSEL, height: VESSEL }} resizeMode="contain" accessibilityLabel={s("lostCapsule")} /> : null}
          <Animated.View style={{ position: "absolute", opacity: crack }}><Cracks size={VESSEL} /></Animated.View>
          {!result && <View style={{ position: "absolute", width: RING, height: RING, borderRadius: RING / 2, borderWidth: 2, borderColor: "rgba(255,255,255,.95)" }} />}
          {!result && <Animated.View style={{ position: "absolute", width: RING, height: RING, borderRadius: RING / 2, borderWidth: 4, borderColor: RING_COLOR[capsule.rarity], transform: [{ scale: ringScale }] }} />}
          {DUST.map((d, i) => <Animated.View key={i} style={{
            position: "absolute", width: d.size, height: d.size, borderRadius: d.size / 2, backgroundColor: d.gold ? C.brass : C.wax,
            opacity: dust.interpolate({ inputRange: [0, .05, 1], outputRange: [0, 1, 0] }),
            transform: [
              { translateX: dust.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(d.angle) * d.reach] }) },
              { translateY: dust.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(d.angle) * d.reach] }) },
            ],
          }} />)}
        </Animated.View>
      </View>

      {!result && <Animated.View {...pan.panHandlers} accessibilityRole="adjustable" accessibilityLabel={s("flick")}
        style={{
          position: "absolute", left: "50%", marginLeft: -BALL / 2, top: ballY(height, insets.bottom) - BALL / 2, width: BALL, height: BALL,
          opacity: ballOpacity, transform: [{ translateX: ball.x }, { translateY: ball.y }, { scale: ballScale }],
          ...(Platform.OS === "web" ? ({ touchAction: "none", cursor: "grab", userSelect: "none" } as object) : {}),
        }}>
        <WaxBall kind={kind} size={BALL} />
      </Animated.View>}
    </>}

    <View pointerEvents="box-none" style={{ position: "absolute", top: insets.top + spacing.sm, left: spacing.md, right: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Pressable accessibilityRole="button" accessibilityLabel={s("close")} onPress={() => onClose(false)}
        style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(246,248,251,.94)", alignItems: "center", justifyContent: "center", ...shadows.card }}>
        <ArtIcon name="close" size={22} />
      </Pressable>
      <View style={{ flexDirection: "row", gap: 6, padding: 8, borderRadius: radii.pill, backgroundColor: "rgba(246,248,251,.9)" }}>
        {Array.from({ length: capsule.attempts_left }, (_, i) => <View key={i} style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: i < attempts ? C.wax : C.line }} />)}
      </View>
      <View style={{ width: 44 }} />
    </View>

    {!!message && !result && <Text accessibilityRole="alert" style={{ position: "absolute", top: height * .62, alignSelf: "center", backgroundColor: C.ink, color: C.white, fontFamily: sans, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, overflow: "hidden" }}>{message}</Text>}

    {!result && <View pointerEvents="box-none" style={{ position: "absolute", left: spacing.md, right: spacing.md, bottom: insets.bottom + spacing.md, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
      <Text style={{ flex: 1, fontFamily: sans, fontSize: 12, color: C.ink }}>{count > 0 ? s("balls", state.wax_balls) : s("noBalls")}</Text>
      <Text style={{ flex: 1, textAlign: "center", fontFamily: sans, fontSize: 12, color: C.ink }}>{s("flick")}</Text>
      <View style={{ flex: 1, alignItems: "flex-end" }}>
        <Pressable accessibilityRole="button" accessibilityLabel={s(kind === "wax" ? "gold" : "wax")} accessibilityState={{ selected: kind === "gold" }}
          disabled={kind === "wax" && state.gold_balls <= 0} onPress={() => { void haptics.tick(); setKind(kind === "wax" ? "gold" : "wax"); }}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, height: 44, borderRadius: 22, backgroundColor: "rgba(246,248,251,.94)", opacity: kind === "wax" && state.gold_balls <= 0 ? .5 : 1, ...shadows.card }}>
          <WaxBall kind={kind === "wax" ? "gold" : "wax"} size={26} />
          <Text style={{ fontFamily: serif, fontSize: 14, color: C.ink }}>{kind === "wax" ? state.gold_balls : state.wax_balls}</Text>
        </Pressable>
      </View>
    </View>}

    {result && <View style={{ position: "absolute", left: spacing.md, right: spacing.md, bottom: insets.bottom + spacing.md, alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,.97)", borderRadius: 22, padding: spacing.lg, borderWidth: 1, borderColor: C.line, ...shadows.card }}>
      <Text style={{ fontFamily: sans, fontSize: 12, letterSpacing: 1.2, color: C.brass }}>{result.is_new ? s("newFind") : s("copies", result.copies)}</Text>
      <Text style={{ fontFamily: serif, fontSize: 24, color: C.ink }}>{s("restored")} · {name}</Text>
      <Text accessibilityLabel={`${result.stars} / 5`} style={{ fontSize: 16, letterSpacing: 3, color: C.brass }}>{"★".repeat(result.stars)}<Text style={{ color: C.line }}>{"★".repeat(5 - result.stars)}</Text></Text>
      <Text style={{ fontFamily: sans, fontSize: 13, color: C.muted }}>{s("xp", result.xp_gained)}</Text>
      <Pressable accessibilityRole="button" onPress={() => onClose(true)} style={{ marginTop: 8, alignSelf: "stretch", alignItems: "center", backgroundColor: C.wax, borderRadius: radii.pill, paddingVertical: 12 }}>
        <Text style={{ fontFamily: serif, fontSize: 16, color: C.white }}>{s("collect")}</Text>
      </Pressable>
    </View>}
  </View>;
}

const capsuleY = (height: number) => height * .38;
const ballY = (height: number, bottom: number) => height - bottom - 118;
