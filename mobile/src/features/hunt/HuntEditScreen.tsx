// One private hunt, as its organizer edits it (docs/design/city-orienteering.md, Part B): its details,
// its missions on the map, the code and link it goes out as, and how everyone is doing.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, Share, Text, TextInput, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { goBack } from "../../navigation";
import { Screen, Bar, BackButton, Heading } from "../../components/Screen";
import { ArtIcon } from "../../components/ArtIcon";
import { Avatar } from "../../components/Avatar";
import { haptics } from "../../components/haptics";
import { useLanguage } from "../../i18n";
import { useAuth } from "../../services/auth";
import { useForegroundLocation } from "../journey/location";
import { GiftQr } from "../capsule/GiftQr";
import { Sheet, SheetOption, PickerRow, Glyph, ToolIcon, MonthCalendar } from "../create/CreateParts";
import { clockText } from "../../services/huntClock";
import { PrivateHuntError, type MissionType } from "../../services/huntPrivate";
import {
  LIMITS, appLink, canPublish, huntProblems, nextOrdinal, organizer, shareLink,
  type HuntDraft, type HuntStatus, type Review, type WaypointDraft,
} from "../../services/huntOrganizer";
import { Btn, TaskList, type TaskRow } from "./HuntViews";
import { MissionGlyph } from "./PrivateHuntViews";
import { useHuntText } from "./strings";
import { useOrganizerText } from "./organizerStrings";
import { WaypointEditor } from "./WaypointEditor";
import { C, radii, sans, serif, shadows, spacing } from "../../theme";

const PLACEHOLDER = "#A5AFBD";
const RADII = [500, 1200, 2000, 5000];
const LIMIT_MINUTES = [null, 30, 45, 60, 90, 120];
type Section = "details" | "missions" | "share" | "review";

export default function HuntEditScreen() {
  const o = useOrganizerText();
  const h = useHuntText();
  const { language } = useLanguage();
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const { id } = useLocalSearchParams<{ id: string }>();
  const location = useForegroundLocation(true);

  const [section, setSection] = useState<Section>("details");
  const [draft, setDraft] = useState<HuntDraft | null>(null);
  const [waypoints, setWaypoints] = useState<WaypointDraft[]>([]);
  const [status, setStatus] = useState<HuntStatus>("draft");
  const [code, setCode] = useState<string | null>(null);
  const [editing, setEditing] = useState<WaypointDraft | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [sheet, setSheet] = useState<"route" | "limit" | "radius" | "end" | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const load = useCallback(() => {
    if (!userId || !id) return;
    organizer.get(userId, id)
      .then((s) => { setDraft(s.draft); setWaypoints(s.waypoints); setStatus(s.status); setCode(s.code); })
      .catch(() => setToast(h.perr.unknown));
  }, [userId, id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { if (!toast) return; const x = setTimeout(() => setToast(""), 2600); return () => clearTimeout(x); }, [toast]);

  // The draft saves itself a moment after you stop typing, so nothing is lost on the way out.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const edit = (patch: Partial<HuntDraft>) => {
    setDraft((old) => {
      if (!old) return old;
      const next = { ...old, ...patch };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => { void organizer.update(userId, id, next).catch(() => {}); }, 600);
      return next;
    });
  };
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  const act = async (run: () => Promise<unknown>, after?: () => void) => {
    if (busy) return;
    setBusy(true);
    try { await run(); void haptics.success(); after?.(); }
    catch (e) { void haptics.warn(); setToast(h.perr[e instanceof PrivateHuntError ? e.code : "unknown"]); }
    finally { setBusy(false); }
  };

  const saveWaypoint = (w: WaypointDraft) => void act(
    () => organizer.saveWaypoint(userId, id, w),
    () => { setEditing(null); load(); },
  );
  const deleteWaypoint = (w: WaypointDraft) => void act(
    () => organizer.deleteWaypoint(userId, id, w.id!),
    () => { setEditing(null); load(); },
  );
  const publish = () => void act(
    async () => { setCode(await organizer.publish(userId, id)); },
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

  const problems = huntProblems(draft, waypoints);
  const ready = canPublish(draft, waypoints);
  const rows: TaskRow[] = [...waypoints].sort((a, b) => a.ordinal - b.ordinal).map((w) => ({
    key: w.id ?? String(w.ordinal),
    label: w.name || o.newWaypoint,
    sub: h.missionTypes[w.mission_type],
    right: h.pointsShort(w.points),
    glyph: <MissionGlyph type={w.mission_type} size={15} color={C.blue} />,
    onPress: () => setEditing(w),
  }));
  const dateText = (iso: string) => new Date(iso).toLocaleDateString(language === "zh" ? "zh-Hant" : "en-US");

  return <Screen>
    <Bar><BackButton label={o.back} onPress={goBack} /><Heading>{draft.name || o.untitled}</Heading></Bar>

    <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
      {(["details", "missions", "share", "review"] as Section[]).map((s) => <Pressable key={s} accessibilityRole="tab"
        accessibilityState={{ selected: section === s }} onPress={() => setSection(s)}
        style={{ paddingVertical: 7, paddingHorizontal: 13, borderRadius: radii.pill, backgroundColor: section === s ? C.blue : C.white, borderWidth: 1.5, borderColor: section === s ? C.blue : C.line }}>
        <Text style={{ fontFamily: serif, fontSize: 13, color: section === s ? C.white : C.muted }}>
          {s === "details" ? o.details : s === "missions" ? o.waypoints : s === "share" ? o.share : o.review}
        </Text>
      </Pressable>)}
    </View>

    {status === "closed" && <Note text={o.closed} />}

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

      <PickerRow label={o.areaLabel} icon={<Glyph><ToolIcon kind="here" /></Glyph>}
        title={o.radiusLabel} sub={`${draft.area.radius_m >= 1000 ? `${draft.area.radius_m / 1000} km` : `${draft.area.radius_m} m`}`}
        onPress={() => setSheet("radius")} />
      {!!location.fix && <Pressable accessibilityRole="button" onPress={() => location.fix && edit({ area: { ...draft.area, lat: location.fix.lat, lng: location.fix.lng } })}
        style={{ alignSelf: "flex-start" }}>
        <Text style={{ fontFamily: sans, fontSize: 13, color: C.blue, textDecorationLine: "underline" }}>{o.areaHere}</Text>
      </Pressable>}

      <PickerRow label={o.routeLabel} icon={<Glyph><ToolIcon kind="landmark" /></Glyph>}
        title={o.route[draft.route_mode]} sub={o.routeSub[draft.route_mode]} onPress={() => setSheet("route")} />
      <PickerRow label={o.limitLabel} icon={<Glyph><ToolIcon kind="clock" /></Glyph>}
        title={draft.time_limit_min ? o.limitMinutes(draft.time_limit_min) : o.limitNone}
        sub={draft.time_limit_min ? h.privateLimit(draft.time_limit_min) : undefined} onPress={() => setSheet("limit")} />
      <PickerRow label={o.endLabel} icon={<Glyph><ToolIcon kind="calendar" /></Glyph>}
        title={draft.ends_at === "infinity" ? o.endNever : dateText(draft.ends_at)} onPress={() => setSheet("end")} />

      <Toggle label={o.leaderboardLabel} on={draft.leaderboard_visible}
        onText={o.leaderboardOn} offText={o.leaderboardOff}
        onPress={() => edit({ leaderboard_visible: !draft.leaderboard_visible })} />
    </>}

    {section === "missions" && <>
      {!rows.length && <View style={{ gap: 4, paddingVertical: spacing.sm }}>
        <Text style={{ fontFamily: serif, fontSize: 16, color: C.ink }}>{o.noWaypoints}</Text>
        <Text style={{ fontFamily: sans, fontSize: 13, lineHeight: 20, color: C.muted }}>{o.noWaypointsNote}</Text>
      </View>}
      {!!rows.length && <TaskList rows={rows} />}
      {waypoints.length < LIMITS.waypoints
        ? <Btn quiet title={o.addWaypoint} onPress={() => setEditing({ ...blankAt(nextOrdinal(waypoints), location.fix) })} />
        : <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{o.waypointFull(LIMITS.waypoints)}</Text>}
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
      {!!review?.stats.per_waypoint.length && !!review.stats.joined && <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: sans, fontSize: 12, letterSpacing: 1, color: C.muted }}>{o.perWaypoint}</Text>
        {review.stats.per_waypoint.map((s) => {
          const w = waypoints.find((x) => x.id === s.id);
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
    <Sheet open={sheet === "radius"} title={o.radiusLabel} onClose={() => setSheet(null)}>
      {RADII.map((r) => <SheetOption key={r} selected={draft.area.radius_m === r}
        icon={<Glyph><ToolIcon kind="here" /></Glyph>}
        title={r >= 1000 ? `${r / 1000} km` : `${r} m`} onPress={() => { edit({ area: { ...draft.area, radius_m: r } }); setSheet(null); }} />)}
    </Sheet>
    <Sheet open={sheet === "end"} title={o.endLabel} onClose={() => setSheet(null)}>
      <SheetOption selected={draft.ends_at === "infinity"} icon={<Glyph><ToolIcon kind="anywhere" /></Glyph>}
        title={o.endNever} onPress={() => { edit({ ends_at: "infinity" }); setSheet(null); }} />
      <MonthCalendar language={language} value={draft.ends_at === "infinity" ? new Date().toISOString() : draft.ends_at}
        onChange={(v) => edit({ ends_at: v })} />
    </Sheet>

    {!!editing && <WaypointEditor waypoint={editing} busy={busy}
      onClose={() => setEditing(null)} onSave={saveWaypoint}
      onDelete={editing.id ? () => deleteWaypoint(editing) : undefined} />}
  </Screen>;
}

const blankAt = (ordinal: number, fix: { lat: number; lng: number } | null | undefined): WaypointDraft => ({
  ordinal, name: "", lat: fix?.lat ?? 0, lng: fix?.lng ?? 0,
  mission_type: "arrive" as MissionType, points: 10, description: "",
  puzzle_kind: "choice", choices: ["", ""], answer: "",
});

const input = { fontFamily: sans, fontSize: 15, color: C.ink, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 12 } as const;

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
