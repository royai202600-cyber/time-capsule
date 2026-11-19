import React, { useEffect, useState } from "react";
import { Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { gameArt } from "../../art/manifest";
import { ArtIcon } from "../../components/ArtIcon";
import { haptics } from "../../components/haptics";
import { Vessel, type VesselKind } from "../../components/Vessel";
import { cityPuzzle, CityPuzzleError, localPriceText, localText, MAX_GUESSES, parseGuess, SAMPLE_SOURCE, shareText, usdText, type CityPuzzle, type ExplorerCity, type GuessMark, type GuessResult } from "../../services/cityPuzzle";
import { C, radii, sans, serif, spacing } from "../../theme";
import { Btn, Chip } from "../journey/JourneyControls";
import { useExplorerText } from "./strings";

/** One city's daily puzzle: guess a price in US dollars, six tries, higher or lower after each. */
export function PriceGuessScreen({ city, puzzle, streak, language, onResult, onClose }: {
  city: ExplorerCity; puzzle: CityPuzzle; streak: number; language: "zh" | "en"; onResult: (r: GuessResult) => void; onClose: () => void;
}) {
  const s = useExplorerText();
  const insets = useSafeAreaInsets();
  const zh = language === "zh";
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  useEffect(() => { if (!note) return; const id = setTimeout(() => setNote(""), 2400); return () => clearTimeout(id); }, [note]);
  const typed = parseGuess(text);
  const cityName = zh ? city.name_zh : city.name_en;

  const submit = async () => {
    if (busy || puzzle.done) return;
    if (typed == null) { setNote(s.badGuess); void haptics.warn(); return; }
    setBusy(true);
    try {
      const out = await cityPuzzle.guess(city.id, typed);
      setText("");
      if (out.puzzle.done) void (out.puzzle.won ? haptics.success() : haptics.warn()); else void haptics.tick();
      onResult(out);
    } catch (e) {
      void haptics.warn();
      const code = e instanceof CityPuzzleError ? e.code : "unknown";
      setNote(code === "already_done" ? s.alreadyDone : code === "bad_guess" ? s.badGuess : s.error);
    } finally { setBusy(false); }
  };
  const share = async () => {
    const message = shareText(puzzle, cityName, s.shareHead);
    try {
      if (Platform.OS === "web") { await navigator.clipboard.writeText(message); setNote(s.copied); }
      else await Share.share({ message });
    } catch { /* sharing was dismissed or is not available */ }
  };

  return <View accessibilityViewIsModal style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 40, backgroundColor: C.paper, paddingTop: insets.top }}>
    <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm }}>
      <Chip onPress={onClose} label={s.done}><ArtIcon name="close" size={20} /></Chip>
      <View style={{ flex: 1, alignItems: "center" }}>
        <Text accessibilityRole="header" style={{ fontFamily: serif, fontSize: 17, color: C.ink }}>{s.puzzleTitle}</Text>
        <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{s.puzzleSub(cityName, puzzle.no)}</Text>
      </View>
      <View style={{ width: 44 }} />
    </View>
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ width: "100%", maxWidth: 560, alignSelf: "center", paddingHorizontal: 22, paddingBottom: insets.bottom + spacing.lg, gap: 12 }}>
        {puzzle.photo
          ? <View style={{ gap: 10, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 12 }}>
            <Image source={{ uri: puzzle.photo.url }} accessibilityIgnoresInvertColors resizeMode="cover" style={{ width: "100%", aspectRatio: 16 / 10, borderRadius: 12, backgroundColor: C.paper }} />
            <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(puzzle.photo!.link)} hitSlop={6}>
              <Text style={{ fontFamily: sans, fontSize: 11.5, color: C.muted }}>{s.photoCredit(puzzle.photo.credit, puzzle.photo.license)}</Text>
            </Pressable>
            <View style={{ paddingHorizontal: 4, paddingBottom: 4, gap: 6 }}>
              <Text style={{ fontFamily: serif, fontSize: 18, lineHeight: 28, color: C.ink }}>{zh ? puzzle.question_zh : puzzle.question_en}</Text>
              <Venue text={zh ? puzzle.venue_zh : puzzle.venue_en} />
            </View>
          </View>
          : <View style={{ flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 16 }}>
            <Vessel kind={puzzle.vessel as VesselKind} size={96} />
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontFamily: serif, fontSize: 18, lineHeight: 28, color: C.ink }}>{zh ? puzzle.question_zh : puzzle.question_en}</Text>
              <Venue text={zh ? puzzle.venue_zh : puzzle.venue_en} />
            </View>
          </View>}
        <Text style={{ fontFamily: sans, fontSize: 12.5, lineHeight: 19, color: C.muted, textAlign: "center" }}>{s.inUsd(localText(1, puzzle))}</Text>

        <View style={{ gap: 6 }}>
          {Array.from({ length: MAX_GUESSES }, (_, i) => <GuessRow key={i} n={i + 1} mark={puzzle.guesses[i]} puzzle={puzzle} />)}
        </View>

        {puzzle.done && puzzle.answer
          ? <>
            <View style={{ gap: 8, backgroundColor: C.white, borderWidth: 1, borderColor: C.brass, borderRadius: 18, padding: 18 }}>
              <Text style={{ fontFamily: serif, fontSize: 19, color: C.ink }}>{puzzle.won ? s.winTitle : s.loseTitle}</Text>
              <Text style={{ fontFamily: serif, fontSize: 24, lineHeight: 32, color: C.plum }}>{s.about(usdText(puzzle.answer.usd), localPriceText(puzzle.answer.local, puzzle.currency))}</Text>
              <Text style={{ fontFamily: sans, fontSize: 14, lineHeight: 22, color: C.ink }}>{zh ? puzzle.answer.fact_zh : puzzle.answer.fact_en}</Text>
              {puzzle.answer.source === SAMPLE_SOURCE
                ? <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{s.sourceSample}</Text>
                : <Pressable accessibilityRole="link" disabled={!isLink(puzzle.answer.source)} onPress={() => void Linking.openURL(puzzle.answer!.source)} hitSlop={6}>
                  <Text style={{ fontFamily: sans, fontSize: 12, color: isLink(puzzle.answer.source) ? C.blue : C.muted }}>{s.source(siteName(puzzle.answer.source), puzzle.answer.checked_on)}</Text>
                </Pressable>}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10 }}>
                <Image source={gameArt.ball.wax} style={{ width: 30, height: 30 }} />
                <Text style={{ flex: 1, fontFamily: serif, fontSize: 15, color: C.ink }}>{[puzzle.reward ? s.reward(puzzle.reward) : "", streak > 0 ? s.streak(streak) : ""].filter(Boolean).join(" · ")}</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Btn flex quiet title={s.share} onPress={() => void share()} />
              <Btn flex title={s.done} onPress={onClose} />
            </View>
          </>
          : <>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14 }}>
                <Text style={{ fontFamily: serif, fontSize: 16, color: C.muted }}>US$</Text>
                <TextInput accessibilityLabel={s.guessLabel} value={text} onChangeText={setText} onSubmitEditing={() => void submit()} keyboardType="decimal-pad" inputMode="decimal" returnKeyType="done" autoFocus={Platform.OS === "web"}
                  style={[{ flex: 1, minWidth: 0, paddingVertical: 13, fontFamily: serif, fontSize: 20, color: C.ink }, Platform.OS === "web" ? { outlineStyle: "none" } as object : null]} />
                {typed != null && <Text style={{ fontFamily: sans, fontSize: 13, color: C.muted }}>≈ {localText(typed, puzzle)}</Text>}
              </View>
              <Pressable accessibilityRole="button" disabled={busy || typed == null} onPress={() => void submit()}
                style={({ pressed }) => ({ borderRadius: 14, paddingHorizontal: 22, justifyContent: "center", backgroundColor: typed == null ? "#E6EBF1" : C.blue, opacity: busy ? .6 : pressed ? .88 : 1 })}>
                <Text style={{ fontFamily: sans, fontWeight: "600", color: typed == null ? C.muted : C.white }}>{s.guess}</Text>
              </Pressable>
            </View>
            <Text style={{ fontFamily: sans, fontSize: 12.5, color: C.muted, textAlign: "center" }}>{s.left(MAX_GUESSES - puzzle.guesses.length)}</Text>
          </>}
        {!!note && <Text accessibilityRole="alert" style={{ alignSelf: "center", backgroundColor: C.ink, color: C.white, fontFamily: sans, fontSize: 13, paddingHorizontal: 16, paddingVertical: 9, borderRadius: radii.pill, overflow: "hidden" }}>{note}</Text>}
      </ScrollView>
    </KeyboardAvoidingView>
  </View>;
}

const isLink = (source: string) => /^https?:\/\//.test(source);
/** A source link shown as its site's name, so a long address doesn't fill the card. */
const siteName = (source: string) => { try { return isLink(source) ? new URL(source).hostname.replace(/^www\./, "") : source; } catch { return source; } };

/** Where the price comes from: one named shop or ticket office. */
export function Venue({ text }: { text: string }) {
  const s = useExplorerText();
  if (!text) return null;
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
    <ArtIcon name="pin" size={15} color={C.muted} />
    <Text style={{ flex: 1, fontFamily: sans, fontSize: 13, lineHeight: 19, color: C.muted }}>{s.venue(text)}</Text>
  </View>;
}

export function GuessRow({ n, mark, puzzle }: { n: number; mark?: GuessMark; puzzle: Pick<CityPuzzle, "currency" | "rate"> }) {
  const s = useExplorerText();
  if (!mark) return <View style={{ minHeight: 44, justifyContent: "center", borderWidth: 1, borderStyle: "dashed", borderColor: C.line, borderRadius: 12, paddingHorizontal: 14 }}>
    <Text style={{ fontFamily: sans, fontSize: 13, color: C.muted }}>{s.slot(n)}</Text>
  </View>;
  const hit = mark.hint === "solved";
  return <View style={{ minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, borderWidth: 1, borderColor: hit ? C.brass : C.line, backgroundColor: hit ? "#FBF4E6" : C.white, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 6 }}>
    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, flexShrink: 1 }}>
      <Text style={{ fontFamily: serif, fontSize: 16, color: C.ink }}>{usdText(mark.usd)}</Text>
      <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>≈ {localText(mark.usd, puzzle)}</Text>
    </View>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Text style={{ fontFamily: sans, fontSize: 14, fontWeight: "600", color: hit ? C.plum : C.blue }}>{hit ? `✓ ${s.hit}` : mark.hint === "higher" ? `↑ ${s.higher}` : `↓ ${s.lower}`}</Text>
      {!hit && mark.close && <View style={{ borderWidth: 1, borderColor: C.brass, backgroundColor: "#FBF4E6", borderRadius: radii.pill, paddingHorizontal: 7, paddingVertical: 1 }}>
        <Text style={{ fontFamily: sans, fontSize: 11.5, color: C.plum }}>{s.close}</Text>
      </View>}
    </View>
  </View>;
}
