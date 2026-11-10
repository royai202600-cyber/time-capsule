import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, PanResponder, Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { gameArt } from "../../art/manifest";
import { haptics } from "../../components/haptics";
import { game, GameError, type GameState, type Waypost } from "../../services/game";
import { C, radii, serif, shadows, spacing } from "../../theme";
import { useReducedMotion } from "../../useReducedMotion";
import { errorKey, useGameText } from "./strings";
import { sceneKey } from "./waypostScene";
import { ThrowBackground, WaxBall } from "./ThrowScreen";
import { noWebSelect, useNoWebDrag } from "./noWebDrag";

const NATIVE = Platform.OS !== "web";
const DISC = 250;
const STAGGER = .09;

/** The round picture of the Waypost's kind of place, in a brass rim. */
function PlacePicture({ waypost }: { waypost: Waypost }) {
  return <View style={{ width: DISC, height: DISC, borderRadius: DISC / 2, overflow: "hidden", borderWidth: 8, borderColor: C.brass, backgroundColor: C.paper }}>
    <Image source={gameArt.wheel[sceneKey(waypost)]} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
  </View>;
}

/** Points the way to swipe; brightens and slides out as the picture sways toward it. */
function SwipeArrow({ side, nudge }: { side: -1 | 1; nudge: Animated.Value }) {
  return <Animated.View pointerEvents="none" style={{
    position: "absolute", top: DISC / 2 - 16, [side < 0 ? "left" : "right"]: -40,
    opacity: nudge.interpolate({ inputRange: [-1, 0, 1], outputRange: side < 0 ? [1, .6, .3] : [.3, .6, 1] }),
    transform: [{ translateX: nudge.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] }) }],
  }}>
    <Svg width={32} height={32} viewBox="0 0 32 32" fill="none" stroke={C.ink} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <Path d={side < 0 ? "M15 7l-9 9 9 9M25 7l-9 9 9 9" : "M17 7l9 9-9 9M7 7l9 9-9 9"} />
    </Svg>
  </Animated.View>;
}

export function SpinScreen({ waypost, language, onState, onClose }: {
  waypost: Waypost; language: "zh" | "en"; onState: (s: GameState) => void; onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const s = useGameText();
  const reduced = useReducedMotion();
  const cooling = !!waypost.cooldown_until && new Date(waypost.cooldown_until).getTime() > Date.now();
  const [reward, setReward] = useState<{ wax: number; gold: number } | null>(null);
  const [note, setNote] = useState(cooling ? s("cooldown") : "");
  const [spent, setSpent] = useState(cooling);
  const [touched, setTouched] = useState(false);
  const hinting = !touched && !spent;
  const nudge = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(0)).current;
  const tally = useRef(new Animated.Value(0)).current;
  const rotation = useRef(new Animated.Value(0)).current;
  const turned = useRef(0);
  const busy = useRef(cooling);
  const spin = async (direction: number) => {
    busy.current = true;
    void haptics.tap();
    Animated.timing(rotation, { toValue: turned.current + direction * 1440, duration: 1500, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE }).start();
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
  useEffect(() => {
    if (!hinting || reduced) return;
    const step = (toValue: number, duration: number) => Animated.timing(nudge, { toValue, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE });
    const loop = Animated.loop(Animated.sequence([step(1, 420), step(-1, 720), step(0, 420), Animated.delay(800)]));
    loop.start();
    return () => { loop.stop(); nudge.setValue(0); };
  }, [hinting, reduced, nudge]);

  const spinRef = useRef(spin);
  spinRef.current = spin;

  useNoWebDrag();
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !busy.current,
    onMoveShouldSetPanResponder: () => !busy.current,
    onPanResponderGrant: () => setTouched(true),
    onPanResponderMove: (_, g) => { turned.current = g.dx * .9; rotation.setValue(turned.current); },
    onPanResponderRelease: (_, g) => {
      if (Math.abs(g.dx) > 50 || Math.abs(g.vx) > .4) void spinRef.current(g.dx < 0 ? -1 : 1);
      else { turned.current = 0; setTouched(false); Animated.spring(rotation, { toValue: 0, useNativeDriver: NATIVE }).start(); }
    },
  }), [rotation]);

  const name = language === "zh" ? waypost.name_zh : waypost.name_en;
  const balls: ("wax" | "gold")[] = reward ? [...Array<"wax">(reward.wax).fill("wax"), ...Array<"gold">(reward.gold).fill("gold")] : [];
  const lines = reward ? [{ kind: "wax" as const, count: reward.wax }, ...(reward.gold ? [{ kind: "gold" as const, count: reward.gold }] : [])] : [];

  return <View style={[{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 40 }, noWebSelect]}>
    <ThrowBackground />
    <Text numberOfLines={1} style={{ position: "absolute", top: insets.top + spacing.md, left: spacing.lg, right: spacing.lg, textAlign: "center", fontFamily: serif, fontSize: 20, color: C.ink }}>{name}</Text>

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
      <View style={{ width: DISC, height: DISC, alignItems: "center", justifyContent: "center" }}>
        {hinting && <SwipeArrow side={-1} nudge={nudge} />}
        {hinting && <SwipeArrow side={1} nudge={nudge} />}
        <Animated.View style={{ transform: [{ perspective: 900 }, { rotateY: nudge.interpolate({ inputRange: [-1, 1], outputRange: ["-18deg", "18deg"] }) }] }}>
        <Animated.View {...pan.panHandlers} accessibilityRole="adjustable" accessibilityLabel={s("spinHint")}
          style={{
            width: DISC, height: DISC, opacity: spent && !reward ? .5 : 1,
            transform: [{ perspective: 900 }, { rotateY: rotation.interpolate({ inputRange: [-3600, 3600], outputRange: ["-3600deg", "3600deg"] }) }],
            ...(Platform.OS === "web" ? ({ touchAction: "none", cursor: "grab", userSelect: "none" } as object) : {}),
          }}>
          <PlacePicture waypost={waypost} />
        </Animated.View>
        </Animated.View>
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

    <Pressable accessibilityRole="button" onPress={onClose} style={{ position: "absolute", left: spacing.md, right: spacing.md, bottom: insets.bottom + spacing.md, alignItems: "center", backgroundColor: reward ? C.blue : "rgba(246,248,251,.94)", borderRadius: radii.pill, paddingVertical: 13, ...shadows.card }}>
      <Text style={{ fontFamily: serif, fontSize: 16, color: reward ? C.white : C.ink }}>{s(reward ? "done" : "leave")}</Text>
    </Pressable>
  </View>;
}
