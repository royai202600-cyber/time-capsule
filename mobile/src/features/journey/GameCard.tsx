import { Image, Pressable, Text, View } from "react-native";
import { gameArt } from "../../art/manifest";
import { GAME_ACTION_RADIUS_M, type Waypost } from "../../services/game";
import { C, radii, sans, serif, shadows, spacing } from "../../theme";
import { useGameText } from "../game/strings";
import { sceneKey } from "../game/waypostScene";
import { distanceText } from "../publicCapsule/strings";
import { useRackText } from "../racks/strings";
import { Btn } from "./JourneyControls";

export type GameCardValue = { waypost: Waypost; meters: number };
/** With racks, a common Waypost's card also leads to Spin and its capsule rack (docs/design/hunt-loop.md). */
export type RackActions = { count: number | null; onSpin: () => void; onRack: () => void; onLeave: () => void };
export function GameCard({ card, busy, g, language, onChallenge, rack }: {
  card: GameCardValue; busy: boolean; g: ReturnType<typeof useGameText>; language: "zh" | "en"; onChallenge: (w: Waypost) => void; rack?: RackActions;
}) {
  const r = useRackText();
  const near = card.meters <= GAME_ACTION_RADIUS_M;
  const left = distanceText(Math.max(0, card.meters - GAME_ACTION_RADIUS_M));
  const landmark = card.waypost.kind === "landmark";
  const title = language === "zh" ? card.waypost.name_zh : card.waypost.name_en;
  const cooling = !!card.waypost.cooldown_until && new Date(card.waypost.cooldown_until).getTime() > Date.now();
  const note = near ? (rack && !landmark && cooling ? g("cooldown") : "") : landmark ? g("challengeWalkCloser", left) : g("spinWalkCloser", left);
  return <View style={{ width: "100%", maxWidth: 560, alignSelf: "center", gap: spacing.sm, backgroundColor: "rgba(255,255,255,.96)", borderRadius: 22, padding: spacing.md, borderWidth: 1, borderColor: C.line, ...shadows.card }}>
    {landmark && <Image source={gameArt.wheel[sceneKey(card.waypost)]} resizeMode="cover" style={{ width: 112, height: 112, borderRadius: 56, borderWidth: 4, borderColor: C.brass, alignSelf: "center" }} />}
    <Text style={{ fontFamily: serif, fontSize: 18, color: C.ink, textAlign: landmark ? "center" : "left" }}>{title}</Text>
    {!!note && <Text style={{ fontFamily: sans, fontSize: 13, color: C.muted }}>{note}</Text>}
    {landmark && near && <Pressable accessibilityRole="button" disabled={busy} onPress={() => onChallenge(card.waypost)} style={{ alignItems: "center", backgroundColor: C.plum, borderRadius: radii.pill, paddingVertical: 11, opacity: busy ? .6 : 1 }}>
      <Text style={{ fontFamily: serif, fontSize: 15, color: C.white }}>{g("challenge")}</Text>
    </Pressable>}
    {rack && !landmark && <>
      {near && <View style={{ flexDirection: "row", gap: spacing.sm }}>
        {!cooling && <Btn flex title={r.spin} onPress={rack.onSpin} />}
        <Btn flex quiet title={r.leave} onPress={rack.onLeave} />
      </View>}
      <Btn quiet title={r.rack(rack.count === null ? "…" : rack.count.toLocaleString())} disabled={!rack.count} onPress={rack.onRack} />
    </>}
  </View>;
}
