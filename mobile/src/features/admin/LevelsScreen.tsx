// Waypost levels in admin (docs/design/hunt-first-home.md, part 3): every level's XP threshold and its list of what
// a spin drops. Everyone may look; owners and admins edit one level at a time, logged in Activity with Undo.
// Level 1 is the spin reward the Capsules page used to edit on its own.
import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { WaxBall } from "../game/ThrowScreen";
import { useRackText } from "../racks/strings";
import { VESSELS } from "../shop/strings";
import { useLanguage } from "../../i18n";
import { ADMIN_EDIT, can } from "../../services/admin";
import { adminLevels, levelProblem, MAX_LEVEL, WAYPOST_LEVELS, XP_POINTS, type LevelItem, type LevelItemKind, type LevelRow } from "../../services/waypostLevels";
import { C, radii, sans, serif, spacing } from "../../theme";
import { useAdmin } from "./AdminShell";
import { useLevelText } from "./levelStrings";
import { useAdminText } from "./strings";
import { AButton, Card, Choice, Failed, Field, Loading, Notice, Page, Pill, Section, Sheet, Stepper, useColumns, useLoad, VesselThumb } from "./ui";

export default function LevelsScreen() {
  const l = useLevelText();
  const { role } = useAdmin();
  const mayEdit = ADMIN_EDIT && can(role, "edit");
  const data = useLoad(adminLevels.list, [role]);
  const [editing, setEditing] = useState<LevelRow | null>(null);
  const [toast, setToast] = useState("");
  const cols = useColumns();
  const rows = data.data ?? [];
  return <Page title={l.title} note={l.note}>
    {data.error ? <Failed onRetry={data.reload} /> : !data.data ? <Loading /> : <>
      {!!toast && <Notice text={toast} />}
      <Section title={l.points}>
        <Card style={{ gap: 8 }}>
          {([["spin", l.spin], ["leave", l.leave], ["open", l.opened]] as const).map(([k, label]) => <View key={k} style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontFamily: sans, fontSize: 14, color: C.ink }}>{label}</Text>
            <Text style={{ fontFamily: serif, fontSize: 15, color: C.blue }}>+{XP_POINTS[k]}</Text>
          </View>)}
          <Text style={{ fontFamily: sans, fontSize: 12.5, lineHeight: 18, color: C.muted }}>{l.pointsNote}</Text>
        </Card>
      </Section>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
        {rows.map((row) => <View key={row.level} style={{ width: cols >= 3 ? "31.5%" : cols === 2 ? "48%" : "100%" }}>
          <LevelCard row={row} onEdit={mayEdit ? () => setEditing(row) : undefined} />
        </View>)}
      </View>
      {!mayEdit && <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted, textAlign: "center" }}>{l.viewOnly}</Text>}
    </>}
    {editing && <LevelSheet rows={rows} row={editing} onClose={() => setEditing(null)}
      onSaved={() => { setEditing(null); setToast(l.saved); data.reload(); }} />}
  </Page>;
}

function LevelCard({ row, onEdit }: { row: LevelRow; onEdit?: () => void }) {
  const l = useLevelText();
  return <Card style={{ gap: 10 }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
      <View style={{ gap: 2 }}>
        <Text style={{ fontFamily: serif, fontSize: 18, color: C.blue }}>{l.level(row.level)}</Text>
        <Text style={{ fontFamily: sans, fontSize: 12.5, color: C.muted }}>{l.from(row.xp)}</Text>
      </View>
      {onEdit && <AButton small tone="ghost" title={l.edit} onPress={onEdit} />}
    </View>
    <View style={{ gap: 6 }}>{row.items.map((i, n) => <ItemLine key={n} item={i} />)}</View>
  </Card>;
}

function ItemLine({ item }: { item: LevelItem }) {
  const r = useRackText();
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
    {item.kind === "vessel" ? (item.vessel ? <VesselThumb kind={item.vessel} size={24} /> : <Pill label="★" tone="brass" />) : <WaxBall kind={item.kind} size={22} />}
    <Text style={{ flex: 1, fontFamily: sans, fontSize: 13.5, color: C.ink }}>{r.item(item)}</Text>
  </View>;
}

const blank = (kind: LevelItemKind): LevelItem => kind === "wax" ? { kind, min: 10, max: 10, chance: 100 } : kind === "gold" ? { kind, min: 1, max: 1, chance: 10 } : { kind, vessel: null, min: 1, max: 1, chance: 5 };

function LevelSheet({ rows, row, onClose, onSaved }: { rows: LevelRow[]; row: LevelRow; onClose: () => void; onSaved: () => void }) {
  const l = useLevelText();
  const a = useAdminText();
  const [xp, setXp] = useState(row.xp);
  const [items, setItems] = useState<LevelItem[]>(row.items.map((i) => ({ ...i })));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const draft = { level: row.level, xp, items };
  const problem = levelProblem(rows, draft);
  const same = xp === row.xp && JSON.stringify(items) === JSON.stringify(row.items);
  const change = (n: number, patch: Partial<LevelItem>) => setItems((list) => list.map((i, k) => {
    if (k !== n) return i;
    const next = { ...i, ...patch };
    if (patch.min != null && next.max < next.min) next.max = next.min;
    if (patch.max != null && next.min > next.max) next.min = next.max;
    return next;
  }));
  const save = async () => {
    setBusy(true); setError(null);
    try { await adminLevels.set(draft, note.trim() || null); onSaved(); }
    catch (e) { setError(a.error[(e as Error)?.message] ?? a.error.failed); }
    finally { setBusy(false); }
  };
  const prev = rows.find((r) => r.level === row.level - 1), next = rows.find((r) => r.level === row.level + 1);
  return <Sheet title={l.editTitle(row.level)} onClose={onClose}
    footer={<View style={{ gap: spacing.sm }}>
      {!!problem && <Notice tone="warn" text={l.problem[problem]} />}
      {!!error && <Notice tone="stop" text={error} />}
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <AButton title={busy ? a.ed.saving : a.ed.save} disabled={busy || same || !!problem} onPress={() => void save()} />
        <AButton tone="ghost" title={a.ed.cancel} onPress={onClose} />
      </View>
    </View>}>
    <View style={{ gap: 6 }}>
      <Text style={label}>{l.xp}</Text>
      {row.level === 1 ? <Text style={{ fontFamily: sans, fontSize: 13, color: C.muted }}>{l.xpFirst}</Text>
        : <Stepper label={l.xp} value={xp} step={10} min={(prev?.xp ?? 0) + 10} max={next ? next.xp - 10 : 100_000} format={(v) => v.toLocaleString()} onChange={setXp} />}
    </View>
    <View style={{ gap: 6 }}>
      <Text style={label}>{l.drops}</Text>
      <Text style={{ fontFamily: sans, fontSize: 12.5, lineHeight: 18, color: C.muted }}>{l.dropsNote}</Text>
    </View>
    {items.map((item, n) => <View key={n} style={{ gap: 10, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: radii.md, padding: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
        <Choice value={item.kind} onChange={(k) => change(n, { ...blank(k) })} options={(["wax", "gold", "vessel"] as const).map((k) => ({ value: k, label: l.kind[k] }))} />
        {items.length > 1 && <Pressable accessibilityRole="button" onPress={() => setItems((list) => list.filter((_, k) => k !== n))} hitSlop={8}>
          <Text style={{ fontFamily: sans, fontSize: 13, color: C.wax }}>{l.remove}</Text>
        </Pressable>}
      </View>
      {item.kind === "vessel" && <VesselPicker value={item.vessel ?? null} onChange={(v) => change(n, { vessel: v })} />}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
        <Labeled text={l.min}><Stepper label={l.min} value={item.min} min={1} max={99} onChange={(v) => change(n, { min: v })} /></Labeled>
        <Labeled text={l.max}><Stepper label={l.max} value={item.max} min={1} max={99} onChange={(v) => change(n, { max: v })} /></Labeled>
        <Labeled text={l.chance}><Stepper label={l.chance} value={item.chance} min={1} max={100} step={item.chance < 10 ? 1 : 5} onChange={(v) => change(n, { chance: v })} /></Labeled>
      </View>
      <ItemLine item={item} />
    </View>)}
    {items.length < 6 && <AButton small tone="ghost" title={l.add} onPress={() => setItems((list) => [...list, blank(list.some((i) => i.kind === "gold") ? "vessel" : "gold")])} />}
    <Field label={a.note} value={note} onChangeText={setNote} />
  </Sheet>;
}

function Labeled({ text, children }: { text: string; children: React.ReactNode }) {
  return <View style={{ gap: 4 }}><Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{text}</Text>{children}</View>;
}

/** The city's rare vessel (the default), or any vessel by name. */
function VesselPicker({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const l = useLevelText();
  const { language } = useLanguage();
  const kinds = Object.keys(VESSELS);
  const chip = (on: boolean) => ({ alignItems: "center" as const, gap: 4, padding: 6, width: 78, borderRadius: radii.md, borderWidth: 1.5, borderColor: on ? C.blue : C.line, backgroundColor: on ? C.glass : C.white });
  return <View style={{ gap: 6 }}>
    <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{l.vessel}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={l.cityRare} accessibilityState={{ selected: value === null }} onPress={() => onChange(null)} style={chip(value === null)}>
        <Text style={{ fontFamily: serif, fontSize: 20, color: C.brass }}>★</Text>
        <Text numberOfLines={2} style={{ fontFamily: sans, fontSize: 10.5, color: C.ink, textAlign: "center" }}>{l.cityRareShort}</Text>
      </Pressable>
      {kinds.map((k) => <Pressable key={k} accessibilityRole="button" accessibilityState={{ selected: value === k }} onPress={() => onChange(k)} style={chip(value === k)}>
        <VesselThumb kind={k} size={36} />
        <Text numberOfLines={2} style={{ fontFamily: sans, fontSize: 10.5, color: C.ink, textAlign: "center" }}>{(VESSELS as Record<string, { name: Record<string, string> }>)[k].name[language]}</Text>
      </Pressable>)}
    </ScrollView>
  </View>;
}

const label = { fontFamily: serif, fontSize: 15, color: C.ink } as const;

/** On the Capsules page, where the spin reward used to be edited: a card that leads here. */
export function LevelsLink() {
  const l = useLevelText();
  if (!WAYPOST_LEVELS) return null;
  return <Card onPress={() => router.push("/admin/levels")} label={l.open} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
    <WaxBall kind="wax" size={30} />
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={{ fontFamily: serif, fontSize: 16, color: C.ink }}>{l.open}</Text>
      <Text style={{ fontFamily: sans, fontSize: 12.5, color: C.muted }}>{l.openNote(MAX_LEVEL)}</Text>
    </View>
    <Text style={{ fontFamily: sans, fontSize: 18, color: C.blue }}>›</Text>
  </Card>;
}
