import { Text, View } from "react-native";
import { Avatar } from "../../components/Avatar";
import { Vessel, type VesselKind } from "../../components/Vessel";
import { useLanguage } from "../../i18n";
import { PUBLIC_CAPSULE_PICKUP_RADIUS_M } from "../../services/publicCapsule";
import { C, sans, serif, spacing } from "../../theme";
import { daysSince, distanceText, usePublicCapsuleText } from "../publicCapsule/strings";

import { Btn, Small } from "./JourneyControls";
import type { Item } from "./journeyModel";
export function SelectedCard({ item, busy, count, index, onStep, onPickUp, onDirections, onView, onMap }: {
  item: Item; busy: boolean; count: number; index: number; onStep: (d: 1 | -1) => void;
  onPickUp: (i: Extract<Item, { kind: "publicCapsule" }>) => void; onDirections: (lat: number, lng: number) => void;
  onView: (i: Extract<Item, { kind: "place" }>) => void; onMap: (i: Extract<Item, { kind: "place" }>) => void;
}) {
  const s = usePublicCapsuleText();
  const { t, language } = useLanguage();
  const near = item.meters <= PUBLIC_CAPSULE_PICKUP_RADIUS_M;
  const nav = <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
    <Small onPress={() => onStep(-1)} label="‹" />
    <Text style={{ fontFamily: sans, fontSize: 11, color: C.muted }}>{index + 1} / {count}</Text>
    <Small onPress={() => onStep(1)} label="›" />
  </View>;
  if (item.kind === "place") {
    const name = language === "zh" ? item.pin.place.name_zh : item.pin.place.name_en;
    return <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Vessel kind={(item.pin.vessel ?? "dome") as VesselKind} size={48} idle />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: sans, fontSize: 11, color: C.brass }}>{s("yourCapsule")}</Text>
          <Text style={{ fontFamily: serif, fontSize: 17, color: C.ink }}>{name}</Text>
          <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{near ? s("here") : s("away", distanceText(item.meters))}</Text>
        </View>
        {nav}
      </View>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Btn flex title={t("journey.viewCapsule")} onPress={() => onView(item)} />
        <Btn flex quiet title={t("journey.viewMap")} onPress={() => onMap(item)} />
      </View>
    </View>;
  }
  const b = item.publicCapsule;
  return <View style={{ gap: spacing.sm }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
      <View>
        <Vessel kind="bottle" size={52} idle />
        <View style={{ position: "absolute", right: -6, top: -4, borderRadius: 14, borderWidth: 2, borderColor: C.white }}><Avatar avatar={b.sender.avatar} size={24} /></View>
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontFamily: sans, fontSize: 11, color: C.brass }}>{s("publicCapsuleFrom", b.sender.name)}</Text>
        <Text numberOfLines={2} style={{ fontFamily: serif, fontSize: 17, color: C.ink }}>「{b.hint}」</Text>
        <Text numberOfLines={1} style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>
          {[b.sender.city ? s("fromCity", b.sender.city) : null, s("drifted", daysSince(b.sealed_at)), b.returns ? s("returns", b.returns) : null].filter(Boolean).join(" · ")}
        </Text>
      </View>
      {nav}
    </View>
    {near
      ? <Btn title={busy ? s("picking") : s("pickUp")} disabled={busy} onPress={() => onPickUp(item)} />
      : <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Text style={{ flex: 1, fontFamily: sans, fontSize: 13, color: C.blue }}>{s("walkCloser", distanceText(item.meters - PUBLIC_CAPSULE_PICKUP_RADIUS_M))}</Text>
        <Btn quiet title={s("navigate")} onPress={() => onDirections(item.lat, item.lng)} />
      </View>}
  </View>;
}
