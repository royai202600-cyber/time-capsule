import React, { useEffect, useState } from "react";
import { Image, Modal, Pressable, ScrollView, Text, View, type ImageSourcePropType } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { ArtIcon } from "../../components/ArtIcon";
import { useLanguage } from "../../i18n";
import { useReducedMotion } from "../../useReducedMotion";
import { characters } from "../../art/manifest";
import { distanceText } from "../publicCapsule/strings";
import { GAME_ACTION_RADIUS_M } from "../../services/game";
import { huntStatus, keeperSpot, landmarkName, questGoal, readyToReturn, type Hunt } from "../../services/cityHunt";
import { clockText, runClock, runningLow, type RunClock, type RunTimes } from "../../services/huntClock";
import { C, radii, sans, serif, shadows, spacing } from "../../theme";
import { timeUntil, useHuntText, type HuntText } from "./strings";

/** The Letter Keeper's round dialog portrait (City Hunt art). */
export const keeperPortrait = characters.keeperPortrait;

export function huntWindow(h: { starts_at: string; ends_at: string }, language: "zh" | "en", t: HuntText) {
  if (Date.now() < new Date(h.starts_at).getTime()) return t.opensIn(timeUntil(h.starts_at, language));
  return h.ends_at === "infinity" ? t.openDaily : t.endsIn(timeUntil(h.ends_at, language));
}

/** The run's clock, re-read every second while it is running. Either kind of hunt can supply it. */
export function useRunClock(hunt: RunTimes | null): RunClock {
  const [, tick] = useState(0);
  const clock: RunClock = hunt ? runClock(hunt) : { state: "none" };
  const running = clock.state === "running";
  useEffect(() => {
    if (running) {
      const timer = setInterval(() => tick((n) => n + 1), 1000);
      return () => clearInterval(timer);
    }
    // Joined ahead of a coordinated start: wake up when the run begins.
    const wait = hunt?.run_started_at ? new Date(hunt.run_started_at).getTime() - Date.now() : 0;
    if (wait <= 0 || wait > 86_400_000) return;
    const timer = setTimeout(() => tick((n) => n + 1), wait + 50);
    return () => clearTimeout(timer);
  }, [running, hunt?.run_started_at, hunt?.checked_in_at]);
  return clock;
}

const Stopwatch = ({ color, size = 18 }: { color: string; size?: number }) => <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
  <Circle cx={12} cy={13.5} r={7.5} stroke={color} strokeWidth={1.8} />
  <Path d="M12 9.5v4l2.5 1.5M9.5 3h5M12 3v3" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
</Svg>;

/** The countdown on the map during a timed run, for either kind of hunt. Tapping it opens the Quest sheet. */
export function RunChip({ hunt, onPress }: { hunt: RunTimes | null; onPress: () => void }) {
  const t = useHuntText();
  const clock = useRunClock(hunt);
  if (clock.state === "none") return null;
  const low = clock.state === "up" || runningLow(clock), color = low ? C.wax : C.blue;
  return <Pressable accessibilityRole="button" accessibilityLabel={clock.state === "up" ? t.timeUp : `${t.timeLeft} ${clockText(clock.left_s)}`} onPress={onPress}
    style={{ height: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: "rgba(246,248,251,.94)", flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1.5, borderColor: color, ...shadows.card }}>
    <Stopwatch color={color} />
    <Text style={{ fontFamily: serif, fontSize: 16, color, fontVariant: ["tabular-nums"] }}>{clock.state === "up" ? t.timeUp : clockText(clock.left_s)}</Text>
  </Pressable>;
}

/**
 * The clock inside a hunt's card: the limit, the countdown, or the finished times. Shared by City Hunts
 * and private hunts so a timed run looks the same whoever is running it.
 */
export function HuntClock({ hunt, startNote, upNote }: { hunt: RunTimes; startNote: (min: number) => string; upNote: string }) {
  const t = useHuntText();
  const clock = useRunClock(hunt);
  if (!hunt.time_limit_min && !hunt.run_ends_at) return null;
  const box = { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: C.glass, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: 10 } as const;
  if (hunt.finished_at) {
    if (hunt.today_s == null && hunt.best_s == null) return null;
    const record = hunt.today_s != null && hunt.today_s === hunt.best_s;
    return <View style={box}>
      <Stopwatch color={C.blue} />
      {hunt.today_s != null && <Text style={{ fontFamily: sans, fontSize: 13, color: C.ink }}>{t.todayTime} <Text style={{ fontFamily: serif, fontSize: 16 }}>{clockText(hunt.today_s)}</Text></Text>}
      {hunt.best_s != null && !record && <Text style={{ fontFamily: sans, fontSize: 13, color: C.muted }}>{t.bestTime} {clockText(hunt.best_s)}</Text>}
      {record && <Text style={{ fontFamily: sans, fontSize: 11, color: C.white, backgroundColor: C.wax, borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2, overflow: "hidden" }}>{t.newRecord}</Text>}
    </View>;
  }
  if (clock.state === "running") {
    const low = runningLow(clock), color = low ? C.wax : C.blue;
    return <View style={[box, { justifyContent: "space-between" }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}><Stopwatch color={color} /><Text style={{ fontFamily: sans, fontSize: 13, color: C.ink }}>{t.timeLeft}</Text></View>
      <Text accessibilityRole="timer" style={{ fontFamily: serif, fontSize: 24, color, fontVariant: ["tabular-nums"] }}>{clockText(clock.left_s)}</Text>
    </View>;
  }
  if (clock.state === "up") return <View style={box}>
    <Stopwatch color={C.wax} />
    <View style={{ flex: 1 }}><Text style={{ fontFamily: serif, fontSize: 16, color: C.wax }}>{t.timeUp}</Text><Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{upNote}</Text></View>
  </View>;
  if (!hunt.time_limit_min) return null;
  return <View style={box}>
    <Stopwatch color={C.blue} />
    <Text style={{ flex: 1, fontFamily: sans, fontSize: 13, lineHeight: 19, color: C.ink }}>{startNote(hunt.time_limit_min)}{hunt.best_s != null ? `　${t.bestTime} ${clockText(hunt.best_s)}` : ""}</Text>
  </View>;
}

/**
 * One line of a hunt's checklist. A City Hunt's steps and a private hunt's quests are the same thing
 * to a player, so they are drawn by the same component and only differ in what fills them.
 */
export type TaskRow = {
  key: string; label: string; sub?: string; right?: string;
  done?: boolean; locked?: boolean;
  /** Private quests carry a glyph for their type; a City Hunt's steps leave the circle empty. */
  glyph?: React.ReactNode;
  onPress?: () => void;
};

export function TaskList({ rows, compact = false }: { rows: TaskRow[]; compact?: boolean }) {
  const size = compact ? 22 : 26;
  return <View style={{ gap: compact ? 6 : 8 }}>
    {rows.map((r) => {
      const body = <>
        <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center", backgroundColor: r.done ? C.blue : "transparent", borderWidth: r.done ? 0 : 1.5, borderColor: r.locked ? C.line : r.done ? C.blue : C.blue, borderStyle: r.locked ? "dashed" : "solid" }}>
          {r.done ? <ArtIcon name="check" size={compact ? 13 : 15} color={C.white} />
            : r.locked ? <ArtIcon name="lock" size={13} color={C.muted} />
              : r.glyph}
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontFamily: sans, fontSize: compact ? 13 : 15, color: r.done ? C.muted : C.ink, textDecorationLine: r.done && !compact ? "line-through" : "none" }}>{r.label}</Text>
          {!!r.sub && <Text style={{ fontFamily: sans, fontSize: 11, color: C.muted }}>{r.sub}</Text>}
        </View>
        {!!r.right && <Text style={{ fontFamily: serif, fontSize: compact ? 13 : 15, color: r.done ? C.muted : C.ink }}>{r.right}</Text>}
      </>;
      const style = { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.sm, opacity: r.locked ? .55 : 1 };
      return r.onPress
        ? <Pressable key={r.key} accessibilityRole="button" disabled={r.locked} onPress={r.onPress}
          style={({ pressed }) => ({ ...style, paddingVertical: 6, paddingHorizontal: spacing.sm, marginHorizontal: -spacing.sm, borderRadius: radii.sm, backgroundColor: pressed ? C.glass : "transparent" })}>{body}</Pressable>
        : <View key={r.key} style={{ ...style, paddingVertical: 2 }}>{body}</View>;
    })}
  </View>;
}

/** A City Hunt's steps as task rows. */
export const huntTasks = (hunt: Hunt, t: HuntText): TaskRow[] => hunt.quests.map((s) => ({
  key: s.key, label: t.steps[s.key], done: s.count >= s.goal,
  right: s.goal > 1 ? `${s.count} / ${s.goal}` : undefined,
}));

/**
 * The card both tabs use. A hunt run by us and a hunt run by an organizer are the same activity, so they
 * get one layout: who it is from, what it is, the clock, how far you are, the checklist, then the actions.
 */
export function HuntCard({ kicker, kickerTone, portrait, title, subtitle, clock, startNote, upNote, progress, tasks, note, actions, footer }: {
  kicker: string; kickerTone: string; portrait?: ImageSourcePropType | null;
  title: string; subtitle: string;
  clock?: RunTimes | null; startNote?: (min: number) => string; upNote?: string;
  progress?: string; tasks?: TaskRow[]; note?: string;
  actions?: React.ReactNode; footer?: React.ReactNode;
}) {
  return <View style={{ gap: spacing.md, backgroundColor: C.white, borderRadius: radii.md, borderWidth: 1, borderColor: C.line, padding: spacing.md, ...shadows.card }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
      {!!portrait && <Image source={portrait} style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 2.5, borderColor: C.brass }} />}
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: sans, fontSize: 11, letterSpacing: 1.2, color: kickerTone }}>{kicker}</Text>
        <Text style={{ fontFamily: serif, fontSize: 20, color: C.ink }}>{title}</Text>
        <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{subtitle}</Text>
      </View>
    </View>
    {!!clock && !!startNote && <HuntClock hunt={clock} startNote={startNote} upNote={upNote ?? ""} />}
    {!!progress && <Text style={{ fontFamily: sans, fontSize: 13, color: C.ink }}>{progress}</Text>}
    {!!tasks?.length && <TaskList rows={tasks} />}
    {!!note && <Text style={{ fontFamily: sans, fontSize: 13, lineHeight: 20, color: C.muted }}>{note}</Text>}
    {actions}
    {footer}
  </View>;
}

/**
 * The Quest sheet. Our own City Hunts and the player's private hunts each get a tab
 * (docs/design/city-orienteering.md); with no private hunt joined, the tabs are still there so the
 * "enter a code" button has a home.
 */
export function QuestSheet({ visible, hunts, busy, onClose, onJoin, onShowOnMap, privateTab }: {
  visible: boolean; hunts: Hunt[]; busy: boolean;
  onClose: () => void; onJoin: (h: Hunt) => void; onShowOnMap: (h: Hunt) => void;
  /** The private-hunt tab's content and its "enter a code" button, or nothing to hide the tabs. */
  privateTab?: { count: number; onEnterCode: () => void; onMyHunts?: () => void; children: React.ReactNode };
}) {
  const t = useHuntText();
  const { language } = useLanguage();
  const reduced = useReducedMotion();
  const list = hunts.filter((h) => huntStatus(h) !== "closed");
  const [tab, setTab] = useState<"system" | "private">("system");
  return <Modal visible={visible} transparent animationType={reduced ? "fade" : "slide"} onRequestClose={onClose}>
    <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "#16263F77" }}>
      <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel={t.close} />
      <View style={{ maxHeight: "82%", width: "100%", maxWidth: 640, alignSelf: "center", backgroundColor: C.paper, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, borderTopWidth: 2, borderColor: C.brass, overflow: "hidden" }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
          <Text style={{ flex: 1, fontFamily: serif, fontSize: 22, color: C.ink }}>{t.quest}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t.close} onPress={onClose} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><ArtIcon name="close" /></Pressable>
        </View>
        {!!privateTab && <View style={{ flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
          <Tab title={t.systemTab} count={list.length} active={tab === "system"} onPress={() => setTab("system")} />
          <Tab title={t.privateTab} count={privateTab.count} active={tab === "private"} onPress={() => setTab("private")} />
        </View>}
        {privateTab && tab === "private"
          ? <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md }}>
            <Btn quiet title={t.enterCode} onPress={privateTab.onEnterCode} />
            {/* Organizers get here too; everyone else never sees it. */}
            {!!privateTab.onMyHunts && <Btn quiet title={t.myHunts} onPress={privateTab.onMyHunts} />}
            {privateTab.children}
            {!privateTab.count && <View style={{ alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl }}>
              <ArtIcon name="map" size={40} color={C.blue} />
              <Text style={{ fontFamily: serif, fontSize: 17, color: C.ink }}>{t.noPrivate}</Text>
              <Text style={{ fontFamily: sans, fontSize: 13, color: C.muted, textAlign: "center" }}>{t.noPrivateNote}</Text>
            </View>}
          </ScrollView>
          : <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md }}>
          {!list.length && <View style={{ alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl }}>
            <ArtIcon name="quest" size={40} color={C.blue} />
            <Text style={{ fontFamily: serif, fontSize: 17, color: C.ink }}>{t.noHunt}</Text>
            <Text style={{ fontFamily: sans, fontSize: 13, color: C.muted, textAlign: "center" }}>{t.noHuntNote}</Text>
          </View>}
          {list.map((h) => {
            const daily = h.ends_at === "infinity", done = !!h.finished_at;
            const tasks = huntTasks(h, t);
            return <HuntCard key={h.id}
              kicker={`${t.huntKicker} · ${language === "zh" ? h.city_zh : h.city_en}`} kickerTone={C.blue}
              portrait={keeperPortrait}
              title={language === "zh" ? h.name_zh : h.name_en}
              subtitle={!done ? huntWindow(h, language, t)
                : daily ? t.finishedToday
                  : t.finishedOn(new Date(h.finished_at!).toLocaleDateString(language === "zh" ? "zh-Hant" : "en-US"))}
              clock={h} startNote={t.limit} upNote={t.timeUpNote}
              progress={h.joined_at && !done ? t.questCount(tasks.filter((x) => x.done).length, tasks.length) : undefined}
              // A finished daily hunt says when it comes back instead of listing the ticks again.
              tasks={done ? undefined : h.joined_at ? tasks : undefined}
              note={done ? (daily ? t.backTomorrow : undefined) : h.joined_at ? undefined : t.reward(h.reward.gold, h.reward.xp)}
              actions={!done && (h.joined_at
                ? <Btn quiet title={t.showOnMap} onPress={() => onShowOnMap(h)} />
                : <Btn title={t.join} disabled={busy || huntStatus(h) === "closed"} onPress={() => onJoin(h)} />)}
              footer={h.preview ? <Text style={{ fontFamily: sans, fontSize: 11, color: C.muted }}>{t.preview}</Text> : undefined} />;
          })}
        </ScrollView>}
      </View>
    </View>
  </Modal>;
}

function Tab({ title, count, active, onPress }: { title: string; count: number; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress}
    style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: spacing.md, borderRadius: radii.pill, backgroundColor: active ? C.blue : C.white, borderWidth: 1.5, borderColor: active ? C.blue : C.line }}>
    <Text style={{ fontFamily: serif, fontSize: 14, color: active ? C.white : C.muted }}>{title}</Text>
    {count > 0 && <Text style={{ fontFamily: sans, fontSize: 11, color: active ? C.white : C.blue }}>{count}</Text>}
  </Pressable>;
}

/** The card that opens when you tap the Letter Keeper on the map. His lines are set text, never generated. */
export function KeeperCard({ hunt, meters, busy, onJoin, onCheckIn, onFinish, onClose }: {
  hunt: Hunt; meters: number; busy: boolean;
  onJoin: () => void; onCheckIn: () => void; onFinish: () => void; onClose: () => void;
}) {
  const t = useHuntText();
  const { language } = useLanguage();
  const near = meters <= GAME_ACTION_RADIUS_M;
  const spot = keeperSpot(hunt, language) ?? t.startSpot;
  const farNote = near ? "" : t.walkCloser(distanceText(meters - GAME_ACTION_RADIUS_M));
  const clock = useRunClock(hunt);
  let line = t.lineDuring, action: { title: string; run: () => void } | null = null, steps = false, note = "";
  if (hunt.finished_at) line = hunt.today_s != null && hunt.today_s === hunt.best_s ? t.lineRecord(clockText(hunt.today_s)) : t.lineAfter;
  // Out of time: the run is over, and checking in again starts a new one.
  else if (clock.state === "up") { line = t.lineTimeUp; if (near) action = { title: t.again, run: onCheckIn }; else note = farNote; }
  else if (!hunt.checked_in_at) {
    if (!hunt.joined_at) { line = t.lineBefore; action = { title: t.join, run: onJoin }; }
    else if (near) { line = t.lineCheckIn(questGoal(hunt, "spin"), questGoal(hunt, "restore"), landmarkName(hunt, language) ?? t.theLandmark); action = { title: t.go, run: onCheckIn }; }
    else { line = t.lineWaiting(spot); note = farNote; }
  } else if (readyToReturn(hunt) && near) { line = t.lineDone; action = { title: t.take, run: onFinish }; }
  else { steps = true; note = readyToReturn(hunt) ? farNote : ""; }
  return <View style={{ width: "100%", maxWidth: 560, alignSelf: "center", gap: spacing.md, backgroundColor: "rgba(255,255,255,.97)", borderRadius: 22, padding: spacing.md, borderWidth: 1, borderColor: C.line, ...shadows.card }}>
    <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "flex-start" }}>
      <Image source={keeperPortrait} style={{ width: 60, height: 60, borderRadius: 30, borderWidth: 3, borderColor: C.brass }} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontFamily: sans, fontSize: 11, letterSpacing: 1.2, color: C.brass }}>{t.keeper}</Text>
        <Text style={{ fontFamily: serif, fontSize: 16, lineHeight: 25, color: C.ink }}>{line}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t.close} onPress={onClose} hitSlop={8} style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}><ArtIcon name="close" size={18} color={C.muted} /></Pressable>
    </View>
    {steps && <TaskList rows={huntTasks(hunt, t)} compact />}
    {!!note && <Text style={{ fontFamily: sans, fontSize: 13, color: C.blue }}>{note}</Text>}
    {action && <Btn title={action.title} disabled={busy} onPress={action.run} />}
  </View>;
}

export function Btn({ title, onPress, quiet, disabled }: { title: string; onPress: () => void; quiet?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ borderRadius: radii.pill, paddingVertical: 12, alignItems: "center", backgroundColor: quiet ? C.white : C.blue, borderWidth: quiet ? 1.5 : 0, borderColor: C.blue, opacity: disabled ? .5 : pressed ? .85 : 1 })}>
    <Text style={{ fontFamily: serif, fontSize: 15, color: quiet ? C.blue : C.white }}>{title}</Text>
  </Pressable>;
}
