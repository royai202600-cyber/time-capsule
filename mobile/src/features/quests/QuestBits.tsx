// Pieces the private-hunt quest editor and the route builder share, so a quest is set the same way in both.
import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import { QUEST_KINDS, type QuestKind } from "../../services/quests";
import type { PoolItem } from "../../services/routes";
import { C, radii, sans, serif, spacing } from "../../theme";
import { ArtIcon } from "../../components/ArtIcon";
import { Venue } from "../explorer/PriceGuessScreen";
import { questPicture } from "./questArt";
import { useQuestText } from "./strings";

/** The five quest types, each with its approved picture. `off` greys out a type that can't be used here (Landmark far from one). */
export function QuestTypeChips({ value, kinds = QUEST_KINDS, off, compact, onChange }: {
  value: QuestKind | null; kinds?: readonly QuestKind[]; off?: (k: QuestKind) => boolean; compact?: boolean; onChange: (k: QuestKind) => void;
}) {
  const q = useQuestText();
  const size = compact ? 30 : 40;
  return <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: compact ? 6 : spacing.sm }}>
    {kinds.map((kind) => {
      const on = value === kind, disabled = !!off?.(kind);
      return <Pressable key={kind} accessibilityRole="radio" accessibilityState={{ selected: on, disabled }} accessibilityLabel={q.kind[kind]} disabled={disabled} onPress={() => onChange(kind)}
        style={({ pressed }) => ({
          flexBasis: compact ? undefined : "30%", flexGrow: compact ? 0 : 1, flexDirection: compact ? "row" : "column", alignItems: "center", gap: compact ? 6 : 6,
          paddingVertical: compact ? 5 : 10, paddingHorizontal: compact ? 8 : 6, borderRadius: compact ? radii.pill : radii.md,
          backgroundColor: on ? C.glass : C.white, borderWidth: 1.5, borderColor: on ? C.blue : C.line, opacity: disabled ? .4 : pressed ? .85 : 1,
        })}>
        <Image source={questPicture(kind)} style={{ width: size, height: size, borderRadius: size / 2 }} />
        <Text style={{ fontFamily: sans, fontSize: compact ? 12 : 13, color: on ? C.ink : C.muted, textAlign: "center" }}>{q.kind[kind]}</Text>
      </Pressable>;
    })}
  </View>;
}

/** A question or price from the city pool, as the sender or organizer will see it asked, with a way to swap it. */
export function PoolCard({ item, zh, busy, empty, onAnother }: { item: PoolItem | null; zh: boolean; busy?: boolean; empty?: string; onAnother?: () => void }) {
  const q = useQuestText();
  const prompt = item?.question ? (zh ? item.question.prompt_zh : item.question.prompt_en) : item?.price ? (zh ? item.price.prompt_zh : item.price.prompt_en) : "";
  return <View style={{ gap: 8, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: radii.md, padding: spacing.md }}>
    {item ? <>
      <Text style={{ fontFamily: serif, fontSize: 16, lineHeight: 24, color: C.ink }}>{prompt}</Text>
      {item.question?.choices && <Text style={{ fontFamily: sans, fontSize: 13, color: C.muted }}>{item.question.choices.map((c) => zh ? c.zh : c.en).join(" · ")}</Text>}
      {item.type === "price" ? <Venue text={zh ? item.name_zh : item.name_en} />
        : <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <ArtIcon name="pin" size={14} color={C.muted} />
          <Text style={{ fontFamily: sans, fontSize: 13, color: C.muted }}>{q.poolPlace(zh ? item.name_zh : item.name_en)}</Text>
        </View>}
    </> : <Text style={{ fontFamily: sans, fontSize: 13, color: C.muted }}>{empty}</Text>}
    {onAnother && <Pressable accessibilityRole="button" disabled={busy} onPress={onAnother} style={{ alignSelf: "flex-start", paddingVertical: 4, opacity: busy ? .5 : 1 }}>
      <Text style={{ fontFamily: sans, fontSize: 13, color: C.blue, textDecorationLine: "underline" }}>{item?.type === "price" ? q.anotherPrice : q.anotherQuestion}</Text>
    </Pressable>}
  </View>;
}

/** A small count, one step at a time: fewer, the number, more. */
export function Stepper({ value, min = 1, max, label, onChange }: { value: number; min?: number; max: number; label: string; onChange: (n: number) => void }) {
  const step = (by: number) => onChange(Math.max(min, Math.min(max, value + by)));
  const button = (by: number, text: string, off: boolean) => <Pressable accessibilityRole="button" accessibilityLabel={`${label} ${text}`} disabled={off} onPress={() => step(by)}
    style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: C.white, borderWidth: 1.5, borderColor: C.blue, opacity: off ? .4 : 1 }}>
    <Text style={{ fontFamily: serif, fontSize: 22, lineHeight: 26, color: C.blue }}>{text}</Text>
  </Pressable>;
  return <View accessible accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min, max, now: value }}
    accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
    onAccessibilityAction={(e) => step(e.nativeEvent.actionName === "increment" ? 1 : -1)}
    style={{ flexDirection: "row", alignItems: "center", gap: spacing.lg }}>
    {button(-1, "−", value <= min)}
    <Text style={{ minWidth: 40, fontFamily: serif, fontSize: 26, color: C.ink, textAlign: "center" }}>{value}</Text>
    {button(1, "+", value >= max)}
  </View>;
}
