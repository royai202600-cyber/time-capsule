import React, { useEffect, useRef } from "react";
import { Image, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { gameArt } from "../../art/manifest";
import { ArtIcon } from "../../components/ArtIcon";
import { haptics } from "../../components/haptics";
import { CITIES, type CityPuzzle, type ExplorerCity, type PuzzleDay } from "../../services/cityPuzzle";
import { C, radii, sans, serif, shadows, spacing } from "../../theme";
import { Chip } from "../journey/JourneyControls";
import { useTodaysHuntText } from "../todaysHunt/strings";
import { useExplorerText } from "./strings";

/** With Today's Hunt on, each city's day: its score so far, whether it is finished, and its streak. */
export type HuntDays = Record<string, { score: number; finished: boolean; streak: number }>;

const GAP = 12;

/** Over the Journey map: swipe a city card and the map flies there; the button below starts that city's daily puzzle. */
export function CityExplorer({ day, hunt, index, onIndex, balls, language, onClose, onPlay }: {
  day: PuzzleDay | null; index: number; onIndex: (i: number) => void; balls: number | null; language: "zh" | "en";
  /** Today's Hunt replaces the daily price card: the button plays the city's hunt instead. */
  hunt?: HuntDays | null;
  onClose: () => void; onPlay: (city: ExplorerCity) => void;
}) {
  const s = useExplorerText();
  const t = useTodaysHuntText();
  const { width } = useWindowDimensions();
  const W = Math.min(width - 56, 420), STEP = W + GAP, inset = (width - W) / 2;
  const list = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const shown = useRef(index);
  // Open on the city the screen chose (the one you are in), without animating there.
  useEffect(() => { list.current?.scrollTo({ x: index * STEP, animated: false }); }, []);
  const go = (i: number) => { list.current?.scrollTo({ x: i * STEP, animated: true }); };
  const city = CITIES[index];
  const puzzleOf = (c: ExplorerCity) => day?.puzzles.find((p) => p.city === c.id) ?? null;
  const puzzle = puzzleOf(city);
  const name = (c: ExplorerCity) => language === "zh" ? c.name_zh : c.name_en;

  return <View pointerEvents="box-none" style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 32 }}>
    <SafeAreaView edges={["top", "left", "right"]} pointerEvents="box-none">
      <View pointerEvents="box-none" style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        <Chip onPress={onClose} label={s.back}><ArtIcon name="back" size={22} /></Chip>
        <View accessibilityRole="header" style={{ height: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: "rgba(246,248,251,.94)", justifyContent: "center", ...shadows.card }}>
          <Text style={{ fontFamily: serif, fontSize: 17, color: C.ink }}>{s.title}</Text>
        </View>
        <View style={{ flex: 1 }} pointerEvents="none" />
        {balls != null && <View accessibilityRole="text" accessibilityLabel={s.balls(balls)} style={{ height: 44, paddingLeft: 8, paddingRight: 14, borderRadius: 22, backgroundColor: "rgba(246,248,251,.94)", flexDirection: "row", alignItems: "center", gap: 6, ...shadows.card }}>
          <Image source={gameArt.ball.wax} style={{ width: 26, height: 26 }} />
          <Text style={{ fontFamily: serif, fontSize: 15, color: C.ink }}>{balls}</Text>
        </View>}
      </View>
    </SafeAreaView>

    <View style={{ flex: 1 }} pointerEvents="none" />

    <SafeAreaView edges={["bottom"]} pointerEvents="box-none" style={{ paddingBottom: spacing.md, gap: spacing.sm }}>
      <ScrollView ref={list} horizontal showsHorizontalScrollIndicator={false} snapToInterval={STEP} decelerationRate="fast" scrollEventThrottle={16}
        // The web has no snapToInterval: CSS scroll snapping does the same job there.
        style={Platform.OS === "web" ? { scrollSnapType: "x mandatory" } as object : undefined}
        contentContainerStyle={{ paddingHorizontal: inset, gap: GAP, paddingVertical: 6 }}
        onScroll={(e) => {
          const next = Math.max(0, Math.min(CITIES.length - 1, Math.round(e.nativeEvent.contentOffset.x / STEP)));
          if (next !== shown.current) { shown.current = next; void haptics.page(); onIndex(next); }
        }}>
        {CITIES.map((c, i) => <CityCard key={c.id} city={c} puzzle={puzzleOf(c)} hunt={hunt ? hunt[c.id] ?? null : undefined} streak={hunt ? hunt[c.id]?.streak ?? 0 : day?.streak ?? 0} width={W} active={i === index} language={language} onPress={() => go(i)} />)}
      </ScrollView>
      <View accessibilityElementsHidden pointerEvents="none" style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}>
        {CITIES.map((c, i) => <View key={c.id} style={{ width: i === index ? 14 : 6, height: 6, borderRadius: 3, backgroundColor: i === index ? C.ink : C.line }} />)}
      </View>
      <View style={{ width: W, alignSelf: "center" }}>
        {city.playable && hunt !== undefined
          ? <Pressable accessibilityRole="button" onPress={() => { void haptics.tap(); onPlay(city); }}
              style={({ pressed }) => ({ alignItems: "center", borderRadius: radii.pill, paddingVertical: 14, backgroundColor: hunt?.[city.id]?.finished ? C.white : C.blue, borderWidth: hunt?.[city.id]?.finished ? 1.5 : 0, borderColor: C.blue, opacity: pressed ? .88 : 1, ...shadows.card })}>
              <Text style={{ fontFamily: serif, fontSize: 16, color: hunt?.[city.id]?.finished ? C.blue : C.white }}>{hunt?.[city.id]?.finished ? t.see : t.play}</Text>
            </Pressable>
          : city.playable
          ? <Pressable accessibilityRole="button" disabled={!puzzle} onPress={() => { void haptics.tap(); onPlay(city); }}
              style={({ pressed }) => ({ alignItems: "center", borderRadius: radii.pill, paddingVertical: 14, backgroundColor: puzzle?.done ? C.white : C.blue, borderWidth: puzzle?.done ? 1.5 : 0, borderColor: C.blue, opacity: !puzzle ? .5 : pressed ? .88 : 1, ...shadows.card })}>
              <Text style={{ fontFamily: serif, fontSize: 16, color: puzzle?.done ? C.blue : C.white }}>{puzzle?.done ? s.see : s.play}</Text>
            </Pressable>
          : <View accessibilityRole="text" style={{ alignItems: "center", borderRadius: radii.pill, paddingVertical: 14, backgroundColor: "rgba(230,235,241,.96)" }}>
              <Text style={{ fontFamily: serif, fontSize: 16, color: C.muted }}>{s.soon}</Text>
            </View>}
      </View>
    </SafeAreaView>
  </View>;
}

function CityCard({ city, puzzle, hunt, streak, width, active, language, onPress }: {
  city: ExplorerCity; puzzle: CityPuzzle | null; hunt?: HuntDays[string] | null; streak: number; width: number; active: boolean; language: "zh" | "en"; onPress: () => void;
}) {
  const s = useExplorerText();
  const t = useTodaysHuntText();
  const zh = language === "zh";
  return <Pressable accessibilityRole="button" accessibilityLabel={zh ? city.name_zh : city.name_en} onPress={onPress}
    style={{ ...(Platform.OS === "web" ? { scrollSnapAlign: "center" } as object : null), width, minHeight: 150, gap: 8, backgroundColor: city.playable ? "rgba(255,255,255,.97)" : "rgba(251,252,253,.95)", borderRadius: 20, borderWidth: 1.5, borderColor: active ? "#5B6474" : C.line, padding: 18, opacity: active ? 1 : .7, ...shadows.card }}>
    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: spacing.sm }}>
      <Text style={{ fontFamily: serif, fontSize: 28, lineHeight: 36, color: city.playable ? C.ink : C.muted }}>{zh ? city.name_zh : city.name_en}</Text>
      {city.playable && streak > 0 && <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.wax }} />
        <Text style={{ fontFamily: sans, fontSize: 12, color: C.plum }}>{s.streak(streak)}</Text>
      </View>}
    </View>
    <Text style={{ fontFamily: sans, fontSize: 13.5, lineHeight: 20, color: C.muted }}>{city.playable ? s.known((zh ? city.known_zh : city.known_en) ?? "") : s.soonLine}</Text>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: "auto" }}>
      {city.playable ? <>
        <Tag text={s.landmark((zh ? city.landmark_zh : city.landmark_en) ?? "")} />
        {hunt !== undefined ? hunt?.finished ? <>
          <Tag text={t.tags(hunt.score)} done />
          <Tag text={t.tomorrow} />
        </> : <Tag text={t.today} /> : puzzle?.done ? <>
          <Tag text={puzzle.won ? s.doneWin(puzzle.guesses.length) : s.doneLose} done />
          <Tag text={s.tomorrow} />
        </> : <Tag text={s.today} />}
      </> : <Tag text={s.soon} />}
    </View>
  </Pressable>;
}

function Tag({ text, done }: { text: string; done?: boolean }) {
  return <View style={{ borderRadius: radii.pill, borderWidth: 1, borderColor: done ? C.brass : C.line, backgroundColor: done ? "#FBF4E6" : C.paper, paddingHorizontal: 9, paddingVertical: 3 }}>
    <Text style={{ fontFamily: sans, fontSize: 12, color: done ? C.plum : C.ink }}>{text}</Text>
  </View>;
}
