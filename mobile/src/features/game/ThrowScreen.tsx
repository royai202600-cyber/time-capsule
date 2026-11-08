import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, PanResponder, Platform, Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, Ellipse, Path, Polygon, RadialGradient, Stop } from "react-native-svg";
import { vesselParts } from "../../art/manifest";
import { ArtIcon } from "../../components/ArtIcon";
import { haptics } from "../../components/haptics";
import type { VesselKind } from "../../components/Vessel";
import { useLanguage } from "../../i18n";
import { game, GameError, type BallKind, type GameState, type CorruptedCapsule, type LandmarkAttempt, type Rarity, type ThrowResult } from "../../services/game";
import { mapPalette } from "../journey/live/mapHtml";
import { C, radii, sans, serif, shadows, spacing } from "../../theme";
import { useReducedMotion } from "../../useReducedMotion";
import { errorKey, useGameText } from "./strings";

const NATIVE = Platform.OS !== "web";
const RING = 196;
const VESSEL = 170;
const BALL = 92;
const MIN_RING = .24;
const HIT_HALF_WIDTH = 74;
const GIANT_VESSEL = 250;
const GIANT_RING = 290;
const GIANT_HIT_HALF_WIDTH = 120;
const STRONG_FLICK = -.7;
const MOUSE = Platform.OS === "web";
const MOUSE_DRAG = -120; // A mouse drag often ends almost still, so distance also counts as a throw.
const RING_HALF_MS: Record<Rarity, number> = { common: 1200, uncommon: 900, rare: 650 };
const RING_COLOR: Record<Rarity, string> = { common: C.brass, uncommon: C.blue, rare: C.wax };
const DUST = Array.from({ length: 14 }, (_, i) => ({
  angle: (i / 14) * Math.PI * 2, reach: 70 + (i % 3) * 26, size: 5 + (i % 4) * 2, gold: i % 2 === 0,
}));

/** Stand-in until the chosen ball art arrives: a solid wax ball, never two-tone. */
export function WaxBall({ kind, size }: { kind: BallKind; size: number }) {
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

const BLOCKS: [number, number, number][] = [[-8, 60, 54], [66, 44, 82], [122, 54, 44], [196, 46, 70], [254, 60, 50], [326, 58, 88]];
const CANOPY = "#C5D5B5";
const CANOPY_DARK = "#B4C7A3";
const CLEARING = "#E7ECD9";
const TRUNK = "#B8A88C";
const HEDGE: [number, number, number][] = [[6, 196, 26], [44, 188, 30], [86, 196, 22], [122, 190, 28], [160, 197, 20], [204, 190, 26], [244, 196, 22], [286, 188, 30], [330, 195, 26], [370, 190, 28]];
const TREES: [number, number, number][] = [[338, 300, 1], [30, 372, .95], [352, 520, 1.25]];
const BUSHES: [number, number, number][] = [[-6, 790, 58], [48, 812, 46], [386, 796, 62], [330, 816, 44], [-10, 560, 38], [24, 580, 26]];

function Tree({ x, y, k }: { x: number; y: number; k: number }) {
  return <>
    <Ellipse cx={x} cy={y + 46 * k} rx={34 * k} ry={9 * k} fill={C.ink} opacity={.08} />
    <Polygon points={`${x - 4 * k},${y + 46 * k} ${x + 4 * k},${y + 46 * k} ${x + 3 * k},${y} ${x - 3 * k},${y}`} fill={TRUNK} />
    <Circle cx={x - 15 * k} cy={y - 2 * k} r={22 * k} fill={CANOPY_DARK} />
    <Circle cx={x + 16 * k} cy={y} r={21 * k} fill={CANOPY_DARK} />
    <Circle cx={x} cy={y - 16 * k} r={26 * k} fill={CANOPY} />
  </>;
}

/** A generic park clearing in the live map's colours and flat style, not a real place. */
export function ThrowBackground() {
  const p = mapPalette;
  return <Svg style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} width="100%" height="100%" viewBox="0 0 375 812" preserveAspectRatio="xMidYMid slice">
    <Polygon points="0,0 375,0 375,204 0,204" fill={C.glass} />
    {BLOCKS.map(([x, w, h]) => <React.Fragment key={x}>
      <Polygon points={`${x},200 ${x + w},200 ${x + w},${200 - h} ${x},${200 - h}`} fill={p.building} />
      <Polygon points={`${x},${200 - h} ${x + w},${200 - h} ${x + w - 5},${191 - h} ${x + 5},${191 - h}`} fill={p.buildingTop} />
    </React.Fragment>)}
    {HEDGE.map(([x, y, r]) => <Circle key={x} cx={x} cy={y} r={r} fill={CANOPY} />)}
    <Polygon points="0,200 375,200 375,812 0,812" fill={p.park} />
    <Path d="M-20 262C20 236 118 234 150 256 176 274 112 296 44 294-4 292-40 276-20 262Z" fill={p.water} stroke={p.waterLine} strokeWidth={1.5} />
    <Path d="M292 200C312 236 276 268 300 302 316 326 372 344 395 352V384C352 372 290 350 270 316 248 278 280 238 268 200Z" fill={p.sand} />
    <Ellipse cx={187} cy={402} rx={176} ry={66} fill={CLEARING} />
    <Ellipse cx={187} cy={700} rx={250} ry={96} fill={CLEARING} opacity={.55} />
    {TREES.map(([x, y, k]) => <Tree key={x} x={x} y={y} k={k} />)}
    {BUSHES.map(([x, y, r]) => <Circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={CANOPY_DARK} />)}
  </Svg>;
}

const ANGER = "M40 12C40 30 30 40 12 40M60 12C60 30 70 40 88 40M12 60C30 60 40 70 40 88M88 60C70 60 60 70 60 88";
/** The comic anger mark that shows a capsule is corrupted, at its upper right. */
function AngerMark({ size }: { size: number }) {
  return <Svg width={size} height={size} viewBox="0 0 100 100">
    <Path d={ANGER} stroke="#fff" strokeWidth={18} fill="none" strokeLinecap="round" />
    <Path d={ANGER} stroke={C.wax} strokeWidth={10} fill="none" strokeLinecap="round" />
  </Svg>;
}

export function ThrowScreen({ capsule, landmark, state, onState, onClose }: {
  capsule: CorruptedCapsule; landmark?: LandmarkAttempt; state: GameState; onState: (s: GameState) => void; onClose: (caught: boolean) => void;
}) {
  const vesselSize = landmark ? GIANT_VESSEL : VESSEL;
  const ringSize = landmark ? GIANT_RING : RING;
  const hitHalfWidth = landmark ? GIANT_HIT_HALF_WIDTH : HIT_HALF_WIDTH;
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const s = useGameText();
  const reduced = useReducedMotion();
  const [height, setHeight] = useState(0);
  const [kind, setKind] = useState<BallKind>("wax");
  const [attempts, setAttempts] = useState(capsule.attempts_left);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<Pick<ThrowResult, "vessel" | "copies" | "stars" | "is_new" | "xp_gained"> | null>(null);
  const [cracks, setCracks] = useState(landmark?.cracks ?? 0);
  const [secondsLeft, setSecondsLeft] = useState(landmark ? Math.ceil((new Date(landmark.expires_at).getTime() - Date.now()) / 1000) : 0);

  const ringPhase = useRef(new Animated.Value(1)).current;
  const hop = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const ball = useRef(new Animated.ValueXY()).current;
  const ballScale = useRef(new Animated.Value(1)).current;
  const ballOpacity = useRef(new Animated.Value(1)).current;
  const crack = useRef(new Animated.Value(1)).current;
  const dust = useRef(new Animated.Value(0)).current;
  const throb = useRef(new Animated.Value(1)).current;

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

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(throb, { toValue: 1.16, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }),
      Animated.timing(throb, { toValue: 1, duration: 420, easing: Easing.in(Easing.quad), useNativeDriver: NATIVE }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reduced, throb]);

  useEffect(() => {
    if (!landmark || result) return;
    const timer = setInterval(() => {
      const left = Math.max(0, Math.ceil((new Date(landmark.expires_at).getTime() - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) { busy.current = true; clearInterval(timer); }
    }, 500);
    return () => clearInterval(timer);
  }, [landmark, result]);

  // The capsule sometimes jumps, and a ball thrown mid-jump passes underneath it.
  useEffect(() => {
    if (reduced || result || landmark) return;
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

  const settleLandmark = async (hit: boolean, ring: number) => {
    if (!landmark) return;
    if (!hit) {
      void haptics.warn();
      flash(s("miss"));
      Animated.timing(ballOpacity, { toValue: 0, duration: 200, useNativeDriver: NATIVE }).start(reset);
      return;
    }
    try {
      const out = await game.landmarkHit({ attempt: landmark.id, ball: latest.current.kind, ring });
      if (!alive.current) return;
      onState(out.state);
      setCracks(out.cracks);
      ballOpacity.setValue(0);
      dust.setValue(0);
      Animated.timing(dust, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE }).start();
      Animated.timing(crack, { toValue: out.cracks / landmark.cracks, duration: 320, useNativeDriver: NATIVE }).start();
      if (out.result === "won") {
        void haptics.success();
        setMessage("");
        setTimeout(() => { if (alive.current) setResult(out); }, 520);
        return;
      }
      void haptics.tap();
      nudge();
      setMessage("");
      setTimeout(reset, 320);
    } catch (e) {
      if (!alive.current) return;
      const code = e instanceof GameError ? e.code : "unknown";
      flash(code === "expired" ? s("timeUp") : s(errorKey(code)));
      reset();
    }
  };

  const settle = async (hit: boolean, ring: number) => {
    if (landmark) return settleLandmark(hit, ring);
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
      flash(s(errorKey(code)));
      reset();
    }
  };

  const release = (dx: number, vx: number, vy: number, dy: number) => {
    const { height: h, kind: ballKind, state: st } = latest.current;
    if ((ballKind === "gold" ? st.gold_balls : st.wax_balls) <= 0) {
      flash(s("noBalls"));
      Animated.spring(ball, { toValue: { x: 0, y: 0 }, useNativeDriver: NATIVE }).start(() => { busy.current = false; });
      return;
    }
    void haptics.tap();
    setMessage("");
    const travel = capsuleY(h) - ballY(h, insets.bottom);
    const strong = vy < STRONG_FLICK || (MOUSE && dy < MOUSE_DRAG);
    const landX = Math.max(-220, Math.min(220, dx + vx * 170));
    const landY = strong ? travel : travel * .62;
    Animated.parallel([
      Animated.timing(ball, { toValue: { x: landX, y: landY }, duration: 460, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }),
      Animated.timing(ballScale, { toValue: .42, duration: 460, useNativeDriver: NATIVE }),
    ]).start(() => {
      if (!alive.current) return;
      void settle(strong && Math.abs(landX) < hitHalfWidth && !jumping.current, ringNow());
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
      if ((g.dy < -50 && g.vy < -.3) || (MOUSE && g.dy < MOUSE_DRAG)) releaseRef.current(g.dx, g.vx, g.vy, g.dy);
      else Animated.spring(ball, { toValue: { x: 0, y: 0 }, useNativeDriver: NATIVE }).start(() => { busy.current = false; });
    },
    onPanResponderTerminate: () => { ball.setValue({ x: 0, y: 0 }); busy.current = false; },
  }), [ball]);

  const count = kind === "gold" ? state.gold_balls : state.wax_balls;
  const source = vesselParts[capsule.vessel as VesselKind]?.assembled;
  const name = t(`shop.vessel.${result?.vessel ?? capsule.vessel}`);
  const timedOut = !!landmark && secondsLeft === 0 && !result;
  const clock = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;
  const ringScale = ringPhase.interpolate({ inputRange: [0, 1], outputRange: [MIN_RING, 1] });

  return <View onLayout={(e: LayoutChangeEvent) => setHeight(e.nativeEvent.layout.height)}
    style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 40, backgroundColor: mapPalette.land }}>
    <ThrowBackground />
    {height > 0 && <>
      <Svg pointerEvents="none" style={{ position: "absolute", left: "50%", marginLeft: -80, top: capsuleY(height) + vesselSize / 2 - 26 }} width={160} height={44}><Ellipse cx={80} cy={22} rx={78} ry={20} fill={C.ink} opacity={.14} /></Svg>
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: capsuleY(height) - vesselSize / 2, height: vesselSize, alignItems: "center" }}>
        <Animated.View style={{ width: vesselSize, height: vesselSize, alignItems: "center", justifyContent: "center", transform: [{ translateY: hop }, { translateX: shake }] }}>
          {source ? <Image source={source} style={{ width: vesselSize, height: vesselSize }} resizeMode="contain" accessibilityLabel={s("corruptedCapsule")} /> : null}
          <Animated.View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, width: vesselSize, height: vesselSize, opacity: crack }}>
            {source ? <Image source={source} style={{ width: vesselSize, height: vesselSize, tintColor: C.ink, opacity: .3 }} resizeMode="contain" /> : null}
            <Animated.View style={{ position: "absolute", top: vesselSize * .02, right: vesselSize * .04, transform: [{ scale: throb }] }}><AngerMark size={vesselSize * .34} /></Animated.View>
          </Animated.View>
          {!result && <View style={{ position: "absolute", width: ringSize, height: ringSize, borderRadius: ringSize / 2, borderWidth: 2, borderColor: "rgba(255,255,255,.95)" }} />}
          {!result && <Animated.View style={{ position: "absolute", width: ringSize, height: ringSize, borderRadius: ringSize / 2, borderWidth: 4, borderColor: RING_COLOR[capsule.rarity], transform: [{ scale: ringScale }] }} />}
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
      {landmark ? <Text style={{ fontFamily: sans, fontSize: 13, color: C.ink, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill, overflow: "hidden", backgroundColor: "rgba(246,248,251,.9)" }}>{clock} · {s("cracksLeft", cracks)}</Text> : <View style={{ flexDirection: "row", gap: 6, padding: 8, borderRadius: radii.pill, backgroundColor: "rgba(246,248,251,.9)" }}>
        {Array.from({ length: capsule.attempts_left }, (_, i) => <View key={i} style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: i < attempts ? C.wax : C.line }} />)}
      </View>}
      <View style={{ width: 44 }} />
    </View>

    {!!message && !result && <Text accessibilityRole="alert" style={{ position: "absolute", top: height * .62, alignSelf: "center", backgroundColor: C.ink, color: C.white, fontFamily: sans, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, overflow: "hidden" }}>{message}</Text>}

    {timedOut && <View style={{ position: "absolute", left: spacing.md, right: spacing.md, bottom: insets.bottom + spacing.md, zIndex: 5, alignItems: "center", gap: spacing.sm, backgroundColor: "rgba(255,255,255,.97)", borderRadius: 22, padding: spacing.lg, borderWidth: 1, borderColor: C.line, ...shadows.card }}>
      <Text style={{ fontFamily: serif, fontSize: 20, color: C.ink }}>{s("timeUp")}</Text>
      <Pressable accessibilityRole="button" onPress={() => onClose(false)} style={{ alignSelf: "stretch", alignItems: "center", backgroundColor: C.blue, borderRadius: radii.pill, paddingVertical: 12 }}>
        <Text style={{ fontFamily: serif, fontSize: 16, color: C.white }}>{s("close")}</Text>
      </Pressable>
    </View>}

    {!result && !timedOut && <View pointerEvents="box-none" style={{ position: "absolute", left: spacing.md, right: spacing.md, bottom: insets.bottom + spacing.md, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
      <Text style={{ flex: 1, fontFamily: sans, fontSize: 12, color: C.ink }}>{count > 0 ? s("balls", state.wax_balls) : s("noBalls")}</Text>
      <Text style={{ flex: 1, textAlign: "center", fontFamily: sans, fontSize: 12, color: C.ink }}>{s(MOUSE ? "flickMouse" : "flick")}</Text>
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
