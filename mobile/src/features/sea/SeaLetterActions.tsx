import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { haptics } from "../../components/haptics";
import { C, sans, serif, spacing } from "../../theme";
import { sea } from "../../services/sea";
import { useSeaText } from "./strings";

// Shown under an opened sea bottle's letter, in place of Reply (the sender is a stranger).
// Keeping needs no call: picking it up already made you its recipient.
export function SeaLetterActions({ capsuleId }: { capsuleId: string }) {
  const s = useSeaText();
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [note, setNote] = useState("");
  const leave = (message: string) => { setNote(message); setTimeout(() => router.replace({ pathname: "/journey" }), 1400); };
  const giveBack = async () => {
    setBusy(true);
    try { await sea.returnToSea(capsuleId); void haptics.page(); leave(s("returned")); }
    catch { setNote(s("errUnknown")); void haptics.warn(); setBusy(false); }
  };
  const report = async (reason: "unkind" | "personal" | "spam" | "other") => {
    setBusy(true);
    try { await sea.report(capsuleId, reason); void haptics.tap(); leave(s("reported")); }
    catch { setNote(s("errUnknown")); void haptics.warn(); setBusy(false); }
  };
  return <View style={{ gap: spacing.sm }}>
    <Btn title={s("keep")} disabled={busy} onPress={() => { void haptics.tap(); router.replace("/"); }} />
    <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted, textAlign: "center" }}>{s("keepNote")}</Text>
    <Btn quiet title={s("giveBack")} disabled={busy} onPress={() => void giveBack()} />
    <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted, textAlign: "center" }}>{s("giveBackNote")}</Text>
    {!!note && <Text accessibilityRole="alert" style={{ fontFamily: serif, color: C.blue, textAlign: "center" }}>{note}</Text>}
    {!reporting ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => setReporting(true)} style={{ alignSelf: "center", padding: spacing.sm }}>
      <Text style={{ fontFamily: sans, fontSize: 13, color: C.muted, textDecorationLine: "underline" }}>{s("report")}</Text>
    </Pressable> : <View style={{ gap: spacing.sm }}>
      <Text style={{ fontFamily: serif, fontSize: 16, color: C.ink }}>{s("reportTitle")}</Text>
      {(["unkind", "personal", "spam", "other"] as const).map((r) => <Btn quiet key={r} disabled={busy} onPress={() => void report(r)}
        title={s(r === "unkind" ? "reasonUnkind" : r === "personal" ? "reasonPersonal" : r === "spam" ? "reasonSpam" : "reasonOther")} />)}
      <Pressable accessibilityRole="button" onPress={() => setReporting(false)} style={{ alignSelf: "center", padding: spacing.sm }}><Text style={{ fontFamily: sans, color: C.muted }}>{s("cancel")}</Text></Pressable>
    </View>}
  </View>;
}
function Btn({ title, onPress, quiet, disabled }: { title: string; onPress: () => void; quiet?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ borderRadius: 14, paddingVertical: 14, alignItems: "center", backgroundColor: quiet ? C.white : C.blue, borderWidth: quiet ? 1.5 : 0, borderColor: C.blue, opacity: disabled ? .5 : pressed ? .85 : 1 })}>
    <Text style={{ fontFamily: sans, fontWeight: "600", color: quiet ? C.blue : C.white }}>{title}</Text>
  </Pressable>;
}
