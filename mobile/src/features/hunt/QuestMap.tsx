// The hunt's quests on one map, as the organizer builds the route (docs/design/city-orienteering.md, Part B).
// Each tap drops another quest, so a whole route goes down in one go; tapping a quest pin opens it.
import React, { useEffect, useMemo, useRef } from "react";
import { Text, View } from "react-native";
import { LiveMap } from "../journey/live/LiveMap";
import { mapHtml } from "../journey/live/mapHtml";
import type { LiveMapHandle, LivePin } from "../journey/live/types";
import { MAP_PMTILES_URL } from "../../services/publicCapsule";
import type { QuestDraft } from "../../services/privateHuntOrganizer";
import { questImageUri, useQuestImages } from "./questImage";
import { useHuntText } from "./strings";
import { C, radii, sans, shadows, spacing } from "../../theme";

const TAIPEI = { lat: 25.033263, lng: 121.564887 };
const placed = (q: QuestDraft) => !!(q.location_lat || q.location_lng);

export function QuestMap({ quests, ordered, hint, you, onDrop, onOpen }: {
  quests: QuestDraft[]; ordered: boolean; hint: string;
  you: { lat: number; lng: number } | null;
  /** Null when no more quests can be dropped (the hunt is locked or full). */
  onDrop: ((lat: number, lng: number) => void) | null;
  onOpen: (quest: QuestDraft) => void;
}) {
  const h = useHuntText();
  const map = useRef<LiveMapHandle>(null);
  const inOrder = useMemo(() => [...quests].filter(placed).sort((a, b) => a.ordinal - b.ordinal), [quests]);
  const first = inOrder[0];
  // Built once: rebuilding the page would reload the tiles. It opens on the first quest, or on you.
  const html = useMemo(() => mapHtml({
    pmtiles: MAP_PMTILES_URL, follow: false,
    center: first ? { lat: first.location_lat, lng: first.location_lng } : you ?? TAIPEI,
  }), []);
  // Frame the whole hunt when the map opens; later drops leave the camera where the organizer put it.
  useEffect(() => {
    if (inOrder.length) map.current?.fit(inOrder.map((q) => ({ lat: q.location_lat, lng: q.location_lng })));
    else if (you) map.current?.focus(you.lat, you.lng);
  }, []);

  const signed = useQuestImages(inOrder.map((q) => q.image));
  const pins = useMemo<LivePin[]>(() => inOrder.map((q, i) => ({
    id: q.id ?? `new-${q.ordinal}`, lat: q.location_lat, lng: q.location_lng, kind: "quest", vessel: "",
    quest: q.quest_type, photo: questImageUri(q.image), tag: `${i + 1} · ${h.pointsShort(q.points)}`,
  })), [inOrder, h, signed]);
  const route = useMemo(() => ordered ? inOrder.map((q) => ({ lat: q.location_lat, lng: q.location_lng })) : undefined, [inOrder, ordered]);
  // The organizer's own position only opens the map; drawn, it would cover the quests being placed.
  const state = useMemo(() => ({ you: null, reach: 0, pins, route }), [pins, route]);

  return <View style={{ height: 460, borderRadius: radii.md, overflow: "hidden", borderWidth: 1, borderColor: C.line }}>
    <LiveMap ref={map} html={html} state={state}
      onSelect={(id) => { const q = inOrder.find((x) => (x.id ?? `new-${x.ordinal}`) === id); if (q) onOpen(q); }}
      onTap={(lat, lng) => onDrop?.(lat, lng)} />
    <View pointerEvents="none" style={{ position: "absolute", top: spacing.sm, left: spacing.sm, right: spacing.sm, backgroundColor: "rgba(246,248,251,.94)", borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: 8, ...shadows.card }}>
      <Text style={{ fontFamily: sans, fontSize: 12, lineHeight: 18, color: C.ink }}>{hint}</Text>
    </View>
  </View>;
}
