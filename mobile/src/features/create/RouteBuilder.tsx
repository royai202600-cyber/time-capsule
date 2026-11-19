// Create step 4, Walk a route (docs/design/hunt-loop.md, section 4): 1–5 brass quest stops built like a private
// hunt's quests. A city template fills three stops in one tap; each stop can change type, swap its question or
// price, take the sender's own question, or go. Places the sender taps on the map start as Arrive.
import React, { useEffect, useState } from "react";
import { Image, Pressable, Text, TextInput, View } from "react-native";
import { haptics } from "../../components/haptics";
import { CITIES } from "../../services/cityPuzzle";
import type { QuestKind } from "../../services/quests";
import {
  arriveStop, cityAt, landmarkNear, ROUTE_LIMITS, routes, stopFromPool, stopProblems,
  type RouteStop, type RouteTemplate,
} from "../../services/routes";
import { C, radii, sans, serif, spacing } from "../../theme";
import { PinPicker } from "../hunt/PinPicker";
import { PoolCard, QuestTypeChips, Stepper } from "../quests/QuestBits";
import { questPicture } from "../quests/questArt";
import { useQuestText } from "../quests/strings";
import { Chip } from "./CreateParts";

const PLACEHOLDER = "#A5AFBD";
const input = { fontFamily: sans, fontSize: 15, color: C.ink, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 } as const;

export function RouteBuilder({ stops, onChange, zh, you }: {
  stops: RouteStop[]; onChange: (s: RouteStop[]) => void; zh: boolean; you: { lat: number; lng: number } | null;
}) {
  const q = useQuestText();
  const playable = CITIES.filter((c) => c.playable);
  const [city, setCity] = useState(() => (stops[0] ? cityAt(stops[0].location_lat, stops[0].location_lng) : you ? cityAt(you.lat, you.lng) : playable[0]!).id);
  const [templates, setTemplates] = useState<RouteTemplate[] | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [missing, setMissing] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let live = true;
    setTemplates(null);
    routes.templates(city).then((t) => { if (live) setTemplates(t); }).catch(() => { if (live) setTemplates([]); });
    return () => { live = false; };
  }, [city]);

  const name = (s: { name_zh: string; name_en: string }) => zh ? s.name_zh || s.name_en : s.name_en || s.name_zh;
  const update = (key: string, patch: Partial<RouteStop>) => onChange(stops.map((s) => s.key === key ? { ...s, ...patch } : s));
  const used = (except?: string) => stops.filter((s) => s.key !== except && s.pool).map((s) => s.pool!.pool_id);
  // Another question / Another price: the nearest unused one to this stop. A stop with none keeps its place.
  const another = async (s: RouteStop, type: "question" | "price", skip: string[]) => {
    setBusy(s.key);
    try {
      const item = await routes.pick(cityAt(s.location_lat, s.location_lng).id, type, s.location_lat, s.location_lng, skip);
      setMissing((m) => ({ ...m, [s.key]: !item }));
      if (item) update(s.key, { type, pool: item, location_lat: item.location_lat, location_lng: item.location_lng, name_zh: item.name_zh, name_en: item.name_en, own_question: undefined, own_answer: undefined });
      else update(s.key, { type, pool: null });
    } catch { setMissing((m) => ({ ...m, [s.key]: true })); }
    finally { setBusy(null); }
  };
  const retype = (s: RouteStop, type: QuestKind) => {
    void haptics.tick();
    if (type === s.type) return;
    setMissing((m) => ({ ...m, [s.key]: false }));
    if (type === "question" || type === "price") { void another(s, type, used(s.key)); return; }
    update(s.key, { type, pool: null, own_question: undefined, own_answer: undefined, catch_count: type === "catch" ? s.catch_count ?? 3 : undefined });
  };
  const useTemplate = (t: RouteTemplate) => { void haptics.tick(); onChange(t.stops.map(stopFromPool)); setMissing({}); };
  const full = stops.length >= ROUTE_LIMITS.stops;

  return <View style={{ gap: 12 }}>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {playable.map((c) => <Chip key={c.id} on={city === c.id} label={zh ? c.name_zh : c.name_en} onPress={() => { setCity(c.id); void haptics.tick(); }} />)}
    </View>
    <Text style={{ fontFamily: sans, fontSize: 12, letterSpacing: 1, color: C.muted }}>{q.templates}</Text>
    {templates?.length === 0 && <Text style={{ fontFamily: sans, fontSize: 13, color: C.muted }}>{q.noTemplates}</Text>}
    {!!templates?.length && <View style={{ gap: 8 }}>
      {templates.map((t) => <Pressable key={t.template_id} accessibilityRole="button" onPress={() => useTemplate(t)}
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: pressed ? C.glass : C.white, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 10 })}>
        <View style={{ flexDirection: "row" }}>
          {t.stops.map((s, i) => <Image key={i} source={questPicture(s.type)} style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: C.brass, marginLeft: i ? -8 : 0 }} />)}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: serif, fontSize: 15, color: C.ink }}>{zh ? t.name_zh : t.name_en}</Text>
          <Text numberOfLines={1} style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{t.stops.map(name).join(" → ")}</Text>
        </View>
      </Pressable>)}
    </View>}

    {!stops.length && <Text style={{ fontFamily: sans, fontSize: 13, lineHeight: 19, color: C.muted }}>{q.routeEmpty}</Text>}
    {stops.map((s, i) => {
      const problems = stopProblems(s);
      const own = s.type === "question" && !s.pool;
      return <View key={s.key} style={{ gap: 10, backgroundColor: C.white, borderWidth: 1, borderColor: problems.length ? C.wax : C.line, borderRadius: 14, padding: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: C.brass, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: serif, fontSize: 14, color: C.white }}>{i + 1}</Text>
          </View>
          <TextInput accessibilityLabel={`${q.stop(i + 1)} ${q.stopName}`} value={name(s)} maxLength={ROUTE_LIMITS.name}
            onChangeText={(v) => update(s.key, zh ? { name_zh: v } : { name_en: v })}
            style={[input, { flex: 1, paddingVertical: 8, fontFamily: serif }]} />
          <Pressable accessibilityRole="button" accessibilityLabel={`${q.remove} ${q.stop(i + 1)}`} onPress={() => { void haptics.tap(); onChange(stops.filter((x) => x.key !== s.key)); }} style={{ paddingVertical: 6 }}>
            <Text style={{ fontFamily: sans, fontSize: 13, color: C.wax, textDecorationLine: "underline" }}>{q.remove}</Text>
          </Pressable>
        </View>
        <QuestTypeChips compact value={s.type} onChange={(k) => retype(s, k)}
          off={(k) => k === "landmark" && !landmarkNear(s.location_lat, s.location_lng)} />
        {(s.pool || ((s.type === "price" || s.type === "question") && missing[s.key])) &&
          <PoolCard item={s.pool ?? null} zh={zh} busy={busy === s.key} empty={s.type === "price" ? q.noPoolPrice : q.noPool}
            onAnother={s.pool ? () => void another(s, s.pool!.type, [...used(), s.pool!.pool_id]) : undefined} />}
        {s.type === "question" && <Pressable accessibilityRole="button" onPress={() => {
          if (own) void another(s, "question", used(s.key));
          else update(s.key, { pool: null, own_question: s.own_question ?? "", own_answer: s.own_answer ?? "" });
        }} style={{ alignSelf: "flex-start" }}>
          <Text style={{ fontFamily: sans, fontSize: 13, color: C.blue, textDecorationLine: "underline" }}>{own ? q.fromPool : q.writeOwn}</Text>
        </Pressable>}
        {own && <>
          <TextInput accessibilityLabel={q.ownQuestion} value={s.own_question ?? ""} onChangeText={(v) => update(s.key, { own_question: v })} maxLength={ROUTE_LIMITS.question}
            multiline placeholder={q.ownQuestionPlaceholder} placeholderTextColor={PLACEHOLDER} style={[input, { minHeight: 64, textAlignVertical: "top" }]} />
          <TextInput accessibilityLabel={q.ownAnswer} value={s.own_answer ?? ""} onChangeText={(v) => update(s.key, { own_answer: v })} maxLength={ROUTE_LIMITS.answer}
            placeholder={q.ownAnswer} placeholderTextColor={PLACEHOLDER} style={input} />
          <Text style={{ fontFamily: sans, fontSize: 12, lineHeight: 17, color: C.muted }}>{q.ownAnswerNote}</Text>
        </>}
        {s.type === "catch" && <Stepper value={s.catch_count ?? 3} max={ROUTE_LIMITS.catches} label={q.catchCount} onChange={(n) => update(s.key, { catch_count: n })} />}
        {s.type === "landmark" && <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{q.landmarkNote}</Text>}
        {problems.map((p) => <Text key={p} style={{ fontFamily: sans, fontSize: 12.5, color: C.wax }}>· {q.stopProblem[p]}</Text>)}
      </View>;
    })}

    <Pressable accessibilityRole="button" disabled={full} onPress={() => { void haptics.tap(); setPicking(true); }}
      style={({ pressed }) => ({ alignItems: "center", paddingVertical: 12, borderRadius: radii.pill, borderWidth: 1.5, borderColor: C.blue, backgroundColor: pressed ? C.glass : C.white, opacity: full ? .5 : 1 })}>
      <Text style={{ fontFamily: serif, fontSize: 15, color: C.blue }}>{full ? q.routeFull(ROUTE_LIMITS.stops) : q.addOnMap}</Text>
    </Pressable>

    {picking && <PinPicker quest="arrive" at={stops.length ? { lat: stops[stops.length - 1]!.location_lat, lng: stops[stops.length - 1]!.location_lng } : you ?? playable.find((c) => c.id === city) ?? null}
      you={you} onClose={() => setPicking(false)}
      onPick={(pin) => { setPicking(false); onChange([...stops, arriveStop(pin.lat, pin.lng, pin.name)]); void haptics.tick(); }} />}
  </View>;
}
