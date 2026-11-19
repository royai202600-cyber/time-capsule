// Each city's Today's Hunt, day by day (docs/review/todays-hunt.md, "HL-U5 calendar"): the three quests the
// server scheduled, with their answers for staff. Days that haven't started can reorder, swap a question or price
// for another pool entry, or move the catch pin. Every write is logged; Undo is in Activity.
import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useLanguage } from "../../i18n";
import { can } from "../../services/admin";
import {
  addDays, adminHuntLoop, allPoolPages, hasPlace, localDate,
  type AdminQuest, type CalendarDay, type CatchSlot, type PoolEntry,
} from "../../services/adminHuntLoop";
import { C, radii, sans, serif, spacing } from "../../theme";
import { useAdmin } from "./AdminShell";
import { sayError, useHuntLoopText, type HuntLoopText, type Say } from "./huntLoopStrings";
import { AButton, Card, Choice, Empty, Failed, Field, Loading, Notice, Pill, Sheet, Stepper, shortDate } from "./ui";

const SPANS = [7, 14, 28];

export function TodaysHuntCalendar({ city, timezone }: { city: string; timezone: string }) {
  const h = useHuntLoopText();
  const { language } = useLanguage();
  const { role } = useAdmin();
  const mayEdit = can(role, "edit");
  const today = localDate(timezone);
  const [span, setSpan] = useState(14);
  const [days, setDays] = useState<CalendarDay[] | null>(null);
  const [failed, setFailed] = useState<Say | null>(null);
  const [change, setChange] = useState<{ day: CalendarDay; quest: AdminQuest } | null>(null);
  const [note, setNote] = useState<{ date: string; say: Say } | null>(null);

  const load = async () => {
    setFailed(null); setDays(null);
    try { setDays(await adminHuntLoop.calendar(city, today, span)); }
    catch (e) { setFailed(() => sayError(e)); }
  };
  useEffect(() => { void load(); }, [city, span, role]);
  const put = (d: CalendarDay) => setDays((x) => x?.map((y) => y.date === d.date ? d : y) ?? null);
  const swap = async (day: CalendarDay, a: number, b: number) => {
    setNote(null);
    try { put(await adminHuntLoop.swap(city, day.date, a, b)); }
    catch (e) { setNote({ date: day.date, say: sayError(e) }); }
  };

  return <View style={{ gap: spacing.md }}>
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm, justifyContent: "space-between" }}>
      <Choice value={span} onChange={setSpan} options={SPANS.map((n) => ({ value: n, label: h.days(n) }))} />
      {mayEdit && <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{h.undoNote}</Text>}
    </View>
    {!mayEdit ? <Notice text={h.error.forbidden} /> : failed ? <View style={{ gap: spacing.sm }}><Notice tone="stop" text={failed(h)} /><Failed onRetry={() => void load()} /></View>
      : !days ? <Loading /> : !days.length ? <Empty text={h.reason.not_scheduled} /> : <View style={{ gap: spacing.sm }}>
      {days.map((d) => {
        const locked = d.started || !mayEdit;
        return <Card key={d.date} style={{ gap: spacing.sm, ...(d.date === today ? { borderColor: C.lightBlue, borderWidth: 2 } : null) }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
            <Text style={{ fontFamily: serif, fontSize: 17, color: C.ink, marginRight: 4 }}>{dayLabel(d.date, language)}</Text>
            {d.date === today && <Pill tone="blue" label={h.todayTag} />}
            {d.started && d.date !== today && <Pill label={h.started} />}
          </View>
          {d.unavailable_reason && <Notice tone={d.unavailable_reason === "not_scheduled" ? "info" : "warn"} text={h.reason[d.unavailable_reason]} />}
          {d.quests.map((q, i) => <QuestRow key={q.quest_id} quest={q} h={h} zh={language === "zh"}
            onUp={!locked && i > 0 ? () => void swap(d, d.quests[i - 1]!.ordinal, q.ordinal) : undefined}
            onDown={!locked && i < d.quests.length - 1 ? () => void swap(d, q.ordinal, d.quests[i + 1]!.ordinal) : undefined}
            onChange={!locked ? () => setChange({ day: d, quest: q }) : undefined} />)}
          {note?.date === d.date && <Notice tone="stop" text={note.say(h)} />}
        </Card>;
      })}
    </View>}
    {change && (change.quest.type === "catch"
      ? <CatchSheet city={city} day={change.day} quest={change.quest} onClose={() => setChange(null)} onSaved={(d) => { put(d); setChange(null); }} />
      : <PickSheet city={city} day={change.day} quest={change.quest} onClose={() => setChange(null)} onSaved={(d) => { put(d); setChange(null); }} />)}
  </View>;
}

const dayLabel = (date: string, lang: "zh" | "en") => {
  const d = new Date(`${date}T00:00:00Z`);
  const wd = new Intl.DateTimeFormat(lang === "zh" ? "zh-TW" : "en-GB", { weekday: "short", timeZone: "UTC" }).format(d);
  return `${shortDate(`${date}T12:00:00Z`, lang)} · ${wd}`;
};

export function answerText(q: AdminQuest, zh: boolean) {
  const c = q.correct_answer;
  if (!c) return null;
  if ("choice" in c) { const ch = q.question?.choices?.[c.choice]; return ch ? (zh ? ch.zh : ch.en) : String(c.choice + 1); }
  if ("usd" in c) return `${q.price?.currency ?? ""} ${c.local_amount} · US$${c.usd.toFixed(2)}`;
  return c.text;
}

function QuestRow({ quest: q, h, zh, onUp, onDown, onChange }: {
  quest: AdminQuest; h: HuntLoopText; zh: boolean; onUp?: () => void; onDown?: () => void; onChange?: () => void;
}) {
  const prompt = q.question ? (zh ? q.question.prompt_zh : q.question.prompt_en) : q.price ? (zh ? q.price.prompt_zh : q.price.prompt_en) : null;
  const answer = answerText(q, zh);
  const arrow = (glyph: string, label: string, on?: () => void) => <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={!on} onPress={on}
    style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: C.line, backgroundColor: C.white, alignItems: "center", justifyContent: "center", opacity: on ? 1 : 0.3 }}>
    <Text style={{ fontFamily: sans, fontSize: 14, color: C.blue }}>{glyph}</Text>
  </Pressable>;
  return <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", backgroundColor: C.paper, borderRadius: radii.sm, padding: spacing.sm }}>
    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: C.blue, alignItems: "center", justifyContent: "center", marginTop: 2 }}>
      <Text style={{ fontFamily: serif, fontSize: 13, color: C.white }}>{q.ordinal}</Text>
    </View>
    <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
      <Text style={{ fontFamily: sans, fontSize: 11, letterSpacing: .5, color: q.type === "price" ? "#8A6A2E" : q.type === "catch" ? C.wax : C.blue }}>
        {h.kindName[q.type]}{q.type === "catch" && q.catch_count ? ` · ${h.catchCount(q.catch_count)}` : ""}
      </Text>
      <Text numberOfLines={1} style={{ fontFamily: serif, fontSize: 15, color: C.ink }}>{zh ? q.name_zh : q.name_en}</Text>
      {!!prompt && <Text numberOfLines={2} style={{ fontFamily: sans, fontSize: 13, color: C.ink }}>{prompt}</Text>}
      {!!answer && <Text style={{ fontFamily: sans, fontSize: 12, color: "#7A5A1E" }}>{h.answerIs(answer)}</Text>}
      {q.type === "catch" && <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{q.location_lat.toFixed(5)}, {q.location_lng.toFixed(5)}</Text>}
    </View>
    {(onUp || onDown || onChange) && <View style={{ alignItems: "flex-end", gap: 6 }}>
      <View style={{ flexDirection: "row", gap: 4 }}>{arrow("↑", h.moveUp, onUp)}{arrow("↓", h.moveDown, onDown)}</View>
      {onChange && <Pressable accessibilityRole="button" onPress={onChange}><Text style={{ fontFamily: sans, fontSize: 13, color: C.blue }}>{h.change} ›</Text></Pressable>}
    </View>}
  </View>;
}

function PickSheet({ city, day, quest, onClose, onSaved }: { city: string; day: CalendarDay; quest: AdminQuest; onClose: () => void; onSaved: (d: CalendarDay) => void }) {
  const h = useHuntLoopText();
  const { language } = useLanguage();
  const zh = language === "zh";
  const [items, setItems] = useState<PoolEntry[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Say | null>(null);
  useEffect(() => {
    let live = true;
    // The list pages 50 at a time; the picker needs every published entry, so follow next_cursor to the end.
    allPoolPages((cursor) => adminHuntLoop.pool(city, "published", cursor))
      .then((all) => live && setItems(all.filter((e) => e.type === quest.type && hasPlace(e))), () => live && setItems([]));
    return () => { live = false; };
  }, [city, quest.type]);
  const pick = async (e: PoolEntry) => {
    setBusy(e.id); setNote(null);
    try { onSaved(await adminHuntLoop.setSlot(city, day.date, quest.ordinal, { pool_id: e.id })); }
    catch (err) { setNote(() => sayError(err)); }
    finally { setBusy(null); }
  };
  return <Sheet title={h.pickTitle(h.kindName[quest.type])} onClose={onClose}>
    <Text style={{ fontFamily: sans, fontSize: 12, lineHeight: 18, color: C.muted }}>{dayLabel(day.date, language)} · {h.pickNote}</Text>
    {!!note && <Notice tone="stop" text={note(h)} />}
    {!items ? <Loading /> : !items.length ? <Empty text={h.noPick} /> : items.map((e) => {
      const current = e.id === quest.pool_id;
      return <Card key={e.id} onPress={current || busy ? undefined : () => void pick(e)} label={zh ? e.prompt_zh : e.prompt_en}
        style={{ gap: 4, opacity: busy && busy !== e.id ? .5 : 1, ...(current ? { borderColor: C.blue } : null) }}>
        <Text style={{ fontFamily: serif, fontSize: 15, color: C.ink }}>{zh ? e.prompt_zh : e.prompt_en}</Text>
        <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>📍 {zh ? e.place_zh : e.place_en}{current ? ` · ${h.current}` : ""}</Text>
      </Card>;
    })}
  </Sheet>;
}

function CatchSheet({ city, day, quest, onClose, onSaved }: { city: string; day: CalendarDay; quest: AdminQuest; onClose: () => void; onSaved: (d: CalendarDay) => void }) {
  const h = useHuntLoopText();
  const { language } = useLanguage();
  const [count, setCount] = useState(quest.catch_count ?? 3);
  const [whereText, setWhereText] = useState(`${quest.location_lat.toFixed(6)}, ${quest.location_lng.toFixed(6)}`);
  const [nameZh, setNameZh] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Say | null>(null);
  const m = whereText.trim().match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
  const save = async () => {
    if (!m) return;
    setBusy(true); setNote(null);
    const slot: CatchSlot = { lat: Number(m[1]), lng: Number(m[2]), count, name_zh: nameZh, name_en: nameEn };
    try { onSaved(await adminHuntLoop.setSlot(city, day.date, quest.ordinal, slot)); }
    catch (e) { setNote(() => sayError(e)); }
    finally { setBusy(false); }
  };
  return <Sheet title={h.catchTitle} onClose={onClose}
    footer={<View style={{ gap: spacing.sm }}>
      {!!note && <Notice tone="stop" text={note(h)} />}
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <AButton title={h.save} disabled={busy || !m} onPress={() => void save()} />
        <AButton tone="ghost" title={h.cancel} onPress={onClose} />
      </View>
    </View>}>
    <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{dayLabel(day.date, language)}</Text>
    <Stepper label={h.kindName.catch} value={count} min={1} max={5} onChange={setCount} format={(n) => h.catchCount(n)} />
    <Field label={h.catchWhere} value={whereText} onChangeText={setWhereText} inputMode="decimal" />
    <Field label={`${h.catchName} · 中文`} value={nameZh} onChangeText={setNameZh} placeholder={quest.name_zh} />
    <Field label={`${h.catchName} · English`} value={nameEn} onChangeText={setNameEn} placeholder={quest.name_en} />
  </Sheet>;
}
