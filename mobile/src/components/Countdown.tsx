import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useF1Text } from "../i18n/f1";
import { C, sans, serif } from "../theme";
export function Countdown({ until }: { until: string }) {
  const t = useF1Text();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const s = Math.max(0, Math.floor((new Date(until).getTime() - now) / 1000));
  const values = [Math.floor(s / 86400), Math.floor((s % 86400) / 3600), Math.floor((s % 3600) / 60), s % 60];
  const units = [t("capsule.countdownDay"), t("capsule.countdownHour"), t("capsule.countdownMinute"), t("capsule.countdownSecond")];
  return <View accessibilityRole="timer" accessibilityLabel={values.map((value, i) => `${value} ${units[i]}`).join(" ")} style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginVertical: 8 }}>
    {values.map((value, i) => <View key={i} style={{ minWidth: 58, alignItems: "center", paddingVertical: 8, paddingHorizontal: 4, borderWidth: 1, borderColor: "#CDD5DF", borderRadius: 8, backgroundColor: C.white }}><Text style={{ fontFamily: serif, fontSize: 26, fontWeight: "700", color: C.blue, lineHeight: 30, fontVariant: ["tabular-nums"] }}>{i ? String(value).padStart(2, "0") : value}</Text><Text style={{ fontFamily: sans, fontSize: 11, color: C.muted }}>{units[i]}</Text></View>)}
  </View>;
}
