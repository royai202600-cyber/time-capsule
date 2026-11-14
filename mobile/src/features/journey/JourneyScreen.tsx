import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, Linking, Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { goBack } from "../../navigation";
import { useAuth } from "../../services/auth";
import { useCapsules, usePlaces } from "../../services/hooks";
import { distanceMeters } from "../../services/data";
import { useLanguage } from "../../i18n";
import { haptics } from "../../components/haptics";
import { ArtIcon } from "../../components/ArtIcon";
import { Avatar } from "../../components/Avatar";
import { Vessel, type VesselKind } from "../../components/Vessel";
import { portraits, vesselParts } from "../../art/manifest";
import { C, radii, sans, serif, shadows, spacing } from "../../theme";
import { isTestLocationUser, setFakeLocation, useForegroundLocation } from "./location";
import { Passport } from "./Passport";
import { CapsuleMapPage } from "./CapsuleMapPage";
import { LiveMap } from "./live/LiveMap";
import { JourneyViewport } from "./JourneyViewport";
import { mapHtml, MONUMENTS, monumentTop } from "./live/mapHtml";
import { assetUri, type LiveMapHandle, type LivePin } from "./live/types";
import type { Tables } from "../../services/database.types";
import { MAP_PMTILES_URL, sea, SeaError, SEA_ENABLED, SEA_PICKUP_RADIUS_M, type SeaBottle } from "../../services/sea";
import { daysSince, distanceText, timeLeftShort, useSeaText } from "../sea/strings";
import { supabase } from "../../services/supabase";
import { game, GameError, GAME_ACTION_RADIUS_M, GAME_ENABLED, type GameState, type CorruptedCapsule, type DevLetter, type LandmarkAttempt, type Nearby, type Waypost } from "../../services/game";
import { characters, gameArt } from "../../art/manifest";
import { figureFor } from "../../components/Figure";
import { crackOverlays } from "../../art/crackOverlays";
import { SpinScreen } from "../game/SpinScreen";
import { sceneKey } from "../game/waypostScene";
import { ThrowScreen } from "../game/ThrowScreen";
import { errorKey, useGameText } from "../game/strings";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { hunt as hunts, HuntError, huntStatus, keeperMark, onHuntChange, type Hunt } from "../../services/hunt";
import { clockText } from "../../services/huntClock";
import { inOrder, locked as missionLocked, onPrivateHuntChange, privateHunt as privateHunts, PrivateHuntError, type LeaderRow, type PrivateHunt, type Waypoint } from "../../services/huntPrivate";
import { organizer } from "../../services/huntOrganizer";
import { KeeperCard, keeperPortrait, QuestSheet, RunChip } from "../hunt/HuntViews";
import { JoinPrivateSheet, LeaderboardSheet, MissionSheet, PrivateHuntCard } from "../hunt/PrivateHuntViews";
import { useHuntText } from "../hunt/strings";
import type { PassportHunt } from "../../services/game";

import { pointOpeningPlace } from "../capsule/model";

type JourneyPin = { place: Tables<"places">; kind: "visited" | "waiting" | "other"; vessel?: string; waiting?: boolean };

const FALLBACK = { lat: 22.19358, lng: 113.53917 }; // Senado Square, Macau (development only)
type Item =
  | { kind: "sea"; id: string; lat: number; lng: number; meters: number; bottle: SeaBottle }
  | { kind: "place"; id: string; lat: number; lng: number; meters: number; pin: JourneyPin; capsuleId: string };

const portraitUri = (avatar: unknown) => {
  const a = avatar as { set?: string; id?: string } | null;
  return assetUri(a?.set === "illus" && a.id ? portraits[a.id] : portraits["01"]);
};
const vesselUri = (kind: string) => assetUri(vesselParts[kind as VesselKind]?.assembled ?? vesselParts.bottle.assembled) ?? "";

export default function JourneyScreen() {
  const insets = useSafeAreaInsets();
  const { session, profile } = useAuth();
  const userId = session?.user.id ?? "";
  const { t, language } = useLanguage();
  const s = useSeaText();
  const g = useGameText();
  const placeData = usePlaces();
  const capsuleData = useCapsules(userId, "inbox");
  const location = useForegroundLocation();
  const { fix, status } = location;
  const latestFix = useRef(fix);
  latestFix.current = fix;
  const you = fix ? { lat: fix.lat, lng: fix.lng } : null;
  const map = useRef<LiveMapHandle>(null);
  const [bottles, setBottles] = useState<SeaBottle[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [walkTo, setWalkTo] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [passport, setPassport] = useState(false);
  const [mapPlace, setMapPlace] = useState<Extract<Item, { kind: "place" }> | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [nearby, setNearby] = useState<Nearby>({ corrupted: [], wayposts: [] });
  const nearbyRef = useRef(nearby);
  nearbyRef.current = nearby;
  const [throwing, setThrowing] = useState<CorruptedCapsule | null>(null);
  const [devLetter, setDevLetter] = useState<DevLetter | null>(null);
  const [fight, setFight] = useState<LandmarkAttempt | null>(null);
  const [passportStamps, setPassportStamps] = useState<Record<string, string>>({});
  const [huntStamps, setHuntStamps] = useState<PassportHunt[]>([]);
  const [huntList, setHuntList] = useState<Hunt[]>([]);
  const [questOpen, setQuestOpen] = useState(false);
  // Private hunts: the ones I joined, the join-by-code sheet, the mission I have open and the leaderboard.
  const [privateList, setPrivateList] = useState<PrivateHunt[]>([]);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinFound, setJoinFound] = useState<PrivateHunt | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [mission, setMission] = useState<{ hunt: string; waypoint: string } | null>(null);
  const [missionError, setMissionError] = useState<string | null>(null);
  const [board, setBoard] = useState<{ hunt: PrivateHunt; rows: LeaderRow[] | null } | null>(null);
  const { huntCode: huntCodeParam } = useLocalSearchParams<{ huntCode?: string }>();
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [keeperOpen, setKeeperOpen] = useState(false);
  const [youLabel, setYouLabel] = useState(false);
  const h = useHuntText();
  // Private capsule pins show their sender's profile picture and a small countdown while still on a timer.
  const [senders, setSenders] = useState<Record<string, unknown>>({});
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);
  const senderIds = [...new Set((capsuleData.data ?? []).map((c) => c.sender))].sort().join(",");
  useEffect(() => {
    if (!senderIds) return;
    let active = true;
    void supabase.from("profiles").select("id,avatar").in("id", senderIds.split(",")).then(({ data }) => {
      if (active && data) setSenders(Object.fromEntries(data.map((p) => [p.id, p.avatar])));
    });
    return () => { active = false; };
  }, [senderIds]);
  const youKey = `tc-journey-you-${userId}`;
  useEffect(() => {
    if (!userId) return;
    let active = true;
    AsyncStorage.getItem(youKey).then((v) => { if (active && !v) setYouLabel(true); }).catch(() => {});
    return () => { active = false; };
  }, [youKey]);
  const dismissYou = () => { setYouLabel(false); void AsyncStorage.setItem(youKey, "1").catch(() => {}); };
  // Shown briefly, once: it fades by itself after a few seconds on the first Journey visit.
  useEffect(() => {
    if (!youLabel || !fix) return;
    const id = setTimeout(dismissYou, 3200);
    return () => clearTimeout(id);
  }, [youLabel, !!fix]);
  const [spinning, setSpinning] = useState<Waypost | null>(null);
  const [gameCard, setGameCard] = useState<{ waypost: Waypost; meters: number } | null>(null);
  const last = useRef<{ lat: number; lng: number } | null>(null);
  // Heading from movement: the cone points the way you walked.
  useEffect(() => {
    if (!you) return;
    const prev = last.current;
    if (prev && distanceMeters(prev.lat, prev.lng, you.lat, you.lng) > 4) {
      const y = Math.sin((you.lng - prev.lng) * Math.PI / 180) * Math.cos(you.lat * Math.PI / 180);
      const x = Math.cos(prev.lat * Math.PI / 180) * Math.sin(you.lat * Math.PI / 180) - Math.sin(prev.lat * Math.PI / 180) * Math.cos(you.lat * Math.PI / 180) * Math.cos((you.lng - prev.lng) * Math.PI / 180);
      setHeading(Math.atan2(y, x) * 180 / Math.PI);
    }
    if (!prev || distanceMeters(prev.lat, prev.lng, you.lat, you.lng) > 4) last.current = you;
  }, [you?.lat, you?.lng]);
  const cell = you ? `${you.lat.toFixed(3)},${you.lng.toFixed(3)}` : "";
  const loadSea = useCallback(async () => {
    if (!SEA_ENABLED || !you) return;
    const test = __DEV__ && GAME_ENABLED ? game.devBottles(you) : [];
    setBottles(test);
    try {
      setBottles([...test, ...await sea.nearby(fix ? { lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy } : null)]);
    } catch { /* the map still works without the sea */ }
  }, [cell]);
  const loadGame = useCallback(async () => {
    const at = latestFix.current;
    if (!GAME_ENABLED || !at) return;
    try {
      const [state, around, stamps] = await Promise.all([game.state(), game.nearby({ lat: at.lat, lng: at.lng, accuracy: at.accuracy }), game.passport()]);
      setGameState(state); setNearby(around); nearbyRef.current = around; setPassportStamps(stamps.places); setHuntStamps(stamps.hunts);
    } catch { /* the map still works without the game */ }
    const previewAllowed = __DEV__ || isTestLocationUser(userId);
    try {
      setHuntList(await hunts.list({ userId, at, known: nearbyRef.current.wayposts, previewAllowed }));
    } catch (e) { if (__DEV__) console.warn("City Hunt list failed", e); }
    try {
      setPrivateList(await privateHunts.mine({ userId, at, previewAllowed }));
    } catch (e) { if (__DEV__) console.warn("private hunt list failed", e); }
  }, [cell]);
  useEffect(() => onHuntChange(() => { void loadGame(); }), [loadGame]);
  useEffect(() => onPrivateHuntChange(() => { void loadGame(); }), [loadGame]);
  useFocusEffect(useCallback(() => {
    void loadGame();
    const timer = setInterval(() => { void loadGame(); }, 30_000);
    return () => clearInterval(timer);
  }, [loadGame]));
  useEffect(() => {
    if (!nearby.corrupted.length) return;
    const next = Math.min(...nearby.corrupted.map((c) => new Date(c.expires_at).getTime()));
    const timer = setTimeout(() => {
      setNearby((previous) => ({ ...previous, corrupted: previous.corrupted.filter((c) => new Date(c.expires_at).getTime() > Date.now()) }));
      void loadGame();
    }, Math.max(0, next - Date.now() + 25));
    return () => clearTimeout(timer);
  }, [nearby.corrupted, loadGame]);
  useEffect(() => { if (fix) game.setPosition({ lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy }); }, [fix?.lat, fix?.lng, fix?.accuracy]);
  useFocusEffect(useCallback(() => {
    if (userId) { void placeData.refresh(); void capsuleData.refresh(); }
    void loadSea();
  }, [userId, placeData.refresh, capsuleData.refresh, loadSea]));
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(""), 3600); return () => clearTimeout(id); }, [toast]);

  const capsules = capsuleData.data ?? [];
  const places = placeData.data ?? [];
  const pins = useMemo<JourneyPin[]>(() => places.map((place) => {
    const here = capsules.filter((capsule) => capsule.place === place.id);
    const visited = here.some((capsule) => !!capsule.opened_at);
    const waiting = here.find((capsule) => !capsule.opened_at);
    return { place, kind: visited ? "visited" : waiting ? "waiting" : "other", vessel: waiting?.vessel, waiting: !!waiting };
  }), [places, capsules]);
  const stampRows = useMemo(() => places.map((place) => {
    const openedAt = capsules.filter((capsule) => capsule.place === place.id && capsule.opened_at).map((capsule) => capsule.opened_at!).sort().at(-1) ?? passportStamps[place.id] ?? null;
    return { place, openedAt };
  }), [places, capsules, passportStamps]);

  // Nearby Sea bottles and every received place capsule, including distant/opened ones.
  const items = useMemo<Item[]>(() => {
    if (!you) return [];
    const m = (lat: number, lng: number) => distanceMeters(you.lat, you.lng, lat, lng);
    const seaItems: Item[] = bottles.map((b) => ({ kind: "sea", id: b.id, lat: b.lat, lng: b.lng, meters: m(b.lat, b.lng), bottle: b }));
    const placeItems: Item[] = capsules.flatMap((capsule) => {
      const point = pointOpeningPlace(capsule);
      const pin: JourneyPin | undefined = point
        ? { place: point, kind: capsule.opened_at ? "visited" : "waiting" }
        : pins.find((p) => p.place.id === capsule.place);
      return pin ? [{ kind: "place" as const, id: `place-${capsule.id}`, lat: pin.place.lat, lng: pin.place.lng,
        meters: m(pin.place.lat, pin.place.lng), pin: { ...pin, vessel: capsule.vessel }, capsuleId: capsule.id }] : [];
    });
    return [...seaItems, ...placeItems].sort((a, b) => a.meters - b.meters);
  }, [bottles, pins, capsules, you?.lat, you?.lng]);
  const selected = items.find((i) => i.id === selectedId) ?? null;

  const metersTo = (lat: number, lng: number) => you ? distanceMeters(you.lat, you.lng, lat, lng) : Infinity;
  // The open City Hunt, if any. The Letter Keeper stands only at its starting point.
  const activeHunt = huntList.find((x) => huntStatus(x) === "open") ?? null;
  const keeperMeters = activeHunt ? metersTo(activeHunt.keeper.lat, activeHunt.keeper.lng) : Infinity;
  const showKeeper = !!activeHunt && (!!activeHunt.joined_at || keeperMeters <= 1500);
  const questDot = !!activeHunt && (!activeHunt.joined_at || keeperMark(activeHunt) === "✓");
  const huntPins = useMemo<LivePin[]>(() => activeHunt && showKeeper ? [{
    id: `keeper-${activeHunt.id}`, lat: activeHunt.keeper.lat, lng: activeHunt.keeper.lng, kind: "keeper", vessel: "",
    portrait: assetUri(keeperPortrait), figure: assetUri(characters.keeper), mark: keeperMark(activeHunt),
  }] : [], [activeHunt, showKeeper]);
  // A joined private hunt's waypoints: brass location pins, only ever visible to people who joined.
  const missionPins = useMemo<LivePin[]>(() => privateList.flatMap((ph) => inOrder(ph).map<LivePin>((w) => ({
    id: `mission-${ph.id}-${w.id}`, lat: w.lat, lng: w.lng, kind: "mission", vessel: "",
    mission: w.mission_type, done: !!w.done_at, locked: missionLocked(ph, w),
    near: metersTo(w.lat, w.lng) <= GAME_ACTION_RADIUS_M,
    tag: w.done_at ? undefined : h.pointsShort(w.points),
  }))), [privateList, you?.lat, you?.lng, h]);
  const cooling = (w: Waypost) => !!w.cooldown_until && new Date(w.cooldown_until).getTime() > Date.now();
  const gamePins = useMemo<LivePin[]>(() => [
    // Only what's inside the pickup circle shows, so capsules never crowd the map.
    ...nearby.corrupted.filter((c) => c.id !== throwing?.id && metersTo(c.lat, c.lng) <= GAME_ACTION_RADIUS_M).map<LivePin>((c) => (
      { id: `corrupted-${c.id}`, lat: c.lat, lng: c.lng, kind: "corrupted", vessel: vesselUri(c.vessel), cracks: assetUri(crackOverlays[c.vessel]) ?? undefined, rarity: c.rarity, near: true }
    )),
    ...nearby.wayposts.map<LivePin>((w) => {
      // A Landmark with a monument is the building itself: its seal floats on top, at the real spot.
      const monument = w.kind === "landmark" ? MONUMENTS.find((m) => m.id === w.place) : undefined;
      return {
      id: `way-${w.id}`, lat: monument?.lat ?? w.lat, lng: monument?.lng ?? w.lng, lift: monument ? monumentTop(monument) + 4 : undefined, kind: w.kind === "landmark" ? "landmark" : "waypost", vessel: assetUri(w.kind === "landmark" ? gameArt.landmarkGem : cooling(w) ? gameArt.waypostGem : gameArt.waypostGemBlue) ?? "",
      done: cooling(w),
      near: metersTo(w.lat, w.lng) <= GAME_ACTION_RADIUS_M,
    }; }),
  ], [nearby, throwing?.id, you?.lat, you?.lng]);

  const html = useMemo(() => mapHtml({ pmtiles: MAP_PMTILES_URL, center: you ?? FALLBACK }), [!!you]);
  // A private capsule: its own vessel, the sender's picture with a wax seal (public ones are always the bottle,
  // with no seal), and only while it is still on its timer, a tiny countdown. No place name: the card has it.
  const placePin = (i: Extract<Item, { kind: "place" }>): LivePin => {
    const c = capsules.find((x) => x.id === i.capsuleId);
    const left = c && !c.opened_at ? new Date(c.open_at).getTime() - now : 0;
    return { id: i.id, lat: i.lat, lng: i.lng, kind: "place", private: true, opened: !!c?.opened_at, vessel: vesselUri(i.pin.vessel ?? "dome"),
      portrait: c ? portraitUri(senders[c.sender]) : null, near: i.meters <= SEA_PICKUP_RADIUS_M, selected: i.id === selectedId,
      timer: left > 0 ? timeLeftShort(left, language) : undefined };
  };
  const mapState = useMemo(() => ({
    you, heading, reach: SEA_PICKUP_RADIUS_M,
    portrait: portraitUri(profile?.avatar),
    figure: assetUri(figureFor(profile?.avatar)),
    youLabel: youLabel && !throwing ? h.thisIsYou : null,
    // While throwing, the capsule is alone on the plain map.
    pins: throwing ? [] : [...items.map<LivePin>((i) => i.kind === "sea"
      ? { id: i.id, lat: i.lat, lng: i.lng, kind: "sea", vessel: vesselUri("bottle"), portrait: portraitUri(i.bottle.sender.avatar), near: i.meters <= SEA_PICKUP_RADIUS_M, far: i.meters > 600, selected: i.id === selectedId, tag: i.meters <= SEA_PICKUP_RADIUS_M ? undefined : distanceText(i.meters) }
      : placePin(i)), ...gamePins, ...huntPins, ...missionPins],
  }), [you?.lat, you?.lng, heading, profile?.avatar, items, selectedId, language, gamePins, huntPins, missionPins, !!throwing, youLabel, h, senders, now]);

  const select = (id: string | null) => {
    setWalkTo(null);
    setSelectedId(id);
    const item = items.find((i) => i.id === id);
    if (item) { void haptics.tick(); map.current?.focus(item.lat, item.lng); }
  };
  const step = (dir: 1 | -1) => {
    if (!items.length) return;
    const index = selected ? items.findIndex((i) => i.id === selected.id) : -1;
    select(items[(index + dir + items.length) % items.length].id);
  };
  const pickUp = async (item: Extract<Item, { kind: "sea" }>) => {
    if (busy) return;
    if (item.id.startsWith("dev-bottle-")) {
      const letter = game.devPickUp(item.id);
      void haptics.success();
      setSelectedId(null); setDevLetter(letter);
      void loadSea();
      return;
    }
    setBusy(true);
    try {
      const capsuleId = await sea.pickUp(item.id, fix ? { lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy } : null);
      void haptics.success();
      setSelectedId(null);
      router.push({ pathname: "/capsule/[id]", params: { id: capsuleId } });
      void loadSea();
    } catch (e) {
      void haptics.warn();
      const code = e instanceof SeaError ? e.code : "unknown";
      setToast(code === "too_far" ? s("errTooFar") : code === "taken" ? s("errTaken") : code === "own_bottle" ? s("errOwn") : s("errUnknown"));
      if (code === "taken") void loadSea();
    } finally { setBusy(false); }
  };
  const onPin = (id: string) => {
    if (id === "you") { dismissYou(); return; }
    if (id.startsWith("keeper-")) {
      setSelectedId(null); setGameCard(null); setKeeperOpen(true); void haptics.tick();
      if (activeHunt) map.current?.focus(activeHunt.keeper.lat, activeHunt.keeper.lng);
      return;
    }
    setKeeperOpen(false);
    if (id.startsWith("mission-")) {
      const pin = missionPins.find((p) => p.id === id);
      const found = findMission(id);
      if (!pin || !found) return;
      setSelectedId(null); setGameCard(null); void haptics.tick();
      map.current?.focus(pin.lat, pin.lng);
      setMissionError(null); setMission({ hunt: found.hunt.id, waypoint: found.waypoint.id });
      return;
    }
    if (id.startsWith("corrupted-")) {
      const capsule = nearby.corrupted.find((c) => `corrupted-${c.id}` === id);
      if (!capsule) return;
      setSelectedId(null); setGameCard(null); void haptics.tick();
      map.current?.focus(capsule.lat, capsule.lng); setThrowing(capsule);
      return;
    }
    if (id.startsWith("way-") || id.startsWith("monument-")) {
      const waypost = id.startsWith("monument-")
        ? nearby.wayposts.find((w) => w.kind === "landmark" && w.place === id.slice("monument-".length))
        : nearby.wayposts.find((w) => `way-${w.id}` === id);
      if (!waypost) return;
      setSelectedId(null); void haptics.tick();
      const meters = metersTo(waypost.lat, waypost.lng);
      if (waypost.kind === "common" && meters <= GAME_ACTION_RADIUS_M) { setGameCard(null); setSpinning(waypost); }
      else setGameCard({ waypost, meters });
      return;
    }
    setGameCard(null);
    select(id);
  };
  const startLandmark = async (waypost: Waypost) => {
    if (busy) return;
    setBusy(true);
    try {
      const attempt = await game.landmarkStart(waypost);
      void haptics.tap();
      setGameCard(null); setFight(attempt);
      setThrowing({ id: attempt.id, vessel: attempt.vessel, rarity: "uncommon", lat: waypost.lat, lng: waypost.lng, expires_at: attempt.expires_at, attempts_left: 0 });
    } catch (e) {
      void haptics.warn();
      setToast(g(errorKey(e instanceof GameError ? e.code : "unknown")));
    } finally { setBusy(false); }
  };
  const huntAction = async (run: () => Promise<unknown>, done?: (out: unknown) => void) => {
    if (busy) return;
    setBusy(true);
    try {
      const out = await run();
      void haptics.success();
      done?.(out);
      await loadGame();
    } catch (e) {
      void haptics.warn();
      setToast(h.err[e instanceof HuntError ? e.code : "unknown"]);
    } finally { setBusy(false); }
  };
  const at = () => fix ? { lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy } : null;
  const joinHunt = (x: Hunt) => huntAction(() => hunts.join(x));
  const finishHunt = (x: Hunt) => huntAction(() => hunts.finish(x, at()), (out) => {
    const r = out as { xp_gained: number; gold_gained: number };
    setKeeperOpen(false);
    const took = (out as { hunt?: Hunt }).hunt?.today_s;
    setToast([r.gold_gained || r.xp_gained ? h.gotReward(r.gold_gained, r.xp_gained) : h.gotStamp, took != null ? h.finishedIn(clockText(took)) : ""].filter(Boolean).join(" · "));
  });
  const showHunt = (x: Hunt) => {
    setQuestOpen(false); setSelectedId(null); setGameCard(null);
    if (x.checked_in_at && !x.finished_at && keeperMark(x) !== "✓") map.current?.recenter();
    else { map.current?.focus(x.keeper.lat, x.keeper.lng); setKeeperOpen(true); }
  };

  // ---- private hunts ----
  // The open mission is held by id, so it follows the hunt as the server (or the demo) refreshes it.
  const openMission = mission ? privateList.find((p) => p.id === mission.hunt) ?? null : null;
  const openWaypoint = openMission?.waypoints.find((w) => w.id === mission?.waypoint) ?? null;
  const findMission = (pinId: string) => {
    for (const ph of privateList) for (const w of ph.waypoints) if (`mission-${ph.id}-${w.id}` === pinId) return { hunt: ph, waypoint: w };
    return null;
  };
  const privateAction = async (run: () => Promise<unknown>, fail: (message: string) => void, done?: () => void) => {
    if (busy) return;
    setBusy(true);
    try {
      await run();
      void haptics.success();
      done?.();
      await loadGame();
    } catch (e) {
      void haptics.warn();
      fail(h.perr[e instanceof PrivateHuntError ? e.code : "unknown"]);
    } finally { setBusy(false); }
  };
  const findCode = (code: string) => {
    setJoinError(null); setJoinFound(null);
    void privateAction(async () => { setJoinFound(await privateHunts.preview(code, at())); }, setJoinError);
  };
  const joinPrivate = (ph: PrivateHunt) => void privateAction(
    async () => { setJoinFound(await privateHunts.join(ph)); },
    setJoinError,
    () => { setJoinOpen(false); setToast(h.joined); },
  );
  const completeMission = (ph: PrivateHunt, w: Waypoint, answer?: string, qr?: string) => {
    setMissionError(null);
    void privateAction(
      async () => {
        const out = await privateHunts.complete(ph, w, at(), answer, qr);
        // Back to the map, where the pin turns purple and the toast says what the mission was worth.
        setMission(null);
        setToast([h.gotPoints(out.points_gained), out.hunt.finished_at ? h.privateStamp : ""].filter(Boolean).join(" · "));
      },
      setMissionError,
    );
  };
  const showLeaderboard = (ph: PrivateHunt) => {
    setQuestOpen(false); setBoard({ hunt: ph, rows: null });
    void privateHunts.leaderboard(ph)
      .then((rows) => setBoard({ hunt: ph, rows }))
      .catch(() => { setBoard(null); setToast(h.leaderboardHidden); });
  };
  const showMissions = (ph: PrivateHunt) => {
    setQuestOpen(false); setSelectedId(null); setGameCard(null); setKeeperOpen(false);
    const next = inOrder(ph).find((w) => !w.done_at) ?? inOrder(ph)[0];
    if (next) map.current?.focus(next.lat, next.lng);
  };
  const reportPrivate = (ph: PrivateHunt) => {
    setQuestOpen(false);
    void privateHunts.report(ph).then(() => setToast(h.reported)).catch(() => setToast(h.perr.unknown));
  };
  // A code that arrived in a share link opens the join sheet once, with the code already filled in.
  // It waits for a position first, so the hunt's distances are right the moment the sheet appears.
  useEffect(() => {
    if (!huntCodeParam || !you) return;
    setLinkCode(huntCodeParam); setJoinOpen(true);
    router.setParams({ huntCode: "" });
  }, [huntCodeParam, !!you]);
  const directions = (lat: number, lng: number) => {
    const at = `${lat},${lng}`;
    void Linking.openURL(Platform.OS === "ios" ? `https://maps.apple.com/?daddr=${at}` : `https://www.google.com/maps/dir/?api=1&destination=${at}`);
  };

  if (mapPlace) {
    const mapCapsule = capsules.find((capsule) => capsule.id === mapPlace.capsuleId);
    return <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("back")} onPress={() => setMapPlace(null)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><ArtIcon name="back" size={25} /></Pressable>
      <CapsuleMapPage place={mapPlace.pin.place} vessel={(mapCapsule?.vessel ?? "dome") as VesselKind} onGoOpen={() => { if (mapCapsule) router.push({ pathname: "/capsule/[id]", params: { id: mapCapsule.id } }); }} />
    </SafeAreaView>;
  }

  return <JourneyViewport>
    <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 0 }}>
    {you
      ? <LiveMap ref={map} html={html} state={mapState} onSelect={onPin}
        onTap={(lat, lng) => { if (keeperOpen) setKeeperOpen(false); else if (gameCard) setGameCard(null); else if (selectedId) setSelectedId(null);
          // Inside the pickup circle your figure walks there (only the picture moves); outside, only the test account can jump.
          else if (you && distanceMeters(you.lat, you.lng, lat, lng) <= SEA_PICKUP_RADIUS_M) { setWalkTo(null); map.current?.walk(lat, lng); }
          else if (__DEV__ || isTestLocationUser(userId)) setWalkTo({ lat, lng }); }} />
      : <LocationGate status={status} onAllow={() => void location.request()} onSettings={() => void location.openSettings()} />}
    </View>

    <SafeAreaView edges={["top", "left", "right"]} pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 30, display: throwing ? "none" : "flex" }}>
      <View pointerEvents="box-none" style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        <Chip onPress={goBack} label={t("back")}><ArtIcon name="back" size={22} /></Chip>
        <View style={{ flex: 1 }} pointerEvents="none" />
        <RunChip hunt={activeHunt} onPress={() => setQuestOpen(true)} />
        {privateList.map((ph) => <RunChip key={ph.id} hunt={ph} onPress={() => setQuestOpen(true)} />)}
        {GAME_ENABLED && gameState && <View accessibilityRole="text" style={{ height: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: "rgba(246,248,251,.94)", justifyContent: "center", ...shadows.card }}>
          <Text style={{ fontFamily: sans, fontSize: 12, color: C.ink }}>{g("level", gameState.level)} · {g("balls", gameState.wax_balls)}</Text>
        </View>}
      </View>
    </SafeAreaView>

    <SafeAreaView edges={["bottom", "left", "right"]} pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 20, display: throwing ? "none" : "flex" }}>
      <View pointerEvents="box-none" style={{ width: "100%", alignSelf: "center", paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm }}>
        <View pointerEvents="box-none" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
          {walkTo ? <Pill onPress={() => { setFakeLocation(walkTo); setWalkTo(null); void haptics.tick(); }} label={s("devWalk")} /> : <View />}
          {you && <Chip onPress={() => { setSelectedId(null); setWalkTo(null); map.current?.recenter(); void haptics.tick(); }} label={s("recenter")} translucent><ArtIcon name="locate" size={24} color={C.blue} /></Chip>}
        </View>
        {!!toast && <Text accessibilityRole="alert" style={{ alignSelf: "center", backgroundColor: C.ink, color: C.white, fontFamily: sans, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, overflow: "hidden" }}>{toast}</Text>}
        {you && keeperOpen && activeHunt && <KeeperCard hunt={activeHunt} meters={keeperMeters} busy={busy}
          onJoin={() => void joinHunt(activeHunt)} onCheckIn={() => void huntAction(() => hunts.checkIn(activeHunt, at()), () => map.current?.recenter())}
          onFinish={() => void finishHunt(activeHunt)} onClose={() => setKeeperOpen(false)} />}
        {you && !selected && !keeperOpen && gameCard && <GameCard card={gameCard} busy={busy} g={g} language={language} onChallenge={startLandmark} />}
        {you && !gameCard && !keeperOpen && (selected
          ? <View style={{ width: "100%", maxWidth: 560, alignSelf: "center", backgroundColor: "rgba(255,255,255,.96)", borderRadius: 22, padding: spacing.md, borderWidth: 1, borderColor: C.line, ...shadows.card }}>
            <SelectedCard item={selected} busy={busy} onPickUp={pickUp} onDirections={directions}
              onView={(item) => router.push({ pathname: "/capsule/[id]", params: { id: item.capsuleId } })}
              onMap={setMapPlace} onStep={step} count={items.length} index={items.findIndex((i) => i.id === selected.id)} />
          </View>
          : <Pressable accessibilityRole="button" accessibilityLabel={s("kicker")} disabled={!items.length}
              onPress={() => select(items[0].id)}
              style={{ alignSelf: "flex-end", marginRight: -spacing.md - insets.right, backgroundColor: "rgba(255,255,255,.9)", borderTopLeftRadius: 12, borderBottomLeftRadius: 12, padding: 12, paddingRight: 12 + insets.right, borderWidth: 1, borderRightWidth: 0, borderColor: C.line, ...shadows.card }}>
            <Text style={{ fontFamily: sans, fontSize: 11, fontWeight: "700", letterSpacing: 1.2, color: C.blue }}>{s("kicker")}</Text>
          </Pressable>)}
        {!selected && !gameCard && !keeperOpen && <View pointerEvents="box-none" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View pointerEvents="box-none" style={{ flexDirection: "row", gap: spacing.sm }}>
          <RoundButton label={s("passport")} onPress={() => setPassport(true)}><ArtIcon name="passport" size={27} color={C.blue} /></RoundButton>
          {GAME_ENABLED && <RoundButton label={h.quest} dot={questDot} onPress={() => setQuestOpen(true)}><ArtIcon name="quest" size={26} color={C.blue} /></RoundButton>}
        </View>
        {SEA_ENABLED ? <Pressable accessibilityRole="button" accessibilityLabel={s("throwCta")}
          onPress={() => { void haptics.tap(); router.push({ pathname: "/create", params: { to: "sea" } }); }}
          style={({ pressed }) => ({ alignSelf: "center", flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.wax, borderRadius: radii.pill, paddingLeft: 8, paddingRight: 20, paddingVertical: 7, opacity: pressed ? .9 : 1, ...shadows.card })}>
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.white, alignItems: "center", justifyContent: "center" }}><Vessel kind="hourglass" size={26} /></View>
          <Text style={{ fontFamily: serif, fontSize: 16, color: C.white }}>{s("throwCta")}</Text>
        </Pressable> : null}
        <RoundButton label={h.cabinet} onPress={() => router.push("/cabinet")}><ArtIcon name="cabinet" size={25} color={C.blue} /></RoundButton>
        </View>}
      </View>
    </SafeAreaView>

    {devLetter && <View style={{ position: "absolute", left: spacing.md, right: spacing.md, bottom: insets.bottom + spacing.md, zIndex: 35, gap: spacing.sm, backgroundColor: "rgba(255,255,255,.97)", borderRadius: 22, padding: spacing.lg, borderWidth: 1, borderColor: C.line, ...shadows.card }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Avatar avatar={devLetter.bottle.sender.avatar} size={36} />
        <Text style={{ flex: 1, fontFamily: sans, fontSize: 12, color: C.brass }}>{s("seaBottle", devLetter.bottle.sender.name)}</Text>
      </View>
      <Text style={{ fontFamily: serif, fontSize: 17, lineHeight: 26, color: C.ink }}>{devLetter.message}</Text>
      <Pressable accessibilityRole="button" onPress={() => setDevLetter(null)} style={{ alignItems: "center", backgroundColor: C.blue, borderRadius: radii.pill, paddingVertical: 11 }}>
        <Text style={{ fontFamily: serif, fontSize: 15, color: C.white }}>{g("close")}</Text>
      </Pressable>
    </View>}
    {spinning && <SpinScreen waypost={spinning} language={language} onState={setGameState} onClose={() => { setSpinning(null); void loadGame(); }} />}
    {throwing && gameState && <ThrowScreen capsule={throwing} landmark={fight ?? undefined} state={gameState} onState={setGameState}
      onClose={() => { setThrowing(null); setFight(null); map.current?.recenter(); void loadGame(); }} />}
    <Passport visible={passport} onClose={() => setPassport(false)} userId={userId} stamps={stampRows}
      hunts={[...huntStamps, ...hunts.previewStamps().filter((p) => !huntStamps.some((x) => x.id === p.id))]}
      privateHunts={privateHunts.demoStamps()} />
    <QuestSheet visible={questOpen} hunts={huntList} busy={busy} onClose={() => setQuestOpen(false)} onJoin={(x) => void joinHunt(x)} onShowOnMap={showHunt}
      privateTab={{
        count: privateList.length,
        onEnterCode: () => { setQuestOpen(false); setLinkCode(null); setJoinFound(null); setJoinError(null); setJoinOpen(true); },
        onMyHunts: organizer.canCreate(profile, __DEV__ || isTestLocationUser(userId)) ? () => { setQuestOpen(false); router.push("/hunts"); } : undefined,
        children: privateList.map((ph) => <PrivateHuntCard key={ph.id} hunt={ph}
          onShowOnMap={showMissions} onLeaderboard={showLeaderboard} onReport={reportPrivate}
          onOpenMission={(x, w) => { setQuestOpen(false); setMissionError(null); setMission({ hunt: x.id, waypoint: w.id }); map.current?.focus(w.lat, w.lng); }} />),
      }} />
    <JoinPrivateSheet visible={joinOpen} initialCode={linkCode} found={joinFound} busy={busy} error={joinError}
      onClose={() => setJoinOpen(false)} onFind={findCode} onJoin={joinPrivate} />
    {openMission && openWaypoint && <MissionSheet visible hunt={openMission} waypoint={openWaypoint}
      meters={metersTo(openWaypoint.lat, openWaypoint.lng)} busy={busy} error={missionError}
      tries={openWaypoint.tries ? 3 - (openWaypoint.tries % 3) : undefined}
      onClose={() => { setMission(null); setMissionError(null); }}
      onComplete={(answer, qr) => completeMission(openMission, openWaypoint, answer, qr)} />}
    <LeaderboardSheet visible={!!board} hunt={board?.hunt ?? null} rows={board?.rows ?? null} onClose={() => setBoard(null)} />
  </JourneyViewport>;
}

type GameCardValue = { waypost: Waypost; meters: number };
function GameCard({ card, busy, g, language, onChallenge }: {
  card: GameCardValue; busy: boolean; g: ReturnType<typeof useGameText>; language: "zh" | "en"; onChallenge: (w: Waypost) => void;
}) {
  const near = card.meters <= GAME_ACTION_RADIUS_M;
  const left = distanceText(Math.max(0, card.meters - GAME_ACTION_RADIUS_M));
  const landmark = card.waypost.kind === "landmark";
  const title = language === "zh" ? card.waypost.name_zh : card.waypost.name_en;
  const note = near ? "" : landmark ? g("challengeWalkCloser", left) : g("spinWalkCloser", left);
  return <View style={{ width: "100%", maxWidth: 560, alignSelf: "center", gap: spacing.sm, backgroundColor: "rgba(255,255,255,.96)", borderRadius: 22, padding: spacing.md, borderWidth: 1, borderColor: C.line, ...shadows.card }}>
    {landmark && <Image source={gameArt.wheel[sceneKey(card.waypost)]} resizeMode="cover" style={{ width: 112, height: 112, borderRadius: 56, borderWidth: 4, borderColor: C.brass, alignSelf: "center" }} />}
    <Text style={{ fontFamily: serif, fontSize: 18, color: C.ink, textAlign: landmark ? "center" : "left" }}>{title}</Text>
    {!!note && <Text style={{ fontFamily: sans, fontSize: 13, color: C.muted }}>{note}</Text>}
    {landmark && near && <Pressable accessibilityRole="button" disabled={busy} onPress={() => onChallenge(card.waypost)} style={{ alignItems: "center", backgroundColor: C.plum, borderRadius: radii.pill, paddingVertical: 11, opacity: busy ? .6 : 1 }}>
      <Text style={{ fontFamily: serif, fontSize: 15, color: C.white }}>{g("challenge")}</Text>
    </Pressable>}
  </View>;
}

function SelectedCard({ item, busy, count, index, onStep, onPickUp, onDirections, onView, onMap }: {
  item: Item; busy: boolean; count: number; index: number; onStep: (d: 1 | -1) => void;
  onPickUp: (i: Extract<Item, { kind: "sea" }>) => void; onDirections: (lat: number, lng: number) => void;
  onView: (i: Extract<Item, { kind: "place" }>) => void; onMap: (i: Extract<Item, { kind: "place" }>) => void;
}) {
  const s = useSeaText();
  const { t, language } = useLanguage();
  const near = item.meters <= SEA_PICKUP_RADIUS_M;
  const nav = <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
    <Small onPress={() => onStep(-1)} label="‹" />
    <Text style={{ fontFamily: sans, fontSize: 11, color: C.muted }}>{index + 1} / {count}</Text>
    <Small onPress={() => onStep(1)} label="›" />
  </View>;
  if (item.kind === "place") {
    const name = language === "zh" ? item.pin.place.name_zh : item.pin.place.name_en;
    return <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Vessel kind={(item.pin.vessel ?? "dome") as VesselKind} size={48} idle />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: sans, fontSize: 11, color: C.brass }}>{s("yourCapsule")}</Text>
          <Text style={{ fontFamily: serif, fontSize: 17, color: C.ink }}>{name}</Text>
          <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{near ? s("here") : s("away", distanceText(item.meters))}</Text>
        </View>
        {nav}
      </View>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Btn flex title={t("journey.viewCapsule")} onPress={() => onView(item)} />
        <Btn flex quiet title={t("journey.viewMap")} onPress={() => onMap(item)} />
      </View>
    </View>;
  }
  const b = item.bottle;
  return <View style={{ gap: spacing.sm }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
      <View>
        <Vessel kind="bottle" size={52} idle />
        <View style={{ position: "absolute", right: -6, top: -4, borderRadius: 14, borderWidth: 2, borderColor: C.white }}><Avatar avatar={b.sender.avatar} size={24} /></View>
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontFamily: sans, fontSize: 11, color: C.brass }}>{s("seaBottle", b.sender.name)}</Text>
        <Text numberOfLines={2} style={{ fontFamily: serif, fontSize: 17, color: C.ink }}>「{b.hint}」</Text>
        <Text numberOfLines={1} style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>
          {[b.sender.city ? s("fromCity", b.sender.city) : null, s("drifted", daysSince(b.sealed_at)), b.returns ? s("returns", b.returns) : null].filter(Boolean).join(" · ")}
        </Text>
      </View>
      {nav}
    </View>
    {near
      ? <Btn title={busy ? s("picking") : s("pickUp")} disabled={busy} onPress={() => onPickUp(item)} />
      : <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Text style={{ flex: 1, fontFamily: sans, fontSize: 13, color: C.blue }}>{s("walkCloser", distanceText(item.meters - SEA_PICKUP_RADIUS_M))}</Text>
        <Btn quiet title={s("navigate")} onPress={() => onDirections(item.lat, item.lng)} />
      </View>}
  </View>;
}

function LocationGate({ status, onAllow, onSettings }: { status: string; onAllow: () => void; onSettings: () => void }) {
  const s = useSeaText();
  const { t } = useLanguage();
  return <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, gap: spacing.md, backgroundColor: C.glass }}>
    <Vessel kind="hourglass" size={130} idle />
    <Text style={{ fontFamily: sans, color: C.ink, textAlign: "center", lineHeight: 22, maxWidth: 360 }}>{status === "denied" ? (Platform.OS === "web" ? t("journey.locationDeniedWeb") : s("locationDenied")) : status === "checking" || status === "granted" ? s("locationWaiting") : s("locationAsk")}</Text>
    {status === "denied" && <Btn title={Platform.OS === "web" ? t("retry") : s("openSettings")} onPress={Platform.OS === "web" ? onAllow : onSettings} />}
    {(status === "explain" || status === "unavailable") && <Btn title={s("locationAllow")} onPress={onAllow} />}
  </SafeAreaView>;
}

function RoundButton({ children, label, onPress, dot }: { children: React.ReactNode; label: string; onPress: () => void; dot?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => { void haptics.tap(); onPress(); }}
    style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: "rgba(246,248,251,.94)", alignItems: "center", justifyContent: "center", ...shadows.card }}>
    {children}
    {dot && <View style={{ position: "absolute", top: 4, right: 4, width: 11, height: 11, borderRadius: 6, backgroundColor: C.wax, borderWidth: 2, borderColor: C.white }} />}
  </Pressable>;
}
function Chip({ children, onPress, label, translucent = false }: { children: React.ReactNode; onPress: () => void; label: string; translucent?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    style={{ minWidth: 44, height: 44, paddingHorizontal: 8, borderRadius: 22, backgroundColor: translucent ? "rgba(246,248,251,.9)" : "rgba(246,248,251,.94)", alignItems: "center", justifyContent: "center", ...shadows.card }}>{children}</Pressable>;
}
function Pill({ onPress, label }: { onPress: () => void; label: string }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={{ backgroundColor: C.ink, borderRadius: radii.pill, paddingHorizontal: 14, paddingVertical: 9, ...shadows.card }}>
    <Text style={{ fontFamily: sans, fontSize: 13, color: C.brass }}>{label}</Text>
  </Pressable>;
}
function Small({ onPress, label }: { onPress: () => void; label: string }) {
  return <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" }}>
    <Text style={{ fontFamily: serif, fontSize: 16, color: C.blue, marginTop: -2 }}>{label}</Text>
  </Pressable>;
}
function Btn({ title, onPress, quiet, disabled, flex }: { title: string; onPress: () => void; quiet?: boolean; disabled?: boolean; flex?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ flex: flex ? 1 : undefined, borderRadius: 14, paddingVertical: 12, paddingHorizontal: spacing.md, alignItems: "center", backgroundColor: quiet ? C.white : C.blue, borderWidth: quiet ? 1.5 : 0, borderColor: C.blue, opacity: disabled ? .5 : pressed ? .85 : 1 })}>
    <Text style={{ fontFamily: sans, fontWeight: "600", color: quiet ? C.blue : C.white }}>{title}</Text>
  </Pressable>;
}
