import React from "react";
import { Image, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { ArtIcon } from "../../components/ArtIcon";
import { useLanguage } from "../../i18n";
import { useReducedMotion } from "../../useReducedMotion";
import { characters } from "../../art/manifest";
import { distanceText } from "../sea/strings";
import { GAME_ACTION_RADIUS_M } from "../../services/game";
import { huntStatus, KEEPER_SPOT, readyToReturn, type Hunt } from "../../services/hunt";
import { C, radii, sans, serif, shadows, spacing } from "../../theme";
import { timeUntil, useHuntText } from "./strings";

/** The Letter Keeper's round dialog portrait (City Hunt art). */
export const keeperPortrait = characters.keeperPortrait;

const when = (h: Hunt, language: "zh" | "en", t: ReturnType<typeof useHuntText>) =>
  huntStatus(h) === "upcoming" ? t.opensIn(timeUntil(h.starts_at, language)) : t.endsIn(timeUntil(h.ends_at, language));

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
  const spot = KEEPER_SPOT[hunt.id]?.[language] ?? t.startSpot;
  const farNote = near ? "" : t.walkCloser(distanceText(meters - GAME_ACTION_RADIUS_M));
  let line = t.lineDuring, action: { title: string; run: () => void } | null = null, steps = false, note = "";
  if (hunt.finished_at) line = t.lineAfter;
  else if (!hunt.checked_in_at) {
    if (!hunt.joined_at) { line = t.lineBefore; action = { title: t.join, run: onJoin }; }
    else if (near) { line = t.lineCheckIn; action = { title: t.go, run: onCheckIn }; }
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
