// The panel the filter button opens: one choice at a time, each with how many pins it would leave on the map.
import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import { ArtIcon } from "../../components/ArtIcon";
import { Vessel } from "../../components/Vessel";
import { gameArt } from "../../art/manifest";
import { haptics } from "../../components/haptics";
import { useSeaText } from "../sea/strings";
import { MAP_FILTERS, type MapFilter } from "./mapFilter";
import { C, radii, sans, serif, shadows, spacing } from "../../theme";

const LABEL = { all: "filterAll", capsules: "filterCapsules", cityHunt: "filterCityHunt", privateHunt: "filterPrivateHunt" } as const;

// The same pictures the map uses: the bottle every public capsule wears, the Waypost gem, the brass quest pin.
function Picture({ filter }: { filter: MapFilter }) {
  if (filter === "capsules") return <Vessel kind="bottle" size={40} />;
  if (filter === "cityHunt") return <Image source={gameArt.waypostGemBlue} style={{ width: 30, height: 40 }} resizeMode="contain" />;
  if (filter === "privateHunt") return <ArtIcon name="pin" size={30} color={C.brass} />;
  return <ArtIcon name="map" size={30} color={C.blue} />;
}

export function MapFilterSheet({ value, counts, onChange, onClose }: {
  value: MapFilter; counts: Record<MapFilter, number>; onChange: (f: MapFilter) => void; onClose: () => void;
}) {
  const s = useSeaText();
  return <View style={{ gap: spacing.sm, backgroundColor: "rgba(255,255,255,.97)", borderRadius: 22, borderWidth: 1, borderColor: C.line, padding: spacing.md, ...shadows.card }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text style={{ fontFamily: serif, fontSize: 17, color: C.ink }}>{s("filterTitle")}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={s("filterClose")} onPress={onClose} hitSlop={8}
        style={{ width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: C.paper }}>
        <ArtIcon name="close" size={16} color={C.muted} />
      </Pressable>
    </View>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
      {MAP_FILTERS.map((f) => {
        const on = f === value;
        return <Pressable key={f} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${s(LABEL[f])} ${counts[f]}`}
          onPress={() => { void haptics.tick(); onChange(f); }}
          style={({ pressed }) => ({ flexBasis: "47%", flexGrow: 1, alignItems: "center", gap: 4, paddingVertical: spacing.sm, borderRadius: radii.md,
            backgroundColor: on ? C.glass : C.white, borderWidth: on ? 1.5 : 1, borderColor: on ? C.blue : C.line, opacity: pressed ? .85 : 1 })}>
          <View style={{ height: 40, justifyContent: "center" }}><Picture filter={f} /></View>
          <Text style={{ fontFamily: sans, fontSize: 13, color: on ? C.blue : C.ink }}>
            {s(LABEL[f])} <Text style={{ color: C.muted }}>{counts[f]}</Text>
          </Text>
        </Pressable>;
      })}
    </View>
  </View>;
}
