// One private hunt, as its organizer edits it (docs/design/city-orienteering.md, Part B): its details,
// its quests on the map, the code and link it goes out as, and how everyone is doing.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { goBack } from "../../navigation";
import { Screen, Bar, BackButton, Heading } from "../../components/Screen";
import { ArtIcon } from "../../components/ArtIcon";
import { Avatar } from "../../components/Avatar";
import { haptics } from "../../components/haptics";
import { useLanguage } from "../../i18n";
import { useAuth } from "../../services/auth";
import { GiftQr } from "../capsule/GiftQr";
import { Sheet, SheetOption, PickerRow, Glyph, ToolIcon, MonthCalendar } from "../create/CreateParts";
import { clockText } from "../../services/huntClock";
import { PrivateHuntError } from "../../services/privateHunt";
import {
  LIMITS, appLink, blankQuest, canPublish, huntArea, huntProblems, nextOrdinal, organizer, shareLink,
  type HuntDraft, type HuntStatus, type Review, type QuestDraft,
} from "../../services/privateHuntOrganizer";
import { Btn, TaskList, type TaskRow } from "./HuntViews";
import { QuestGlyph } from "./PrivateHuntViews";
import { useHuntText } from "./strings";
import { useOrganizerText, type OrganizerText } from "./organizerStrings";
import { QuestEditor } from "./QuestEditor";
import { C, radii, sans, serif, shadows, spacing } from "../../theme";

const PLACEHOLDER = "#A5AFBD";
const LIMIT_MINUTES = [null, 30, 45, 60, 90, 120];
type Section = "details" | "quests" | "share" | "review";

export default function HuntEditScreen() {
  const o = useOrganizerText();
  const h = useHuntText();
  const { language } = useLanguage();
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const { id } = useLocalSearchParams<{ id: string }>();

  const [section, setSection] = useState<Section>("details");
  const [draft, setDraft] = useState<HuntDraft | null>(null);
  const [quests, setQuests] = useState<QuestDraft[]>([]);
  const [status, setStatus] = useState<HuntStatus>("draft");
  const [code, setCode] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [editing, setEditing] = useState<QuestDraft | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [sheet, setSheet] = useState<"route" | "limit" | "start" | "end" | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const load = useCallback(() => {
    if (!userId || !id) return;
    return organizer.get(userId, id)
      .then((s) => { setDraft(s.draft); setQuests(s.quests); setStatus(s.status); setCode(s.code); setLocked(!!s.locked); })
      .catch(() => setToast(h.perr.unknown));
  }, [userId, id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { if (!toast) return; const x = setTimeout(() => setToast(""), 2600); return () => clearTimeout(x); }, [toast]);

  // The draft saves itself a moment after you stop typing, so nothing is lost on the way out.
  // Leaving the screen saves whatever is still waiting.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unsaved = useRef<HuntDraft | null>(null);
  const flush = useRef(() => {});
  flush.current = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const next = unsaved.current;
    unsaved.current = null;
    if (next) void organizer.update(userId, id, next).catch(() => {});
  };
  const edit = (patch: Partial<HuntDraft>) => {
    if (!draft) return;
    const next = { ...draft, ...patch };
    setDraft(next);
    unsaved.current = next;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => flush.current(), 600);
  };
  useEffect(() => () => flush.current(), []);

  const act = async (run: () => Promise<unknown>, after?: () => void | Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try { await run(); void haptics.success(); await after?.(); }
    catch (e) {
      void haptics.warn(); setToast(h.perr[e instanceof PrivateHuntError ? e.code : "unknown"]);
      // Someone joined while this screen was open: reload, so the editor shows the lock.
      if (e instanceof PrivateHuntError && e.code === "hunt_locked") { setEditing(null); await load(); }
    }
    finally { setBusy(false); }
  };

  const saveQuest = (w: QuestDraft) => void act(
    () => organizer.saveQuest(userId, id, w),
    async () => { await load(); setEditing(null); },
  );
  const deleteQuest = (w: QuestDraft) => void act(
    () => organizer.deleteQuest(userId, id, w.id!),
    async () => { await load(); setEditing(null); },
  );
  const publish = () => void act(
    async () => { flush.current(); setCode(await organizer.publish(userId, id)); },
    () => { setStatus("published"); setSection("share"); },
  );
  const close = () => void act(() => organizer.close(userId, id), () => setStatus("closed"));

  useEffect(() => {
    if (section !== "review" || !userId || !id || !draft) return;
    organizer.mine(userId)
      .then((all) => all.find((x) => x.id === id))
      .then((owned) => owned && organizer.review(userId, owned))
      .then((r) => setReview(r ?? null))
      .catch(() => setReview(null));
  }, [section, userId, id, draft]);

  if (!draft) return <Screen><Bar><BackButton label={o.back} onPress={goBack} /><Heading>{o.myHunts}</Heading></Bar></Screen>;

  const problems = huntProblems(draft, quests);
  const ready = canPublish(draft, quests);
  const rows: TaskRow[] = [...quests].sort((a, b) => a.ordinal - b.ordinal).map((w) => ({
    key: w.id ?? String(w.ordinal),
    label: w.name || o.newQuest,
    sub: h.questTypes[w.quest_type],
    right: h.pointsShort(w.points),
    glyph: <QuestGlyph type={w.quest_type} size={15} color={C.blue} />,
    onPress: locked ? undefined : () => setEditing(w),
  }));
  const dateText = (iso: string) => new Date(iso).toLocaleDateString(language === "zh" ? "zh-Hant" : "en-US");
  const timeText = (iso: string) => new Date(iso).toLocaleTimeString(language === "zh" ? "zh-Hant" : "en-US", { hour: "2-digit", minute: "2-digit" });
  const area = huntArea(quests.map(q => ({ lat: q.location_lat, lng: q.location_lng })));

  return <Screen>
    <Bar><BackButton label={o.back} onPress={goBack} /><Heading>{draft.name || o.untitled}</Heading></Bar>

    <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
      {(["details", "quests", "share", "review"] as Section[]).map((s) => <Pressable key={s} accessibilityRole="tab"
        accessibilityState={{ selected: section === s }} onPress={() => setSection(s)}
        style={{ paddingVertical: 7, paddingHorizontal: 13, borderRadius: radii.pill, backgroundColor: section === s ? C.blue : C.white, borderWidth: 1.5, borderColor: section === s ? C.blue : C.line }}>
        <Text style={{ fontFamily: serif, fontSize: 13, color: section === s ? C.white : C.muted }}>
          {s === "details" ? o.details : s === "quests" ? o.quests : s === "share" ? o.share : o.review}
        </Text>
      </Pressable>)}
    </View>

    {status === "closed" && <Note text={o.closed} />}
    {locked && status !== "closed" && (section === "details" || section === "quests") && <Note text={o.lockedNote} />}

    {section === "details" && <>
      <Field label={o.nameLabel}>
        <TextInput accessibilityLabel={o.nameLabel} value={draft.name} onChangeText={(v) => edit({ name: v })}
          maxLength={LIMITS.name} placeholder={o.namePlaceholder} placeholderTextColor={PLACEHOLDER} style={input} />
      </Field>
      <Field label={o.descriptionLabel}>
        <TextInput accessibilityLabel={o.descriptionLabel} value={draft.description} onChangeText={(v) => edit({ description: v })}
          maxLength={LIMITS.description} multiline placeholder={o.descriptionPlaceholder} placeholderTextColor={PLACEHOLDER}
          style={[input, { minHeight: 92, textAlignVertical: "top" }]} />
      </Field>

      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: C.glass, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: 10 }}>
        <ArtIcon name="map" size={17} color={C.blue} />
        <Text style={{ flex: 1, fontFamily: sans, fontSize: 13, lineHeight: 19, color: C.ink }}>
          {area.radius_m ? o.areaAuto((area.radius_m * 2 / 1000).toFixed(1)) : o.areaEmpty}
        </Text>
      </View>

      {/* After the first join these no longer change; they stay visible but can't be opened. */}
      <View pointerEvents={locked ? "none" : "auto"} style={{ gap: spacing.md, opacity: locked ? .55 : 1 }}>
      <Field label={o.startLabel2}>
        <PickerRow label={o.startLabel2} icon={<Glyph><ToolIcon kind="calendar" /></Glyph>}
          title={o.timeAt(dateText(draft.starts_at), timeText(draft.starts_at))} onPress={() => setSheet("start")} />
      </Field>
      <Field label={o.endLabel2}>
        <PickerRow label={o.endLabel2} icon={<Glyph><ToolIcon kind="calendar" /></Glyph>}
          title={o.timeAt(dateText(draft.ends_at), timeText(draft.ends_at))} onPress={() => setSheet("end")} />
      </Field>

      <PickerRow label={o.routeLabel} icon={<Glyph><ToolIcon kind="landmark" /></Glyph>}
        title={o.route[draft.route_mode]} sub={o.routeSub[draft.route_mode]} onPress={() => setSheet("route")} />
      <PickerRow label={o.limitLabel} icon={<Glyph><ToolIcon kind="clock" /></Glyph>}
        title={draft.time_limit_min ? o.limitMinutes(draft.time_limit_min) : o.limitNone}
        sub={o.limitSub} onPress={() => setSheet("limit")} />
      </View>

      <Toggle label={o.leaderboardLabel} on={draft.leaderboard_visible}
        onText={o.leaderboardOn} offText={o.leaderboardOff}
        onPress={() => edit({ leaderboard_visible: !draft.leaderboard_visible })} />
    </>}

    {section === "quests" && <>
      {!rows.length && <View style={{ gap: 4, paddingVertical: spacing.sm }}>
        <Text style={{ fontFamily: serif, fontSize: 16, color: C.ink }}>{o.noQuests}</Text>
        <Text style={{ fontFamily: sans, fontSize: 13, lineHeight: 20, color: C.muted }}>{o.noQuestsNote}</Text>
      </View>}
      {!!rows.length && <TaskList rows={rows} />}
      {locked ? null : quests.length < LIMITS.quests
        ? <Btn quiet title={o.addQuest} disabled={busy} onPress={() => setEditing(blankQuest(nextOrdinal(quests), null))} />
        : <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{o.questFull(LIMITS.quests)}</Text>}
    </>}

    {section === "share" && <>
      {!ready && <View style={{ gap: 4 }}>
        {problems.map((p) => <Text key={p} style={{ fontFamily: sans, fontSize: 13, color: C.wax }}>· {o.problems[p]}</Text>)}
      </View>}
      {!!code && <View style={{ alignItems: "center", gap: spacing.md, backgroundColor: C.white, borderRadius: radii.md, borderWidth: 1, borderColor: C.line, padding: spacing.lg, ...shadows.card }}>
        <Text style={{ fontFamily: sans, fontSize: 11, letterSpacing: 1.2, color: C.brass }}>{o.codeLabel}</Text>
        <Text selectable style={{ fontFamily: serif, fontSize: 34, letterSpacing: 8, color: C.ink }}>{code}</Text>
        <GiftQr value={shareLink(code)} label={o.qrAlt(code)} />
        <Text selectable style={{ fontFamily: sans, fontSize: 12, color: C.muted, textAlign: "center" }}>{shareLink(code)}</Text>
        <View style={{ flexDirection: "row", gap: spacing.sm, alignSelf: "stretch" }}>
          <View style={{ flex: 1 }}><Btn quiet title={o.copy} onPress={() => void Clipboard.setStringAsync(shareLink(code)).then(() => { void haptics.tick(); setToast(o.copied); })} /></View>
          <View style={{ flex: 1 }}><Btn quiet title={o.shareSheet} onPress={() => void Share.share({
            message: `${draft.name}\n${shareLink(code)}\n${Platform.OS === "web" ? appLink(code) : ""}`.trim(),
          }).catch(() => {})} /></View>
        </View>
      </View>}
      {status !== "closed" && <Btn title={status === "published" ? o.publishAgain : o.publish} disabled={!ready || busy} onPress={publish} />}
      {status === "published" && <Pressable accessibilityRole="button" onPress={close} style={{ alignSelf: "center", paddingVertical: 8 }}>
        <Text style={{ fontFamily: sans, fontSize: 13, color: C.wax, textDecorationLine: "underline" }}>{o.closeHunt}</Text>
      </Pressable>}
    </>}

    {section === "review" && <>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Stat label={o.reviewJoined} value={review?.stats.joined ?? 0} />
        <Stat label={o.reviewFinished} value={review?.stats.finished ?? 0} />
      </View>
      {!review?.members.length && <View style={{ alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl }}>
        <ArtIcon name="user" size={36} color={C.blue} />
        <Text style={{ fontFamily: serif, fontSize: 16, color: C.ink }}>{o.reviewNobody}</Text>
        <Text style={{ fontFamily: sans, fontSize: 13, color: C.muted, textAlign: "center" }}>{o.reviewNobodyNote}</Text>
      </View>}
      {review?.members.map((m, i) => <View key={m.user} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: radii.md, paddingVertical: 10, paddingHorizontal: spacing.md }}>
        <Text style={{ width: 22, fontFamily: serif, fontSize: 16, color: i < 3 ? C.blue : C.muted, textAlign: "center" }}>{i + 1}</Text>
        <Avatar avatar={m.avatar} size={30} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontFamily: sans, fontSize: 14, color: C.ink }}>{m.name}</Text>
          <Text style={{ fontFamily: sans, fontSize: 11, color: C.muted }}>{m.duration_s != null ? h.finishedIn(clockText(m.duration_s)) : o.stillGoing}</Text>
        </View>
        <Text style={{ fontFamily: serif, fontSize: 15, color: C.ink }}>{h.rankPoints(m.points)}</Text>
      </View>)}
      {!!review?.stats.per_quest.length && !!review.stats.joined && <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: sans, fontSize: 12, letterSpacing: 1, color: C.muted }}>{o.perQuest}</Text>
        {review.stats.per_quest.map((s) => {
          const w = quests.find((x) => x.id === s.id);
          return <View key={s.id} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Text numberOfLines={1} style={{ flex: 1, fontFamily: sans, fontSize: 13, color: C.ink }}>{w?.name ?? s.id}</Text>
            <Text style={{ fontFamily: serif, fontSize: 13, color: C.blue }}>{s.done} / {review.stats.joined}</Text>
          </View>;
        })}
      </View>}
    </>}

    <Text style={{ fontFamily: sans, fontSize: 11, color: C.muted }}>{o.previewNote}</Text>
    {!!toast && <Text accessibilityRole="alert" style={{ fontFamily: sans, fontSize: 13, color: C.blue, textAlign: "center" }}>{toast}</Text>}

    <Sheet open={sheet === "route"} title={o.routeLabel} onClose={() => setSheet(null)}>
      {(["any", "ordered"] as const).map((m) => <SheetOption key={m} selected={draft.route_mode === m}
        icon={<Glyph><ToolIcon kind={m === "ordered" ? "landmark" : "anywhere"} /></Glyph>}
        title={o.route[m]} sub={o.routeSub[m]} onPress={() => { edit({ route_mode: m }); setSheet(null); }} />)}
    </Sheet>
    <Sheet open={sheet === "limit"} title={o.limitLabel} onClose={() => setSheet(null)}>
      {LIMIT_MINUTES.map((m) => <SheetOption key={String(m)} selected={draft.time_limit_min === m}
        icon={<Glyph><ToolIcon kind="clock" /></Glyph>}
        title={m ? o.limitMinutes(m) : o.limitNone} onPress={() => { edit({ time_limit_min: m }); setSheet(null); }} />)}
    </Sheet>
    <Sheet open={sheet === "start"} title={o.startLabel2} onClose={() => setSheet(null)}>
      <WhenPicker language={language} value={draft.starts_at} onChange={(v) => edit({ starts_at: v })} o={o} />
    </Sheet>
    <Sheet open={sheet === "end"} title={o.endLabel2} onClose={() => setSheet(null)}>
      <WhenPicker language={language} value={draft.ends_at}
        onChange={(v) => edit({ ends_at: v })} o={o} />
    </Sheet>

    {!!editing && <QuestEditor huntId={id} quest={editing} busy={busy}
      onClose={() => setEditing(null)} onSave={saveQuest}
      onDelete={editing.id ? () => deleteQuest(editing) : undefined} />}
  </Screen>;
}

const input = { fontFamily: sans, fontSize: 15, color: C.ink, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 12 } as const;

/**
 * A day and a clock time together, because an organized hunt starts and ends at a moment, not a date.
 * The calendar sets the day and the chips set the time; the minutes run in five-minute steps.
 */
function WhenPicker({ language, value, onChange, o }: {
  language: "zh" | "en"; value: string; onChange: (iso: string) => void; o: OrganizerText;
}) {
  const when = new Date(value);
  const withTime = (hours: number, minutes: number) => {
    const next = new Date(when);
    next.setHours(hours, minutes, 0, 0);
    onChange(next.toISOString());
  };
  const chip = (on: boolean) => ({
    minWidth: 46, alignItems: "center" as const, paddingVertical: 8, paddingHorizontal: 10, borderRadius: radii.sm,
    backgroundColor: on ? C.blue : C.white, borderWidth: 1, borderColor: on ? C.blue : C.line,
  });
  return <View style={{ gap: spacing.sm, paddingHorizontal: 10 }}>
    <MonthCalendar language={language} value={value} onChange={(v) => {
      // The calendar only moves the day; keep the time already chosen.
      const day = new Date(v), next = new Date(when);
      next.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
      onChange(next.toISOString());
    }} />
    <Text style={{ fontFamily: sans, fontSize: 12, letterSpacing: 1, color: C.muted }}>{o.timeLabel}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
      {Array.from({ length: 24 }, (_, hour) => <Pressable key={hour} accessibilityRole="radio"
        accessibilityState={{ selected: when.getHours() === hour }} onPress={() => withTime(hour, when.getMinutes())}
        style={chip(when.getHours() === hour)}>
        <Text style={{ fontFamily: serif, fontSize: 14, color: when.getHours() === hour ? C.white : C.ink }}>{String(hour).padStart(2, "0")}</Text>
      </Pressable>)}
    </ScrollView>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
      {Array.from({ length: 12 }, (_, i) => i * 5).map((minute) => <Pressable key={minute} accessibilityRole="radio"
        accessibilityState={{ selected: when.getMinutes() === minute }} onPress={() => withTime(when.getHours(), minute)}
        style={chip(when.getMinutes() === minute)}>
        <Text style={{ fontFamily: serif, fontSize: 14, color: when.getMinutes() === minute ? C.white : C.ink }}>:{String(minute).padStart(2, "0")}</Text>
      </Pressable>)}
    </ScrollView>
  </View>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={{ gap: 8 }}>
    <Text style={{ fontFamily: sans, fontSize: 12, letterSpacing: 1, color: C.muted }}>{label}</Text>
    {children}
  </View>;
}

function Toggle({ label, on, onText, offText, onPress }: { label: string; on: boolean; onText: string; offText: string; onPress: () => void }) {
  return <Pressable accessibilityRole="switch" accessibilityState={{ checked: on }} onPress={onPress}
    style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 12 }}>
    <View style={{ flex: 1 }}>
      <Text style={{ fontFamily: serif, fontSize: 16, color: C.ink }}>{label}</Text>
      <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{on ? onText : offText}</Text>
    </View>
    <View style={{ width: 46, height: 28, borderRadius: 14, padding: 3, backgroundColor: on ? C.blue : C.line, alignItems: on ? "flex-end" : "flex-start" }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.white }} />
    </View>
  </Pressable>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return <View style={{ flex: 1, alignItems: "center", gap: 2, backgroundColor: C.glass, borderRadius: radii.md, paddingVertical: spacing.md }}>
    <Text style={{ fontFamily: serif, fontSize: 26, color: C.ink }}>{value}</Text>
    <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{label}</Text>
  </View>;
}

function Note({ text }: { text: string }) {
  return <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: C.glass, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: 10 }}>
    <ArtIcon name="lock" size={16} color={C.muted} />
    <Text style={{ flex: 1, fontFamily: sans, fontSize: 13, color: C.ink }}>{text}</Text>
  </View>;
}
