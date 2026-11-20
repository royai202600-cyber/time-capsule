import React from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { lightBurst } from "../../art/manifest";
import { useLanguage } from "../../i18n";
import { COPIES } from "../../services/copies";
import type { ThrowResult } from "../../services/game";
import { C, radii, sans, serif, shadows, spacing } from "../../theme";
import { useCopiesText } from "../copies/strings";
import { VESSELS } from "../shop/strings";
import { useGameText } from "./strings";

export type Restored = Pick<ThrowResult, "vessel" | "copies" | "stars" | "is_new" | "xp_gained">;

export function RestoreLightBurst({ size, burst }: { size: number; burst: Animated.Value }) {
  return <Animated.Image source={lightBurst} resizeMode="contain" style={{
    position: "absolute", left: "50%", marginLeft: -size * 1.4, top: -size * .9, width: size * 2.8, height: size * 2.8,
    opacity: burst.interpolate({ inputRange: [0, .12, .3, .75, 1], outputRange: [0, .35, 1, .75, .38] }),
    transform: [
      { scale: burst.interpolate({ inputRange: [0, .12, .4, 1], outputRange: [.3, .45, 1, 1.08] }) },
      { rotate: burst.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "38deg"] }) },
    ],
  }} />;
}

export function RestoreResultCard({ result, bottom, onCollect }: { result: Restored; bottom: number; onCollect: () => void }) {
  const { language } = useLanguage();
  const s = useGameText();
  const cp = useCopiesText();
  const name = VESSELS[result.vessel as keyof typeof VESSELS]?.name[language];
  return <View style={{ position: "absolute", left: spacing.md, right: spacing.md, bottom: bottom + spacing.md, alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,.97)", borderRadius: 22, padding: spacing.lg, borderWidth: 1, borderColor: C.line, ...shadows.card }}>
    {/* With copies on, `copies` is the balance after the catch, shown below instead of stars. */}
    {(result.is_new || !COPIES) && <Text style={{ fontFamily: sans, fontSize: 12, letterSpacing: 1.2, color: C.brass }}>{result.is_new ? s("newFind") : s("copies", result.copies ?? 0)}</Text>}
    <Text style={{ fontFamily: serif, fontSize: 24, color: C.ink }}>{s("restored")}{name ? ` · ${name}` : ""}</Text>
    {COPIES
      ? <Text style={{ fontFamily: serif, fontSize: 16, color: C.brass }}>{cp.label(result.copies)}</Text>
      : <Text accessibilityLabel={`${result.stars} / 5`} style={{ fontSize: 16, letterSpacing: 3, color: C.brass }}>{"★".repeat(result.stars)}<Text style={{ color: C.line }}>{"★".repeat(5 - result.stars)}</Text></Text>}
    <Text style={{ fontFamily: sans, fontSize: 13, color: C.muted }}>{s("xp", result.xp_gained)}</Text>
    <Pressable accessibilityRole="button" onPress={onCollect} style={{ marginTop: 8, alignSelf: "stretch", alignItems: "center", backgroundColor: C.wax, borderRadius: radii.pill, paddingVertical: 12 }}>
      <Text style={{ fontFamily: serif, fontSize: 16, color: C.white }}>{s("collect")}</Text>
    </Pressable>
  </View>;
}
