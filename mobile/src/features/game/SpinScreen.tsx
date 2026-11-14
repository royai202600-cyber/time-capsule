import React, { useRef, useState } from "react";
import { Animated, Easing, Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { gameArt } from "../../art/manifest";
import { haptics } from "../../components/haptics";
import { game, GameError, type GameState, type Waypost } from "../../services/game";
import { C, radii, serif, shadows, spacing } from "../../theme";
import { errorKey, useGameText } from "./strings";
import { sceneKey } from "./waypostScene";
import { ThrowBackground, WaxBall } from "./ThrowScreen";
import { noWebSelect, useNoWebDrag } from "./noWebDrag";
import { SpinDisc } from "./SpinDisc";

const NATIVE = Platform.OS !== "web";
const STAGGER = .09;

export function SpinScreen({ waypost, language, onState, onClose }: {
  waypost: Waypost; language: "zh" | "en"; onState: (s: GameState) => void; onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const s = useGameText();
  const cooling = !!waypost.cooldown_until && new Date(waypost.cooldown_until).getTime() > Date.now();
  const [reward, setReward] = useState<{ wax: number; gold: number } | null>(null);
  const [note, setNote] = useState(cooling ? s("cooldown") : "");
  const [spent, setSpent] = useState(cooling);
  const rise = useRef(new Animated.Value(0)).current;
  const tally = useRef(new Animated.Value(0)).current;
  const spin = async () => {
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
  useNoWebDrag();
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
      <SpinDisc source={gameArt.wheel[sceneKey(waypost)]} spinnable={!cooling} dim={spent && !reward} label={s("spinHint")} onSpin={() => void spin()}>
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
      </SpinDisc>
      {!reward && <Text style={{ fontSize: 14, color: C.ink, backgroundColor: "rgba(246,248,251,.86)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill, overflow: "hidden" }}>{note || s("spinHint")}</Text>}
    </View>

    <Pressable accessibilityRole="button" onPress={onClose} style={{ position: "absolute", left: spacing.md, right: spacing.md, bottom: insets.bottom + spacing.md, alignItems: "center", backgroundColor: reward ? C.blue : "rgba(246,248,251,.94)", borderRadius: radii.pill, paddingVertical: 13, ...shadows.card }}>
      <Text style={{ fontFamily: serif, fontSize: 16, color: reward ? C.white : C.ink }}>{s(reward ? "done" : "leave")}</Text>
    </Pressable>
  </View>;
}
