import React, { useCallback, useState } from "react";
import { Image, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { sealWax } from "../../art/manifest";
import { supabase } from "../../services/supabase";
import { predictionRecord, type RecordRow } from "../../services/prediction";
import { C, handwriting, sans, serif } from "../../theme";
import { usePredictionText } from "./strings";

/** Me → Prediction record: opened predictions you wrote or received. Private; no ranking. */
export function PredictionRecord({ userId }: { userId: string }) {
  const p = usePredictionText();
  const [rows, setRows] = useState<RecordRow[] | null>(null), [names, setNames] = useState<Record<string, string>>({});
  useFocusEffect(useCallback(() => {
    let alive = true;
    predictionRecord(userId).then(async list => {
      const ids = [...new Set(list.map(r => r.other).filter((x): x is string => !!x && x !== userId))];
      const people = ids.length ? (await supabase.from("profiles").select("id,name").in("id", ids)).data ?? [] : [];
      if (!alive) return;
      setNames(Object.fromEntries(people.map(x => [x.id, x.name])));
      setRows([...list].sort((a, b) => b.opened_at.localeCompare(a.opened_at)));
    }).catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, [userId]));
  if (rows === null) return null;
  const yes = rows.filter(r => r.verdict === true).length;
  const who = (r: RecordRow) => !r.other || r.other === userId ? p("recordSelf") : r.role === "sent" ? p("recordTo", names[r.other] ?? "") : p("recordFrom", names[r.other] ?? "");
  return <View style={{ backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 16, gap: 12 }}>
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
      <Text style={{ fontFamily: serif, fontSize: 18, color: C.ink }}>{p("recordTitle")}</Text>
      {rows.length > 0 && <Text style={{ fontFamily: sans, color: C.muted }}>{p("recordCount", yes, rows.length)}</Text>}
    </View>
    {rows.length === 0 && <Text style={{ fontFamily: sans, color: C.muted, fontSize: 13 }}>{p("recordEmpty")}</Text>}
    {rows.map(r => <View key={r.capsule_id} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
      <Image source={sealWax} style={{ width: 32, height: 32, opacity: r.verdict === true ? 1 : .25 }} resizeMode="contain" />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: handwriting, fontSize: 17, lineHeight: 24, color: C.ink }}>{r.prediction}</Text>
        <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{who(r)}</Text>
      </View>
    </View>)}
    {rows.length > 0 && <Text style={{ fontFamily: sans, color: C.muted, fontSize: 12 }}>{p("noRank")}</Text>}
  </View>;
}
