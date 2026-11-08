import React, { useMemo, useRef, useState } from "react";
import { Animated, Easing, PanResponder, Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { ArtIcon } from "../../components/ArtIcon";
import { haptics } from "../../components/haptics";
import { game, GameError, type GameState, type Waypost } from "../../services/game";
import { C, radii, sans, serif, shadows, spacing } from "../../theme";
import { useGameText } from "./strings";
import { ThrowBackground, WaxBall } from "./ThrowScreen";

const NATIVE = Platform.OS !== "web";
const WHEEL = 244;
const SPOKES = Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2);

/** A plain waypost wheel: one flat colour and a little building, so it never competes with capsules. */
function Wheel({ color }: { color: string }) {
  return <Svg width={WHEEL} height={WHEEL} viewBox="0 0 100 100">
    <Circle cx={50} cy={50} r={47} fill={C.paper} stroke={color} strokeWidth={3} />
    <Circle cx={50} cy={50} r={38} fill="none" stroke={color} strokeOpacity={.35} strokeWidth={1} />
    {SPOKES.map((a) => <Line key={a} x1={50 + Math.cos(a) * 20} y1={50 + Math.sin(a) * 20} x2={50 + Math.cos(a) * 44} y2={50 + Math.sin(a) * 44} stroke={color} strokeWidth={2} strokeLinecap="round" />)}
    <Circle cx={50} cy={50} r={17} fill={color} />
    <Path d="M50 40 60 49v2H40v-2Z" fill={C.paper} />
    <Path d="M43 51h14v9H43Z" fill={C.paper} />
  </Svg>;
}

export function SpinScreen({ waypost, language, onState, onClose }: {
  waypost: Waypost; language: "zh" | "en"; onState: (s: GameState) => void; onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const s = useGameText();
  const cooling = !!waypost.cooldown_until && new Date(waypost.cooldown_until).getTime() > Date.now();
  const [reward, setReward] = useState<{ wax: number; gold: number } | null>(null);
  const [note, setNote] = useState(cooling ? s("cooldown") : "");
  const [spent, setSpent] = useState(cooling);
  const rotation = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const turned = useRef(0);
  const busy = useRef(cooling);

  const spin = async (direction: number) => {
    busy.current = true;
    void haptics.tap();
    Animated.timing(rotation, { toValue: turned.current + direction * 1080, duration: 1400, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE }).start();
    try {
      const out = await game.spin(waypost.id);
      onState(out.state);
      setTimeout(() => {
        void haptics.success();
        setReward({ wax: out.wax, gold: out.gold });
        setNote(s("spun", out.wax, out.gold));
        setSpent(true);
        Animated.spring(pop, { toValue: 1, useNativeDriver: NATIVE }).start();
      }, 900);
    } catch (e) {
      void haptics.warn();
      setNote(e instanceof GameError && e.code === "cooldown" ? s("cooldown") : s("error"));
      setSpent(true);
    }
  };
  const spinRef = useRef(spin);
  spinRef.current = spin;

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !busy.current,
    onMoveShouldSetPanResponder: () => !busy.current,
    onPanResponderMove: (_, g) => rotation.setValue(g.dx * .9),
    onPanResponderRelease: (_, g) => {
      if (Math.abs(g.dx) > 50 || Math.abs(g.vx) > .4) { turned.current = g.dx * .9; void spinRef.current(g.dx < 0 ? -1 : 1); }
      else Animated.spring(rotation, { toValue: 0, useNativeDriver: NATIVE }).start();
    },
  }), [rotation]);

  const name = language === "zh" ? waypost.name_zh : waypost.name_en;
  return <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 40 }}>
    <ThrowBackground />
    <View pointerEvents="box-none" style={{ position: "absolute", top: insets.top + spacing.sm, left: spacing.md, right: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
      <Pressable accessibilityRole="button" accessibilityLabel={s("close")} onPress={onClose}
        style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(246,248,251,.94)", alignItems: "center", justifyContent: "center", ...shadows.card }}>
        <ArtIcon name="close" size={22} />
      </Pressable>
      <Text numberOfLines={1} style={{ flex: 1, fontFamily: serif, fontSize: 20, color: C.ink }}>{name}</Text>
    </View>

    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg }}>
      <Animated.View {...pan.panHandlers} accessibilityRole="adjustable" accessibilityLabel={s("spinHint")}
        style={{
          width: WHEEL, height: WHEEL, opacity: spent && !reward ? .55 : 1,
          transform: [{ rotate: rotation.interpolate({ inputRange: [-3600, 3600], outputRange: ["-3600deg", "3600deg"] }) }],
          ...(Platform.OS === "web" ? ({ touchAction: "none", cursor: "grab", userSelect: "none" } as object) : {}),
        }}>
        <Wheel color={C.blue} />
      </Animated.View>
      {reward && <Animated.View style={{ flexDirection: "row", gap: 6, opacity: pop, transform: [{ scale: pop }] }}>
        {Array.from({ length: reward.wax }, (_, i) => <WaxBall key={i} kind="wax" size={34} />)}
        {reward.gold > 0 && <WaxBall kind="gold" size={34} />}
      </Animated.View>}
      <Text style={{ fontFamily: sans, fontSize: 14, color: C.ink, backgroundColor: "rgba(246,248,251,.86)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill, overflow: "hidden" }}>{note || s("spinHint")}</Text>
    </View>

    {spent && <Pressable accessibilityRole="button" onPress={onClose} style={{ position: "absolute", left: spacing.md, right: spacing.md, bottom: insets.bottom + spacing.md, alignItems: "center", backgroundColor: C.blue, borderRadius: radii.pill, paddingVertical: 13 }}>
      <Text style={{ fontFamily: serif, fontSize: 16, color: C.white }}>{s("done")}</Text>
    </Pressable>}
  </View>;
}
