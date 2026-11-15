// Every open city at a glance (docs/design/admin.md, Overview), with what waits in the review queue on top.
import React, { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { ArtIcon } from "../../components/ArtIcon";
import { useLanguage } from "../../i18n";
import { VESSELS } from "../shop/strings";
import { admin, megabytes, type Region } from "../../services/admin";
import { C, sans, serif, spacing } from "../../theme";
import { useAdmin } from "./AdminShell";
import { useAdminText } from "./strings";
import { AButton, Card, Failed, Loading, Page, Pill, Stat, VesselThumb, useColumns, useLoad } from "./ui";

export default function OverviewScreen() {
  const a = useAdminText();
  const { role } = useAdmin();
  const cities = useLoad(admin.cities, [role]);
  const queue = useLoad(() => admin.queue("open"), [role]);
  const columns = useColumns();
  const open = queue.data?.length ?? 0;
  return <Page title={a.nav.overview} note={a.overviewNote}>
    <Card onPress={() => router.push("/admin/queue" as any)} label={a.nav.queue}
      style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 12, borderColor: open ? "#E9C6D0" : C.line, backgroundColor: open ? "#FBF3F5" : C.white }}>
      <ArtIcon name="check" size={22} color={open ? C.wax : C.muted} />
      <Text style={{ flex: 1, fontFamily: sans, fontSize: 15, color: open ? C.wax : C.muted }}>{open ? a.openReports(open) : a.allClear}</Text>
      <Text style={{ fontFamily: sans, fontSize: 18, color: C.muted }}>›</Text>
    </Card>
    {cities.error ? <Failed onRetry={cities.reload} />
      : !cities.data ? <Loading />
      : <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
          {cities.data.map((c) => <View key={c.id} style={{ width: columns === 1 ? "100%" : `calc(${100 / columns}% - ${(spacing.md * (columns - 1)) / columns}px)` as any }}>
            <CityCard city={c} />
          </View>)}
        </View>}
  </Page>;
}

function CityCard({ city }: { city: Region }) {
  const a = useAdminText();
  const { language } = useLanguage();
  const zh = language === "zh";
  const mb = megabytes(city.coverage.bytes);
  const [wideVessels, setWideVessels] = useState(false);
  const vesselsPerRow = wideVessels ? 6 : 3;
  const vesselRows = Array.from({ length: Math.ceil(city.vessels.length / vesselsPerRow) },
    (_, index) => city.vessels.slice(index * vesselsPerRow, (index + 1) * vesselsPerRow));
  return <Card style={{ gap: spacing.md }}>
    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
      <View style={{ gap: 2 }}>
        <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{zh ? city.country_zh : city.country_en} · {city.timezone}</Text>
        <Text style={{ fontFamily: serif, fontSize: 24, color: C.ink }}>{zh ? city.name_zh : city.name_en}</Text>
      </View>
      {city.coverage.covered
        ? <Pill tone="blue" label={`${a.coverage} · ${mb != null ? a.coverageMb(mb) : "✓"}`} />
        : <Pill tone="wax" label={a.noCoverage} />}
    </View>
    <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: spacing.md, columnGap: spacing.sm }}>
      <Stat label={a.wayposts} value={city.wayposts.common} tone={C.blue} />
      <Stat label={a.landmarks} value={city.wayposts.landmark} tone="#8A6A2E" />
      <Stat label={a.spots} value={city.corrupted_spots} />
      <Stat label={a.outNow} value={city.out_now} tone={C.plum} />
      <Stat label={a.cityHunts} value={city.city_hunts_live} />
      <Stat label={a.privateHunts} value={city.private_hunts} />
    </View>
    <View style={{ gap: spacing.sm }}>
      <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{a.canAppear}</Text>
      <View onLayout={({ nativeEvent }) => setWideVessels(nativeEvent.layout.width >= 374)}
        style={{ gap: spacing.sm, backgroundColor: C.paper, borderRadius: 12, padding: spacing.sm }}>
        {vesselRows.map((row) => <View key={row[0]} style={{ flexDirection: "row", gap: spacing.sm }}>
          {row.map((v) => <View key={v} style={{ flex: 1, minWidth: 0, alignItems: "center", gap: 4 }}>
            <VesselThumb kind={v} size={52} />
            <Text numberOfLines={1} style={{ maxWidth: "100%", fontFamily: sans, fontSize: 11, color: C.ink }}>{(VESSELS as any)[v]?.name[language] ?? v}</Text>
          </View>)}
        </View>)}
      </View>
    </View>
    <View style={{ flexDirection: "row", gap: spacing.sm }}>
      <AButton small title={a.openMap} onPress={() => router.push(`/admin/city/${city.id}` as any)} />
      <AButton small tone="ghost" title={a.openCapsules} onPress={() => router.push(`/admin/capsules?place=${city.id}` as any)} />
    </View>
  </Card>;
}
