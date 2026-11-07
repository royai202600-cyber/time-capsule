import React, { useEffect, useRef, useState } from "react";
import { Animated, Image, Pressable, Text, TextInput, View } from "react-native";
import { sealWax } from "../../art/manifest";
import { haptics } from "../../components/haptics";
import { C, handwriting, motion, sans, serif } from "../../theme";
import { useReducedMotion } from "../../useReducedMotion";
import { PREDICTION_MAX, setVerdict, type Verdict } from "../../services/prediction";
import { usePredictionText } from "./strings";

// The fortune-slip look shared by every prediction surface: cream paper, uneven corners.
export const slip = { backgroundColor: C.cream, borderWidth: 1, borderColor: "#E5CF9E", borderTopLeftRadius: 4, borderBottomRightRadius: 4, borderTopRightRadius: 16, borderBottomLeftRadius: 16 } as const;
const kicker = { fontFamily: sans, fontSize: 12, fontWeight: "700", color: C.plum, letterSpacing: 1 } as const;

/** Create step 1: letter or prediction. Same flow afterwards. */
export function KindChoice({ kind, onChange }: { kind: "letter" | "prediction"; onChange: (k: "letter" | "prediction") => void }) {
  const p = usePredictionText();
  return <View style={{ gap: 8 }}>
    <Text style={{ fontFamily: sans, color: C.ink }}>{p("kindTitle")}</Text>
    <View style={{ flexDirection: "row", gap: 10 }}>{(["letter", "prediction"] as const).map(k => {
      const on = kind === k;
      return <Pressable key={k} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => { onChange(k); void haptics.tick(); }}
        style={[k === "prediction" ? slip : { borderWidth: 1.5, borderRadius: 16, backgroundColor: C.white }, { flex: 1, padding: 12, gap: 2, borderColor: on ? C.blue : k === "prediction" ? "#E5CF9E" : C.line, borderWidth: on ? 2 : 1.5 }]}>
        <Text style={{ fontFamily: serif, fontSize: 17, color: C.ink }}>{p(k === "letter" ? "kindLetter" : "kindPrediction")}</Text>
        <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{p(k === "letter" ? "kindLetterNote" : "kindPredictionNote")}</Text>
      </Pressable>;
    })}</View>
  </View>;
}

/** Create step 2 for a prediction capsule: the prediction line, written by hand-feel font. */
export function PredictionInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const p = usePredictionText();
  return <View style={{ gap: 8 }}>
    <View style={[slip, { paddingHorizontal: 16, paddingVertical: 14, gap: 6 }]}>
      <Text style={kicker}>{p("label")}</Text>
      <TextInput value={value} onChangeText={onChange} placeholder={p("placeholder")} placeholderTextColor="#A8946A" maxLength={PREDICTION_MAX} multiline textAlignVertical="top"
        accessibilityLabel={p("label")} style={{ minHeight: 84, fontFamily: handwriting, fontSize: 20, lineHeight: 30, color: C.ink, borderBottomWidth: 1, borderStyle: "dashed", borderColor: "#D2B57A", paddingVertical: 4 }} />
      <Text style={{ color: "#8A7550", textAlign: "right", fontSize: 12 }}>{value.length} / {PREDICTION_MAX}</Text>
    </View>
    <Text style={{ color: C.muted, fontFamily: sans, fontSize: 12 }}>{p("sealedNote")}</Text>
    <Text style={{ color: C.muted, fontFamily: sans, fontSize: 12 }}>{p("noAi")}</Text>
  </View>;
}

/** The opened letter's top: the prediction, plus one wax stamp the recipient presses if it came true. */
export function PredictionStamp({ capsuleId, prediction, initial, who }: { capsuleId: string; prediction: string; initial: Verdict; who: string }) {
  const p = usePredictionText();
  const reduced = useReducedMotion();
  const [verdict, setLocal] = useState<Verdict>(initial);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const pop = useRef(new Animated.Value(initial === true ? 1 : 0)).current;
  const stamped = verdict === true;
  useEffect(() => {
    if (!stamped) { pop.setValue(0); return; }
    if (reduced) { pop.setValue(1); return; }
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, ...motion.spring.snappy, useNativeDriver: true }).start();
  }, [stamped, reduced, pop]);
  const toggle = async () => {
    if (busy) return;
    const next: Verdict = stamped ? null : true;
    setBusy(true); setError(""); setLocal(next);
    void (next ? haptics.thump() : haptics.tap());
    try { await setVerdict(capsuleId, next); }
    catch { setLocal(verdict); setError(p("stampError")); void haptics.warn(); }
    finally { setBusy(false); }
  };
  return <View style={{ gap: 8 }}>
    <View style={[slip, { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 18, paddingRight: 110, minHeight: 130, gap: 6 }]}>
      <Text style={kicker}>{who}</Text>
      <Text style={{ fontFamily: handwriting, fontSize: 21, lineHeight: 32, color: C.ink }}>{prediction}</Text>
      <Pressable accessibilityRole="button" accessibilityState={{ checked: stamped, busy }} accessibilityLabel={stamped ? p("cameTrue") : p("stampAsk").replace("\n", " ")} onPress={() => void toggle()}
        style={{ position: "absolute", right: 12, top: 18, width: 90, height: 90, borderRadius: 45, alignItems: "center", justifyContent: "center", borderWidth: stamped ? 0 : 2, borderStyle: "dashed", borderColor: "#D2B57A", backgroundColor: stamped ? "transparent" : "rgba(255,255,255,.45)" }}>
        {!stamped && <Text style={{ fontFamily: sans, fontSize: 11, lineHeight: 15, color: C.muted, textAlign: "center" }}>{p("stampAsk")}</Text>}
        {stamped && <Animated.View style={{ width: 90, height: 90, alignItems: "center", justifyContent: "center", opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [1.8, 1] }) }, { rotate: pop.interpolate({ inputRange: [0, 1], outputRange: ["-18deg", "-8deg"] }) }] }}>
          <Image source={sealWax} style={{ position: "absolute", width: 90, height: 90 }} resizeMode="contain" />
          <Text style={{ fontFamily: serif, fontSize: 17, letterSpacing: 2, color: "#FBEFD9" }}>{p("stampWord")}</Text>
        </Animated.View>}
      </Pressable>
    </View>
    <Text style={{ color: error ? C.wax : C.muted, fontFamily: sans, fontSize: 12 }}>{error || p("stampNote")}</Text>
  </View>;
}

/** Sender side: the prediction stays sealed until opened, then shows with its verdict. */
export function SenderPredictionCard({ opened, prediction, verdict }: { opened: boolean; prediction: string | null; verdict: Verdict }) {
  const p = usePredictionText();
  return <View style={[slip, { padding: 16, gap: 8 }]}>
    <Text style={kicker}>{p("yours")}</Text>
    {opened && prediction ? <>
      <Text style={{ fontFamily: handwriting, fontSize: 19, lineHeight: 29, color: C.ink }}>「{prediction}」</Text>
      <Verdictpill verdict={verdict} />
    </> : <Text style={{ fontFamily: sans, color: C.muted, fontSize: 13 }}>{p("sealedLine")}</Text>}
  </View>;
}

export function Verdictpill({ verdict }: { verdict: Verdict }) {
  const p = usePredictionText();
  const label = verdict === true ? `${p("cameTrue")} ✓` : verdict === false ? p("notTrue") : p("notStamped");
  return <Text style={{ alignSelf: "flex-start", overflow: "hidden", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2, fontFamily: sans, fontSize: 12, fontWeight: "700", color: verdict === true ? C.ink : C.blue, backgroundColor: verdict === true ? C.brass : C.glass }}>{label}</Text>;
}
