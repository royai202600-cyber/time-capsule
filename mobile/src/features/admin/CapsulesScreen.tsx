// Which vessels turn up as Corrupted Capsules, and where (docs/design/admin.md). The same rules seen two
// ways: by place (country → city) and by vessel. Owners and admins can switch to editing (phase 2).
import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useLanguage } from "../../i18n";
import { VESSELS } from "../shop/strings";
import { ADMIN_EDIT, admin, can, type Region, type SpawnRule, type Spawning } from "../../services/admin";
import { C, radii, sans, serif, spacing } from "../../theme";
import { useAdmin } from "./AdminShell";
import { useAdminText, type AdminText } from "./strings";
import { AButton, Card, Failed, Loading, Page, Pill, Section, Segmented, Stat, VesselThumb, useColumns, useLoad, type Tone } from "./ui";
import { PlaceEditor, RuleSheet, WaveEditButtons } from "./SpawnEditor";
import { ADMIN_HUNT_LOOP } from "../../services/adminHuntLoop";
import { SpinButton, spinOf } from "./SpinControls";
import { LevelsLink } from "./LevelsScreen";
import { WAYPOST_LEVELS } from "../../services/waypostLevels";
import { CopiesButton, VesselCopies, perCatchOf } from "./CopiesControls";
import { useHuntLoopText } from "./huntLoopStrings";

const RARITY_TONE: Record<string, Tone> = { common: "blue", uncommon: "plum", rare: "brass" };
const vesselName = (v: string, lang: "zh" | "en") => (VESSELS as any)[v]?.name[lang] ?? v;

export default function CapsulesScreen() {
  const a = useAdminText();
  const { cities, role, refresh } = useAdmin();
  const mayEdit = ADMIN_EDIT && can(role, "edit");
  const [editing, setEditing] = useState(false);
  const { place } = useLocalSearchParams<{ place?: string }>();
  const [view, setView] = useState<"place" | "vessel">("place");
  const data = useLoad(admin.spawning, [role]);
  // A saved change also moves the city cards and the sidebar's numbers.
  const saved = () => { data.reload(); refresh(); };
  const on = mayEdit && editing;
  return <Page title={a.nav.capsules} note={a.capsulesNote}
    right={<View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm }}>
      <Segmented value={view} onChange={setView} options={[{ value: "place", label: a.byPlace }, { value: "vessel", label: a.byVessel }]} />
      {mayEdit && <AButton small tone={editing ? "blue" : "ghost"} title={editing ? a.ed.done : a.ed.edit} onPress={() => setEditing((x) => !x)} />}
    </View>}>
    {data.error ? <Failed onRetry={data.reload} /> : !data.data ? <Loading /> : <>
      <WaveSettings config={data.data.config}>{on && <WaveEditButtons data={data.data} cities={cities} onSaved={saved} />}{on && ADMIN_HUNT_LOOP && <CopiesButton config={data.data.config} onSaved={saved} />}{/* With Waypost levels, the spin reward is level 1's drop list, edited on the levels page. */}{on && !WAYPOST_LEVELS && <SpinButton config={data.data.config} onSaved={saved} />}</WaveSettings>
      <LevelsLink />
      {view === "vessel" ? <ByVessel data={data.data} cities={cities} onSaved={on ? saved : undefined} />
        : on ? <PlaceEditor data={data.data} cities={cities} onSaved={saved} />
        : <ByPlace data={data.data} cities={cities} focus={place} />}
      {!mayEdit && <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted, textAlign: "center" }}>{ADMIN_EDIT ? a.ed.viewOnly : a.editSpawnLater}</Text>}
    </>}
  </Page>;
}

function WaveSettings({ config, children }: { config: Spawning["config"]; children?: React.ReactNode }) {
  const a = useAdminText();
  const h = useHuntLoopText();
  const next = config.next_length;
  const at = next ? new Date(next.starts_at) : null;
  const items = [a.waveEvery(config.wave_minutes), a.showChance(Math.round(config.spawn_chance * 100)),
    a.weights(config.weights.common, config.weights.uncommon, config.weights.rare), a.nearbyMax(config.nearby_max),
    ...(ADMIN_HUNT_LOOP ? [h.copiesPerCatch(perCatchOf(config))] : []),
    ...(spinOf(config) ? [a.spinReward(...spinOf(config)!)] : [])];
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, alignItems: "center" }}>
    <Text style={{ fontFamily: serif, fontSize: 14, color: C.ink, marginRight: 4 }}>{a.waveSettings}</Text>
    {items.map((x) => <Pill key={x} label={x} />)}
    {next && at && <Pill tone="blue" label={a.ed.nextLength(next.minutes, `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`)} />}
    {children}
  </View>;
}

function RuleLine({ rule, a }: { rule: SpawnRule; a: AdminText }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
    {rule.rarity && <Pill tone={RARITY_TONE[rule.rarity]} label={a.rarity[rule.rarity]} />}
    {rule.habitat && <Pill label={a.habitat[rule.habitat]} />}
    <Pill label={rule.hours ? a.hours(rule.hours[0], rule.hours[1]) : a.allDay} />
    <Pill label={rule.dates ? a.dates(rule.dates[0], rule.dates[1]) : a.allYear} />
  </View>;
}

function ByPlace({ data, cities, focus }: { data: Spawning; cities: Region[]; focus?: string }) {
  const a = useAdminText();
  const { language } = useLanguage();
  const zh = language === "zh";
  const columns = useColumns();
  // Country first, so a country's cities sit together; the city opened from Overview leads.
  const ordered = useMemo(() => [...cities].sort((x, y) =>
    Number(y.id === focus) - Number(x.id === focus) || x.country_en.localeCompare(y.country_en) || x.name_en.localeCompare(y.name_en)), [cities, focus]);
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
    {ordered.map((city) => {
      const rules = data.rules.filter((r) => r.regions.includes(city.id));
      const stats = data.stats[city.id];
      return <View key={city.id} style={{ width: columns === 1 ? "100%" : `calc(${100 / columns}% - ${(spacing.md * (columns - 1)) / columns}px)` as any }}>
        <Card style={focus === city.id ? { borderColor: C.lightBlue, borderWidth: 2 } : undefined}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
            <View style={{ gap: 2 }}>
              <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{zh ? city.country_zh : city.country_en}</Text>
              <Text style={{ fontFamily: serif, fontSize: 22, color: C.ink }}>{zh ? city.name_zh : city.name_en}</Text>
            </View>
            <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{a.vesselCount(rules.length)}</Text>
          </View>
          {stats && <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Stat label={a.outNow} value={stats.out_now} tone={C.plum} />
            <Stat label={a.caughtToday} value={stats.caught_today} />
            <Stat label={a.caughtWeek} value={stats.caught_week} />
          </View>}
          <View style={{ gap: spacing.sm }}>
            {rules.map((r) => <View key={r.vessel} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: C.paper, borderRadius: 12, padding: spacing.sm }}>
              <VesselThumb kind={r.vessel} size={56} />
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={{ fontFamily: serif, fontSize: 16, color: C.ink }}>{vesselName(r.vessel, language)}</Text>
                <RuleLine rule={r} a={a} />
              </View>
            </View>)}
          </View>
        </Card>
      </View>;
    })}
  </View>;
}

function ByVessel({ data, cities, onSaved }: { data: Spawning; cities: Region[]; onSaved?: () => void }) {
  const [rule, setRule] = useState<SpawnRule | null>(null);
  const a = useAdminText();
  const { language } = useLanguage();
  const order = Object.keys(VESSELS);
  const sorted = [...data.rules].sort((x, y) => order.indexOf(x.vessel) - order.indexOf(y.vessel));
  const groups: [string, SpawnRule[]][] = [
    [a.groupLive, sorted.filter((r) => !r.never && r.regions.length)],
    [a.groupIdle, sorted.filter((r) => !r.never && !r.regions.length)],
    [a.groupNever, sorted.filter((r) => r.never)],
  ];
  const place = (id: string) => { const c = cities.find((x) => x.id === id); return c ? (language === "zh" ? c.name_zh : c.name_en) : id; };
  return <View style={{ gap: spacing.xl }}>
    {groups.filter(([, list]) => list.length).map(([title, list]) => <Section key={title} title={title} right={<Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{a.vesselCount(list.length)}</Text>}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {list.map((r) => <View key={r.vessel} style={{ width: 172, flexGrow: 1, maxWidth: 240, backgroundColor: C.white, borderRadius: radii.md, borderWidth: 1, borderColor: C.line, padding: spacing.sm, gap: 6, opacity: r.never ? 0.75 : 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <VesselThumb kind={r.vessel} size={48} faded={!!r.never} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: sans, fontSize: 11, color: C.muted }}>No.{String(order.indexOf(r.vessel) + 1).padStart(2, "0")}</Text>
              <Text numberOfLines={2} style={{ fontFamily: serif, fontSize: 14, color: C.ink }}>{vesselName(r.vessel, language)}</Text>
            </View>
          </View>
          {r.never ? <Pill label={a.never[r.never]} />
            : <>
                <Text numberOfLines={1} style={{ fontFamily: sans, fontSize: 12, color: r.regions.length ? C.blue : C.muted }}>
                  {r.regions.length ? `${a.appearsIn} ${r.regions.map(place).join("、")}` : a.nowhere}
                </Text>
                {(r.rarity || r.hours || r.dates || r.habitat) && <RuleLine rule={r} a={a} />}
                {onSaved && r.regions.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel={a.ed.rules(vesselName(r.vessel, language))} onPress={() => setRule(r)}>
                  <Text style={{ fontFamily: sans, fontSize: 13, color: C.blue }}>{a.ed.edit} ›</Text>
                </Pressable>}
              </>}
          {ADMIN_HUNT_LOOP && <VesselCopies rule={r} name={vesselName(r.vessel, language)} onSaved={onSaved} />}
        </View>)}
      </View>
    </Section>)}
    {rule && onSaved && <RuleSheet rule={rule} cities={cities} onClose={() => setRule(null)} onSaved={() => { setRule(null); onSaved(); }} />}
  </View>;
}
