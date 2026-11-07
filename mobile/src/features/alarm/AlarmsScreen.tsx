import React from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { router } from "expo-router";
import { BackButton, Bar, Heading, Screen } from "../../components/Screen";
import { Vessel } from "../../components/Vessel";
import { haptics } from "../../components/haptics";
import { useLanguage } from "../../i18n";
import { goBack } from "../../navigation";
import { C, sans, serif } from "../../theme";
import type { VesselKind } from "../../vesselArt";
import { Note } from "./AlarmEditScreen";
import { describeDays, formatTime } from "./model";
import { scheduler } from "./scheduler";
import { saveAlarm, useAlarms } from "./store";
import { useAlarmText } from "./strings";

/** Me → Alarms: every wake-up alarm saved on this device. */
export default function AlarmsScreen() {
  const t = useAlarmText();
  const { language } = useLanguage();
  const alarms = useAlarms();
  return <Screen>
    <Bar><BackButton label={language === "zh" ? "返回" : "Back"} onPress={goBack} /><Heading>{t("title")}</Heading></Bar>
    {!scheduler.supported && <Note text={t("webList")} strong />}
    {alarms && !alarms.length && <Text style={{ fontFamily: sans, color: C.muted, lineHeight: 22, paddingVertical: 12 }}>{t("empty")}</Text>}
    <View style={{ gap: 12 }}>
      {alarms?.map(a => <Pressable key={a.id} accessibilityRole="button" onPress={() => { void haptics.tap(); router.push({ pathname: "/alarms/edit", params: { id: a.id } }); }}
        style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.line, paddingVertical: 12, paddingHorizontal: 14 }}>
        <View style={{ opacity: a.on ? 1 : .45 }}><Vessel kind={a.vessel as VesselKind} size={58} /></View>
        <View style={{ flex: 1, opacity: a.on ? 1 : .55 }}>
          <Text style={{ fontFamily: serif, fontSize: 32, lineHeight: 40, color: C.ink }}>{formatTime(a.hour, a.minute)}</Text>
          <Text numberOfLines={1} style={{ fontFamily: sans, fontSize: 13, color: C.muted }}>{describeDays(a.days, language)} · {a.self ? t("fromSelf") : t("from", a.senderName)}</Text>
        </View>
        <Switch accessibilityLabel={`${formatTime(a.hour, a.minute)} ${t("on")}`} value={a.on} disabled={!scheduler.supported} onValueChange={on => { void haptics.tick(); void saveAlarm({ ...a, on }); }} trackColor={{ true: C.blue }} />
      </Pressable>)}
    </View>
    {scheduler.supported && !!alarms?.length && <Note text={t("limit")} />}
  </Screen>;
}
