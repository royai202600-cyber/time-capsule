import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, PanResponder, Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Polygon } from "react-native-svg";
import { ArtIcon } from "../../components/ArtIcon";
import { haptics } from "../../components/haptics";
import { game, GameError, type GameState, type Waypost } from "../../services/game";
import { C, radii, serif, shadows, spacing } from "../../theme";
import { errorKey, useGameText } from "./strings";
import { ThrowBackground, WaxBall } from "./ThrowScreen";

const NATIVE = Platform.OS !== "web";
const GEM = 230;
const SIDES = 6;
const SPIN_MS = 1500;
const STAGGER = .09;

const mix = (a: number[], b: number[], t: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;
const LIGHT = [186, 148, 166], MID = [120, 80, 100], DARK = [74, 44, 60];

/** The Waypost gem as a real six-sided shape, so a swipe genuinely turns it. */
function Gem({ angle, size }: { angle: number; size: number }) {
  const step = (Math.PI * 2) / SIDES;
  const cx = size / 2, cy = size * .46, radius = size * .44, top = size * .40, bottom = size * .50;
  const faces = Array.from({ length: SIDES }, (_, i) => {
    const a0 = angle + i * step, a1 = a0 + step, mid = (a0 + a1) / 2;
    return { x0: cx + radius * Math.sin(a0), x1: cx + radius * Math.sin(a1), facing: Math.cos(mid), side: Math.sin(mid) };
  }).filter((face) => face.facing > 0);
  return <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
    {faces.map((face, i) => {
      const light = Math.max(0, Math.min(1, face.facing * .75 - face.side * .4));
      return <React.Fragment key={i}>
        <Polygon points={`${cx},${cy - top} ${face.x0},${cy} ${face.x1},${cy}`} fill={mix(MID, LIGHT, light)} />
        <Polygon points={`${face.x0},${cy} ${face.x1},${cy} ${cx},${cy + bottom}`} fill={mix(DARK, MID, light)} />
      </React.Fragment>;
    })}
  </Svg>;
}

export function SpinScreen({ waypost, language, onState, onClose }: {
  waypost: Waypost; language: "zh" | "en"; onState: (s: GameState) => void; onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const s = useGameText();
  const cooling = !!waypost.cooldown_until && new Date(waypost.cooldown_until).getTime() > Date.now();
  const [angle, setAngle] = useState(.35);
  const [reward, setReward] = useState<{ wax: number; gold: number } | null>(null);
  const [note, setNote] = useState(cooling ? s("cooldown") : "");
  const [spent, setSpent] = useState(cooling);
  const rise = useRef(new Animated.Value(0)).current;
  const tally = useRef(new Animated.Value(0)).current;
  const current = useRef(.35);
  const busy = useRef(cooling);
  const frame = useRef<number | null>(null);

  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);

  const turn = (direction: number) => {
    const from = current.current, to = from + direction * Math.PI * 6, start = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / SPIN_MS);
      const next = from + (to - from) * (1 - Math.pow(1 - t, 3));
      current.current = next;
      setAngle(next);
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  };

  const spin = async (direction: number) => {
    busy.current = true;
    void haptics.tap();
    turn(direction);
    try {
      const out = await game.spin(waypost.id);
      onState(out.state);
      setTimeout(() => {
        void haptics.success();
        setReward({ wax: out.wax, gold: out.gold });
        setSpent(true);
        rise.setValue(0); tally.setValue(0);
        Animated.timing(rise, { toValue: 1, duration: 1500, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }).start();
        Animated.timing(tally, { toValue: 1, duration: 2800, easing: Easing.linear, useNativeDriver: NATIVE }).start();
      }, 700);
    } catch (e) {
      void haptics.warn();
      setNote(s(errorKey(e instanceof GameError ? e.code : "unknown")));
      setSpent(true);
    }
  };
  const spinRef = useRef(spin);
  spinRef.current = spin;

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !busy.current,
    onMoveShouldSetPanResponder: () => !busy.current,
    onPanResponderMove: (_, g) => { const next = .35 + g.dx * .014; current.current = next; setAngle(next); },
    onPanResponderRelease: (_, g) => {
      if (Math.abs(g.dx) > 50 || Math.abs(g.vx) > .4) void spinRef.current(g.dx < 0 ? -1 : 1);
    },
  }), []);

  const name = language === "zh" ? waypost.name_zh : waypost.name_en;
  const balls: ("wax" | "gold")[] = reward ? [...Array<"wax">(reward.wax).fill("wax"), ...Array<"gold">(reward.gold).fill("gold")] : [];
  const lines = reward ? [{ kind: "wax" as const, count: reward.wax }, ...(reward.gold ? [{ kind: "gold" as const, count: reward.gold }] : [])] : [];

  return <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 40 }}>
    <ThrowBackground />
    <View pointerEvents="box-none" style={{ position: "absolute", top: insets.top + spacing.sm, left: spacing.md, right: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
      <Pressable accessibilityRole="button" accessibilityLabel={s("close")} onPress={onClose}
        style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(246,248,251,.94)", alignItems: "center", justifyContent: "center", ...shadows.card }}>
        <ArtIcon name="close" size={22} />
      </Pressable>
      <Text numberOfLines={1} style={{ flex: 1, fontFamily: serif, fontSize: 20, color: C.ink }}>{name}</Text>
    </View>

    <View pointerEvents="none" style={{ position: "absolute", top: insets.top + 68, right: spacing.md, alignItems: "flex-end", gap: 8 }}>
      {lines.map((line, i) => <Animated.View key={line.kind} style={{
        flexDirection: "row", alignItems: "center", gap: 6,
        opacity: tally.interpolate({ inputRange: [0, .08 + i * .06, .8, 1], outputRange: [0, 1, 1, 0] }),
        transform: [{ translateX: tally.interpolate({ inputRange: [0, .08 + i * .06, 1], outputRange: [28, 0, 0] }) }],
      }}>
        <Text style={{ fontFamily: serif, fontSize: 20, color: C.ink }}>+{line.count}</Text>
        <WaxBall kind={line.kind} size={30} />
      </Animated.View>)}
    </View>

    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg }}>
      <View style={{ width: GEM, height: GEM, alignItems: "center", justifyContent: "center" }}>
        <View {...pan.panHandlers} accessibilityRole="adjustable" accessibilityLabel={s("spinHint")}
          style={{
            width: GEM, height: GEM, opacity: spent && !reward ? .5 : 1,
            ...(Platform.OS === "web" ? ({ touchAction: "none", cursor: "grab", userSelect: "none" } as object) : {}),
          }}>
          <Gem angle={angle} size={GEM} />
        </View>
        {balls.map((kind, i) => {
          const start = Math.min(.5, i * STAGGER);
          const end = Math.min(1, start + .55);
          const drift = (i % 2 ? 1 : -1) * (24 + (i % 3) * 22);
          return <Animated.View key={i} pointerEvents="none" style={{
            position: "absolute", width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center",
            backgroundColor: "rgba(255,255,255,.34)", borderWidth: 1, borderColor: "rgba(255,255,255,.75)",
            opacity: rise.interpolate({ inputRange: [start, start + .08, end - .15, end], outputRange: [0, 1, 1, 0], extrapolate: "clamp" }),
            transform: [
              { translateX: rise.interpolate({ inputRange: [start, end], outputRange: [0, drift], extrapolate: "clamp" }) },
              { translateY: rise.interpolate({ inputRange: [start, end], outputRange: [20, -190], extrapolate: "clamp" }) },
            ],
          }}><WaxBall kind={kind} size={38} /></Animated.View>;
        })}
      </View>
      {!reward && <Text style={{ fontSize: 14, color: C.ink, backgroundColor: "rgba(246,248,251,.86)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill, overflow: "hidden" }}>{note || s("spinHint")}</Text>}
    </View>

    {spent && <Pressable accessibilityRole="button" onPress={onClose} style={{ position: "absolute", left: spacing.md, right: spacing.md, bottom: insets.bottom + spacing.md, alignItems: "center", backgroundColor: C.blue, borderRadius: radii.pill, paddingVertical: 13 }}>
      <Text style={{ fontFamily: serif, fontSize: 16, color: C.white }}>{s("done")}</Text>
    </Pressable>}
  </View>;
}
