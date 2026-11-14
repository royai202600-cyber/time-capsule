import React, { useEffect, useRef, useState } from "react";
import { Animated, Text, View } from "react-native";
import { useScreenText } from "../i18n/useScreenText";
import { useReducedMotion } from "../useReducedMotion";
import { C, sans, serif } from "../theme";

const NAVY_TOP = "#22385A", SEAM = "#0E1A2C", NUMBER = "#F3E2BB";

/** One flip card: navy in a brass frame, a lighter top half, a seam with two brass pins.
 *  When the number changes it folds shut and open again; Reduce Motion just swaps it. */
function Tile({ value, unit, reduced }: { value: string; unit: string; reduced: boolean }) {
  const flip = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (reduced) return;
    flip.setValue(0);
    Animated.timing(flip, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [value, reduced, flip]);
  const scaleY = flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.15, 1] });
  return <View style={{ alignItems: "center", gap: 5 }}>
    <View style={{ width: 62, height: 58, borderRadius: 8, borderWidth: 2.5, borderColor: C.brass, backgroundColor: C.ink, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
      <View style={{ position: "absolute", left: 3, right: 3, top: 3, height: 23, borderRadius: 4, backgroundColor: NAVY_TOP }} />
      <Animated.Text style={{ fontFamily: serif, fontSize: 27, lineHeight: 32, color: NUMBER, fontVariant: ["tabular-nums"], transform: [{ scaleY }] }}>{value}</Animated.Text>
      <View style={{ position: "absolute", left: 0, right: 0, top: 26, height: 1.5, backgroundColor: SEAM }} />
      <View style={{ position: "absolute", left: 2, top: 24.5, width: 4, height: 4, borderRadius: 2, backgroundColor: C.brass }} />
      <View style={{ position: "absolute", right: 2, top: 24.5, width: 4, height: 4, borderRadius: 2, backgroundColor: C.brass }} />
    </View>
    <Text style={{ fontFamily: sans, fontSize: 11, color: C.plum }}>{unit}</Text>
  </View>;
}

export function Countdown({ until }: { until: string }) {
  const t = useScreenText();
  const reduced = useReducedMotion();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const s = Math.max(0, Math.floor((new Date(until).getTime() - now) / 1000));
  const values = [Math.floor(s / 86400), Math.floor((s % 86400) / 3600), Math.floor((s % 3600) / 60), s % 60];
  const units = [t("capsule.countdownDay"), t("capsule.countdownHour"), t("capsule.countdownMinute"), t("capsule.countdownSecond")];
  return <View accessibilityRole="timer" accessibilityLabel={values.map((value, i) => `${value} ${units[i]}`).join(" ")} style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginVertical: 8 }}>
    {values.map((value, i) => <Tile key={i} value={i ? String(value).padStart(2, "0") : String(value)} unit={units[i]} reduced={reduced} />)}
  </View>;
}
