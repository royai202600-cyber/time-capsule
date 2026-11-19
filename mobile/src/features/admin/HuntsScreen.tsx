// Hunts in the admin: the question pool and each city's Today's Hunt calendar (HL-U5). One city at a time,
// chosen like the rest of the admin from the cities the server lists.
import React, { useState } from "react";
import { View } from "react-native";
import { useLanguage } from "../../i18n";
import { huntCity } from "../../services/adminHuntLoop";
import { spacing } from "../../theme";
import { useAdmin } from "./AdminShell";
import { useHuntLoopText } from "./huntLoopStrings";
import { QuestionPool } from "./QuestionPool";
import { TodaysHuntCalendar } from "./TodaysHuntCalendar";
import { Choice, Loading, Page, Segmented } from "./ui";

export default function HuntsScreen() {
  const h = useHuntLoopText();
  const { language } = useLanguage();
  const { cities } = useAdmin();
  const [tab, setTab] = useState<"pool" | "calendar">("pool");
  const [region, setRegion] = useState<string | null>(null);
  const city = cities.find((c) => c.id === region) ?? cities[0];
  return <Page title={h.title} note={h.note}
    right={<Segmented value={tab} onChange={setTab} options={[{ value: "pool", label: h.poolTab }, { value: "calendar", label: h.calendarTab }]} />}>
    {!city ? <Loading /> : <View style={{ gap: spacing.lg }}>
      <Choice value={city.id} onChange={setRegion} options={cities.map((c) => ({ value: c.id, label: language === "zh" ? c.name_zh : c.name_en }))} />
      {tab === "pool"
        ? <QuestionPool key={city.id} city={huntCity(city.id)} />
        : <TodaysHuntCalendar key={city.id} city={huntCity(city.id)} timezone={city.timezone} />}
    </View>}
  </Page>;
}
