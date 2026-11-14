// The hunt's quests on one map, as the organizer builds the route (docs/design/city-orienteering.md, Parts B and C).
// Each tap drops another quest, so a whole route goes down in one go; tapping a quest pin opens it.
// A fixed guide stands here too: while placing him, the next tap moves him instead of dropping a quest.
import React, { useEffect, useMemo, useRef } from "react";
import { Text, View } from "react-native";
import { characters } from "../../art/manifest";
import { LiveMap } from "../journey/live/LiveMap";
import { mapHtml } from "../journey/live/mapHtml";
import { assetUri, type LiveMapHandle, type LivePin } from "../journey/live/types";
import { MAP_PMTILES_URL } from "../../services/publicCapsule";
import { hasSpot, type QuestDraft } from "../../services/privateHuntOrganizer";
import { keeperPortrait } from "./HuntViews";
import { questImageUri, useQuestImages } from "./questImage";
import { useHuntText } from "./strings";
import { C, radii, sans, shadows, spacing } from "../../theme";

const TAIPEI = { lat: 25.033263, lng: 121.564887 };
type Spot = { lat: number; lng: number };
type Placed = QuestDraft & { location_lat: number; location_lng: number };

export function QuestMap({ quests, ordered, hint, you, guide, placingGuide, onDrop, onOpen, onGuide }: {
  quests: QuestDraft[]; ordered: boolean; hint: string;
  you: Spot | null;
  /** A fixed guide's spot, or null when he appears near players. */
  guide: Spot | null;
  /** The next tap puts the guide there. */
  placingGuide: boolean;
  /** Null when no more quests can be dropped (the hunt is locked or full). */
  onDrop: ((lat: number, lng: number) => void) | null;
  onOpen: (quest: QuestDraft) => void;
  /** Tapping the guide asks to move him; a tap while placing sets his spot. Null when locked. */
  onGuide: { move: () => void; place: (lat: number, lng: number) => void } | null;
}) {
  const h = useHuntText();
  const map = useRef<LiveMapHandle>(null);
  const inOrder = useMemo(() => quests.filter((q): q is Placed => hasSpot(q)).sort((a, b) => a.ordinal - b.ordinal), [quests]);
  const first = inOrder[0];
  // Built once: rebuilding the page would reload the tiles. It opens on the first quest, or on you.
  const html = useMemo(() => mapHtml({
    pmtiles: MAP_PMTILES_URL, follow: false,
    center: first ? { lat: first.location_lat, lng: first.location_lng } : guide ?? you ?? TAIPEI,
  }), []);
  // Frame the whole hunt when the map opens; later drops leave the camera where the organizer put it.
  useEffect(() => {
    const spots = [...inOrder.map((q) => ({ lat: q.location_lat, lng: q.location_lng })), ...(guide ? [guide] : [])];
    if (spots.length) map.current?.fit(spots);
    else if (you) map.current?.focus(you.lat, you.lng);
  }, []);

  const signed = useQuestImages(inOrder.map((q) => q.image));
  const pins = useMemo<LivePin[]>(() => [...inOrder.map<LivePin>((q, i) => ({
    id: q.id ?? `new-${q.ordinal}`, lat: q.location_lat, lng: q.location_lng, kind: "quest", vessel: "",
    quest: q.quest_type, photo: questImageUri(q.image), tag: `${i + 1} · ${h.pointsShort(q.points)}`,
  })), ...(guide ? [{
    id: "guide", lat: guide.lat, lng: guide.lng, kind: "keeper" as const, vessel: "",
    portrait: assetUri(keeperPortrait), figure: assetUri(characters.keeper),
  }] : [])], [inOrder, h, signed, guide?.lat, guide?.lng]);
  const route = useMemo(() => ordered ? inOrder.map((q) => ({ lat: q.location_lat, lng: q.location_lng })) : undefined, [inOrder, ordered]);
  // The organizer's own position only opens the map; drawn, it would cover the quests being placed.
  const state = useMemo(() => ({ you: null, reach: 0, pins, route }), [pins, route]);

  return <View style={{ height: 460, borderRadius: radii.md, overflow: "hidden", borderWidth: 1, borderColor: C.line }}>
    <LiveMap ref={map} html={html} state={state}
      onSelect={(id) => {
        if (id === "guide") { onGuide?.move(); return; }
        const q = inOrder.find((x) => (x.id ?? `new-${x.ordinal}`) === id); if (q) onOpen(q);
      }}
      onTap={(lat, lng) => placingGuide ? onGuide?.place(lat, lng) : onDrop?.(lat, lng)} />
    <View pointerEvents="none" style={{ position: "absolute", top: spacing.sm, left: spacing.sm, right: spacing.sm, backgroundColor: placingGuide ? "rgba(255,248,232,.96)" : "rgba(246,248,251,.94)", borderWidth: placingGuide ? 1 : 0, borderColor: C.brass, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: 8, ...shadows.card }}>
      <Text style={{ fontFamily: sans, fontSize: 12, lineHeight: 18, color: C.ink }}>{hint}</Text>
    </View>
  </View>;
}
