import React, { useCallback, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { sealWax } from "../../art/manifest";
import { ArtIcon } from "../../components/ArtIcon";
import { haptics } from "../../components/haptics";
import { supabase } from "../../services/supabase";
import { predictionRecord, type RecordRow } from "../../services/prediction";
import { C, sans, serif, shadows } from "../../theme";
import { useReducedMotion } from "../../useReducedMotion";
import { usePredictionText } from "./strings";

/** Me → Prediction record: opened predictions you wrote or received. Private; no ranking. */
export function PredictionRecord({ userId }: { userId: string }) {
  const [rows, setRows] = useState<RecordRow[] | null>(null), [names, setNames] = useState<Record<string, string>>({});
  useFocusEffect(useCallback(() => {
    let alive = true;
    predictionRecord(userId).then(async list => {
      const ids = [...new Set(list.map(r => r.other).filter((x): x is string => !!x && x !== userId))];
      const people = ids.length ? (await supabase.from("profiles").select("id,name").in("id", ids)).data ?? [] : [];
      if (!alive) return;
      setNames(Object.fromEntries(people.map(x => [x.id, x.name])));
      setRows(list);
    }).catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, [userId]));
  if (rows === null) return null;
  return <PredictionRecordCard key={userId} rows={rows} names={names} userId={userId} />;
}

/** Compact profile preview, with the complete private record available in a dialog. */
export function PredictionRecordCard({ rows, names, userId }: {
  rows: RecordRow[]; names: Record<string, string>; userId: string;
}) {
  const p = usePredictionText();
  const reduced = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const ordered = [...rows].sort((a, b) => b.opened_at.localeCompare(a.opened_at));
  const successful = ordered.filter(r => r.verdict === true);
  const close = () => setExpanded(false);
  const count = p("recordCount", successful.length, rows.length);
  const item = (r: RecordRow) => {
    const who = !r.other || r.other === userId ? p("recordSelf") : r.role === "sent" ? p("recordTo", names[r.other] ?? "") : p("recordFrom", names[r.other] ?? "");
    return <View key={r.capsule_id} style={styles.row}>
      <Image source={sealWax} accessible={false} style={[styles.seal, r.verdict !== true && { tintColor: C.muted, opacity: .25 }]} resizeMode="contain" />
      <View style={{ flex: 1 }}>
        <Text style={styles.prediction}>{r.prediction}</Text>
        <Text style={styles.detail}>{who}</Text>
      </View>
    </View>;
  };
  return <View style={styles.card}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Text style={[styles.title, { flex: 1 }]}>{p("recordTitle")}</Text>
      {rows.length > 0 && <Text style={styles.detail}>{count}</Text>}
      {rows.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel={p("recordViewAll")} accessibilityState={{ expanded }} hitSlop={6}
        onPress={() => { void haptics.tap(); setExpanded(true); }} style={styles.more}>
        <Text style={{ fontFamily: sans, fontSize: 13, color: C.blue }}>{p("recordMore")} ›</Text>
      </Pressable>}
    </View>
    {successful.slice(0, 2).map(item)}
    {successful.length === 0 && <Text style={styles.empty}>{p(rows.length ? "recordNoSuccess" : "recordEmpty")}</Text>}
    <Modal visible={expanded} accessibilityLabel={p("recordTitle")} transparent animationType={reduced ? "none" : "fade"} onRequestClose={close}>
      <View style={styles.overlay}>
        <Pressable accessible={false} focusable={false} onPress={close} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={styles.dialog}>
          <View style={styles.dialogHeader}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text accessibilityRole="header" style={styles.title}>{p("recordTitle")}</Text>
              <Text style={styles.detail}>{count}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={p("recordClose")} onPress={close} style={styles.close}>
              <ArtIcon name="close" size={22} color={C.plum} />
            </Pressable>
          </View>
          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={styles.history}>{ordered.map(item)}</ScrollView>
        </View>
      </View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 16, gap: 10 },
  title: { fontFamily: sans, fontSize: 16, lineHeight: 24, color: C.ink, flexShrink: 1 },
  prediction: { fontFamily: serif, fontSize: 16, lineHeight: 24, color: C.ink },
  detail: { fontFamily: sans, fontSize: 12, lineHeight: 18, color: C.muted },
  empty: { fontFamily: sans, fontSize: 13, lineHeight: 20, color: C.muted },
  row: { flexDirection: "row", gap: 10, alignItems: "center" },
  seal: { width: 26, height: 26 },
  more: { minHeight: 32, paddingHorizontal: 6, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.line, borderRadius: 999 },
  overlay: { flex: 1, padding: 20, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(22,38,63,.36)" },
  dialog: { width: "100%", maxWidth: 600, maxHeight: "85%", backgroundColor: C.white, borderRadius: 20, borderWidth: 1, borderColor: C.line, overflow: "hidden", ...shadows.card },
  dialogHeader: { flexDirection: "row", alignItems: "center", gap: 12, paddingLeft: 18, paddingRight: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  history: { padding: 18, gap: 12 },
});
