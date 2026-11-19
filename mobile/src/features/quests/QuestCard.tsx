// The card that flips up out of a quest pin, shared by Today's Hunt (played from home), City Hunt quests and
// route stops (played at the pin). It shows what the quest asks; whoever holds it keeps the answers and results.
import React from "react";
import { Image, Platform, Pressable, Text, TextInput, View } from "react-native";
import { localText, parseGuess, type GuessMark } from "../../services/cityPuzzle";
import type { Quest, QuestResult } from "../../services/quests";
import { C, radii, sans, serif, shadows, spacing } from "../../theme";
import { GuessRow, Venue } from "../explorer/PriceGuessScreen";
import { useExplorerText } from "../explorer/strings";
import { questImageSource } from "../hunt/questImage";
import { useTodaysHuntText } from "../todaysHunt/strings";
import { questPicture } from "./questArt";
import { useQuestText } from "./strings";

export const questCardStyle = { width: "100%" as const, maxWidth: 560, alignSelf: "center" as const, gap: spacing.sm, backgroundColor: "rgba(255,255,255,.97)", borderRadius: 22, padding: spacing.md, borderWidth: 1, borderColor: C.line, ...shadows.card };

/** At the pin: how far away the player is (null when close enough), and the actions only a pin has. */
export type PinPlay = { away: string | null; onArrive: () => void; onStart: () => void; started: boolean };

export function QuestCard({ quest, zh, result, picked, wrong = [], marks, text, busy, catchCount, caught, onText, onChoose, onGuess, onCatch, pin }: {
  quest: Quest; zh: boolean; result: QuestResult | null; picked: number | null; marks: GuessMark[]; text: string; busy: boolean; catchCount: number; caught: number;
  onText: (v: string) => void; onChoose: (i: number) => void; onGuess: () => void; onCatch: () => void;
  /** Choices already missed (a pin's question allows more than one try). */
  wrong?: number[];
  /** Played at the pin rather than from home. */
  pin?: PinPlay;
}) {
  const t = useTodaysHuntText();
  const x = useExplorerText();
  const q = useQuestText();
  const typed = parseGuess(text);
  const correct = result?.correct_answer && "choice" in result.correct_answer ? result.correct_answer.choice : null;
  const tint = quest.color === "brass" ? C.brass : C.blue;
  const far = !!pin?.away;
  // Pin play shows the quest-type picture; Today's Hunt keeps the place picture it was designed with.
  const face = pin ? (quest.image ? questImageSource(quest.image) : questPicture(quest.type)) : questImageSource(quest.image);
  const head = <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
    <Image source={face} style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 2.5, borderColor: quest.done ? C.plum : tint }} />
    <View style={{ flex: 1 }}>
      <Text style={{ fontFamily: sans, fontSize: 11, letterSpacing: .6, color: tint }}>{quest.ordinal} · {pin ? q.kind[quest.type] : t.kind[quest.type]}</Text>
      <Text numberOfLines={1} style={{ fontFamily: serif, fontSize: 17, color: C.ink }}>{zh ? quest.name_zh : quest.name_en}</Text>
    </View>
  </View>;
  const awayLine = far && !result && <Text style={{ fontFamily: sans, fontSize: 13, color: C.wax }}>{pin!.away}</Text>;
  const action = (title: string, onPress: () => void, color: string = C.blue) => <Pressable accessibilityRole="button" disabled={busy || far} onPress={onPress}
    style={({ pressed }) => ({ alignItems: "center", backgroundColor: far ? "#E6EBF1" : color, borderRadius: radii.pill, paddingVertical: 12, opacity: busy ? .6 : pressed ? .88 : 1 })}>
    <Text style={{ fontFamily: serif, fontSize: 16, color: far ? C.muted : C.white }}>{title}</Text>
  </Pressable>;

  if (quest.type === "question" && quest.question) {
    const qq = quest.question;
    return <>
      {head}
      <Text style={{ fontFamily: serif, fontSize: 18, lineHeight: 27, color: C.ink }}>{zh ? qq.prompt_zh : qq.prompt_en}</Text>
      {awayLine}
      {qq.kind === "text" ? !result && <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput accessibilityLabel={q.answerPlaceholder} value={text} onChangeText={onText} onSubmitEditing={onGuess} placeholder={q.answerPlaceholder} placeholderTextColor="#A5AFBD" returnKeyType="done"
          editable={!far} style={[{ flex: 1, minWidth: 0, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontFamily: serif, fontSize: 17, color: C.ink }, Platform.OS === "web" ? { outlineStyle: "none" } as object : null]} />
        <Pressable accessibilityRole="button" disabled={busy || far || !text.trim()} onPress={onGuess}
          style={({ pressed }) => ({ borderRadius: 14, paddingHorizontal: 18, justifyContent: "center", backgroundColor: far || !text.trim() ? "#E6EBF1" : C.blue, opacity: busy ? .6 : pressed ? .88 : 1 })}>
          <Text style={{ fontFamily: sans, fontWeight: "600", color: far || !text.trim() ? C.muted : C.white }}>{q.submit}</Text>
        </Pressable>
      </View>
      : <View style={{ gap: 8 }}>
        {(qq.choices ?? []).map((c, i) => {
          const isRight = correct === i, isWrong = (result && picked === i && correct !== i) || wrong.includes(i);
          const off = !!result || busy || far || wrong.includes(i);
          return <Pressable key={i} accessibilityRole="button" accessibilityState={{ selected: picked === i, disabled: off }} disabled={off} onPress={() => onChoose(i)}
            style={({ pressed }) => ({ borderRadius: 14, borderWidth: 1.5, paddingVertical: 11, paddingHorizontal: 14,
              borderColor: isRight ? C.brass : isWrong ? C.wax : picked === i ? C.blue : C.line,
              backgroundColor: isRight ? "#FBF4E6" : C.white, opacity: pressed ? .85 : 1 })}>
            <Text style={{ fontFamily: sans, fontSize: 15, color: isWrong ? C.wax : C.ink }}>{zh ? c.zh : c.en}{isRight ? "  ✓" : ""}</Text>
          </Pressable>;
        })}
      </View>}
    </>;
  }

  if (quest.type === "price" && quest.price) {
    const p = quest.price;
    return <>
      {head}
      <Text style={{ fontFamily: serif, fontSize: 18, lineHeight: 27, color: C.ink }}>{zh ? p.prompt_zh : p.prompt_en}</Text>
      {(zh ? p.place_zh : p.place_en) !== (zh ? quest.name_zh : quest.name_en) && <Venue text={zh ? p.place_zh : p.place_en} />}
      {awayLine}
      {marks.map((m, i) => <GuessRow key={i} n={i + 1} mark={m} puzzle={p} />)}
      {!result && <>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14 }}>
            <Text style={{ fontFamily: serif, fontSize: 16, color: C.muted }}>US$</Text>
            <TextInput accessibilityLabel={x.guessLabel} value={text} onChangeText={onText} onSubmitEditing={onGuess} keyboardType="decimal-pad" inputMode="decimal" returnKeyType="done" editable={!far}
              style={[{ flex: 1, minWidth: 0, paddingVertical: 12, fontFamily: serif, fontSize: 19, color: C.ink }, Platform.OS === "web" ? { outlineStyle: "none" } as object : null]} />
            {typed != null && <Text style={{ fontFamily: sans, fontSize: 13, color: C.muted }}>≈ {localText(typed, p)}</Text>}
          </View>
          <Pressable accessibilityRole="button" disabled={busy || far || typed == null} onPress={onGuess}
            style={({ pressed }) => ({ borderRadius: 14, paddingHorizontal: 20, justifyContent: "center", backgroundColor: typed == null || far ? "#E6EBF1" : C.blue, opacity: busy ? .6 : pressed ? .88 : 1 })}>
            <Text style={{ fontFamily: sans, fontWeight: "600", color: typed == null || far ? C.muted : C.white }}>{x.guess}</Text>
          </Pressable>
        </View>
        <Text style={{ fontFamily: sans, fontSize: 12.5, color: C.muted }}>{t.tries(p.tries_left)} {x.inUsd(localText(1, p))}</Text>
      </>}
    </>;
  }

  if (pin && quest.type === "arrive") return <>
    {head}
    <Text style={{ fontFamily: sans, fontSize: 14, lineHeight: 21, color: C.ink }}>{q.sub.arrive}</Text>
    {awayLine}
    {!result && action(q.youAreHere, pin.onArrive)}
  </>;

  if (pin && (quest.type === "catch" || quest.type === "landmark")) {
    const catching = quest.type === "catch";
    return <>
      {head}
      <Text style={{ fontFamily: sans, fontSize: 14, lineHeight: 21, color: C.ink }}>
        {pin.started ? (catching ? q.catchStarted(catchCount) : q.fightStarted) : q.sub[quest.type]}
      </Text>
      {awayLine}
      {!result && !pin.started && action(catching ? q.startCatch(catchCount) : q.startFight, pin.onStart, C.wax)}
    </>;
  }

  // Catch from home (Today's Hunt).
  return <>
    {head}
    <Text style={{ fontFamily: sans, fontSize: 14, lineHeight: 21, color: C.ink }}>{result ? t.caught(caught, catchCount) : t.catchBody(catchCount)}</Text>
    {!result && <Pressable accessibilityRole="button" disabled={busy} onPress={onCatch} style={({ pressed }) => ({ alignItems: "center", backgroundColor: C.wax, borderRadius: radii.pill, paddingVertical: 12, opacity: busy ? .6 : pressed ? .88 : 1 })}>
      <Text style={{ fontFamily: serif, fontSize: 16, color: C.white }}>{t.start}</Text>
    </Pressable>}
  </>;
}
