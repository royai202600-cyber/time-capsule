import React, { useEffect, useState } from "react";
import { Image, Modal, Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { ArtIcon } from "../../components/ArtIcon";
import { useLanguage } from "../../i18n";
import { useReducedMotion } from "../../useReducedMotion";
import { characters } from "../../art/manifest";
import { distanceText } from "../sea/strings";
import { GAME_ACTION_RADIUS_M } from "../../services/game";
import { huntStatus, keeperSpot, landmarkName, stepGoal, readyToReturn, type Hunt } from "../../services/hunt";
import { clockText, runClock, runningLow, type RunClock } from "../../services/huntClock";
import { C, radii, sans, serif, shadows, spacing } from "../../theme";
import { timeUntil, useHuntText } from "./strings";

/** The Letter Keeper's round dialog portrait (City Hunt art). */
export const keeperPortrait = characters.keeperPortrait;

const when = (h: Hunt, language: "zh" | "en", t: ReturnType<typeof useHuntText>) =>
  huntStatus(h) === "upcoming" ? t.opensIn(timeUntil(h.starts_at, language))
    : h.ends_at === "infinity" ? t.openDaily : t.endsIn(timeUntil(h.ends_at, language));

/** The run's clock, re-read every second while it is running. */
export function useRunClock(hunt: Hunt | null): RunClock {
  const [, tick] = useState(0);
  const clock: RunClock = hunt ? runClock(hunt) : { state: "none" };
  const running = clock.state === "running";
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [running, hunt?.id]);
  return clock;
}

const Stopwatch = ({ color, size = 18 }: { color: string; size?: number }) => <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
  <Circle cx={12} cy={13.5} r={7.5} stroke={color} strokeWidth={1.8} />
  <Path d="M12 9.5v4l2.5 1.5M9.5 3h5M12 3v3" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
</Svg>;

/** The countdown on the map during a timed run. Tapping it opens the Quest sheet. */
export function RunChip({ hunt, onPress }: { hunt: Hunt | null; onPress: () => void }) {
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

/** The clock inside a hunt's card on the Quest sheet: the limit, the countdown, or the finished times. */
function RunPanel({ hunt }: { hunt: Hunt }) {
  const t = useHuntText();
  const clock = useRunClock(hunt);
  if (!hunt.time_limit_min) return null;
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
    <View style={{ flex: 1 }}><Text style={{ fontFamily: serif, fontSize: 16, color: C.wax }}>{t.timeUp}</Text><Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{t.timeUpNote}</Text></View>
  </View>;
  return <View style={box}>
    <Stopwatch color={C.blue} />
    <Text style={{ flex: 1, fontFamily: sans, fontSize: 13, lineHeight: 19, color: C.ink }}>{t.limit(hunt.time_limit_min)}{hunt.best_s != null ? `　${t.bestTime} ${clockText(hunt.best_s)}` : ""}</Text>
  </View>;
}

export function StepList({ hunt, compact = false }: { hunt: Hunt; compact?: boolean }) {
  const t = useHuntText();
  return <View style={{ gap: compact ? 6 : 10 }}>
    {hunt.steps.map((s) => {
      const done = s.count >= s.goal;
      return <View key={s.key} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: done ? C.brass : "transparent", borderWidth: done ? 0 : 1.5, borderColor: C.brass }}>
          {done && <ArtIcon name="check" size={14} color={C.white} />}
        </View>
        <Text style={{ flex: 1, fontFamily: sans, fontSize: compact ? 13 : 15, color: done ? C.muted : C.ink, textDecorationLine: done && !compact ? "line-through" : "none" }}>{t.steps[s.key]}</Text>
        {s.goal > 1 && <Text style={{ fontFamily: serif, fontSize: compact ? 13 : 15, color: done ? C.muted : C.blue }}>{s.count} / {s.goal}</Text>}
      </View>;
    })}
  </View>;
}

export function QuestSheet({ visible, hunts, busy, onClose, onJoin, onShowOnMap }: {
  visible: boolean; hunts: Hunt[]; busy: boolean;
  onClose: () => void; onJoin: (h: Hunt) => void; onShowOnMap: (h: Hunt) => void;
}) {
  const t = useHuntText();
  const { language } = useLanguage();
  const reduced = useReducedMotion();
  const list = hunts.filter((h) => huntStatus(h) !== "closed");
  return <Modal visible={visible} transparent animationType={reduced ? "fade" : "slide"} onRequestClose={onClose}>
    <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "#16263F77" }}>
      <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel={t.close} />
      <View style={{ maxHeight: "82%", width: "100%", maxWidth: 640, alignSelf: "center", backgroundColor: C.paper, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, borderTopWidth: 2, borderColor: C.brass, overflow: "hidden" }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
          <Text style={{ flex: 1, fontFamily: serif, fontSize: 22, color: C.ink }}>{t.quest}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t.close} onPress={onClose} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><ArtIcon name="close" /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md }}>
          {!list.length && <View style={{ alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl }}>
            <ArtIcon name="quest" size={40} color={C.brass} />
            <Text style={{ fontFamily: serif, fontSize: 17, color: C.ink }}>{t.noHunt}</Text>
            <Text style={{ fontFamily: sans, fontSize: 13, color: C.muted, textAlign: "center" }}>{t.noHuntNote}</Text>
          </View>}
          {list.map((h) => <View key={h.id} style={{ gap: spacing.md, backgroundColor: C.white, borderRadius: radii.md, borderWidth: 1, borderColor: C.line, padding: spacing.md, ...shadows.card }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <Image source={keeperPortrait} style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 2.5, borderColor: C.brass }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: sans, fontSize: 11, letterSpacing: 1.2, color: C.brass }}>{t.huntKicker} · {language === "zh" ? h.city_zh : h.city_en}</Text>
                <Text style={{ fontFamily: serif, fontSize: 20, color: C.ink }}>{language === "zh" ? h.name_zh : h.name_en}</Text>
                <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{h.finished_at ? t.finishedOn(new Date(h.finished_at).toLocaleDateString(language === "zh" ? "zh-Hant" : "en-US")) : when(h, language, t)}</Text>
              </View>
            </View>
            <RunPanel hunt={h} />
            {h.joined_at ? <StepList hunt={h} /> : <Text style={{ fontFamily: sans, fontSize: 13, lineHeight: 20, color: C.ink }}>{t.reward(h.reward.gold, h.reward.xp)}</Text>}
            {!h.finished_at && (h.joined_at
              ? <Btn quiet title={t.showOnMap} onPress={() => onShowOnMap(h)} />
              : <Btn title={t.join} disabled={busy || huntStatus(h) === "closed"} onPress={() => onJoin(h)} />)}
            {h.preview && <Text style={{ fontFamily: sans, fontSize: 11, color: C.muted }}>{t.preview}</Text>}
          </View>)}
        </ScrollView>
      </View>
    </View>
  </Modal>;
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
    else if (near) { line = t.lineCheckIn(stepGoal(hunt, "spin"), stepGoal(hunt, "restore"), landmarkName(hunt, language) ?? t.theLandmark); action = { title: t.go, run: onCheckIn }; }
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
    {steps && <StepList hunt={hunt} compact />}
    {!!note && <Text style={{ fontFamily: sans, fontSize: 13, color: C.blue }}>{note}</Text>}
    {action && <Btn title={action.title} disabled={busy} onPress={action.run} />}
  </View>;
}

function Btn({ title, onPress, quiet, disabled }: { title: string; onPress: () => void; quiet?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ borderRadius: radii.pill, paddingVertical: 12, alignItems: "center", backgroundColor: quiet ? C.white : C.blue, borderWidth: quiet ? 1.5 : 0, borderColor: C.blue, opacity: disabled ? .5 : pressed ? .85 : 1 })}>
    <Text style={{ fontFamily: serif, fontSize: 15, color: quiet ? C.blue : C.white }}>{title}</Text>
  </Pressable>;
}
