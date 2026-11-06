import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { BackButton } from '../../components/Screen';
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { goBack } from "../../navigation";
import { useAuth } from "../../services/auth";
import { useCapsules, usePlaces } from "../../services/hooks";
import { useLanguage } from "../../i18n";
import { haptics } from "../../components/haptics";
import { C, radii, sans, serif, shadows, spacing } from "../../theme";
import { useForegroundLocation } from "./location";
import { JourneyMap, type JourneyPin } from "./JourneyMap";
import { Passport } from "./Passport";
import { CapsuleMapPage } from "./CapsuleMapPage";
import type { VesselKind } from "../../components/Vessel";

export default function JourneyScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const { t, language } = useLanguage();
  const placeData = usePlaces();
  const capsuleData = useCapsules(userId, "inbox");
  const { fix } = useForegroundLocation();
  const [selected, select] = useState<JourneyPin | null>(null);
  const [passport, setPassport] = useState(false);
  const [mapPlace, setMapPlace] = useState<JourneyPin | null>(null);
  useFocusEffect(useCallback(() => {
    if (userId) { void placeData.refresh(); void capsuleData.refresh(); }
  }, [userId, placeData.refresh, capsuleData.refresh]));
  const capsules = capsuleData.data ?? [];
  const places = placeData.data ?? [];
  const pins = useMemo<JourneyPin[]>(() => places.map((place) => {
    const here = capsules.filter((capsule) => capsule.place === place.id);
    const visited = here.some((capsule) => !!capsule.opened_at);
    const waiting = here.find((capsule) => !capsule.opened_at);
    return { place, kind: visited ? "visited" : waiting ? "waiting" : "other", vessel: waiting?.vessel, waiting: !!waiting };
  }), [places, capsules]);
  const stampRows = useMemo(() => places.map((place) => {
    const openedAt = capsules.filter((capsule) => capsule.place === place.id && capsule.opened_at)
      .map((capsule) => capsule.opened_at!).sort().at(-1) ?? null;
    return { place, openedAt };
  }), [places, capsules]);
  const earned = stampRows.filter((row) => row.openedAt && !row.place.brand_vessel).length;
  const total = places.filter((place) => !place.brand_vessel).length;
  const current = selected && pins.find((pin) => pin.place.id === selected.place.id);
  const related = current && capsules.filter((capsule) => capsule.place === current.place.id);
  const waiting = related?.find((capsule) => !capsule.opened_at);
  const opened = related?.filter((capsule) => capsule.opened_at).sort((a, b) => b.opened_at!.localeCompare(a.opened_at!))[0];
  if (mapPlace) {
    const mapCapsule = capsules.find((capsule) => capsule.place === mapPlace.place.id && !capsule.opened_at);
    return <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
      <BackButton label={t("back")} onPress={() => setMapPlace(null)} />
      <CapsuleMapPage place={mapPlace.place} vessel={(mapCapsule?.vessel ?? "dome") as VesselKind} onGoOpen={() => { if (mapCapsule) router.push({ pathname: "/capsule/[id]", params: { id: mapCapsule.id } }); }} />
    </SafeAreaView>;
  }
  return <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
    <View style={{ width: "100%", maxWidth: 640, alignSelf: "center", flex: 1, padding: spacing.md, gap: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <BackButton label={t("back")} onPress={goBack} />
        <Text style={{ fontFamily: serif, fontSize: 28, color: C.ink }}>{t("journey.title")}</Text>
      </View>
      {(placeData.error || capsuleData.error) && <Text style={{ fontFamily: sans, color: C.plum }}>{t("journey.loadError")}</Text>}
      <JourneyMap pins={pins} fix={fix} onSelect={(pin) => { void haptics.tick(); select(pin); }} />
      {current && <ScrollView style={{ flexGrow: 0, maxHeight: 200, borderRadius: radii.md, borderWidth: 1, borderColor: C.line, ...shadows.card }} contentContainerStyle={{ padding: spacing.md, backgroundColor: C.white }}>
        <Text style={{ fontFamily: serif, fontSize: 20, color: C.ink }}>{language === "zh" ? current.place.name_zh : current.place.name_en}</Text>
        <Text style={{ fontFamily: sans, color: C.muted }}>{language === "zh" ? current.place.city_zh : current.place.city_en}</Text>
        <Text style={{ fontFamily: sans, color: C.ink, marginTop: spacing.sm }}>{language === "zh" ? current.place.why_zh : current.place.why_en}</Text>
        <Text style={{ fontFamily: sans, color: C.blue, marginTop: spacing.sm }}>
          {waiting ? t("journey.waitingHere", related?.filter((capsule) => !capsule.opened_at).length ?? 1) : opened ? t("journey.openedHere", new Date(opened.opened_at!).toLocaleDateString(language === "zh" ? "zh-Hant" : "en-US")) : t("journey.noCapsules")}
        </Text>
        {waiting && <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/capsule/[id]", params: { id: waiting.id } })} style={{ marginTop: spacing.sm, padding: spacing.sm, borderRadius: radii.sm, backgroundColor: C.blue, alignItems: "center" }}><Text style={{ fontFamily: sans, color: C.white }}>{t("journey.viewCapsule")}</Text></Pressable>}
        {waiting && <Pressable accessibilityRole="button" onPress={() => setMapPlace(current)} style={{ marginTop: spacing.sm, padding: spacing.sm, borderRadius: radii.sm, borderWidth: 1, borderColor: C.blue, alignItems: "center" }}><Text style={{ fontFamily: sans, color: C.blue }}>{t("journey.viewMap")}</Text></Pressable>}
      </ScrollView>}
      <Pressable accessibilityRole="button" onPress={() => { void haptics.tap(); setPassport(true); }} style={{ alignSelf: "flex-end", borderRadius: radii.pill, backgroundColor: C.ink, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, marginTop: 4, marginBottom: 8 }}>
        <Text style={{ fontFamily: serif, color: C.brass, fontSize: 16 }}>{t("journey.passport")}  {earned} / {total}</Text>
      </Pressable>
    </View>
    <Passport visible={passport} onClose={() => setPassport(false)} userId={userId} stamps={stampRows} />
  </SafeAreaView>;
}
