// Page 2 of a route capsule's opening pages (docs/design/hunt-loop.md, section 4): the stops to walk, in order,
// each with its quest picture; done ones purple, later ones locked. Walking happens on the Journey map.
import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import type { Quest } from "../../services/quests";
import { C, sans, serif } from "../../theme";
import { questPicture } from "../quests/questArt";
import { StopMark } from "../quests/QuestPlay";
import { useQuestText } from "../quests/strings";

export function RoutePage({ stops, zh, onWalk }: { stops: Quest[]; zh: boolean; onWalk: () => void }) {
  const q = useQuestText();
  const left = stops.filter((s) => !s.done).length;
  return <View style={{ flex: 1, width: "100%", maxWidth: 600, alignSelf: "center", gap: 14, backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 18 }}>
    <Text style={{ fontFamily: serif, fontSize: 20, color: C.ink }}>{q.routeTitle}</Text>
    <Text style={{ fontFamily: sans, fontSize: 13, lineHeight: 19, color: C.muted }}>{q.routeNote}</Text>
    <View style={{ gap: 10 }}>
      {stops.map((s, i) => <View key={s.quest_id} style={{ flexDirection: "row", alignItems: "center", gap: 12, opacity: s.locked ? .55 : 1 }}>
        <StopMark quest={s} n={i + 1} />
        <Image source={questPicture(s.type)} style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: s.done ? C.plum : C.brass }} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontFamily: serif, fontSize: 16, color: C.ink }}>{zh ? s.name_zh : s.name_en}</Text>
          <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{q.kind[s.type]}</Text>
        </View>
      </View>)}
    </View>
    <Text style={{ fontFamily: sans, fontSize: 13, color: left ? C.ink : C.plum }}>{left ? q.routeLeft(left) : q.routeProgress(stops.length, stops.length)}</Text>
    {!!left && <Pressable accessibilityRole="button" onPress={onWalk}
      style={({ pressed }) => ({ backgroundColor: C.blue, borderRadius: 14, padding: 15, alignItems: "center", opacity: pressed ? .88 : 1 })}>
      <Text style={{ color: C.white, fontFamily: sans, fontSize: 16 }}>{q.walkRoute}</Text>
    </Pressable>}
  </View>;
}
