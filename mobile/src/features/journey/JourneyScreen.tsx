import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking, Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ArtIcon } from "../../components/ArtIcon";
import { Avatar } from "../../components/Avatar";
import { figureFor } from "../../components/Figure";
import { haptics } from "../../components/haptics";
import { Vessel, type VesselKind } from "../../components/Vessel";
import { useLanguage } from "../../i18n";
import { useAuth } from "../../services/auth";
import { CITIES, CITY_EXPLORER, cityAt, cityPuzzle, type ExplorerCity, type GuessResult, type PuzzleDay } from "../../services/cityPuzzle";
import { HuntError, hunt as hunts, keeperMark, onHuntChange, type Hunt } from "../../services/cityHunt";
import { distanceMeters } from "../../services/data";
import type { PassportHunt } from "../../services/game";
import { dodgeFights, game, GAME_ACTION_RADIUS_M, GAME_ENABLED, type CorruptedCapsule, type DevLetter, type GameState, type Nearby, type Waypost } from "../../services/game";
import { useCapsules, usePlaces } from "../../services/hooks";
import { clockText } from "../../services/huntClock";
import { atGuide, guideSpot, guideStage, inOrder, onPrivateHuntChange, placed, PrivateHuntError, privateHunt as privateHunts, type LeaderRow, type PrivateHunt, type Quest } from "../../services/privateHunt";
import { organizer } from "../../services/privateHuntOrganizer";
import { MAP_PMTILES_URL, PUBLIC_CAPSULE_ENABLED, PUBLIC_CAPSULE_PICKUP_RADIUS_M, PUBLIC_CAPSULE_RECIPIENT, publicCapsule, PublicCapsuleError, type PublicCapsule } from "../../services/publicCapsule";
import { supabase } from "../../services/supabase";
import { C, radii, sans, serif, shadows, spacing } from "../../theme";
import { CityExplorer, type HuntDays } from "../explorer/CityExplorer";
import { TodaysHuntScreen, type HuntMap } from "../todaysHunt/TodaysHuntScreen";
import { TODAYS_HUNT, todaysHunt } from "../../services/todaysHunt";
import { PriceGuessScreen } from "../explorer/PriceGuessScreen";
import { useExplorerText } from "../explorer/strings";
import { RACK_SAMPLE, RACKS, racks } from "../../services/racks";
import { WaypostScreen } from "../racks/WaypostScreen";
import { useGameText } from "../game/strings";
import { DodgeFightScreen } from "../game/DodgeFightScreen";
import { KeeperCard, QuestSheet, RunChip } from "../hunt/HuntViews";
import { GuideCard, JoinPrivateSheet, LeaderboardSheet, PrivateHuntCard, QuestScreen } from "../hunt/PrivateHuntViews";
import { useHuntText } from "../hunt/strings";
import { distanceText, timeLeftShort, usePublicCapsuleText } from "../publicCapsule/strings";
import { CapsuleMapPage } from "./CapsuleMapPage";
import { GameCard } from "./GameCard";
import { Chip, Pill } from "./JourneyControls";
import { BallsChip, HomeBar, HomeDock, type HomeMode } from "./HomeBar";
import { pointOpeningPlace, status as capsuleStatus } from "../capsule/model";
import { Item, portraitUri, vesselUri } from "./journeyModel";
import { JourneyViewport } from "./JourneyViewport";
import { LiveMap } from "./live/LiveMap";
import { mapHtml } from "./live/mapHtml";
import { assetUri, type LiveMapHandle, type LivePin } from "./live/types";
import { isTestLocationUser, setFakeLocation, useForegroundLocation } from "./location";
import { LocationGate } from "./LocationGate";
import { filterCounts, shows, showsPin, type MapFilter } from "./mapFilter";
import { MapFilterSheet } from "./MapFilterSheet";
import { Passport } from "./Passport";
import { SelectedCard } from "./SelectedCard";
import { useCapsuleItems } from './useCapsuleItems';
import { openCityHunt, useCityHuntPins } from './useCityHuntPins';
import { useGamePins } from "./useGamePins";
import { usePrivateQuestPins } from "./usePrivateQuestPins";
import { usePinQuests, type PinQuest } from "./usePinQuests";
import { QuestPlay } from "../quests/QuestPlay";
import { routes } from "../../services/routes";
import { cityHuntQuests, HUNT_QUESTS } from "../../services/cityHuntQuests";
import type { QuestAnswer } from "../../services/quests";

const FALLBACK = { lat: 22.19358, lng: 113.53917 };
export default function JourneyScreen() {
  const insets = useSafeAreaInsets();
  const { session, profile } = useAuth();
  const userId = session?.user.id ?? "";
  const { t, language } = useLanguage();
  const s = usePublicCapsuleText();
  const g = useGameText();
  const placeData = usePlaces();
  const capsuleData = useCapsules(userId, "inbox");
  const location = useForegroundLocation();
  const { fix, status } = location;
  const latestFix = useRef(fix);
  latestFix.current = fix;
  const you = fix ? { lat: fix.lat, lng: fix.lng } : null;
  const map = useRef<LiveMapHandle>(null);
  const [publicCapsules, setPublicCapsules] = useState<PublicCapsule[]>([]);
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
  const [dodgeLandmark, setDodgeLandmark] = useState<Waypost | undefined>();
  const [throwing, setThrowing] = useState<CorruptedCapsule | null>(null);
  const [devLetter, setDevLetter] = useState<DevLetter | null>(null);
  const [passportStamps, setPassportStamps] = useState<Record<string, string>>({});
  const [huntStamps, setHuntStamps] = useState<PassportHunt[]>([]);
  const [privateHuntStamps, setPrivateHuntStamps] = useState<Awaited<ReturnType<typeof game.passport>>["privateHunts"]>([]);
  const [huntList, setHuntList] = useState<Hunt[]>([]);
  const [questOpen, setQuestOpen] = useState(false);
  // Private hunts: the ones I joined, the join-by-code sheet, the quest I have open and the leaderboard.
  const [privateList, setPrivateList] = useState<PrivateHunt[]>([]);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinFound, setJoinFound] = useState<PrivateHunt | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [quest, setQuest] = useState<{ hunt: string; quest: string } | null>(null);
  const [questError, setQuestError] = useState<string | null>(null);
  const [questResult, setQuestResult] = useState<{ points: number; finished: boolean } | null>(null);
  const [board, setBoard] = useState<{ hunt: PrivateHunt; rows: LeaderRow[] | null } | null>(null);
  const { huntCode: huntCodeParam, route: routeParam } = useLocalSearchParams<{ huntCode?: string; route?: string }>();
  const [pinQuest, setPinQuest] = useState<PinQuest | null>(null);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [keeperOpen, setKeeperOpen] = useState(false);
  // The private hunt whose guide card is open, by id.
  const [guideOpen, setGuideOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<MapFilter>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [youLabel, setYouLabel] = useState(false);
  const h = useHuntText();
  // City Explorer: look around any city from anywhere and play its daily puzzle (docs/design/city-explorer.md).
  const x = useExplorerText();
  // The app opens on Today's Hunt (docs/design/hunt-first-home.md); a route or hunt link opens on Explore instead.
  const [mode, setMode] = useState<HomeMode>(routeParam || huntCodeParam || !CITY_EXPLORER ? "explore" : "hunt");
  const exploring = mode === "hunt";
  const [cityIndex, setCityIndex] = useState(0);
  const [puzzleDay, setPuzzleDay] = useState<PuzzleDay | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  // Today's Hunt (docs/design/hunt-loop.md, section 1) replaces the daily price card when it is on.
  const [huntDays, setHuntDays] = useState<HuntDays | null>(null);
  const [huntCity, setHuntCity] = useState<string | null>(null);
  const [huntMap, setHuntMap] = useState<HuntMap | null>(null);
  const loadHuntDays = () => {
    if (!TODAYS_HUNT) return;
    void Promise.all(CITIES.filter((c) => c.playable).map((c) => todaysHunt.today(c.id).then((d) => [c.id, { score: d.score, finished: d.finished, streak: d.streak }] as const).catch(() => null)))
      .then((rows) => setHuntDays(Object.fromEntries(rows.filter((r) => r !== null))));
  };
  const here = cityAt(fix ? { lat: fix.lat, lng: fix.lng } : null);
  // After the render, so it also works when opening the Explorer is what puts the map on screen.
  useEffect(() => { if (exploring) map.current?.city(CITIES[cityIndex].lat, CITIES[cityIndex].lng); }, [exploring, cityIndex]);
  const loadDays = () => { void cityPuzzle.today().then(setPuzzleDay).catch(() => {}); loadHuntDays(); };
  const toHunt = () => {
    setSelectedId(null); setGameCard(null); setKeeperOpen(false); setGuideOpen(null); setFilterOpen(false); setWalkTo(null);
    setMode("hunt");
    if (here) setCityIndex(CITIES.indexOf(here));
    loadDays();
  };
  // Explore is the map around you. Without a location it asks for one, with a way back to Today's Hunt.
  const toExplore = () => { setMode("explore"); setPlaying(null); setHuntCity(null); setHuntMap(null); map.current?.recenter(); };
  const pickMode = (m: HomeMode) => m === "hunt" ? toHunt() : toExplore();
  const closeHunt = () => { setHuntCity(null); setHuntMap(null); loadHuntDays(); map.current?.city(CITIES[cityIndex].lat, CITIES[cityIndex].lng); };
  const onGuess = (r: GuessResult) => {
    setPuzzleDay((day) => day && { streak: r.streak, puzzles: day.puzzles.map((p) => p.city === r.puzzle.city ? r.puzzle : p) });
    if (r.state) setGameState(r.state);
  };
  // Opening on Today's Hunt: load the day, and turn to the city you're in once your location arrives.
  useEffect(() => { if (exploring) loadDays(); }, []);
  const placedCity = useRef(false);
  useEffect(() => {
    if (!here || placedCity.current) return;
    placedCity.current = true;
    if (exploring && !huntCity) setCityIndex(CITIES.indexOf(here));
  }, [here?.id]);
  // A route or hunt link that arrives while the app is open switches to Explore, where it is shown.
  useEffect(() => { if ((routeParam || huntCodeParam) && exploring) toExplore(); }, [routeParam, huntCodeParam]);
  const playingCity: ExplorerCity | null = CITIES.find((c) => c.id === playing) ?? null;
  const playingPuzzle = puzzleDay?.puzzles.find((p) => p.city === playing) ?? null;
  // Private capsule pins show their sender's profile picture and a small countdown while still on a timer.
  const [senders, setSenders] = useState<Record<string, unknown>>({});
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);
  // Time capsules ready to open now, for the badge on the dock's Capsules button.
  const readyCount = (capsuleData.data ?? []).filter((c) => {
    const place = c.place ? (placeData.data ?? []).find((p) => p.id === c.place) : pointOpeningPlace(c as never);
    return capsuleStatus(c as never, "inbox", fix as never, place as never, now) === "ready";
  }).length;
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
  // A common Waypost near you opens on its own screen: spin first, then its capsule rack (docs/design/hunt-first-home.md).
  const [waypostOpen, setWaypostOpen] = useState<{ waypost: Waypost; meters: number } | null>(null);
  const [gameCard, setGameCard] = useState<{ waypost: Waypost; meters: number; count?: number | null } | null>(null);
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
  const loadPublicCapsules = useCallback(async () => {
    // With racks, public capsules hang on Waypost racks instead of floating on the map.
    if (!PUBLIC_CAPSULE_ENABLED || RACKS || !you) return;
    const test = __DEV__ && !userId && GAME_ENABLED ? game.devPublicCapsules(you) : [];
    setPublicCapsules(test);
    try {
      setPublicCapsules([...test, ...await publicCapsule.nearby(fix ? { lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy } : null)]);
    } catch { /* the map still works without public capsules */ }
  }, [cell, userId]);
  const loadGame = useCallback(async () => {
    const at = latestFix.current;
    if (!GAME_ENABLED || !at) return;
    try {
      const [state, around, stamps] = await Promise.all([game.state(), game.nearby({ lat: at.lat, lng: at.lng, accuracy: at.accuracy }), game.passport()]);
      setGameState(state); setNearby(around); nearbyRef.current = around; setPassportStamps(stamps.places); setHuntStamps(stamps.hunts);
      setPrivateHuntStamps(stamps.privateHunts);
    } catch { /* the map still works without the game */ }
    const previewAllowed = __DEV__ || isTestLocationUser(userId);
    try {
      setHuntList(await hunts.list({ userId, at, known: nearbyRef.current.wayposts, previewAllowed }));
    } catch (e) { if (__DEV__) console.warn("City Hunt list failed", e); }
    try {
      setPrivateList(await privateHunts.mine({ userId, at, previewAllowed }));
    } catch (e) { if (__DEV__) console.warn("private hunt list failed", e); }
  }, [cell, userId]);
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
    void loadPublicCapsules();
  }, [userId, placeData.refresh, capsuleData.refresh, loadPublicCapsules]));
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(""), 3600); return () => clearTimeout(id); }, [toast]);

  const capsules = capsuleData.data ?? [];
  const places = placeData.data ?? [];
  const { items, stampRows } = useCapsuleItems(places, capsules, publicCapsules, you, passportStamps);
  const selected = items.find((i) => i.id === selectedId) ?? null;

  const metersTo = (lat: number, lng: number) => you ? distanceMeters(you.lat, you.lng, lat, lng) : Infinity;
  const activeHunt = openCityHunt(huntList);
  const { questPins, guidePins, guides } = usePrivateQuestPins(privateList, you, h);
  const gamePins = useGamePins(nearby, throwing, you);
  const { pinQuestPins, findPinQuest, nextStop, refresh: refreshPinQuests, routeQuests, cityQuests } = usePinQuests(capsules, activeHunt, you);
  const { keeperMeters, questDot, huntPins } = useCityHuntPins(activeHunt, cityQuests, you);
  // From a capsule's pages ("Walk the route"): the map goes to the route's next stop once it has loaded.
  const routeShown = useRef<string | null>(null);
  useEffect(() => {
    if (!routeParam || routeShown.current === routeParam) return;
    const stop = nextStop(String(routeParam));
    if (!stop) return;
    routeShown.current = String(routeParam);
    map.current?.focus(stop.location_lat, stop.location_lng);
  }, [routeParam, routeQuests]);

  // The Explorer can open the map before a position is known; the page is then kept when one arrives.
  const html = useMemo(() => mapHtml({ pmtiles: MAP_PMTILES_URL, center: you ?? FALLBACK }), [!!you || exploring]);
  // A private capsule: its own vessel, the sender's picture with a wax seal (public ones are always the bottle,
  // with no seal), and only while it is still on its timer, a tiny countdown. No place name: the card has it.
  const placePin = (i: Extract<Item, { kind: "place" }>): LivePin => {
    const c = capsules.find((x) => x.id === i.capsuleId);
    const left = c && !c.opened_at ? new Date(c.open_at).getTime() - now : 0;
    return { id: i.id, lat: i.lat, lng: i.lng, kind: "place", private: true, opened: !!c?.opened_at, vessel: vesselUri(i.pin.vessel ?? "dome"),
      portrait: c ? portraitUri(senders[c.sender]) : null, near: i.meters <= PUBLIC_CAPSULE_PICKUP_RADIUS_M, selected: i.id === selectedId,
      timer: left > 0 ? timeLeftShort(left, language) : undefined };
  };
  const allPins = useMemo<LivePin[]>(() => [...items.map<LivePin>((i) => i.kind === "publicCapsule"
    ? { id: i.id, lat: i.lat, lng: i.lng, kind: "publicCapsule", vessel: vesselUri("bottle"), portrait: portraitUri(i.publicCapsule.sender.avatar), near: i.meters <= PUBLIC_CAPSULE_PICKUP_RADIUS_M, far: i.meters > 600, selected: i.id === selectedId, tag: i.meters <= PUBLIC_CAPSULE_PICKUP_RADIUS_M ? undefined : distanceText(i.meters) }
    : placePin(i)), ...gamePins, ...huntPins, ...questPins, ...guidePins, ...pinQuestPins], [items, selectedId, language, gamePins, huntPins, questPins, guidePins, pinQuestPins, senders, now]);
  const mapState = useMemo(() => huntMap ? {
    // Today's Hunt: only its three pins, and your figure at the hunt instead of where you are; no pickup circle.
    you: huntMap.you, heading: null, reach: 0, portrait: portraitUri(profile?.avatar), figure: assetUri(figureFor(profile?.avatar)), youLabel: null, pins: huntMap.pins,
  } : {
    you, heading, reach: PUBLIC_CAPSULE_PICKUP_RADIUS_M,
    portrait: portraitUri(profile?.avatar),
    figure: assetUri(figureFor(profile?.avatar)),
    youLabel: youLabel && !throwing ? h.thisIsYou : null,
    // While throwing, the capsule is alone on the plain map.
    pins: throwing ? [] : allPins.filter((p) => showsPin(filter, p)),
  }, [you?.lat, you?.lng, heading, profile?.avatar, allPins, filter, !!throwing, youLabel, h, huntMap]);
  const counts = useMemo(() => filterCounts(allPins), [allPins]);
  const pickFilter = (f: MapFilter) => {
    setFilter(f); setFilterOpen(false);
    // Close whatever card belongs to pins the new choice hides.
    if (!shows(f, "publicCapsule")) setSelectedId(null);
    if (!shows(f, "keeper")) setKeeperOpen(false);
    if (!shows(f, "quest")) setGuideOpen(null);
    if (!shows(f, "waypost")) setGameCard(null);
  };

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
  const pickUp = async (item: Extract<Item, { kind: "publicCapsule" }>) => {
    if (busy) return;
    if (item.id.startsWith("dev-public-capsule-")) {
      const letter = game.devPickUp(item.id);
      void haptics.success();
      setSelectedId(null); setDevLetter(letter);
      void loadPublicCapsules();
      return;
    }
    setBusy(true);
    try {
      const capsuleId = await publicCapsule.pickUp(item.id, fix ? { lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy } : null);
      void haptics.success();
      setSelectedId(null);
      router.push({ pathname: "/capsule/[id]", params: { id: capsuleId } });
      void loadPublicCapsules();
    } catch (e) {
      void haptics.warn();
      const code = e instanceof PublicCapsuleError ? e.code : "unknown";
      setToast(code === "too_far" ? s("errTooFar") : code === "taken" ? s("errTaken") : code === "own_capsule" ? s("errOwn") : s("errUnknown"));
      if (code === "taken") void loadPublicCapsules();
    } finally { setBusy(false); }
  };
  const onPin = (id: string) => {
    if (id === "you") { dismissYou(); return; }
    if (id.startsWith("keeper-")) {
      setSelectedId(null); setGameCard(null); setGuideOpen(null); setKeeperOpen(true); void haptics.tick();
      if (activeHunt) map.current?.focus(activeHunt.keeper.lat, activeHunt.keeper.lng);
      return;
    }
    setKeeperOpen(false); setGuideOpen(null);
    if (id.startsWith("guide-")) {
      const g = guides.find((x) => `guide-${x.hunt.id}` === id);
      if (!g) return;
      setSelectedId(null); setGameCard(null); void haptics.tick();
      map.current?.focus(g.spot.lat, g.spot.lng); setGuideOpen(g.hunt.id);
      return;
    }
    if (id.startsWith("route-") || id.startsWith("cityq-")) {
      const found = findPinQuest(id);
      if (!found) return;
      setSelectedId(null); setGameCard(null); void haptics.tick();
      map.current?.focus(found.quest.location_lat, found.quest.location_lng);
      setPinQuest(found);
      return;
    }
    if (id.startsWith("quest-")) {
      const pin = questPins.find((p) => p.id === id);
      const found = findQuest(id);
      if (!pin || !found) return;
      setSelectedId(null); setGameCard(null); void haptics.tick();
      map.current?.focus(pin.lat, pin.lng);
      setQuestError(null); setQuestResult(null); setQuest({ hunt: found.hunt.id, quest: found.quest.id });
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
      if (waypost.kind === "common" && meters <= GAME_ACTION_RADIUS_M) { setGameCard(null); setWaypostOpen({ waypost, meters }); }
      else if (waypost.kind === "common" && RACKS) {
        // Too far to spin: a small card with the distance and how full its rack is.
        setGameCard({ waypost, meters, count: null });
        void racks.list(waypost.id, "all", null).then((p) => setGameCard((c) => c?.waypost.id === waypost.id ? { ...c, count: p.count } : c)).catch(() => {});
      }
      else setGameCard({ waypost, meters });
      return;
    }
    setGameCard(null);
    select(id);
  };
  // A catch or Landmark win can finish a quest, so its pins and checklist reload too.
  const closeFight = () => {
    setThrowing(null);
    setDodgeLandmark(undefined);
    map.current?.recenter();
    void loadGame().finally(() => refreshPinQuests());
  };
  const startLandmark = (waypost: Waypost) => {
    if (busy) return;
    void haptics.tap();
    setGameCard(null);
    setDodgeLandmark(waypost);
    setThrowing({ id: waypost.id, vessel: dodgeFights.landmarkVessel(waypost), rarity: "uncommon", lat: waypost.lat,
      lng: waypost.lng, expires_at: "", attempts_left: 0 });
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
    if (x.checked_in_at && !x.finished_at && keeperMark(x, HUNT_QUESTS ? (x.id === activeHunt?.id ? cityQuests : []) : null) !== "✓") map.current?.recenter();
    else { map.current?.focus(x.keeper.lat, x.keeper.lng); setKeeperOpen(true); }
  };

  // ---- private hunts ----
  // The open quest is held by id, so it follows the hunt as the server (or the demo) refreshes it.
  const openPrivateHunt = quest ? privateList.find((p) => p.id === quest.hunt) ?? null : null;
  const openGuide = guideOpen ? guides.find((x) => x.hunt.id === guideOpen) ?? null : null;
  const openQuest = openPrivateHunt?.quests.find((w) => w.id === quest?.quest) ?? null;
  const findQuest = (pinId: string) => {
    for (const ph of privateList) for (const w of ph.quests) if (`quest-${ph.id}-${w.id}` === pinId) return { hunt: ph, quest: w };
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
  // Joining only finds the hunt: the map flies to its guide, who starts the run, even when the hunt is in another city.
  let joinedHunt: PrivateHunt | null = null;
  const joinPrivate = (ph: PrivateHunt) => void privateAction(
    async () => { joinedHunt = await privateHunts.join(ph); setJoinFound(joinedHunt); },
    setJoinError,
    () => {
      setJoinOpen(false); setToast(h.joined);
      const spot = joinedHunt && guideSpot(joinedHunt, you);
      if (spot) map.current?.focus(spot.lat, spot.lng);
    },
  );
  const startPrivate = (ph: PrivateHunt) => void privateAction(
    () => privateHunts.start(ph, at()),
    setToast,
    () => { setGuideOpen(null); showQuests({ ...ph, started_at: new Date().toISOString() }); },
  );
  const collectPrivate = (ph: PrivateHunt) => void privateAction(
    () => privateHunts.collect(ph, at()),
    setToast,
    () => { setGuideOpen(null); setQuestOpen(false); setToast(h.privateStamp); },
  );
  const completeQuest = (ph: PrivateHunt, w: Quest, answer?: string, qr?: string) => {
    setQuestError(null);
    void privateAction(
      async () => {
        const out = await privateHunts.complete(ph, w, at(), answer, qr);
        // The quest's page stays open with what it was worth, as a Waypost does after a spin.
        setQuestResult({ points: out.points_gained, finished: !!out.hunt.finished_at });
      },
      setQuestError,
    );
  };
  const showLeaderboard = (ph: PrivateHunt) => {
    setQuestOpen(false); setBoard({ hunt: ph, rows: null });
    void privateHunts.leaderboard(ph)
      .then((rows) => setBoard({ hunt: ph, rows }))
      .catch(() => { setBoard(null); setToast(h.leaderboardHidden); });
  };
  // Before the run and after it, the map goes to the guide; during it, to the next quest with a spot.
  const showQuests = (ph: PrivateHunt) => {
    setQuestOpen(false); setSelectedId(null); setGameCard(null); setKeeperOpen(false);
    if (guideStage(ph) !== "playing") {
      const spot = guideSpot(ph, you);
      map.current?.focus(spot.lat, spot.lng); setGuideOpen(ph.id);
      return;
    }
    const spots = inOrder(ph).filter(placed);
    const next = spots.find((w) => !w.done_at) ?? spots[0];
    if (next) map.current?.focus(next.location_lat, next.location_lng);
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

  const homeBar = <HomeBar mode={mode} onMode={pickMode} avatar={profile?.avatar}
    right={GAME_ENABLED && gameState ? <BallsChip balls={gameState.wax_balls} label={g("balls", gameState.wax_balls)} /> : null} />;
  const homeDock = <HomeDock passportLabel={s("passport")} cabinetLabel={h.cabinet} ready={readyCount} onPassport={() => setPassport(true)}
    questLabel={h.quest} questDot={questDot} onQuest={GAME_ENABLED ? () => setQuestOpen(true) : undefined} />;

  return <JourneyViewport>
    <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 0 }}>
    {you || exploring
      ? <LiveMap ref={map} html={html} state={mapState} onSelect={(id) => { if (!exploring) onPin(id); }}
        // Another city is for looking only: nothing on the map answers a tap while exploring.
        onTap={(lat, lng) => { if (exploring) return; if (filterOpen) setFilterOpen(false); else if (keeperOpen) setKeeperOpen(false); else if (guideOpen) setGuideOpen(null); else if (gameCard) setGameCard(null); else if (selectedId) setSelectedId(null);
          // Inside the pickup circle your figure walks there (only the picture moves); outside, only the test account can jump.
          else if (you && distanceMeters(you.lat, you.lng, lat, lng) <= PUBLIC_CAPSULE_PICKUP_RADIUS_M) { setWalkTo(null); map.current?.walk(lat, lng); }
          else if (__DEV__ || isTestLocationUser(userId)) setWalkTo({ lat, lng }); }} />
      : <LocationGate status={status} onAllow={() => void location.request()} onSettings={() => void location.openSettings()}
          explore={CITY_EXPLORER ? { title: x.backToHunt, onPress: toHunt } : undefined} />}
    </View>

    <SafeAreaView edges={["top", "left", "right"]} pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 30, display: throwing || exploring ? "none" : "flex" }}>
      {homeBar}
      {(activeHunt || privateList.length > 0) && <View pointerEvents="box-none" style={{ flexDirection: "row", justifyContent: "flex-end", flexWrap: "wrap", gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        <RunChip hunt={activeHunt} onPress={() => setQuestOpen(true)} />
        {privateList.map((ph) => <RunChip key={ph.id} hunt={ph} onPress={() => setQuestOpen(true)} />)}
      </View>}
    </SafeAreaView>

    <SafeAreaView edges={["bottom", "left", "right"]} pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 20, display: throwing || exploring ? "none" : "flex" }}>
      <View pointerEvents="box-none" style={{ width: "100%", alignSelf: "center", paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm }}>
        <View pointerEvents="box-none" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
          {walkTo ? <Pill onPress={() => { setFakeLocation(walkTo); setWalkTo(null); void haptics.tick(); }} label={s("devWalk")} /> : <View />}
          {you && <View style={{ gap: spacing.sm }}>
            <Chip onPress={() => { setSelectedId(null); setWalkTo(null); map.current?.recenter(); void haptics.tick(); }} label={s("recenter")} translucent><ArtIcon name="locate" size={24} color={C.blue} /></Chip>
            {/* Filled blue while the map hides something, so a filtered map never looks like an empty one. */}
            <Chip onPress={() => { setFilterOpen((o) => !o); void haptics.tick(); }} label={filter === "all" ? s("filter") : s("filterOn", s(FILTER_LABEL[filter]))} translucent active={filter !== "all"}>
              <ArtIcon name="filter" size={22} color={filter === "all" ? C.blue : C.white} />
            </Chip>
          </View>}
        </View>
        {you && filterOpen && <MapFilterSheet value={filter} counts={counts} onChange={pickFilter} onClose={() => setFilterOpen(false)} />}
        {!!toast && <Text accessibilityRole="alert" style={{ alignSelf: "center", backgroundColor: C.ink, color: C.white, fontFamily: sans, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, overflow: "hidden" }}>{toast}</Text>}
        {you && keeperOpen && activeHunt && <KeeperCard hunt={activeHunt} quests={cityQuests} meters={keeperMeters} busy={busy}
          onJoin={() => void joinHunt(activeHunt)} onCheckIn={() => void huntAction(() => hunts.checkIn(activeHunt, at()), () => map.current?.recenter())}
          onFinish={() => void finishHunt(activeHunt)} onClose={() => setKeeperOpen(false)} />}
        {you && openGuide && <GuideCard hunt={openGuide.hunt} near={atGuide(openGuide.hunt, at())} busy={busy}
          onStart={() => startPrivate(openGuide.hunt)} onCollect={() => collectPrivate(openGuide.hunt)} onClose={() => setGuideOpen(null)} />}
        {you && !selected && !keeperOpen && !openGuide && gameCard && <GameCard card={gameCard} busy={busy} g={g} language={language} onChallenge={startLandmark}
          rackCount={RACKS && gameCard.waypost.kind === "common" ? gameCard.count ?? null : undefined} />}
        {you && !gameCard && !keeperOpen && !openGuide && (selected
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
        {!selected && !gameCard && !keeperOpen && !openGuide && homeDock}
      </View>
    </SafeAreaView>

    {devLetter && <View style={{ position: "absolute", left: spacing.md, right: spacing.md, bottom: insets.bottom + spacing.md, zIndex: 50, gap: spacing.sm, backgroundColor: "rgba(255,255,255,.97)", borderRadius: 22, padding: spacing.lg, borderWidth: 1, borderColor: C.line, ...shadows.card }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Avatar avatar={devLetter.publicCapsule.sender.avatar} size={36} />
        <Text style={{ flex: 1, fontFamily: sans, fontSize: 12, color: C.brass }}>{s("publicCapsuleFrom", devLetter.publicCapsule.sender.name)}</Text>
      </View>
      <Text style={{ fontFamily: serif, fontSize: 17, lineHeight: 26, color: C.ink }}>{devLetter.message}</Text>
      <Pressable accessibilityRole="button" onPress={() => setDevLetter(null)} style={{ alignItems: "center", backgroundColor: C.blue, borderRadius: radii.pill, paddingVertical: 11 }}>
        <Text style={{ fontFamily: serif, fontSize: 15, color: C.white }}>{g("close")}</Text>
      </Pressable>
    </View>}
    {exploring && !huntCity && !playing && <CityExplorer day={puzzleDay} hunt={TODAYS_HUNT ? huntDays : undefined} index={cityIndex} onIndex={setCityIndex} balls={gameState?.wax_balls ?? null} language={language}
      header={homeBar} footer={homeDock} onClose={toExplore} onPlay={(c) => TODAYS_HUNT ? setHuntCity(c.id) : setPlaying(c.id)} />}
    {exploring && huntCity && <TodaysHuntScreen city={CITIES.find((c) => c.id === huntCity)!} language={language} map={map} gameState={gameState}
      onState={setGameState} onMap={setHuntMap} onFinish={() => void loadGame()} onClose={closeHunt} />}
    {exploring && playingCity && playingPuzzle && <PriceGuessScreen city={playingCity} puzzle={playingPuzzle} streak={puzzleDay?.streak ?? 0} language={language}
      onResult={onGuess} onClose={() => setPlaying(null)} />}
    {waypostOpen && <WaypostScreen key={waypostOpen.waypost.id} waypost={waypostOpen.waypost} meters={waypostOpen.meters} at={at} language={language}
      onState={setGameState}
      onSpun={() => void loadGame().then(() => setWaypostOpen((o) => o && { ...o, waypost: nearbyRef.current.wayposts.find((w) => w.id === o.waypost.id) ?? o.waypost }))}
      onSampleLetter={RACK_SAMPLE ? (publicCapsule, message) => setDevLetter({ publicCapsule, message }) : undefined}
      onClose={() => { setWaypostOpen(null); void loadGame(); }} />}
    {throwing && gameState && <DodgeFightScreen key={throwing.id} capsule={throwing} landmark={dodgeLandmark} avatar={profile?.avatar}
      state={gameState} onState={setGameState} onClose={closeFight} />}
    <Passport visible={passport} onClose={() => setPassport(false)} userId={userId} stamps={stampRows}
      hunts={[...huntStamps, ...(__DEV__ && !userId ? hunts.previewStamps() : []).filter((p) => !huntStamps.some((x) => x.id === p.id))]}
      privateHunts={[...privateHuntStamps, ...(__DEV__ && !userId ? privateHunts.demoStamps() : [])]} />
    <QuestSheet visible={questOpen} hunts={huntList} busy={busy} onClose={() => setQuestOpen(false)} onJoin={(x) => void joinHunt(x)} onShowOnMap={showHunt}
      located={activeHunt ? { huntId: activeHunt.id, quests: cityQuests } : undefined}
      onOpenQuest={(x, quest) => { setQuestOpen(false); setSelectedId(null); setGameCard(null); map.current?.focus(quest.location_lat, quest.location_lng); setPinQuest({ kind: "city", hunt: x, quest }); }}
      privateTab={{
        count: privateList.length,
        onEnterCode: () => { setQuestOpen(false); setLinkCode(null); setJoinFound(null); setJoinError(null); setJoinOpen(true); },
        onMyHunts: organizer.canCreate(profile) ? () => { setQuestOpen(false); router.push("/hunts"); } : undefined,
        children: privateList.map((ph) => <PrivateHuntCard key={ph.id} hunt={ph} busy={busy}
          onShowOnMap={showQuests} onCollect={collectPrivate} onLeaderboard={showLeaderboard} onReport={reportPrivate}
          onOpenQuest={(x, w) => { setQuestOpen(false); setQuestError(null); setQuestResult(null); setQuest({ hunt: x.id, quest: w.id }); if (placed(w)) map.current?.focus(w.location_lat, w.location_lng); }} />),
      }} />
    <JoinPrivateSheet visible={joinOpen} initialCode={linkCode} found={joinFound} busy={busy} error={joinError}
      onClose={() => setJoinOpen(false)} onFind={findCode} onJoin={joinPrivate} />
    {pinQuest && <QuestPlay quest={pinQuest.quest} zh={language === "zh"} meters={metersTo(pinQuest.quest.location_lat, pinQuest.quest.location_lng)}
      onAttempt={(answer?: QuestAnswer) => {
        if (!fix) return Promise.reject(Object.assign(new Error("too_far"), { code: "too_far" }));
        const payload = { quest_id: pinQuest.quest.quest_id, lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy ?? null, answer };
        const run = pinQuest.kind === "route" ? routes.attempt(pinQuest.capsuleId, payload) : cityHuntQuests.attempt(pinQuest.hunt, payload);
        return run.finally(() => refreshPinQuests());
      }}
      // The catch releases or the Landmark fight show up through the usual game refresh.
      onStarted={() => void loadGame()}
      onClose={() => { setPinQuest(null); refreshPinQuests(); }} />}
    {openPrivateHunt && openQuest && <QuestScreen hunt={openPrivateHunt} quest={openQuest} result={questResult}
      meters={placed(openQuest) ? metersTo(openQuest.location_lat, openQuest.location_lng) : Infinity} busy={busy} error={questError}
      tries={openQuest.tries ? 3 - (openQuest.tries % 3) : undefined}
      onClose={() => { setQuest(null); setQuestError(null); setQuestResult(null); }}
      onComplete={(answer, qr) => completeQuest(openPrivateHunt, openQuest, answer, qr)} />}
    <LeaderboardSheet visible={!!board} hunt={board?.hunt ?? null} rows={board?.rows ?? null} onClose={() => setBoard(null)} />
  </JourneyViewport>;
}

const FILTER_LABEL = { capsules: "filterCapsules", cityHunt: "filterCityHunt", privateHunt: "filterPrivateHunt" } as const;
