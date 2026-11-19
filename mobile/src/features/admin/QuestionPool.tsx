// The question pool (docs/design/hunt-loop.md, "Admin impact"): each city's questions and prices for Today's
// Hunt, routes and private hunts. List, add, edit, publish and hide; a re-check flag after 6 months; where each is used.
import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useLanguage } from "../../i18n";
import { can } from "../../services/admin";
import {
  adminHuntLoop, afterSave, canPublish, hasPlace, mergePoolEntry, poolProblems, usdOf,
  type PoolEntry, type PoolFilter, type PoolResult, type PoolSave, type PoolStatus,
} from "../../services/adminHuntLoop";
import { C, radii, sans, serif, spacing } from "../../theme";
import { useAdmin } from "./AdminShell";
import { sayError, useHuntLoopText, type Say } from "./huntLoopStrings";
import { AButton, Card, Choice, Empty, Failed, Field, Loading, Notice, Pill, Sheet, type Tone } from "./ui";

const FILTERS: PoolFilter[] = ["all", "draft", "published", "hidden", "needs_recheck"];
const STATUS_TONE: Record<PoolStatus, Tone> = { draft: "muted", published: "blue", hidden: "plum" };

export function QuestionPool({ city }: { city: string }) {
  const h = useHuntLoopText();
  const { language } = useLanguage();
  const zh = language === "zh";
  const { role } = useAdmin();
  const mayEdit = can(role, "edit");
  const [filter, setFilter] = useState<PoolFilter>("all");
  const [items, setItems] = useState<PoolEntry[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<PoolEntry | "new" | null>(null);

  const load = async (more = false) => {
    setFailed(false);
    if (!more) setItems(null);
    try {
      const page = await adminHuntLoop.pool(city, filter, more ? cursor : null);
      setItems((x) => more ? [...(x ?? []), ...page.items] : page.items);
      setCursor(page.next_cursor);
    } catch { setFailed(true); }
  };
  useEffect(() => { void load(); }, [city, filter, role]);
  // Save and status results come back without `uses`, so the merge keeps the usage the list already showed.
  const saved = (e: PoolResult) => {
    const merged = mergePoolEntry(items ?? [], e);
    setItems(merged.list); setOpen(merged.entry);
  };

  return <View style={{ gap: spacing.md }}>
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm }}>
      <View style={{ flex: 1, minWidth: 240 }}><Choice value={filter} onChange={setFilter} options={FILTERS.map((f) => ({ value: f, label: h.filter[f] }))} /></View>
      {mayEdit && <AButton small title={`+ ${h.add}`} onPress={() => setOpen("new")} />}
    </View>
    {failed ? <Failed onRetry={() => void load()} /> : !items ? <Loading /> : !items.length ? <Empty text={h.empty} /> : <View style={{ gap: spacing.sm }}>
      {items.map((e) => <Card key={e.id} onPress={() => setOpen(e)} label={zh ? e.prompt_zh : e.prompt_en} style={{ gap: 6 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          <Pill tone={e.type === "price" ? "brass" : "blue"} label={h.type[e.type]} />
          <Pill tone={STATUS_TONE[e.status]} label={h.status[e.status]} />
          {e.needs_recheck && <Pill tone="wax" label={h.recheck} />}
          {e.outside_coverage && <Pill label={h.outsideMap} />}
        </View>
        <Text style={{ fontFamily: serif, fontSize: 16, lineHeight: 23, color: C.ink }}>{zh ? e.prompt_zh : e.prompt_en}</Text>
        <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>
          📍 {zh ? e.place_zh : e.place_en} · {e.uses.length ? h.usedIn(e.uses.length) : h.unused}
        </Text>
        {!hasPlace(e) && <Text style={{ fontFamily: sans, fontSize: 12, color: C.wax }}>{h.noPlace}</Text>}
        {e.status === "hidden" && !!e.hidden_reason && <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{h.hiddenWhy(e.hidden_reason)}</Text>}
      </Card>)}
      {cursor && <View style={{ alignItems: "center" }}><AButton small tone="ghost" title={h.more} onPress={() => void load(true)} /></View>}
    </View>}
    {open && <PoolSheet city={city} entry={open === "new" ? null : open} mayEdit={mayEdit} onClose={() => setOpen(null)}
      onSaved={saved} />}
  </View>;
}

const where = (e: { location_lat: number | null; location_lng: number | null }) => e.location_lat == null ? "" : `${e.location_lat}, ${e.location_lng}`;
const parseWhere = (v: string) => {
  const m = v.trim().match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
  return m ? { location_lat: Number(m[1]), location_lng: Number(m[2]) } : v.trim() ? null : { location_lat: null, location_lng: null };
};
const todayIso = () => new Date().toISOString().slice(0, 10);

function PoolSheet({ city, entry, mayEdit, onClose, onSaved }: {
  city: string; entry: PoolEntry | null; mayEdit: boolean; onClose: () => void; onSaved: (e: PoolResult) => void;
}) {
  const h = useHuntLoopText();
  const [f, setF] = useState<PoolSave>(() => entry ? { ...entry } : { city, type: "question", kind: "choice", place_zh: "", place_en: "", prompt_zh: "", prompt_en: "",
    choices: [{ zh: "", en: "" }, { zh: "", en: "" }], location_lat: null, location_lng: null, source_url: null, checked_on: null, currency: null, rate: null });
  // Once saved, a new entry is an existing row: later saves update it, and its answer is already on the server.
  const isNew = !entry && !f.id;
  const [whereText, setWhereText] = useState(entry ? where(entry) : "");
  const [answer, setAnswer] = useState<number | string | undefined>(undefined);
  const [aliases, setAliases] = useState("");
  const [local, setLocal] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "info" | "stop"; say: Say } | null>(null);
  const set = (patch: Partial<PoolSave>) => { setF((x) => ({ ...x, ...patch })); setNote(null); };
  const spot = parseWhere(whereText);
  const rate = Number(f.rate);
  const localNum = Number(local);
  const payload: PoolSave = {
    ...f, ...(spot ?? {}),
    source_url: f.source_url?.trim() || null, checked_on: f.checked_on?.trim() || null,
    ...(f.type === "question" && answer !== undefined && answer !== "" ? { answer } : {}),
    ...(f.type === "question" && f.kind === "text" && aliases.trim() ? { typed_aliases: aliases.split(/[,，]/).map((x) => x.trim()).filter(Boolean) } : {}),
    ...(f.type === "price" && local.trim() ? { local_amount: localNum } : {}),
  };
  const problems = poolProblems(payload, isNew);
  const off = !mayEdit || busy;

  const save = async () => {
    if (problems.length || !spot) return;
    setBusy(true);
    try {
      // The server keeps the fields it decides itself; send only what the form edits.
      const { needs_recheck: _n, uses: _u, status: _s, outside_coverage: _o, hidden_reason: _r, ...body } = payload as PoolEntry & PoolSave;
      const out = await adminHuntLoop.savePool(body);
      // The sheet stays open, so later saves must update this row: keep the id the server gave a new entry.
      // The answer and local price are kept on the server; leaving them out of the next save keeps them.
      setF((x) => afterSave(x, out));
      onSaved(out); setNote({ tone: "info", say: (t) => t.saved }); setAnswer(undefined); setLocal("");
    } catch (e) { setNote({ tone: "stop", say: sayError(e) }); }
    finally { setBusy(false); }
  };
  const status = async (s: PoolStatus) => {
    const id = f.id ?? entry?.id;
    if (!id) return;
    setBusy(true);
    try { onSaved(await adminHuntLoop.setPoolStatus(id, s)); }
    catch (e) { setNote({ tone: "stop", say: sayError(e) }); }
    finally { setBusy(false); }
  };
  const choices = f.choices ?? [];
  const pickedRight = typeof answer === "number" ? answer : null;

  return <Sheet title={isNew ? h.newTitle : h.editTitle} onClose={onClose}
    footer={mayEdit && <View style={{ gap: spacing.sm }}>
      {!!note && <Notice tone={note.tone} text={note.say(h)} />}
      {problems.map((p) => <Text key={p} style={{ fontFamily: sans, fontSize: 12, color: C.wax }}>· {h.problem[p]}</Text>)}
      {!spot && <Text style={{ fontFamily: sans, fontSize: 12, color: C.wax }}>· {h.locationHint}</Text>}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        <AButton title={h.save} disabled={off || !!problems.length || !spot} onPress={() => void save()} />
        {entry && entry.status !== "published" && <AButton tone="ghost" title={h.publish} disabled={busy || !canPublish(entry)} onPress={() => void status("published")} />}
        {entry && entry.status !== "hidden" && <AButton tone="ghost" title={h.hide} disabled={busy} onPress={() => void status("hidden")} />}
        {entry && entry.status !== "draft" && <AButton tone="ghost" title={h.toDraft} disabled={busy} onPress={() => void status("draft")} />}
      </View>
      {entry && entry.status !== "published" && !canPublish(entry) && <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{h.publishNeeds}</Text>}
    </View>}>
    {entry && <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      <Pill tone={STATUS_TONE[entry.status]} label={h.status[entry.status]} />
      {entry.needs_recheck && <Pill tone="wax" label={h.recheck} />}
      <Pill label={entry.uses.length ? h.usedIn(entry.uses.length) : h.unused} />
      {entry.outside_coverage && <Pill label={h.outsideMap} />}
    </View>}
    {entry?.status === "hidden" && !!entry.hidden_reason && <Notice tone="info" text={h.hiddenWhy(entry.hidden_reason)} />}
    {isNew && <Choice value={f.type!} onChange={(type) => set(type === "price" ? { type, kind: null, choices: null } : { type, kind: "choice", choices: [{ zh: "", en: "" }, { zh: "", en: "" }] })}
      options={[{ value: "question", label: h.type.question }, { value: "price", label: h.type.price }]} />}
    <Group title={h.place}>
      <Field label={h.placeZh} value={f.place_zh ?? ""} editable={!off} onChangeText={(v) => set({ place_zh: v })} />
      <Field label={h.placeEn} value={f.place_en ?? ""} editable={!off} onChangeText={(v) => set({ place_en: v })} />
      <Field label={h.location} hint={h.locationHint} value={whereText} editable={!off} onChangeText={(v) => { setWhereText(v); setNote(null); }} inputMode="decimal" />
    </Group>
    <Group title={h.prompt}>
      <Field label={h.placeZh} value={f.prompt_zh ?? ""} editable={!off} multiline onChangeText={(v) => set({ prompt_zh: v })} style={{ minHeight: 56 }} />
      <Field label={h.placeEn} value={f.prompt_en ?? ""} editable={!off} multiline onChangeText={(v) => set({ prompt_en: v })} style={{ minHeight: 56 }} />
    </Group>
    {f.type === "question" && <Group title={h.answer}>
      {isNew && <Choice value={f.kind!} onChange={(kind) => { set(kind === "text" ? { kind, choices: null } : { kind, choices: [{ zh: "", en: "" }, { zh: "", en: "" }] }); setAnswer(undefined); }}
        options={[{ value: "choice", label: h.kind.choice }, { value: "text", label: h.kind.text }]} />}
      {f.kind === "choice" ? <>
        {choices.map((c, i) => <View key={i} style={{ gap: 6, padding: spacing.sm, borderRadius: radii.sm, borderWidth: 1, borderColor: pickedRight === i ? C.brass : C.line, backgroundColor: C.white }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Pressable accessibilityRole="radio" accessibilityState={{ checked: pickedRight === i }} accessibilityLabel={`${h.choice(i + 1)} ${h.markRight}`} disabled={off}
              onPress={() => { setAnswer(i); setNote(null); }} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: pickedRight === i ? C.brass : C.muted, backgroundColor: pickedRight === i ? C.brass : C.white }} />
              <Text style={{ fontFamily: sans, fontSize: 12, color: pickedRight === i ? "#7A5A1E" : C.muted }}>{h.choice(i + 1)}{pickedRight === i ? ` · ${h.rightOne}` : ""}</Text>
            </Pressable>
            {choices.length > 2 && !off && <Pressable accessibilityRole="button" onPress={() => { set({ choices: choices.filter((_, j) => j !== i) }); setAnswer(undefined); }}>
              <Text style={{ fontFamily: sans, fontSize: 12, color: C.wax }}>{h.removeChoice}</Text>
            </Pressable>}
          </View>
          <Field label={h.placeZh} value={c.zh} editable={!off} onChangeText={(v) => set({ choices: choices.map((x, j) => j === i ? { ...x, zh: v } : x) })} />
          <Field label={h.placeEn} value={c.en} editable={!off} onChangeText={(v) => set({ choices: choices.map((x, j) => j === i ? { ...x, en: v } : x) })} />
        </View>)}
        {choices.length < 6 && !off && <View style={{ alignItems: "flex-start" }}><AButton small tone="ghost" title={`+ ${h.addChoice}`} onPress={() => set({ choices: [...choices, { zh: "", en: "" }] })} /></View>}
      </> : <>
        <Field label={h.answer} value={typeof answer === "string" ? answer : ""} editable={!off} onChangeText={(v) => { setAnswer(v); setNote(null); }} />
        <Field label={h.aliases} hint={h.aliasesHint} value={aliases} editable={!off} onChangeText={setAliases} />
      </>}
      {!isNew && <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{h.keepAnswer}</Text>}
    </Group>}
    {f.type === "price" && <Group title={h.localPrice}>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <View style={{ flex: 1 }}><Field label={h.localPrice} value={local} editable={!off} inputMode="decimal" onChangeText={(v) => { setLocal(v); setNote(null); }} /></View>
        <View style={{ width: 96 }}><Field label={h.currency} value={f.currency ?? ""} editable={!off} autoCapitalize="characters" maxLength={3} onChangeText={(v) => set({ currency: v.toUpperCase() })} /></View>
      </View>
      <Field label={h.rate} value={f.rate == null ? "" : String(f.rate)} editable={!off} inputMode="decimal" onChangeText={(v) => set({ rate: v.trim() ? Number(v) : null })} />
      {localNum > 0 && rate > 0 && <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{h.usd(usdOf(localNum, rate).toFixed(2))}</Text>}
      {!isNew && <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{h.keepAnswer}</Text>}
    </Group>}
    <Group title={h.source}>
      <Field label={h.source} value={f.source_url ?? ""} editable={!off} autoCapitalize="none" inputMode="url" onChangeText={(v) => set({ source_url: v })} />
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.sm }}>
        <View style={{ flex: 1 }}><Field label={h.checked} hint="YYYY-MM-DD" value={f.checked_on ?? ""} editable={!off} onChangeText={(v) => set({ checked_on: v })} /></View>
        {!off && <AButton small tone="ghost" title={h.today} onPress={() => set({ checked_on: todayIso() })} />}
      </View>
      {!!entry?.photo_credit && <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{h.photo}: {h.photoCredit(entry.photo_credit, entry.photo_license ?? "")}</Text>}
    </Group>
  </Sheet>;
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={{ gap: spacing.sm }}>
    <Text style={{ fontFamily: serif, fontSize: 15, color: C.ink }}>{title}</Text>
    {children}
  </View>;
}
