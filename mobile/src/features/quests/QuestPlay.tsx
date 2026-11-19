// A quest pin opened on the Journey map (City Hunt quests, route stops): the shared quest card plus what
// happens when it is answered. The attempt itself is whatever the context's server function is; the server
// checks the player is at the pin, so the distance here only explains why the buttons wait.
import React, { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { haptics } from "../../components/haptics";
import { localPriceText, parseGuess, usdText, type GuessMark } from "../../services/cityPuzzle";
import { GAME_ACTION_RADIUS_M } from "../../services/game";
import { guessHint, type Quest, type QuestAnswer, type QuestResult } from "../../services/quests";
import { C, radii, sans, serif, spacing } from "../../theme";
import { useExplorerText } from "../explorer/strings";
import { formatDistance } from "../journey/CapsuleMapPage";
import { Btn } from "../journey/JourneyControls";
import { QuestCard, questCardStyle } from "./QuestCard";
import { useQuestText } from "./strings";

export function QuestPlay({ quest, zh, meters, onAttempt, onStarted, onClose }: {
  quest: Quest; zh: boolean;
  /** How far the player is from the pin; Infinity without a location. */
  meters: number;
  /** Throws an error with a `code` from the shared quest errors. */
  onAttempt: (answer?: QuestAnswer) => Promise<QuestResult>;
  /** A catch or Landmark has begun at the pin: the usual throw or fight finishes it. */
  onStarted?: () => void;
  onClose: () => void;
}) {
  const q = useQuestText();
  const x = useExplorerText();
  const [picked, setPicked] = useState<number | null>(null);
  const [wrong, setWrong] = useState<number[]>([]);
  const [marks, setMarks] = useState<GuessMark[]>([]);
  const [text, setText] = useState("");
  const [result, setResult] = useState<QuestResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [started, setStarted] = useState(false);
  // Guesses left as the server last counted them; the quest only carries the count from when it opened.
  const [triesLeft, setTriesLeft] = useState<number | null>(null);
  const shown = quest.price && triesLeft != null ? { ...quest, price: { ...quest.price, tries_left: triesLeft } } : quest;
  const away = quest.locked ? q.lockedNote : !Number.isFinite(meters) ? q.needLocation
    : meters > GAME_ACTION_RADIUS_M ? q.goCloser(formatDistance(meters - GAME_ACTION_RADIUS_M, zh ? "zh" : "en")) : null;

  const attempt = async (answer?: QuestAnswer) => {
    if (busy) return null;
    setBusy(true); setNote("");
    try { return await onAttempt(answer); }
    catch (e) {
      void haptics.warn();
      setNote(q.errors[(e as { code?: string }).code ?? "unknown"] ?? q.errors.unknown);
      return null;
    } finally { setBusy(false); }
  };
  const finish = (out: QuestResult) => { setResult(out); if (out.ok) void haptics.success(); else void haptics.warn(); };
  const missed = (out: QuestResult) => {
    void haptics.warn();
    setNote(out.tries_left === 0 ? q.wait : out.tries_left != null ? `${q.wrong} · ${q.triesLeft(out.tries_left)}` : q.wrong);
  };

  const choose = async (i: number) => {
    setPicked(i);
    const out = await attempt({ choice: i });
    if (!out) return;
    if (out.done) finish(out); else { setWrong((w) => [...w, i]); setPicked(null); missed(out); }
  };
  const guess = async () => {
    if (quest.type === "question") {
      const out = await attempt({ text: text.trim() });
      if (!out) return;
      if (out.done) finish(out); else { setText(""); missed(out); }
      return;
    }
    const usd = parseGuess(text);
    if (usd == null) { setNote(x.badGuess); void haptics.warn(); return; }
    const out = await attempt({ usd });
    if (!out) return;
    setText("");
    if (out.tries_left != null) setTriesLeft(out.tries_left);
    setMarks((m) => [...m, { usd, hint: guessHint(out, usd), close: false }]);
    if (out.done) finish(out); else void haptics.tick();
  };
  const arrive = async () => { const out = await attempt(); if (out) finish(out); };
  const start = async () => {
    const out = await attempt();
    if (!out) return;
    if (out.done) finish(out); else { setStarted(true); void haptics.success(); onStarted?.(); }
  };
  const answerText = (out: QuestResult) => {
    const c = out.correct_answer;
    if (!c) return "";
    if ("choice" in c) { const ch = quest.question?.choices?.[c.choice]; return ch ? (zh ? ch.zh : ch.en) : ""; }
    if ("usd" in c) return `${usdText(c.usd)} · ${localPriceText(c.local_amount, quest.price?.currency ?? "")}`;
    return c.text;
  };

  return <Modal visible transparent animationType="slide" onRequestClose={onClose}>
    <View style={{ flex: 1, justifyContent: "flex-end" }}>
      <Pressable accessibilityRole="button" accessibilityLabel={q.done} onPress={onClose}
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(22,38,63,.25)" }} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} pointerEvents="box-none">
        <SafeAreaView edges={["bottom"]} style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
          <View style={questCardStyle}>
            <QuestCard quest={shown} zh={zh} result={result} picked={picked} wrong={wrong} marks={marks} text={text} busy={busy}
              catchCount={quest.catch_count ?? 3} caught={0} onText={setText} onChoose={(i) => void choose(i)} onGuess={() => void guess()} onCatch={() => void start()}
              pin={{ away: quest.done ? null : away, onArrive: () => void arrive(), onStart: () => void start(), started }} />
            {result && <View style={{ gap: 6 }}>
              <Text style={{ fontFamily: serif, fontSize: 17, color: result.ok ? C.plum : C.ink }}>{result.ok ? (quest.type === "question" ? q.right : q.done) : q.done}{result.points ? ` · +${result.points}` : ""}</Text>
              {!result.ok && !!answerText(result) && <Text style={{ fontFamily: sans, fontSize: 14, color: C.ink }}>{q.answerWas(answerText(result))}</Text>}
            </View>}
            {!!note && <Text accessibilityRole="alert" style={{ fontFamily: sans, fontSize: 13, color: C.wax }}>{note}</Text>}
            <Btn quiet={!result && !started} title={q.done} onPress={onClose} />
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  </Modal>;
}

/** Done line for a quest pin row elsewhere (route list): a filled dot, a ring, or a padlock. */
export function StopMark({ quest, n }: { quest: Quest; n: number }) {
  const tint = quest.done ? C.plum : quest.color === "blue" ? C.blue : C.brass;
  return <View style={{ width: 26, height: 26, borderRadius: radii.pill, alignItems: "center", justifyContent: "center", backgroundColor: quest.done ? tint : C.white, borderWidth: 2, borderColor: tint, opacity: quest.locked ? .5 : 1 }}>
    <Text style={{ fontFamily: serif, fontSize: 13, color: quest.done ? C.white : tint }}>{quest.done ? "✓" : n}</Text>
  </View>;
}
