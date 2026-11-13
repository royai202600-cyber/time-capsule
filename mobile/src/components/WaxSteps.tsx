import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { SEAL } from "./DockIcons";
import { C, sans, serif } from "../theme";

const D = 34; // drop size

/** Done: a small wax seal with an embossed tick. Current: wax seal in a brass ring with its number.
 *  Future: a dashed outline. Uses the same SEAL outline as the + button and hold-to-open. */
function Drop({ state, n }: { state: "done" | "current" | "future"; n: number }) {
  if (state === "future") return <Svg width={D} height={D} viewBox="0 0 68 68" fill="none">
    <Circle cx={34} cy={34} r={20} fill={C.white} stroke="#CDB9C0" strokeWidth={2.2} strokeDasharray="4 4" />
  </Svg>;
  const current = state === "current";
  return <View style={{ width: D, height: D, alignItems: "center", justifyContent: "center" }}>
    <Svg width={D} height={D} viewBox="0 0 68 68" fill="none" style={{ position: "absolute" }}>
      <Path d={SEAL} fill="#9A2E48" stroke={current ? C.brass : "#74203A"} strokeWidth={current ? 4.5 : 1.5}
        transform={current ? undefined : "translate(34 34) scale(0.8) translate(-34 -34)"} />
      <Circle cx={30} cy={29} r={current ? 21 : 17} fill="#BD4A66" opacity={0.5} />
      {!current && <>
        <Path d="M24 36 l7 7 l13 -15" stroke="#5E1529" strokeOpacity={0.5} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M24 35 l7 7 l13 -15" stroke="#FBF1E1" strokeWidth={4.4} strokeLinecap="round" strokeLinejoin="round" />
      </>}
    </Svg>
    {current && <Text style={{ fontFamily: serif, fontSize: 15, lineHeight: 18, color: "#FBF1E1" }}>{n}</Text>}
  </View>;
}

/** Create progress: wax drops on a curved brass ribbon. Tapping a done drop goes back to it. */
export function WaxSteps({ step, labels, label, onBack, labelSize = 11 }: { step: number; labels: string[]; label: string; onBack: (n: number) => void; labelSize?: number }) {
  const [w, setW] = useState(0);
  const inset = 100 / (2 * labels.length); // ribbon runs between the first and last drop centres
  return <View accessibilityLabel={label} onLayout={e => setW(e.nativeEvent.layout.width)} style={{ paddingTop: 4 }}>
    {w > 0 && <Svg width={w} height={D} style={{ position: "absolute", top: 4, left: 0 }} pointerEvents="none">
      <Path d={`M${w * inset / 100} ${D / 2} C${w * .3} ${D / 2 + 7} ${w * .4} ${D / 2 - 7} ${w / 2} ${D / 2} S${w * .75} ${D / 2 + 7} ${w * (1 - inset / 100)} ${D / 2}`}
        stroke={C.brass} strokeWidth={1.6} fill="none" />
    </Svg>}
    <View style={{ flexDirection: "row" }}>
      {labels.map((name, i) => {
        const n = i + 1, state = n < step ? "done" : n === step ? "current" : "future";
        return <Pressable key={n} disabled={state !== "done"} onPress={() => onBack(n)} accessibilityRole="button"
          accessibilityState={{ disabled: state !== "done", selected: state === "current" }} accessibilityLabel={name}
          style={{ flex: 1, alignItems: "center", gap: 4 }}>
          <Drop state={state} n={n} />
          <Text numberOfLines={1} style={{ fontFamily: sans, fontSize: labelSize, color: state === "done" ? C.plum : state === "current" ? C.ink : C.muted }}>{name}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}
