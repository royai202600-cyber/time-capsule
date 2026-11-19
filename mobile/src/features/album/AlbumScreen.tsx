import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { BackButton, Bar, Heading } from "../../components/Screen";
import { Vessel, type VesselKind } from "../../components/Vessel";
import { useLanguage } from "../../i18n";
import { VESSELS } from "../../features/shop/strings";
import { goBack } from "../../navigation";
import { useAuth } from "../../services/auth";
import { vessels } from "../../services/data";
import { game, GAME_ENABLED } from "../../services/game";
import { copiesOf, COPIES } from "../../services/copies";
import { isCollected } from "../../services/vesselAccess";
import { useCopiesText } from "../copies/strings";
import { C, sans, serif, spacing } from "../../theme";
import { useGameText } from "../game/strings";

type Row = { id: string; price_mop: number; edition_total?: number | null; sort: number; earned_place?: string | null };
/** `copies` replaces stars once copies are on: a number, null for unlimited. */
type Card = { id: VesselKind; no: number; collected: boolean; stars: number; copies?: number | null };
const isVessel = (id: string): id is VesselKind => id in VESSELS;
const GAP = 8;
const MAX_WIDTH = 960;
const number = (no: number) => String(no).padStart(3, "0");

function AlbumCard({ card, width, name }: { card: Card; width: number; name: string }) {
  const cp = useCopiesText();
  const height = width * 1.34;
  if (!card.collected) {
    return <View accessibilityLabel={`No.${number(card.no)}`} style={{ width, height, borderRadius: 12, backgroundColor: "#E9EEF4", alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontFamily: serif, fontSize: 22, color: C.muted, letterSpacing: 1 }}>{number(card.no)}</Text>
    </View>;
  }
  return <View style={{ width, height, borderRadius: 12, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, alignItems: "center", paddingVertical: 8, paddingHorizontal: 4 }}>
    <Text style={{ alignSelf: "flex-start", marginLeft: 4, fontFamily: serif, fontSize: 11, color: C.brass }}>{number(card.no)}</Text>
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Vessel kind={card.id} size={width * .62} /></View>
    <Text numberOfLines={1} style={{ fontFamily: sans, fontSize: 11, color: C.ink }}>{name}</Text>
    {card.copies !== undefined
      ? <Text accessibilityLabel={cp.label(card.copies)} style={{ fontFamily: serif, fontSize: 11, color: card.copies === 0 ? C.plum : C.brass }}>{cp.count(card.copies)}</Text>
      : card.stars > 0 && <Text accessibilityLabel={`${card.stars} / 5`} style={{ fontSize: 9, letterSpacing: 1, color: C.brass }}>{"★".repeat(card.stars)}</Text>}
  </View>;
}

/** The numbered list of every vessel: what you have, and a number card for what you don't. */
export default function AlbumScreen() {
  const { t, language } = useLanguage();
  const g = useGameText();
  const { session } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const [all, setAll] = useState<Row[]>([]);
  const [owned, setOwned] = useState<{ vessel: string; copies?: number | null }[]>([]);
  const [caught, setCaught] = useState<Record<string, { copies: number | null; stars: number }>>({});

  useFocusEffect(useCallback(() => {
    let alive = true;
    if (GAME_ENABLED) void game.collection().then(next => { if (alive) setCaught(next); }).catch(() => undefined);
    if (!session) {
      if (__DEV__) setAll(Object.keys(VESSELS).map((id, sort) => ({ id, price_mop: (VESSELS[id as VesselKind] as { price: number }).price, sort })));
      return () => { alive = false; };
    }
    void Promise.all([vessels.list(), vessels.owned(session.user.id)]).then(([list, mine]) => {
      if (!alive) return;
      setAll(list.data ?? []);
      setOwned(mine.data ?? []);
    });
    return () => { alive = false; };
  }, [session?.user.id]));

  const cards = useMemo(() => {
    return [...all].sort((a, b) => a.sort - b.sort).flatMap((v, index): Card[] => {
      if (!isVessel(v.id)) return [];
      const collected = isCollected(v, owned.some((o) => o.vessel === v.id) || !!caught[v.id], GAME_ENABLED);
      return [{ id: v.id, no: index + 1, collected, stars: caught[v.id]?.stars ?? 0, copies: COPIES && collected ? copiesOf(v, owned) : undefined }];
    });
  }, [all, owned, caught]);

  const columns = windowWidth >= 760 ? 5 : windowWidth >= 560 ? 4 : 3;
  const content = Math.min(windowWidth, MAX_WIDTH) - spacing.md * 2;
  const cardWidth = (content - GAP * (columns - 1)) / columns;
  const collected = cards.filter((card) => card.collected).length;

  return <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
    <FlatList key={columns} data={cards} numColumns={columns} keyExtractor={(card) => card.id} initialNumToRender={15}
      contentContainerStyle={{ width: content, alignSelf: "center", gap: GAP, paddingTop: spacing.md, paddingBottom: spacing.xl }}
      columnWrapperStyle={{ gap: GAP }}
      ListHeaderComponent={<View style={{ gap: spacing.sm, marginBottom: spacing.sm }}>
        <Bar><BackButton label={t("back")} onPress={goBack} /><Heading>{g("album")}</Heading></Bar>
        {cards.length > 0 && <Text style={{ fontFamily: serif, fontSize: 16, color: C.ink }}>{g("collected", collected, cards.length)}</Text>}
      </View>}
      renderItem={({ item }) => <AlbumCard card={item} width={cardWidth} name={VESSELS[item.id].name[language]} />} />
  </SafeAreaView>;
}
