import React, { useEffect, useState } from "react";
import { Linking, Pressable, Switch, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ArtIcon } from "../../components/ArtIcon";
import { BackButton, Bar, Heading, Screen } from "../../components/Screen";
import { Vessel } from "../../components/Vessel";
import { haptics } from "../../components/haptics";
import { useLanguage } from "../../i18n";
import { goBack } from "../../navigation";
import { C, sans, serif, shadows } from "../../theme";
import type { VesselKind } from "../../vesselArt";
import { ALL_DAYS, clampTime, dayName, dayShort, formatTime, newAlarmId, nextRing, untilText, type Alarm } from "./model";
import { scheduler } from "./scheduler";
import type { Permission } from "./scheduler.types";
import { deleteAlarm, findAlarm, saveAlarm } from "./store";
import { useAlarmText } from "./strings";

/** Set or edit one alarm. New alarms come from an opened capsule's letter view. */
export default function AlarmEditScreen() {
  const params = useLocalSearchParams<{ id?: string; capsule?: string; vessel?: string; name?: string; self?: string }>();
  const t = useAlarmText();
  const { language } = useLanguage();
  const [alarm, setAlarm] = useState<Alarm | null>(null);
  const [isNew, setIsNew] = useState(true);
  const [ask, setAsk] = useState<Permission | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    void findAlarm(params.id).then(found => {
      if (found) { setAlarm(found); setIsNew(false); return; }
      setAlarm({ id: newAlarmId(), capsuleId: params.capsule ?? "", vessel: params.vessel ?? "envelope", senderName: params.name ?? "", self: params.self === "1", hour: 7, minute: 0, days: [...ALL_DAYS], on: true, scheduled: [] });
    });
  }, [params.id]);
  if (!alarm) return <Screen><View /></Screen>;

  const set = (patch: Partial<Alarm>) => { setAlarm({ ...alarm, ...patch }); setError(""); };
  const step = (minutes: number) => { void haptics.tick(); set(clampTime(alarm.hour, alarm.minute + minutes)); };
  const toggleDay = (d: number) => { void haptics.tick(); set({ days: alarm.days.includes(d) ? alarm.days.filter(x => x !== d) : [...alarm.days, d] }); };
  const ring = alarm.on ? nextRing(alarm, now) : null;

  const commit = async () => {
    setBusy(true);
    try { await saveAlarm(alarm); void haptics.success(); goBack(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); void haptics.warn(); }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (!alarm.days.length) { setError(t("needDay")); void haptics.warn(); return; }
    if (!alarm.on) return commit();
    const p = await scheduler.permission();
    if (p === "granted") return commit();
    setAsk(p); // Explain first; the system prompt only comes after "Allow".
  };
  const allow = async () => {
    const p = await scheduler.requestPermission();
    if (p === "granted") { setAsk(null); return commit(); }
    setAsk("denied");
  };
  const remove = async () => { await deleteAlarm(alarm.id); void haptics.tap(); goBack(); };
  const preview = () => router.push({ pathname: "/wake/[id]", params: { id: alarm.capsuleId, preview: "1", vessel: alarm.vessel, name: alarm.senderName, self: alarm.self ? "1" : "0" } });

  return <Screen>
    <Bar><BackButton label={language === "zh" ? "返回" : "Back"} onPress={goBack} /><Heading>{isNew ? t("newTitle") : t("editTitle")}</Heading></Bar>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Vessel kind={alarm.vessel as VesselKind} size={64} />
      <Text style={{ flex: 1, fontFamily: serif, fontSize: 17, color: "#4A5466" }}>{alarm.self ? t("fromSelf") : t("from", alarm.senderName)}</Text>
    </View>

    <View style={{ backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.line, paddingVertical: 14, alignItems: "center", ...shadows.card, opacity: alarm.on ? 1 : .6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Stepper value={String(alarm.hour).padStart(2, "0")} up={() => step(60)} down={() => step(-60)} upLabel={t("hourUp")} downLabel={t("hourDown")} />
        <Text style={{ fontFamily: serif, fontSize: 56, color: C.ink, lineHeight: 70, marginTop: -6 }}>:</Text>
        <Stepper value={String(alarm.minute).padStart(2, "0")} up={() => step(5)} down={() => step(-5)} upLabel={t("minuteUp")} downLabel={t("minuteDown")} />
      </View>
      <Text style={{ fontFamily: sans, fontSize: 13, color: C.muted, minHeight: 20 }}>{ring ? untilText(ring, language, now) : " "}</Text>
    </View>
    {__DEV__ && <Pressable accessibilityRole="button" onPress={() => {
      const soon = new Date(Date.now() + 2 * 60_000);
      soon.setMinutes(soon.getMinutes() + (soon.getSeconds() ? 1 : 0), 0, 0);
      set({ hour: soon.getHours(), minute: soon.getMinutes(), days: [...ALL_DAYS], on: true });
    }} style={{ alignSelf: "flex-end", paddingVertical: 6 }}>
      <Text style={{ color: C.blue, fontFamily: sans, fontSize: 13 }}>{t("testTwoMinutes")}</Text>
    </Pressable>}

    <View style={{ gap: 10 }}>
      <Text style={{ fontFamily: sans, color: C.ink, fontSize: 15 }}>{t("repeat")}</Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {ALL_DAYS.map(d => {
          const on = alarm.days.includes(d);
          return <Pressable key={d} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={dayName(d, language)} onPress={() => toggleDay(d)}
            style={{ width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: on ? C.blue : C.line, backgroundColor: on ? C.blue : C.white }}>
            <Text style={{ fontFamily: sans, fontSize: 15, color: on ? C.white : C.muted }}>{dayShort(d, language)}</Text>
          </Pressable>;
        })}
      </View>
    </View>

    {!isNew && <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><Text style={{ flex: 1, fontFamily: sans, color: C.ink }}>{t("on")}</Text><Switch accessibilityLabel={t("on")} value={alarm.on} onValueChange={on => { void haptics.tick(); set({ on }); }} trackColor={{ true: C.blue }} /></View>}

    {!!error && <Text accessibilityRole="alert" style={{ color: C.wax, fontFamily: sans }}>{error}</Text>}

    {ask ? <Explainer state={ask} t={t} onAllow={() => void allow()} onCancel={() => setAsk(null)} />
      : scheduler.supported ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => void save()} style={{ backgroundColor: C.blue, borderRadius: 14, padding: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, opacity: busy ? .6 : 1 }}>
          <ArtIcon name="alarm" size={20} color={C.white} /><Text style={{ color: C.white, fontFamily: sans, fontSize: 16 }}>{busy ? t("saving") : t("save")}</Text>
        </Pressable>
      : <Note text={t("webOnly")} strong />}

    <Pressable accessibilityRole="button" onPress={preview} style={{ borderRadius: 14, padding: 14, alignItems: "center", borderWidth: 1, borderColor: C.blue, backgroundColor: C.white }}>
      <Text style={{ color: C.blue, fontFamily: sans, fontSize: 15 }}>{t("preview")}</Text>
    </Pressable>
    {scheduler.supported && <Note text={t("limit")} />}
    {!isNew && <Pressable accessibilityRole="button" onPress={() => void remove()} style={{ alignItems: "center", padding: 10 }}><Text style={{ color: C.wax, fontFamily: sans }}>{t("delete")}</Text></Pressable>}
  </Screen>;
}

function Stepper({ value, up, down, upLabel, downLabel }: { value: string; up: () => void; down: () => void; upLabel: string; downLabel: string }) {
  const btn = (label: string, icon: "up" | "down", onPress: () => void) =>
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6} style={{ width: 64, height: 36, alignItems: "center", justifyContent: "center" }}><ArtIcon name={icon} size={24} color={C.blue} /></Pressable>;
  return <View style={{ alignItems: "center" }}>
    {btn(upLabel, "up", up)}
    <Text style={{ fontFamily: serif, fontSize: 56, lineHeight: 70, color: C.ink, minWidth: 80, textAlign: "center", fontVariant: ["tabular-nums"] }}>{value}</Text>
    {btn(downLabel, "down", down)}
  </View>;
}

export function Note({ text, strong = false }: { text: string; strong?: boolean }) {
  return <View style={{ flexDirection: "row", gap: 10, padding: 14, borderRadius: 12, backgroundColor: strong ? "#FBF3E2" : C.paper, borderWidth: 1, borderColor: strong ? C.brass : C.line }}>
    <ArtIcon name="alarm" size={18} color={strong ? "#8A6A2E" : C.muted} />
    <Text style={{ flex: 1, fontFamily: sans, fontSize: 13, lineHeight: 20, color: strong ? "#5E4A22" : C.muted }}>{text}</Text>
  </View>;
}

function Explainer({ state, t, onAllow, onCancel }: { state: Permission; t: ReturnType<typeof useAlarmText>; onAllow: () => void; onCancel: () => void }) {
  return <View style={{ backgroundColor: C.white, borderRadius: 16, borderWidth: 1.5, borderColor: C.brass, padding: 18, gap: 12 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><ArtIcon name="alarm" size={22} color={C.plum} /><Text style={{ flex: 1, fontFamily: serif, fontSize: 17, color: C.ink }}>{t("askTitle")}</Text></View>
    <Text style={{ fontFamily: sans, fontSize: 14, lineHeight: 22, color: "#4A5466" }}>{state === "denied" ? t("denied") : t("askBody")}</Text>
    <View style={{ flexDirection: "row", gap: 10 }}>
      <Pressable accessibilityRole="button" onPress={onCancel} style={{ flex: 1, padding: 13, borderRadius: 12, borderWidth: 1, borderColor: C.line, alignItems: "center" }}><Text style={{ color: C.muted, fontFamily: sans }}>{t("notNow")}</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={state === "denied" ? () => void Linking.openSettings() : onAllow} style={{ flex: 1.4, padding: 13, borderRadius: 12, backgroundColor: C.blue, alignItems: "center" }}><Text style={{ color: C.white, fontFamily: sans }}>{state === "denied" ? t("openSettings") : t("allow")}</Text></Pressable>
    </View>
  </View>;
}
