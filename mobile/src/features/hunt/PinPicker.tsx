// Drop a quest's pin on the map (docs/design/city-orienteering.md, Part B). The organizer taps the spot
// rather than typing a radius or an address, and the map says what is there so the quest names itself.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { ArtIcon } from "../../components/ArtIcon";
import { haptics } from "../../components/haptics";
import { LiveMap } from "../journey/live/LiveMap";
import { mapHtml } from "../journey/live/mapHtml";
import type { LiveMapHandle, LivePin } from "../journey/live/types";
import { MAP_PMTILES_URL } from "../../services/publicCapsule";
import { reversePlace } from "../../services/places";
import type { PrivateHuntQuestType } from "../../services/privateHunt";
import { Btn } from "./HuntViews";
import { useOrganizerText } from "./organizerStrings";
import { useLanguage } from "../../i18n";
import { questImageUri, useQuestImages } from "./questImage";
import { C, radii, sans, serif, shadows, spacing } from "../../theme";

export type PickedPin = { lat: number; lng: number; name: string; detail: string };

export function PinPicker({ at, you, quest, image, onClose, onPick }: {
  /** Where the pin starts, or null to start on the player's own position. */
  at: { lat: number; lng: number } | null;
  you: { lat: number; lng: number } | null;
  quest: PrivateHuntQuestType; image?: string | null;
  onClose: () => void;
  onPick: (pin: PickedPin) => void;
}) {
  const o = useOrganizerText();
  const { language } = useLanguage();
  const map = useRef<LiveMapHandle>(null);
  const start = at ?? you ?? { lat: 25.033263, lng: 121.564887 };
  const [point, setPoint] = useState(start);
  const [found, setFound] = useState<{ name: string; detail: string } | null>(null);
  const [looking, setLooking] = useState(false);

  // The map page is built once; rebuilding it would reload the tiles under the organizer.
  const html = useMemo(() => mapHtml({ pmtiles: MAP_PMTILES_URL, center: start }), []);
  const signedVersion = useQuestImages([image]);
  const pins = useMemo<LivePin[]>(() => [{
    id: "picked", lat: point.lat, lng: point.lng, kind: "quest", vessel: "", quest, photo: questImageUri(image), near: true,
  }], [point.lat, point.lng, quest, image, signedVersion]);
  const state = useMemo(() => ({ you, reach: 0, pins }), [you?.lat, you?.lng, pins]);

  // Whatever is at the pin names the quest, so the organizer rarely types a name at all.
  useEffect(() => {
    let live = true;
    setLooking(true); setFound(null);
    const timer = setTimeout(() => {
      reversePlace(point, language)
        .then((p) => { if (live) setFound(p ? { name: p.name, detail: p.detail } : null); })
        .catch(() => { if (live) setFound(null); })
        .finally(() => { if (live) setLooking(false); });
    }, 300);
    return () => { live = false; clearTimeout(timer); };
  }, [point.lat, point.lng, language]);

  return <Modal visible transparent animationType="slide" onRequestClose={onClose}>
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <View style={{ flex: 1 }}>
        <LiveMap ref={map} html={html} state={state} onSelect={() => {}}
          onTap={(lat, lng) => { void haptics.tick(); setPoint({ lat, lng }); }} />
        <View pointerEvents="none" style={{ position: "absolute", top: spacing.md, left: spacing.md, right: spacing.md, backgroundColor: "rgba(246,248,251,.94)", borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: 10, ...shadows.card }}>
          <Text style={{ fontFamily: sans, fontSize: 13, color: C.ink }}>{o.tapTheMap}</Text>
        </View>
      </View>

      <View style={{ gap: spacing.md, padding: spacing.lg, backgroundColor: C.paper, borderTopWidth: 1, borderColor: C.line }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <ArtIcon name="pin" size={18} color={C.blue} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontFamily: serif, fontSize: 16, color: C.ink }}>
              {looking ? o.looking : found?.name ?? o.unnamedSpot}
            </Text>
            <Text numberOfLines={1} style={{ fontFamily: sans, fontSize: 11, color: C.muted }}>
              {found?.detail || `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`}
            </Text>
          </View>
          {!!you && <Pressable accessibilityRole="button" onPress={() => { setPoint(you); map.current?.focus(you.lat, you.lng); }}>
            <Text style={{ fontFamily: sans, fontSize: 13, color: C.blue, textDecorationLine: "underline" }}>{o.whereHere}</Text>
          </Pressable>}
        </View>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <View style={{ flex: 1 }}><Btn quiet title={o.cancel} onPress={onClose} /></View>
          <View style={{ flex: 1 }}><Btn title={o.usePin} onPress={() => onPick({ ...point, name: found?.name ?? "", detail: found?.detail ?? "" })} /></View>
        </View>
      </View>
    </View>
  </Modal>;
}
