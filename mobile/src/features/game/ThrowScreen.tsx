import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, PanResponder, Platform, Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Ellipse, Path, Polygon } from "react-native-svg";
import { vesselParts } from "../../art/manifest";
import { ArtIcon } from "../../components/ArtIcon";
import { haptics } from "../../components/haptics";
import type { VesselKind } from "../../components/Vessel";
import { useLanguage } from "../../i18n";
import { game, GameError, type BallKind, type GameState, type CorruptedCapsule, type LandmarkAttempt, type Rarity, type ThrowResult } from "../../services/game";
import { mapPalette } from "../journey/live/mapHtml";
import { C, radii, sans, serif, shadows, spacing } from "../../theme";
import Reanimated, { cancelAnimation, Easing as Curve, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { fxGlint, gameArt, lightBurst } from "../../art/manifest";
import { crackOverlays } from "../../art/crackOverlays";
import { ANGER_MARK, CORRUPTED_MARK } from "./corruptedLook";
import { useReducedMotion } from "../../useReducedMotion";
import { errorKey, useGameText } from "./strings";
import { FRAME_FIELDS, FRAMES_PER_SECOND, simulateThrow } from "./throwPhysics";

const NATIVE = Platform.OS !== "web";
const RING = 196;
const VESSEL = 170;
const BALL = 92;
const MIN_RING = .24;
const HIT_HALF_WIDTH = 74;
const GIANT_VESSEL = 250;
const GIANT_RING = 290;
const GIANT_HIT_HALF_WIDTH = 120;
const MOUSE = Platform.OS === "web";
const MOUSE_DRAG = -120; // A mouse drag often ends almost still, so distance also counts as a throw.
const RING_HALF_MS: Record<Rarity, number> = { common: 1200, uncommon: 900, rare: 650 };
const RING_COLOR: Record<Rarity, string> = { common: C.brass, uncommon: C.blue, rare: C.wax };
const DUST = Array.from({ length: 8 }, (_, i) => ({
  angle: (i / 8) * Math.PI * 2, reach: 64 + (i % 3) * 26, size: 56 + (i % 3) * 16, turn: `${i * 47}deg`,
}));

export function WaxBall({ kind, size }: { kind: BallKind; size: number }) {
  return <Image source={gameArt.ball[kind]} style={{ width: size, height: size }} resizeMode="contain" />;
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

// The dark layer: the web can dull the picture directly, as the map does; phones lay a vessel-shaped tint on top.
const WEB_DARKEN = Platform.OS === "web";
const ANGER = "M40 12C40 30 30 40 12 40M60 12C60 30 70 40 88 40M12 60C30 60 40 70 40 88M88 60C70 60 60 70 60 88";
/** The comic anger mark that shows a capsule is corrupted, inside the top right of the vessel. */
const GLINTS = Array.from({ length: 8 }, (_, i) => ({ angle: (i / 8) * Math.PI * 2 + .3, reach: 104 + (i % 3) * 34, size: 24 + (i % 3) * 10 }));
type Praise = "praiseGood" | "praiseLovely" | "praisePerfect";
const PRAISE_COLOR: Record<Praise, string> = { praiseGood: C.blue, praiseLovely: "#9A7430", praisePerfect: C.wax };
/** `ring` is 1 at the ring's tightest. */
const praiseFor = (ring: number): Praise => ring >= .8 ? "praisePerfect" : ring >= .45 ? "praiseLovely" : "praiseGood";
const finished = (animation: Animated.CompositeAnimation) => new Promise<void>((done) => animation.start(() => done()));

function AngerMark({ size }: { size: number }) {
  return <Svg width={size} height={size} viewBox="0 0 100 100">
    <Path d={ANGER} stroke="#fff" strokeWidth={18} fill="none" strokeLinecap="round" />
    <Path d={ANGER} stroke="#000" strokeWidth={10} fill="none" strokeLinecap="round" />
  </Svg>;
}

type Restored = Pick<ThrowResult, "vessel" | "copies" | "stars" | "is_new" | "xp_gained">;

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
  const [result, setResult] = useState<Restored | null>(null);
  const [cracks, setCracks] = useState(landmark?.cracks ?? 0);
  const [praise, setPraise] = useState<Praise | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(landmark ? Math.ceil((new Date(landmark.expires_at).getTime() - Date.now()) / 1000) : 0);

  const ringPhase = useRef(new Animated.Value(1)).current;
  const hop = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  // The ball runs on Reanimated: dragged by the finger until released (progress -1), then played along its path.
  const progress = useSharedValue(-1);
  const path = useSharedValue<number[]>([]);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const ballFade = useSharedValue(1);
  const crack = useRef(new Animated.Value(1)).current;
  const dust = useRef(new Animated.Value(0)).current;
  const praiseShow = useRef(new Animated.Value(0)).current;
  const rock = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const wave = useRef(new Animated.Value(0)).current;
  const sparkle = useRef(new Animated.Value(0)).current;
  const dim = useRef(new Animated.Value(0)).current;
  const settling = useRef(false);

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
    if (reduced || result || landmark || celebrating) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        if (settling.current) { schedule(); return; }
        jumping.current = true;
        Animated.sequence([
          Animated.timing(hop, { toValue: -74, duration: 230, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }),
          Animated.timing(hop, { toValue: 0, duration: 270, easing: Easing.bounce, useNativeDriver: NATIVE }),
        ]).start(() => { jumping.current = false; schedule(); });
      }, 2400 + Math.random() * 2800);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [hop, reduced, result, celebrating]);

  const flash = (text: string) => setMessage(text);
  const unlock = () => { busy.current = false; };
  const reset = () => {
    if (!alive.current) return;
    settling.current = false;
    cancelAnimation(progress);
    progress.value = -1;
    dragX.value = 0;
    dragY.value = 0;
    ballFade.value = 0;
    ballFade.value = withTiming(1, { duration: 160 }, (done) => { if (done) runOnJS(unlock)(); });
  };
  const springBack = () => {
    dragX.value = withSpring(0);
    dragY.value = withSpring(0, undefined, (done) => { if (done) runOnJS(unlock)(); });
  };
  const nudge = () => Animated.sequence([-14, 14, -8, 8, 0].map((toValue) =>
    Animated.timing(shake, { toValue, duration: 70, useNativeDriver: NATIVE }))).start();

  const timing = (value: Animated.Value, toValue: number, duration: number, easing?: (n: number) => number) =>
    Animated.timing(value, { toValue, duration, easing, useNativeDriver: NATIVE });

  /** Everything the player feels at the moment of a hit. */
  const impact = (ring: number) => {
    void haptics.tap();
    setPraise(praiseFor(ring));
    praiseShow.setValue(0);
    timing(praiseShow, 1, 1050, Easing.linear).start();
    if (!reduced) {
      dust.setValue(0);
      timing(dust, 1, 620, Easing.out(Easing.cubic)).start();
      Animated.sequence([timing(pop, 1.07, 70), timing(pop, 1, 130)]).start();
    }
  };

  /** The capsule struggles, gathers, and bursts back into its true colours. */
  const restore = async (out: Restored) => {
    setMessage("");
    setCelebrating(true);
    if (reduced) {
      void haptics.success();
      await finished(timing(crack, 0, 420));
      if (alive.current) setResult(out);
      return;
    }
    timing(dim, .58, 620, Easing.inOut(Easing.quad)).start();
    await finished(Animated.sequence([-1, 1, -.75, .75, -.45, .45, 0].map((toValue) => timing(rock, toValue, 105, Easing.inOut(Easing.quad)))));
    if (!alive.current) return;
    await finished(Animated.parallel([timing(pop, .88, 240, Easing.in(Easing.quad)), timing(burst, .12, 240)]));
    if (!alive.current) return;
    void haptics.success();
    dust.setValue(0);
    await finished(Animated.parallel([
      timing(crack, 0, 240),
      Animated.sequence([timing(pop, 1.22, 170, Easing.out(Easing.back(2))), timing(pop, 1, 320, Easing.inOut(Easing.quad))]),
      timing(burst, 1, 1150, Easing.linear),
      Animated.sequence([Animated.delay(640), timing(dim, 0, 510, Easing.inOut(Easing.quad))]),
      timing(wave, 1, 720, Easing.out(Easing.cubic)),
      timing(sparkle, 1, 1050, Easing.out(Easing.quad)),
      timing(dust, 1, 760, Easing.out(Easing.cubic)),
    ]));
    if (alive.current) setResult(out);
  };

  const settleLandmark = async (hit: boolean, ring: number, moved: Promise<void>) => {
    if (!landmark) return;
    if (!hit) {
      void haptics.warn();
      flash(s("miss"));
      await moved;
      reset();
      return;
    }
    impact(ring);
    try {
      const out = await game.landmarkHit({ attempt: landmark.id, ball: latest.current.kind, ring });
      if (!alive.current) return;
      onState(out.state);
      setCracks(out.cracks);
      timing(crack, out.cracks / landmark.cracks, 320).start();
      await moved;
      if (!alive.current) return;
      if (out.result === "won") { await restore(out); return; }
      setMessage("");
      reset();
    } catch (e) {
      if (!alive.current) return;
      const code = e instanceof GameError ? e.code : "unknown";
      flash(code === "expired" ? s("timeUp") : s(errorKey(code)));
      await moved;
      reset();
    }
  };

  const settle = async (hit: boolean, ring: number, moved: Promise<void>) => {
    if (landmark) return settleLandmark(hit, ring, moved);
    const ballKind = latest.current.kind;
    if (hit) impact(ring);
    try {
      const out = await game.throwBall({ id: capsule.id, ball: ballKind, ring, hit });
      if (!alive.current) return;
      onState(out.state);
      setAttempts(out.attempts_left);
      if (out.result === "miss") void haptics.warn();
      await moved;
      if (!alive.current) return;
      if (out.result === "miss") {
        flash(s("miss"));
        reset();
        return;
      }
      if (out.result === "restored") { await restore(out); return; }
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
      await moved;
      reset();
    }
  };

  const release = (dx: number, vx: number, vy: number, dy: number) => {
    const { height: h, kind: ballKind, state: st } = latest.current;
    if ((ballKind === "gold" ? st.gold_balls : st.wax_balls) <= 0) {
      flash(s("noBalls"));
      springBack();
      return;
    }
    void haptics.tap();
    setMessage("");
    settling.current = true;
    const flight = simulateThrow({ dx, dy, vx, vy }, { travel: capsuleY(h) - ballY(h, insets.bottom), vessel: vesselSize, hitHalfWidth, mouse: MOUSE, still: reduced });
    const linear = (ms: number) => ({ duration: ms, easing: Curve.linear });
    const whenItArrives = () => {
      if (!alive.current) return;
      const hit = flight.outcome === "hit" && !jumping.current; // A capsule mid-jump lets the ball pass underneath.
      const route = hit ? flight.hitPath : flight.missPath;
      path.value = route;
      const end = (route.length / FRAME_FIELDS - 1) / FRAMES_PER_SECOND;
      const moved = new Promise<void>((settled) => {
        const finish = () => settled();
        progress.value = withTiming(end, linear((end - flight.resolveAt) * 1000), () => { runOnJS(finish)(); });
      });
      void settle(hit, ringNow(), moved);
    };
    path.value = flight.hitPath;
    progress.value = 0;
    progress.value = withTiming(flight.resolveAt, linear(flight.resolveAt * 1000), (done) => { if (done) runOnJS(whenItArrives)(); });
  };
  const releaseRef = useRef(release);
  releaseRef.current = release;

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !busy.current,
    onMoveShouldSetPanResponder: () => !busy.current,
    onPanResponderGrant: () => { busy.current = true; },
    onPanResponderMove: (_, g) => { dragX.value = g.dx; dragY.value = g.dy; },
    onPanResponderRelease: (_, g) => {
      if ((g.dy < -50 && g.vy < -.3) || (MOUSE && g.dy < MOUSE_DRAG)) releaseRef.current(g.dx, g.vx, g.vy, g.dy);
      else springBack();
    },
    onPanResponderTerminate: () => { dragX.value = 0; dragY.value = 0; busy.current = false; },
  }), [dragX, dragY]);

  const ballStyle = useAnimatedStyle(() => {
    if (progress.value < 0) return { opacity: ballFade.value, transform: [{ translateX: dragX.value }, { translateY: dragY.value }, { scale: 1 }, { rotate: "0deg" }] };
    const frames = path.value;
    const last = frames.length / FRAME_FIELDS - 1;
    const at = Math.min(progress.value * FRAMES_PER_SECOND, last);
    const whole = Math.min(Math.floor(at), last - 1);
    const part = at - whole;
    const read = (field: number) => {
      const from = frames[whole * FRAME_FIELDS + field];
      return from + (frames[(whole + 1) * FRAME_FIELDS + field] - from) * part;
    };
    return { opacity: read(4), transform: [{ translateX: read(0) }, { translateY: read(1) }, { scale: read(2) }, { rotate: `${read(3)}deg` }] };
  });

  const count = kind === "gold" ? state.gold_balls : state.wax_balls;
  const source = vesselParts[capsule.vessel as VesselKind]?.assembled;
  const name = t(`shop.vessel.${result?.vessel ?? capsule.vessel}`);
  const timedOut = !!landmark && secondsLeft === 0 && !result;
  const clock = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;
  const ringScale = ringPhase.interpolate({ inputRange: [0, 1], outputRange: [MIN_RING, 1] });

  return <View onLayout={(e: LayoutChangeEvent) => setHeight(e.nativeEvent.layout.height)}
    style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 40, backgroundColor: mapPalette.land }}>
    <ThrowBackground />
    <Animated.View pointerEvents="none" style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: C.ink, opacity: dim }} />
    {height > 0 && <>
      <Svg pointerEvents="none" style={{ position: "absolute", left: "50%", marginLeft: -80, top: capsuleY(height) + vesselSize / 2 - 26 }} width={160} height={44}><Ellipse cx={80} cy={22} rx={78} ry={20} fill={C.ink} opacity={.14} /></Svg>
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: capsuleY(height) - vesselSize / 2, height: vesselSize, alignItems: "center" }}>
        <Animated.Image source={lightBurst} resizeMode="contain" style={{
          position: "absolute", left: "50%", marginLeft: -vesselSize * 1.4, top: -vesselSize * .9, width: vesselSize * 2.8, height: vesselSize * 2.8,
          opacity: burst.interpolate({ inputRange: [0, .12, .3, .75, 1], outputRange: [0, .35, 1, .75, .38] }),
          transform: [
            { scale: burst.interpolate({ inputRange: [0, .12, .4, 1], outputRange: [.3, .45, 1, 1.08] }) },
            { rotate: burst.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "38deg"] }) },
          ],
        }} />
        <Animated.View style={{ width: vesselSize, height: vesselSize, alignItems: "center", justifyContent: "center", transform: [{ translateY: hop }, { translateX: shake }, { rotate: rock.interpolate({ inputRange: [-1, 1], outputRange: ["-10deg", "10deg"] }) }, { scale: pop }] }}>
          {source ? <Image source={source} style={{ width: vesselSize, height: vesselSize }} resizeMode="contain" accessibilityLabel={s("corruptedCapsule")} /> : null}
          <Animated.View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, width: vesselSize, height: vesselSize, opacity: crack }}>
            {source && WEB_DARKEN ? <Image source={source} style={[{ position: "absolute", top: 0, left: 0, width: vesselSize, height: vesselSize }, { filter: "saturate(.55) brightness(.8)" } as object]} resizeMode="contain" /> : null}
            {source && !WEB_DARKEN ? <Image source={source} style={{ width: vesselSize, height: vesselSize, opacity: .3, tintColor: C.ink }} resizeMode="contain" /> : null}
            {CORRUPTED_MARK === "cracks" && crackOverlays[capsule.vessel] ? <Image source={crackOverlays[capsule.vessel]} style={{ position: "absolute", top: 0, left: 0, width: vesselSize, height: vesselSize }} resizeMode="contain" /> : null}
            {CORRUPTED_MARK === "anger" && <View style={{ position: "absolute", top: vesselSize * ANGER_MARK.throw.top, left: vesselSize * ANGER_MARK.throw.left }}><AngerMark size={vesselSize * ANGER_MARK.throw.size} /></View>}
          </Animated.View>
          {!result && !celebrating && <View style={{ position: "absolute", width: ringSize, height: ringSize, borderRadius: ringSize / 2, borderWidth: 2, borderColor: "rgba(255,255,255,.95)" }} />}
          {!result && !celebrating && <Animated.View style={{ position: "absolute", width: ringSize, height: ringSize, borderRadius: ringSize / 2, borderWidth: 4, borderColor: RING_COLOR[capsule.rarity], transform: [{ scale: ringScale }] }} />}
          {DUST.map((d, i) => <Animated.Image key={i} source={gameArt.hitDust} resizeMode="contain" style={{
            position: "absolute", width: d.size, height: d.size,
            opacity: dust.interpolate({ inputRange: [0, .05, 1], outputRange: [0, 1, 0] }),
            transform: [
              { translateX: dust.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(d.angle) * d.reach] }) },
              { translateY: dust.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(d.angle) * d.reach] }) },
              { rotate: d.turn },
            ],
          }} />)}
          <Animated.View style={{
            position: "absolute", width: vesselSize, height: vesselSize, borderRadius: vesselSize / 2, borderWidth: 5, borderColor: C.brass,
            opacity: wave.interpolate({ inputRange: [0, .05, 1], outputRange: [0, .9, 0] }),
            transform: [{ scale: wave.interpolate({ inputRange: [0, 1], outputRange: [.4, 2.3] }) }],
          }} />
          {GLINTS.map((g, i) => <Animated.Image key={i} source={fxGlint} resizeMode="contain" style={{
            position: "absolute", width: g.size, height: g.size,
            opacity: sparkle.interpolate({ inputRange: [0, .1, .65, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateX: sparkle.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(g.angle) * g.reach] }) },
              { translateY: sparkle.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(g.angle) * g.reach] }) },
              { scale: sparkle.interpolate({ inputRange: [0, .25, 1], outputRange: [.3, 1.25, .7] }) },
            ],
          }} />)}
        </Animated.View>
      </View>
      {praise && <Animated.Text pointerEvents="none" style={{
        position: "absolute", left: 0, right: 0, top: capsuleY(height) - vesselSize / 2 - 46, textAlign: "center",
        fontFamily: serif, fontSize: praise === "praisePerfect" ? 38 : 32, color: PRAISE_COLOR[praise],
        textShadowColor: "rgba(255,255,255,.95)", textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 },
        opacity: praiseShow.interpolate({ inputRange: [0, .08, .75, 1], outputRange: [0, 1, 1, 0] }),
        transform: reduced ? [] : [
          { translateY: praiseShow.interpolate({ inputRange: [0, 1], outputRange: [14, -22] }) },
          { scale: praiseShow.interpolate({ inputRange: [0, .1, .2, 1], outputRange: [.5, 1.2, 1, 1] }) },
        ],
      }}>{s(praise)}</Animated.Text>}

      {!result && !celebrating && <Reanimated.View {...pan.panHandlers} accessibilityRole="adjustable" accessibilityLabel={s("flick")}
        style={[{
          position: "absolute", left: "50%", marginLeft: -BALL / 2, top: ballY(height, insets.bottom) - BALL / 2, width: BALL, height: BALL,
          ...(Platform.OS === "web" ? ({ touchAction: "none", cursor: "grab", userSelect: "none" } as object) : {}),
        }, ballStyle]}>
        <WaxBall kind={kind} size={BALL} />
      </Reanimated.View>}
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

    {!result && !celebrating && !timedOut && <View pointerEvents="box-none" style={{ position: "absolute", left: spacing.md, right: spacing.md, bottom: insets.bottom + spacing.md, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
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
