import React from "react";
import { Linking, Platform, Pressable, Text, View, useWindowDimensions } from "react-native";
import type { Tables } from "../../services/database.types";
import { C, radii, sans, serif, shadows, spacing } from "../../theme";
import { useLanguage } from "../../i18n";
import { haptics } from "../../components/haptics";
import type { VesselKind } from "../../components/Vessel";
import { PlaceMap } from "./PlaceMap";
import { setFakeLocation, useForegroundLocation } from "./location";
import { distanceMeters } from "../../services/data";
import { navigationUrl } from "./navigation";

type Place = Tables<"places">;
export function CapsuleMapPage({ place, vessel, onGoOpen }: {
  place: Place;
  vessel: VesselKind;
  onGoOpen: () => void;
}) {
  const { t, language } = useLanguage();
  const location = useForegroundLocation();
  const { height } = useWindowDimensions();
  const fix = location.fix;
  const meters = fix ? distanceMeters(fix.lat, fix.lng, place.lat, place.lng) : null;
  const fresh = !!fix && (location.fake || Date.now() - fix.at <= 60000);
  const arrived = meters !== null && meters <= place.radius_m && fix !== null && fix.accuracy <= 200 && fresh;
  const navigate = () => {
    void Linking.openURL(navigationUrl(place, Platform.OS));
    void haptics.tap();
  };
  return <View style={{ flex: 1, width: "100%", maxWidth: 640, alignSelf: "center", padding: spacing.md, gap: spacing.md }}>
    <Text style={{ fontFamily: serif, fontSize: 24, color: C.ink }}>{language === "zh" ? place.name_zh : place.name_en}</Text>
    <Text style={{ fontFamily: sans, color: C.muted }}>{language === "zh" ? place.city_zh : place.city_en}</Text>
    <View style={{ height: Math.min(340, Math.max(220, height - 580)), borderRadius: radii.lg, overflow: "hidden", borderWidth: 1.5, borderColor: C.line, ...shadows.card }}>
      <PlaceMap place={place} fix={fix} vessel={vessel} />
    </View>
    <Text style={{ fontFamily: sans, color: C.ink }}>{language === "zh" ? place.why_zh : place.why_en}</Text>
    {location.status === "explain" && <View style={{ padding: spacing.md, borderRadius: radii.md, backgroundColor: C.white, borderColor: C.line, borderWidth: 1, gap: spacing.sm }}>
      <Text style={{ fontFamily: sans, color: C.ink }}>{t("journey.locationExplainer")}</Text>
      <Action title={t("journey.allowLocation")} onPress={() => void location.request()} />
    </View>}
    {location.status === "denied" && <View style={{ gap: spacing.sm }}>
      <Text style={{ fontFamily: sans, color: C.plum }}>{t(Platform.OS === "web" ? "journey.locationDeniedWeb" : "journey.locationDenied")}</Text>
      {Platform.OS !== "web" && <Action title={t("journey.openSettings")} onPress={() => void location.openSettings()} />}
      <Action title={t("retry")} onPress={() => void location.check()} />
    </View>}
    {location.status === "unavailable" && <View style={{ gap: spacing.sm }}><Text style={{ fontFamily: sans, color: C.plum }}>{t("journey.locationUnavailable")}</Text><Action title={t("retry")} onPress={() => void location.request()} /></View>}
    {location.status === "granted" && !fix && <Text style={{ fontFamily: sans, color: C.muted }}>{t("journey.locating")}</Text>}
    {fix && (!fresh || fix.accuracy > 200) && <Text style={{ fontFamily: sans, color: C.plum }}>{t("journey.inaccurate")}</Text>}
    {fix && <Text style={{ fontFamily: serif, fontSize: 18, color: arrived ? C.blue : C.ink }}>
      {arrived ? `${t("journey.here")} · ${formatDistance(meters!, language)}` : t("journey.distance", formatDistance(meters!, language))}
      {`  ·  ${t("journey.accuracy", Math.round(fix.accuracy))}`}
    </Text>}
    <View style={{ flexDirection: "row", gap: spacing.sm }}>
      <Action title={t("journey.navigate")} onPress={navigate} />
      {arrived && <Action title={t("journey.goOpen")} onPress={() => { void haptics.tap(); onGoOpen(); }} />}
    </View>
    {__DEV__ && <Pressable accessibilityRole="button" onPress={() => setFakeLocation(location.fake ? null : { lat: place.lat, lng: place.lng })}>
      <Text style={{ fontFamily: sans, color: C.muted }}>{location.fake ? t("journey.fakeOff") : t("journey.fakeHere")}</Text>
    </Pressable>}
  </View>;
}
function Action({ title, onPress }: { title: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={{ flex: 1, backgroundColor: C.blue, padding: 13, borderRadius: radii.md, alignItems: "center" }}>
    <Text style={{ fontFamily: sans, color: C.white, fontWeight: "700", textAlign: "center" }}>{title}</Text>
  </Pressable>;
}
export function formatDistance(meters: number, language: "zh" | "en") {
  return meters < 1000 ? `${Math.round(meters)} ${language === "zh" ? "米" : "m"}` : `${(meters / 1000).toFixed(1)} ${language === "zh" ? "公里" : "km"}`;
}
