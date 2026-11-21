// The home screen's top bar and dock (docs/design/hunt-first-home.md): one switch between Today's Hunt and
// Explore, and one dock (Passport · Quests · Capsules · Cabinet) that stays the same in both modes.
import { router } from "expo-router";
import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import { gameArt } from "../../art/manifest";
import { CabinetIcon, CapsulesIcon, PassportIcon, QuestIcon } from "../../components/DockIcons";
import { Avatar } from "../../components/Avatar";
import { haptics } from "../../components/haptics";
import { C, sans, serif, shadows, spacing } from "../../theme";
import { useExplorerText } from "../explorer/strings";
import { RoundButton } from "./JourneyControls";

export type HomeMode = "hunt" | "explore";
const glass = "rgba(246,248,251,.94)";

/** Your picture (to Me), the mode switch, then whatever the mode adds on the right. */
export function HomeBar({ mode, onMode, avatar, right }: { mode: HomeMode; onMode: (m: HomeMode) => void; avatar: unknown; right?: React.ReactNode }) {
  const x = useExplorerText();
  return <View pointerEvents="box-none" style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
    <Pressable accessibilityRole="button" accessibilityLabel={x.me} onPress={() => { void haptics.tap(); router.push("/me"); }}
      style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: glass, alignItems: "center", justifyContent: "center", ...shadows.card }}>
      <Avatar avatar={avatar as never} size={36} />
    </Pressable>
    <View accessibilityRole="tablist" style={{ flexDirection: "row", height: 44, padding: 4, borderRadius: 22, backgroundColor: glass, ...shadows.card }}>
      {(["hunt", "explore"] as const).map((m) => {
        const on = mode === m;
        return <Pressable key={m} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => { if (!on) { void haptics.tick(); onMode(m); } }}
          style={{ paddingHorizontal: 14, borderRadius: 18, justifyContent: "center", backgroundColor: on ? C.blue : "transparent" }}>
          <Text numberOfLines={1} style={{ fontFamily: serif, fontSize: 14.5, color: on ? C.white : C.blue }}>{m === "hunt" ? x.modeHunt : x.modeExplore}</Text>
        </Pressable>;
      })}
    </View>
    <View style={{ flex: 1 }} pointerEvents="none" />
    {right}
  </View>;
}

/** Your wax balls, the one count both modes care about. */
export function BallsChip({ balls, label }: { balls: number; label: string }) {
  return <View accessibilityRole="text" accessibilityLabel={label} style={{ height: 44, paddingLeft: 8, paddingRight: 12, borderRadius: 22, backgroundColor: glass, flexDirection: "row", alignItems: "center", gap: 5, ...shadows.card }}>
    <Image source={gameArt.ball.wax} style={{ width: 24, height: 24 }} />
    <Text style={{ fontFamily: serif, fontSize: 15, color: C.ink }}>{balls}</Text>
  </View>;
}

/** Passport and Quests on the left; time capsules (with how many are ready) and Cabinet on the right. */
export function HomeDock({ passportLabel, questLabel, cabinetLabel, questDot, ready, onPassport, onQuest }: {
  passportLabel: string; questLabel?: string; cabinetLabel: string; questDot?: boolean; ready: number;
  onPassport: () => void; onQuest?: () => void;
}) {
  const x = useExplorerText();
  return <View pointerEvents="box-none" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
    <View pointerEvents="box-none" style={{ flexDirection: "row", gap: spacing.sm }}>
      <RoundButton label={passportLabel} onPress={onPassport}><PassportIcon size={32} /></RoundButton>
      {onQuest && questLabel && <RoundButton label={questLabel} dot={questDot} onPress={onQuest}><QuestIcon size={32} /></RoundButton>}
    </View>
    <View pointerEvents="box-none" style={{ flexDirection: "row", gap: spacing.sm }}>
      <View>
        <RoundButton label={ready ? x.capsulesReady(ready) : x.capsules} onPress={() => router.push("/capsules")}><CapsulesIcon size={32} /></RoundButton>
        {ready > 0 && <View pointerEvents="none" style={{ position: "absolute", top: -3, right: -3, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: C.wax, borderWidth: 2, borderColor: C.white, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: sans, fontSize: 11, lineHeight: 14, color: C.white }}>{ready > 9 ? "9+" : ready}</Text>
        </View>}
      </View>
      <RoundButton label={cabinetLabel} onPress={() => router.push("/cabinet")}><CabinetIcon size={32} /></RoundButton>
    </View>
  </View>;
}
