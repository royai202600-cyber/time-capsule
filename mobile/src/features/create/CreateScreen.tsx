import { GAME_ENABLED } from "../../services/game";
import { canUseVessel as canAccessVessel, isCollected, showVesselInShop } from "../../services/vesselAccess";
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, ImageBackground, PanResponder, Keyboard, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { GestureDetector, useNativeGesture, usePanGesture } from 'react-native-gesture-handler';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { goBack } from "../../navigation";
import { pickPhoto } from '../../components/pickPhoto';
import { useSharedValue, withSpring } from 'react-native-reanimated';
import { Avatar } from '../../components/Avatar';
import { Vessel, type VesselKind } from '../../components/Vessel';
import { Screen, Button, Heading, Body } from '../../components/Screen';
import { Toast } from '../../components/Toast';
import { haptics } from '../../components/haptics';
import { useLanguage } from '../../i18n';
import { useReducedMotion } from '../../useReducedMotion';
import { useAuth } from '../../services/auth';
import { capsules } from '../../services/data';
import { useFriends, useOwnedVessels, usePlaces, useVessels } from '../../services/hooks';
import { C, handwriting, motion, serif, sans, shadows } from '../../theme';
import { DrawingPad, type DrawingHandle, type DrawingStrokes } from './DrawingPad';
import { letterDropFor, paperLetter, scenes, sealWax } from '../../art/manifest';
import { ArtIcon } from '../../components/ArtIcon';
import { SealLoader } from '../../components/SealLoader';
import { WaxSteps } from '../../components/WaxSteps';
import { VoiceRecorder } from '../voice/VoiceRecorder';
import { uploadVoice, VOICE_ENABLED, type VoiceClip } from '../../services/voice';
import { PREDICTION_ENABLED, predictionSendArgs, type CapsuleKind } from '../../services/prediction';
import { PredictionInput } from '../prediction/PredictionParts';
import { Chip, Glyph, MonthCalendar, PickerRow, Sheet, SheetGroup, SheetOption, ToolIcon, VESSEL_CATEGORIES, vesselCategory, type ToolKind, type VesselCategory } from './CreateParts';
import { usePredictionText } from '../prediction/strings';
import { DRIFT_CHOICES, publicCapsule, PublicCapsuleError, PUBLIC_CAPSULE_ENABLED, PUBLIC_CAPSULE_MESSAGE_MAX, PUBLIC_CAPSULE_AVATAR, PUBLIC_CAPSULE_RECIPIENT, type DriftDays, type ThrowResult } from '../../services/publicCapsule';
import { shortDate, usePublicCapsuleText } from '../publicCapsule/strings';
import { openingCoordinates, useForegroundLocation } from '../journey/location';
import { placeLabel, pointPlaceArgs, reversePlace, searchPlaces, type PointPlace } from '../../services/places';

type Quick = 'd1' | 'w1' | 'm1' | 'm6' | 'y1' | 'y5' | 'custom' | 'dev';
// The blocks a capsule can hold. Today's backend keeps one of each, and text or handwriting (docs/design/create-v2.md).
type Block = 'text' | 'voice' | 'photo' | 'hand' | 'predict';
const BLOCKS: Block[] = ['text', 'voice', 'photo', 'hand', 'predict'];
const BLOCK_ICON: Record<Block, ToolKind> = { text: 'text', voice: 'voice', photo: 'photo', hand: 'hand', predict: 'predict' };
const BLOCK_LABEL: Record<Block, string> = { text: 'create2.tText', voice: 'create2.tVoice', photo: 'create2.tPhoto', hand: 'create2.tHand', predict: 'create2.tPredict' };
// Public capsules still use public-capsule availability delays, so their time list maps onto them.
const PUBLIC_CAPSULE_QUICK: Quick[] = ['d1', 'w1', 'm1', 'y1'];
const PUBLIC_CAPSULE_DELAY: Partial<Record<Quick, DriftDays>> = { d1: 1, w1: 7, m1: 30, y1: 365 };
const quickDate = (q: Quick) => { const d = new Date(); if (q === 'd1') d.setDate(d.getDate() + 1); if (q === 'w1') d.setDate(d.getDate() + 7); if (q === 'm1') d.setMonth(d.getMonth() + 1); if (q === 'm6') d.setMonth(d.getMonth() + 6); if (q === 'y1') d.setFullYear(d.getFullYear() + 1); if (q === 'y5') d.setFullYear(d.getFullYear() + 5); if (q === 'dev') d.setMinutes(d.getMinutes() + 2); return d; };
const dateValue = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const customDate = (s: string) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null; const d = new Date(`${s}T12:00:00`); return dateValue(d) === s && d.getTime() > Date.now() ? d : null; };
const PLACEHOLDER = '#A5AFBD';
const card = { borderWidth: 1.5, borderColor: C.line, backgroundColor: C.white, borderRadius: 16, padding: 14 } as const;
const label = { fontFamily: sans, color: C.ink } as const;
// The letter's centre is at stage y=125; these drops meet each vessel's opening at stage y=270–325.

export default function CreateScreen() {
  const { t, language } = useLanguage();
  const { session, profile, loading: authLoading } = useAuth();
  const params = useLocalSearchParams<{ to?: string; recipient?: string; kind?: string }>();
  const p = usePredictionText();
  const st = usePublicCapsuleText();
  // A prediction is a block on the page; a capsule holding one is sent as a prediction capsule.
  const [blocks, setBlocks] = useState<Block[]>(PREDICTION_ENABLED && params.kind === 'prediction' ? ['predict'] : ['text']), [prediction, setPrediction] = useState('');
  const predicting = PREDICTION_ENABLED && blocks.includes('predict');
  const kind: CapsuleKind = predicting ? 'prediction' : 'letter';
  const startsWithPublicCapsule = PUBLIC_CAPSULE_ENABLED && params.to === PUBLIC_CAPSULE_RECIPIENT;
  const id = session?.user.id ?? '';
  const friends = useFriends(id), catalog = useVessels(), owned = useOwnedVessels(id), places = usePlaces();
  const reduced = useReducedMotion();
  const [stepIndex, setStepIndex] = useState(1), [recipient, setRecipient] = useState<string | null>(((params.to ?? params.recipient) === 'future' ? session?.user.id : (params.to ?? params.recipient)) ?? session?.user.id ?? null);
  const [message, setMessage] = useState(''), [hint, setHint] = useState(''), [drawingData, setDrawingData] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null), [photoChoices, setPhotoChoices] = useState(false), [voice, setVoice] = useState<VoiceClip | null>(null);
  const voicePath = useRef<{ uri: string; path: string } | null>(null);
  const [vessel, setVessel] = useState<VesselKind | null>(null), [place, setPlace] = useState<string | null>(null);
  const hasText = blocks.includes('text'), hasHand = blocks.includes('hand');
  const [quick, setQuick] = useState<Quick>(startsWithPublicCapsule ? 'd1' : 'y1'), [dateText, setDateText] = useState('');
  const driftDays: DriftDays = PUBLIC_CAPSULE_DELAY[quick] ?? 7;
  const [publicCapsuleResult, setPublicCapsuleResult] = useState<ThrowResult | null>(null);
  // Where: anywhere, the sender's current spot, or a specific place (one of our landmarks or a searched address).
  const [placeMode, setPlaceMode] = useState<'anywhere' | 'current' | 'specific'>('anywhere'), [point, setPoint] = useState<PointPlace | null>(null);
  const [placeQuery, setPlaceQuery] = useState(''), [placeResults, setPlaceResults] = useState<PointPlace[]>([]), [searching, setSearching] = useState(false);
  const location = useForegroundLocation(placeMode === 'current');
  useEffect(() => {
    if (placeMode !== 'current' || !location.fix || point) return;
    const here = { lat: location.fix.lat, lng: location.fix.lng };
    setPoint({ name: t('create2.findingName'), detail: `${here.lat.toFixed(4)}, ${here.lng.toFixed(4)}`, ...here });
    // Name the spot from the map, so the card and the recipient read "Civic Square, Xinyi, Taipei" rather than "Where I am now".
    reversePlace(here, language).then(found => {
      if (found) setPoint(old => old && old.lat === here.lat && old.lng === here.lng ? found : old);
    }).catch(() => {});
  }, [placeMode, location.fix, point]);
  useEffect(() => {
    if (placeMode !== 'specific' || placeQuery.trim().length < 2) { setPlaceResults([]); setSearching(false); return; }
    let live = true; setSearching(true);
    const timer = setTimeout(() => {
      searchPlaces(placeQuery, location.fix).then(r => { if (live) setPlaceResults(r); }).catch(() => { if (live) setPlaceResults([]); }).finally(() => { if (live) setSearching(false); });
    }, 400);
    return () => { live = false; clearTimeout(timer); };
  }, [placeMode, placeQuery]);
  const [sheet, setSheet] = useState<'to' | 'when' | 'where' | null>(null), [vesselQuery, setVesselQuery] = useState(''), [vesselCat, setVesselCat] = useState<'all' | VesselCategory>('all');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [phase, setPhase] = useState<'steps' | 'seal' | 'sealed'>('steps'), [sealedAt, setSealedAt] = useState<Date | null>(null), [stamped, setStamped] = useState(false);
  const drawing = useRef<DrawingHandle>(null);
  const drawingStrokes = useRef<DrawingStrokes>([]);
  const sentOnce = useRef(false);
  const sendingRef = useRef(false);
  const wax = useRef(new Animated.ValueXY()).current, waxScale = useRef(new Animated.Value(1)).current, letter = useRef(new Animated.Value(1)).current, letterNarrow = useRef(new Animated.Value(1)).current, letterDrop = useRef(new Animated.Value(0)).current, letterEntry = useRef(new Animated.Value(44)).current, letterOpacity = useRef(new Animated.Value(0)).current, letterFade = useRef(new Animated.Value(1)).current, drift = useRef(new Animated.Value(0)).current;
  const lidLift = useSharedValue(1);
  const [sealTouched, setSealTouched] = useState(false);
  const dragActive = useRef(false);
  const dragOrigin = useRef({ x: 0, y: 0 });
  const dragDelta = useRef({ x: 0, y: 0 });
  const hintFade = useRef(new Animated.Value(1)).current;
  const hintCycle = useRef(new Animated.Value(0)).current;
  const idleNudge = useRef(new Animated.Value(0)).current;
  const sealNear = useRef(new Animated.Value(0)).current;
  const targetPulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (phase !== 'seal' || stamped || reduced) return;
    targetPulse.setValue(0);
    const loop = Animated.loop(Animated.timing(targetPulse, { toValue: 1, duration: 2000, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [phase, stamped, reduced, targetPulse]);
  // The seal went back to its starting spot without sealing: bring the guide back.
  const restoreHint = () => { setSealTouched(false); Animated.timing(hintFade, { toValue: 1, duration: motion.fade.quick, useNativeDriver: true }).start(); };
  useEffect(() => {
    if (phase !== 'seal') return;
    setSealTouched(false); hintFade.setValue(1); sealNear.setValue(0);
  }, [phase, hintFade, sealNear]);
  useEffect(() => {
    if (phase !== 'seal' || stamped || sealTouched || reduced) return;
    hintCycle.setValue(0); idleNudge.setValue(0);
    const lights = Animated.loop(Animated.timing(hintCycle, { toValue: 3, duration: 1200, easing: Easing.linear, useNativeDriver: true }));
    const nudge = Animated.loop(Animated.sequence([
      Animated.delay(1500),
      Animated.spring(idleNudge, { toValue: -8, ...motion.spring.soft, useNativeDriver: true }),
      Animated.spring(idleNudge, { toValue: 0, ...motion.spring.soft, useNativeDriver: true }),
    ]));
    lights.start(); nudge.start();
    return () => { lights.stop(); nudge.stop(); };
  }, [phase, stamped, sealTouched, reduced, hintCycle, idleNudge]);
  useEffect(() => {
    if (sealTouched || reduced) Animated.timing(idleNudge, { toValue: 0, duration: motion.fade.quick, useNativeDriver: true }).start();
  }, [sealTouched, reduced, idleNudge]);
  useEffect(() => { if ((!recipient || recipient === 'future') && id) setRecipient(id); }, [id, recipient]);
  useEffect(() => {
    if (phase !== 'seal') return;
    letterEntry.setValue(reduced ? 0 : 44);
    letterOpacity.setValue(0);
    letterFade.setValue(1);
    Animated.parallel([
      reduced ? Animated.timing(letterEntry, { toValue: 0, duration: motion.fade.quick, useNativeDriver: true }) : Animated.spring(letterEntry, { toValue: 0, ...motion.spring.soft, restDisplacementThreshold: 1, restSpeedThreshold: 2, useNativeDriver: true }),
      Animated.timing(letterOpacity, { toValue: 1, duration: motion.fade.quick, useNativeDriver: true }),
    ]).start();
  }, [phase, reduced]);
  useFocusEffect(useCallback(() => { void owned.refresh(); void catalog.refresh(); }, [id]));
  const chosenVessel = catalog.data?.find(v => v.id === vessel);
  // Earned (landmark) vessels are only usable once earned by opening a capsule at their place.
  const ownsVessel = (id: string) => !!owned.data?.some(o => o.vessel === id);
  // Once the game is on, you send what you've collected plus the four starters.
  const canUseVessel = (v: { id: string; price_mop: number }) => GAME_ENABLED ? isCollected(v, ownsVessel(v.id), true) : canAccessVessel(v, ownsVessel(v.id));
  const selectedPlace = places.data?.find(p => p.id === place);
  const recipientRow = friends.data?.find(f => f.friend_id === recipient);
  // A public capsule is an ordinary capsule addressed to whoever passes by: typed only, available after its delay.
  const toPublicCapsule = PUBLIC_CAPSULE_ENABLED && recipient === PUBLIC_CAPSULE_RECIPIENT;
  // Everything left in public is a bottle, so it can't be mistaken for a Corrupted Capsule.
  const wasPublicCapsule = useRef(toPublicCapsule);
  useEffect(() => {
    if (toPublicCapsule) setVessel('bottle');
    else if (wasPublicCapsule.current) setVessel(null);
    wasPublicCapsule.current = toPublicCapsule;
  }, [toPublicCapsule]);
  // Private: To → Message → Vessel → When & where. Public (from the map): Message → When & where.
  const flow = toPublicCapsule ? [2, 4] : [1, 2, 3, 4];
  const step = flow[stepIndex - 1] ?? flow[0];
  const recipientName = toPublicCapsule ? st('toPublicCapsule') : recipient === id ? t('create.self') : ((recipientRow as any)?.profiles?.name ?? '');
  const openAt = toPublicCapsule ? new Date(Date.now() + driftDays * 86_400_000) : quick === 'custom' ? customDate(dateText) : quickDate(quick);
  const formatted = (sealedAt ?? openAt)?.toLocaleDateString(language === 'zh' ? 'zh-Hant' : 'en', { year: 'numeric', month: 'long', day: 'numeric', hour: quick === 'dev' ? 'numeric' : undefined, minute: quick === 'dev' ? '2-digit' : undefined }) ?? dateText;
  const placeName = selectedPlace ? (language === 'zh' ? selectedPlace.name_zh : selectedPlace.name_en) : '';
  const validate = () => {
    if (!recipient) return t('create.needRecipient');
    if (step >= 2 && predicting && !prediction.trim()) return p('need');
    if (step >= 2 && toPublicCapsule && !message.trim()) return t('create.needMessage');
    if (step >= 4 && toPublicCapsule && !openingCoordinates()) return st('needLocation');
    // Text and handwriting can sit together; one of them (or a prediction) must have content.
    const inked = hasHand && (step === 2 ? !!drawing.current?.hasInk() : !!drawingData);
    if (step >= 2 && !predicting && !(hasText && message.trim()) && !inked) return t('create.needMessage');
    if (step >= 3 && !vessel) return t('create.chooseFirst');
    if (step >= 3 && chosenVessel && !canUseVessel(chosenVessel)) return t('create.notOwned');
    if (step >= 4 && !openAt) return t('create.badDate');
    if (step >= 4 && !toPublicCapsule && placeMode === 'current' && !point) return t('create2.needHere');
    if (step >= 4 && !toPublicCapsule && placeMode === 'specific' && !place && !point) return t('create2.needPlace');
    return '';
  };
  const saveDrawingDraft = () => {
    if (drawing.current) drawingStrokes.current = drawing.current.getStrokes();
  };
  const next = async () => { const issue = validate(); if (issue) { setError(issue); void haptics.warn(); return; } if (step === 2 && hasHand) { saveDrawingDraft(); try { setDrawingData(drawing.current?.hasInk() ? await drawing.current.png() ?? null : null); } catch { setError(t('create.sendError')); return; } } setError(''); Keyboard.dismiss(); void haptics.tap(); if (step === 2 && predicting && !vessel) { const cookie = catalog.data?.find(v => v.id === 'fortune-cookie'); if (cookie && canUseVessel(cookie)) setVessel('fortune-cookie'); } if (stepIndex < flow.length) setStepIndex(stepIndex + 1); else setPhase('seal'); };
  const choosePhoto = async (source: 'camera' | 'library') => {
    setPhotoChoices(false); setError('');
    try {
      const image = await pickPhoto(source);
      if (image === 'denied') { setError(t('create.photoPermission')); return; }
      if (image) { setPhoto(image); void haptics.tick(); }
    } catch { setError(t('create.photoError')); void haptics.warn(); }
  };
  const finishAnimation = () => {
    const complete = () => { setPhase('sealed'); void haptics.success(); };
    if (reduced) { Animated.timing(drift, { toValue: 1, duration: motion.fade.quick, useNativeDriver: true }).start(complete); return; }
    const driftAway = () => Animated.timing(drift, { toValue: 1, duration: 550, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(complete);
    const closeLid = () => {
      void haptics.thump();
      lidLift.value = withSpring(0, motion.spring.heavy);
      setTimeout(driftAway, 250);
    };
    const dropLetter = () => Animated.parallel([
      Animated.timing(letterDrop, { toValue: letterDropFor(vessel ?? 'dome'), duration: 550, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(letterNarrow, { toValue: .24, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(letterFade, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]),
    ]).start(closeLid);
    Animated.sequence([
      Animated.spring(letter, { toValue: .65, ...motion.spring.soft, restDisplacementThreshold: .05, restSpeedThreshold: 2, useNativeDriver: true }),
      Animated.spring(letter, { toValue: .16, ...motion.spring.soft, restDisplacementThreshold: .05, restSpeedThreshold: 2, useNativeDriver: true }),
    ]).start(dropLetter);
  };
  const sendRef = useRef<() => void>(() => {});
  const send = async () => {
    if (sendingRef.current || sentOnce.current || !recipient || !vessel || !openAt) return;
    setSealTouched(true);
    Animated.timing(hintFade, { toValue: 0, duration: motion.fade.quick, useNativeDriver: true }).start();
    sendingRef.current = true;
    setBusy(true); setError('');
    void (reduced ? haptics.tap() : haptics.thump());
    let contactMotion: Animated.CompositeAnimation | undefined;
    const contact = reduced ? Promise.resolve() : new Promise<void>(resolve => { contactMotion = Animated.parallel([
      Animated.spring(wax, { toValue: { x: 0, y: -348 }, ...motion.spring.snappy, restDisplacementThreshold: 1, restSpeedThreshold: 3, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(waxScale, { toValue: 1.25, duration: motion.fade.quick, useNativeDriver: true }),
        Animated.timing(waxScale, { toValue: .95, duration: motion.fade.quick, useNativeDriver: true }),
        Animated.timing(waxScale, { toValue: 1, duration: motion.fade.quick, useNativeDriver: true }),
      ]),
    ]); contactMotion.start(() => resolve()); });
    try {
      if (toPublicCapsule) {
        const thrown = await publicCapsule.dropPublicCapsule({ message, hint: hint.trim() || t('create.hintDefault'), vessel, driftDays, at: openingCoordinates() });
        setPublicCapsuleResult(thrown);
        sentOnce.current = true;
        setSealedAt(new Date(thrown.available_at));
        await contact;
        setStamped(true);
        finishAnimation();
        return;
      }
      const ink = hasHand ? drawingData : null;
      if (!ink && !(hasText && message.trim()) && !predicting) throw new Error('empty drawing');
      // Upload once per recording; a retried send reuses the same pending path.
      let voiceArgs = {};
      if (voice) {
        if (voicePath.current?.uri !== voice.uri) {
          try { voicePath.current = { uri: voice.uri, path: await uploadVoice(id, voice) }; }
          catch { throw new Error('voice upload'); }
        }
        voiceArgs = { p_voice: voicePath.current.path, p_voice_ms: Math.round(voice.durationMs) };
      }
      // Never save a placeholder as the place: look the name up once more, or fall back to the coordinates.
      let sendPoint = point;
      if (placeMode === 'current' && point && point.name === t('create2.findingName')) {
        sendPoint = await reversePlace(point, language).catch(() => null) ?? { ...point, name: `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}` };
      }
      const { data: capsuleId, error: rpcError } = await capsules.send({ p_recipient: recipient, p_vessel: vessel, p_message: hasText ? message.trim() : '', p_drawing: ink ?? undefined, p_photo: photo ?? undefined, p_hint: hint.trim() || t('create.hintDefault'), p_open_at: openAt.toISOString(), ...(placeMode !== 'anywhere' && sendPoint ? pointPlaceArgs(sendPoint) : { p_place: place ?? undefined }), ...voiceArgs, ...predictionSendArgs(kind, prediction) });
      if (rpcError) throw rpcError;
      sentOnce.current = true;
      setSealedAt(openAt);
      await contact;
      setStamped(true);
      finishAnimation();
    } catch (e) {
      contactMotion?.stop();
      wax.stopAnimation(); waxScale.stopAnimation();
      const msg = String((e as any)?.message ?? e).toLowerCase(), code = String((e as any)?.hint ?? '');
      if (e instanceof PublicCapsuleError) setError(e.code === 'rejected' ? st('errRejected') : e.code === 'no_spot' ? st('errNoSpot') : t('create.sendError'));
      else setError(code === 'not_owned' || msg.includes('not owned') ? t('create.notOwned') : code === 'brand_place' || msg.includes('brand vessel') ? t('create.brandRefusal') : msg.includes('not a friend') ? t('create.friendRefusal') : msg.includes('open time must be in the future') ? t('create.badDate') : msg.includes('voice') ? t('voice.uploadError') : t('create.sendError'));
      if (reduced) wax.setValue({ x: 0, y: 0 });
      else Animated.parallel([
        Animated.spring(wax, { toValue: { x: 0, y: 0 }, ...motion.spring.soft, useNativeDriver: true }),
        Animated.spring(waxScale, { toValue: 1, ...motion.spring.soft, useNativeDriver: true }),
      ]).start();
      sealNear.setValue(0); restoreHint();
      void haptics.warn();
    } finally { sendingRef.current = false; setBusy(false); }
  };
  sendRef.current = () => { void send(); };
  const snapBack = () => {
    sealNear.stopAnimation();
    Animated.timing(sealNear, { toValue: 0, duration: motion.fade.quick, useNativeDriver: false }).start();
    if (reduced) wax.setValue({ x: 0, y: 0 });
    else Animated.spring(wax, { toValue: { x: 0, y: 0 }, ...motion.spring.soft, useNativeDriver: true }).start();
    restoreHint();
  };
  // Keep a stable responder while its callbacks read the current Reduce Motion/state.
  const gesture = useRef({ grant: () => {}, move: (_dx: number, _dy: number) => {}, release: (_dx: number, _dy: number) => {}, cancel: () => {} });
  gesture.current = {
    grant: () => {
      if (sentOnce.current || sendingRef.current) return;
      dragActive.current = true; dragDelta.current = { x: 0, y: 0 };
      setSealTouched(true);
      sealNear.stopAnimation(); waxScale.stopAnimation(); idleNudge.stopAnimation(); idleNudge.setValue(0);
      wax.stopAnimation(position => {
        if (!dragActive.current) return;
        dragOrigin.current = position;
        wax.setValue({ x: position.x + dragDelta.current.x, y: position.y + dragDelta.current.y });
      });
      Animated.timing(hintFade, { toValue: 0, duration: motion.fade.quick, useNativeDriver: true }).start();
    },
    move: (dx, dy) => {
      if (!dragActive.current || sentOnce.current || sendingRef.current) return;
      dragDelta.current = { x: dx, y: dy };
      const x = dragOrigin.current.x + dx, y = dragOrigin.current.y + dy;
      wax.setValue({ x, y });
      // Proximity is JS-driven throughout; never hand this value to the native driver.
      sealNear.setValue(Math.max(0, 1 - Math.hypot(x, y + 348) / 180));
    },
    release: (dx, dy) => {
      dragActive.current = false;
      if (sentOnce.current || sendingRef.current) return;
      const x = dragOrigin.current.x + dx, y = dragOrigin.current.y + dy;
      if (y < -160 && Math.abs(x) < 130) sendRef.current();
      else snapBack();
    },
    cancel: () => {
      dragActive.current = false;
      if (!sentOnce.current && !sendingRef.current) snapBack();
    },
  };
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => !sentOnce.current && !sendingRef.current,
    onMoveShouldSetPanResponder: () => !sentOnce.current && !sendingRef.current,
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
    onPanResponderGrant: () => gesture.current.grant(),
    onPanResponderMove: (_, g) => gesture.current.move(g.dx, g.dy),
    onPanResponderRelease: (_, g) => gesture.current.release(g.dx, g.dy),
    onPanResponderTerminate: () => gesture.current.cancel(),
  })).current;

  const sealScrollGesture = useNativeGesture({});
  const drawScrollGesture = useNativeGesture({});
  const sealPanGesture = usePanGesture({
    minDistance: 0,
    runOnJS: true,
    shouldCancelWhenOutside: false,
    block: sealScrollGesture,
    onBegin: () => gesture.current.grant(),
    onUpdate: event => gesture.current.move(event.translationX, event.translationY),
    onDeactivate: event => {
      if (event.canceled) gesture.current.cancel();
      else gesture.current.release(event.translationX, event.translationY);
    },
    onFinalize: () => { if (dragActive.current) gesture.current.cancel(); },
  });
  const waxControl = <Animated.View {...(Platform.OS === 'web' ? pan.panHandlers : {})} accessible accessibilityRole='button' accessibilityLabel={t('create.drag')} accessibilityActions={[{ name: 'activate', label: t('create.sealSend') }]} onAccessibilityAction={() => sendRef.current()} style={{ width: 76, height: 76, justifyContent: 'center', alignItems: 'center', transform: [...wax.getTranslateTransform(), { scale: waxScale }, { translateY: idleNudge }] }}><Image source={sealWax} style={{ width: 76, height: 76 }} resizeMode="contain" /></Animated.View>;
  if (authLoading) return <Screen><SealLoader size={44} label={t('create.loading')} /></Screen>;
  if (!session) return <Screen><Body>{t('create.signIn')}</Body><Button title={t('create.close')} onPress={() => router.replace('/')} /></Screen>;
  if (phase === 'seal') return <Screen dragContent scrollGesture={sealScrollGesture} scrollEnabled={!busy}>
    <Heading>{t('create.sealSend')}</Heading>
    <View style={{ height: 570, width: '100%' }}>
      <Animated.View style={{ position: 'absolute', zIndex: 2, top: 20, left: '6%', width: '88%', height: 210, transform: [{ translateY: letterDrop }, { translateY: letterEntry }], opacity: Animated.multiply(Animated.multiply(letterOpacity, letterFade), drift.interpolate({ inputRange: [0, 1], outputRange: [1, 0] })) }}><Animated.View style={[card, { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', transform: [{ scaleY: letter }, { scaleX: letterNarrow }] }]}>
        <Text style={{ color: C.muted, fontFamily: handwriting, fontSize: 19 }}>{recipientName}</Text><View style={{ width: '75%', marginTop: 28, gap: 18 }}><View style={{ borderBottomWidth: 1, borderColor: C.line }} /><View style={{ borderBottomWidth: 1, borderColor: C.line }} /><View style={{ borderBottomWidth: 1, borderColor: C.line }} /></View>
        {stamped && <View style={{ position: 'absolute', top: 83, left: 0, right: 0, alignItems: 'center' }}><Image source={sealWax} style={{ width: 70, height: 70 }} resizeMode="contain" /></View>}
        {!stamped && <View pointerEvents="none" style={{ position: 'absolute', top: 83, left: 0, right: 0, alignItems: 'center' }}><View style={{ width: 70, height: 70, alignItems: 'center', justifyContent: 'center' }}>
          {/* Brass ripple spreading out from where the wax goes, like warm wax settling. */}
          {!reduced && <Animated.View style={{ position: 'absolute', width: 70, height: 70, borderRadius: 35, borderWidth: 1.5, borderColor: C.brass, opacity: targetPulse.interpolate({ inputRange: [0, 1], outputRange: [.5, 0] }), transform: [{ scale: targetPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] }) }] }} />}
          <Animated.View style={{ width: 70, height: 70, borderRadius: 35, borderWidth: 1.5, borderColor: C.brass, backgroundColor: 'rgba(201,161,90,0.08)', alignItems: 'center', justifyContent: 'center', opacity: sealNear.interpolate({ inputRange: [0, 1], outputRange: [.7, 1] }), transform: [{ scale: sealNear.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) }] }}>
            {/* A faint impression of the seal shows exactly what goes here. */}
            <Animated.Image source={sealWax} style={{ width: 58, height: 58, opacity: sealNear.interpolate({ inputRange: [0, 1], outputRange: [.2, .45] }) }} resizeMode="contain" />
          </Animated.View>
        </View></View>}
      </Animated.View></Animated.View>
      <Animated.View style={{ position: 'absolute', top: 270, left: 0, right: 0, alignItems: 'center', transform: [{ translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -120] }) }, { scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1, .5] }) }], opacity: drift.interpolate({ inputRange: [0, .8, 1], outputRange: [1, 1, 0] }) }}><Vessel kind={vessel ?? 'dome'} size={120} lidLift={lidLift} /></Animated.View>
      {!stamped && <Animated.View pointerEvents="none" style={{ position: 'absolute', zIndex: 3, top: 398, left: 0, right: 0, alignItems: 'center', gap: 5, opacity: hintFade }}>{[2, 1, 0].map(i => <Animated.View key={i} style={{ width: 12, height: 12, borderTopWidth: 2.5, borderLeftWidth: 2.5, borderColor: C.brass, transform: [{ rotate: '45deg' }], opacity: reduced ? .45 : hintCycle.interpolate({ inputRange: [i, i + .5, i + 1], outputRange: [.35, 1, .35], extrapolate: 'clamp' }) }} />)}</Animated.View>}
      {!stamped && <View style={{ position: 'absolute', zIndex: 10, elevation: 10, top: 448, left: 0, right: 0, alignItems: 'center' }}>{Platform.OS === 'web' ? waxControl : <GestureDetector gesture={sealPanGesture}>{waxControl}</GestureDetector>}</View>}
      <Text style={{ position: 'absolute', top: 534, left: 0, right: 0, textAlign: 'center', fontFamily: sans, color: C.muted }}>{busy || sentOnce.current ? t('create.sending') : t('create.drag')}</Text>
    </View>
    <Toast message={error} /><Button title={t('create.back')} onPress={() => { setPhase('steps'); setError(''); }} disabled={busy || sentOnce.current} />
  </Screen>;
  if (phase === 'sealed') return <Screen><View style={{ flex: 1, minHeight: 570, alignItems: 'center', justifyContent: 'center', gap: 18 }}><Image source={toPublicCapsule ? scenes.publicCapsuleSealed : scenes.sealed} style={{ width: '100%', height: 220 }} resizeMode="contain" /><Heading>{t('create.sealed')}</Heading><Body>{toPublicCapsule && publicCapsuleResult ? st('publicCapsuleSealed', language === 'zh' ? publicCapsuleResult.spot_zh : publicCapsuleResult.spot_en, shortDate(publicCapsuleResult.available_at, language)) : predicting ? p('sealedBody', formatted, recipientName) : t('create.sealedBody', formatted, recipientName, placeName)}</Body><Button title={t('create.done')} onPress={() => router.replace({ pathname: '/', params: { tab: 'sent' } })} /></View></Screen>;
  const last = stepIndex === flow.length;
  const goTo = (n: number) => { saveDrawingDraft(); Keyboard.dismiss(); setStepIndex(n); setError(''); void haptics.tap(); };
  const blockOff = (b: Block) => blocks.includes(b) || (toPublicCapsule && b !== 'text') || (b === 'voice' && !VOICE_ENABLED) || (b === 'predict' && !PREDICTION_ENABLED);
  const addBlock = (b: Block) => { if (blockOff(b)) return; setBlocks([...blocks, b]); setError(''); void haptics.tick(); if (b === 'photo') setPhotoChoices(true); };
  const removeBlock = (b: Block) => {
    setBlocks(blocks.filter(x => x !== b)); void haptics.tap();
    if (b === 'text') setMessage('');
    if (b === 'hand') { drawing.current?.clear(); drawingStrokes.current = []; setDrawingData(null); }
    if (b === 'photo') { setPhoto(null); setPhotoChoices(false); }
    if (b === 'voice') setVoice(null);
    if (b === 'predict') setPrediction('');
  };
  const quickList: Quick[] = toPublicCapsule ? PUBLIC_CAPSULE_QUICK : ['d1', 'm1', 'm6', 'y1', 'y5', 'custom', ...(__DEV__ ? ['dev' as Quick] : [])];
  const quickLabel = (q: Quick) => t(q === 'd1' || q === 'w1' ? `create2.${q}` : `create.${q}`);
  const dateLabel = (d: Date | null) => d?.toLocaleDateString(language === 'zh' ? 'zh-Hant' : 'en', { year: 'numeric', month: 'long', day: 'numeric' }) ?? '';
  const friendName = (f: any) => f?.profiles?.name ?? '';
  const usableList = (catalog.data ?? []).filter(v => GAME_ENABLED ? canUseVessel(v) : showVesselInShop(v, ownsVessel(v.id)));
  const query = vesselQuery.trim().toLowerCase();
  const shownVessels = usableList.filter(v => (vesselCat === 'all' || vesselCategory(v) === vesselCat) && (!query || v.id.includes(query) || t(`shop.vessel.${v.id}`).toLowerCase().includes(query)));
  const cookie = catalog.data?.find(v => v.id === 'fortune-cookie');
  const insideSummary = blocks.filter(b => b !== 'predict' || predicting).map(b => t(BLOCK_LABEL[b])).join(' · ') || '—';
  const muted = { fontFamily: sans, color: C.muted, fontSize: 13, lineHeight: 20 } as const;
  const title = (text: string) => <Text style={{ fontFamily: serif, color: C.ink, fontSize: 23 }}>{text}</Text>;
  const sectionLabel = (text: string) => <Text style={{ fontFamily: sans, color: C.muted, fontSize: 12, letterSpacing: .7, marginBottom: -8 }}>{text}</Text>;

  const shownLandmarks = (places.data ?? []).filter(pl => { const q = placeQuery.trim().toLowerCase(); return !q || `${pl.name_zh} ${pl.name_en} ${pl.city_zh} ${pl.city_en}`.toLowerCase().includes(q); });
  const whereLabel = placeMode === 'anywhere' ? '' : selectedPlace ? placeName : point?.name ?? '';
  const placeCard = (name: string, detail: string) => <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12 }}>
    <Glyph><ToolIcon kind="landmark" color={C.wax} /></Glyph>
    <View style={{ flex: 1, gap: 2 }}><Text style={{ fontFamily: serif, color: C.ink, fontSize: 16 }}>{name}</Text>{!!detail && <Text style={muted}>{detail}</Text>}<Text style={{ fontFamily: sans, color: C.plum, fontSize: 12 }}>{t('create2.radius')}</Text></View>
  </View>;
  const header = <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6, gap: 8, backgroundColor: C.paper }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    <Pressable accessibilityRole='button' accessibilityLabel={stepIndex > 1 ? t('create.back') : t('create2.close')} onPress={() => { if (stepIndex > 1) goTo(stepIndex - 1); else goBack(); }}
      style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: C.line, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' }}>
      <ArtIcon name={stepIndex > 1 ? 'back' : 'close'} size={20} color={stepIndex > 1 ? C.ink : C.plum} />
    </Pressable>
    <Text numberOfLines={1} style={{ flex: 1, textAlign: 'center', fontFamily: serif, fontSize: 18, color: C.ink }}>{toPublicCapsule ? t('create2.pubTitle') : t('create.title')}</Text>
    <Pressable accessibilityRole='button' onPress={next} style={({ pressed }) => ({ borderRadius: 999, backgroundColor: last ? C.wax : C.blue, paddingHorizontal: 16, paddingVertical: 10, opacity: pressed ? .85 : 1 })}>
      <Text style={{ fontFamily: sans, color: C.white, fontSize: 15 }}>{last ? t('create2.send') : t('create.next')}</Text>
    </Pressable>
  </View>
    <View style={{ alignSelf: 'center', width: '100%', maxWidth: toPublicCapsule ? 220 : 400 }}>
      <WaxSteps step={stepIndex} label={t('create2.step', stepIndex, flow.length)} labels={flow.map(n => t(`create2.s${n}`))} onBack={goTo} labelSize={13} />
    </View>
    {/* Errors sit under the header, next to the Next / Send button that caused them. */}
    <Toast message={error || ((friends.error || catalog.error || places.error) ? t('create.noData') : '')} />
  </View>;

  const self = <View pointerEvents='none'><Avatar avatar={profile?.avatar} size={44} future /></View>;
  const whoFace = recipient === id ? self : <View pointerEvents='none'><Avatar avatar={(recipientRow as any)?.profiles?.avatar} size={44} /></View>;

  return <Screen scrollGesture={drawScrollGesture} header={header}>
    {step === 1 && <View style={{ gap: 16 }}>
      {title(t('create.who'))}
      {sectionLabel(t('create2.to'))}
      <PickerRow label={t('create2.to')} icon={whoFace} title={recipientName || t('create.self')} sub={recipient === id ? t('create2.futureSub') : t('create2.friendSub')} onPress={() => setSheet('to')} />
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 12, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: C.line, backgroundColor: C.white }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.glass, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 }}><ArtIcon name="lock" size={12} color={C.blue} /><Text style={{ fontFamily: sans, fontSize: 12, color: C.blue }}>{t('create2.private')}</Text></View>
        <Text style={{ flex: 1, fontFamily: sans, fontSize: 13, lineHeight: 20, color: C.ink }}>{t('create2.privateNote')}</Text>
      </View>
      <ImageBackground source={paperLetter} resizeMode='cover' imageStyle={{ borderRadius: 14 }} style={{ borderRadius: 14, borderWidth: 1, borderColor: C.line, paddingHorizontal: 20, paddingVertical: 22, gap: 6, overflow: 'hidden' }}>
        <Text style={{ fontFamily: serif, color: C.ink, fontSize: 18 }}><Text style={{ fontSize: 12, color: C.muted }}>{t('create2.envTo')}　</Text>{recipientName || t('create.self')}</Text>
        <Text style={{ fontFamily: serif, color: C.ink, fontSize: 18 }}><Text style={{ fontSize: 12, color: C.muted }}>{t('create2.envFrom')}　</Text>{t('create2.you')}</Text>
        <Image source={sealWax} style={{ position: 'absolute', right: 14, bottom: 10, width: 60, height: 60 }} resizeMode='contain' />
      </ImageBackground>
      {friends.loading && <SealLoader size={44} label={t('create.loading')} />}
    </View>}

    <View style={{ gap: 16, display: step === 2 ? 'flex' : 'none' }}>
      {title(t('create.write'))}
      <Text style={[muted, { marginTop: -8 }]}>{toPublicCapsule ? t('create2.pubLede') : t('create2.writeLede')}</Text>
      <ImageBackground source={paperLetter} resizeMode='cover' imageStyle={{ borderRadius: 6 }} style={{ borderRadius: 6, borderWidth: 1, borderColor: C.line, padding: 16, gap: 14, minHeight: 280, overflow: 'hidden' }}>
        {!blocks.length && <Text style={{ fontFamily: handwriting, color: C.muted, fontSize: 16, lineHeight: 27, textAlign: 'center', marginVertical: 'auto', paddingVertical: 40 }}>{t('create2.empty')}</Text>}
        {blocks.map(b => <View key={b} style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flex: 1, fontFamily: sans, fontSize: 11.5, letterSpacing: .5, color: C.muted }}>{t(BLOCK_LABEL[b])}</Text>
            <Pressable accessibilityRole='button' accessibilityLabel={t('create2.remove', t(BLOCK_LABEL[b]))} onPress={() => removeBlock(b)} hitSlop={8} style={{ paddingHorizontal: 6 }}><Text style={{ color: C.muted, fontSize: 14 }}>✕</Text></Pressable>
          </View>
          {b === 'text' && <><TextInput value={message} onChangeText={setMessage} placeholder={predicting ? p('letterPlaceholder') : t('create.message')} placeholderTextColor={PLACEHOLDER} maxLength={toPublicCapsule ? PUBLIC_CAPSULE_MESSAGE_MAX : 500} multiline textAlignVertical='top' style={{ minHeight: 120, fontFamily: serif, fontSize: 18, lineHeight: 30, color: C.ink, padding: 0 }} /><Text style={{ color: C.muted, textAlign: 'right', fontSize: 12 }}>{message.length} / {toPublicCapsule ? PUBLIC_CAPSULE_MESSAGE_MAX : 500}</Text></>}
          {b === 'hand' && <><DrawingPad initialStrokes={drawingStrokes.current} scrollGesture={drawScrollGesture} ref={drawing} label={t('create.pad')} /><Pressable onPress={() => { drawing.current?.clear(); void haptics.tap(); }}><Text style={{ color: C.blue }}>{t('create.clear')}</Text></Pressable></>}
          {b === 'predict' && <><PredictionInput value={prediction} onChange={setPrediction} /><Text style={{ fontFamily: sans, fontSize: 12, color: C.plum }}>{t('create2.predictNote')}</Text></>}
          {b === 'voice' && <VoiceRecorder value={voice} onChange={setVoice} active={step === 2 && phase === 'steps'} />}
          {b === 'photo' && (photo ? <Image source={{ uri: photo }} style={{ width: '100%', height: 220, borderRadius: 6 }} resizeMode='cover' /> : <View style={{ gap: 8, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.line, borderRadius: 10, padding: 14, alignItems: 'center' }}>
            <ToolIcon kind="photo" /><Text style={{ fontFamily: sans, color: C.blue }}>{t('create2.photoPick')}</Text>
            {photoChoices && <View style={{ flexDirection: 'row', gap: 8, alignSelf: 'stretch' }}><View style={{ flex: 1 }}><Button title={t('create.camera')} onPress={() => void choosePhoto('camera')} /></View><View style={{ flex: 1 }}><Button title={t('create.library')} onPress={() => void choosePhoto('library')} /></View></View>}
          </View>)}
        </View>)}
      </ImageBackground>
      <View accessibilityRole='toolbar' style={{ flexDirection: 'row', gap: 4, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 6, ...shadows.card }}>
        {BLOCKS.map(b => { const off = blockOff(b); return <Pressable key={b} accessibilityRole='button' accessibilityState={{ disabled: off }} disabled={off} onPress={() => addBlock(b)}
          style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 3, paddingVertical: 7, borderRadius: 11, backgroundColor: pressed ? C.glass : 'transparent', opacity: off ? .32 : 1 })}>
          <ToolIcon kind={BLOCK_ICON[b]} color={b === 'predict' ? C.brass : C.blue} /><Text style={{ fontFamily: sans, fontSize: 12, color: C.ink }}>{t(BLOCK_LABEL[b])}</Text>
        </Pressable>; })}
      </View>
      <Text style={muted}>{toPublicCapsule ? t('create2.textOnly') : t('create2.oneEach')}</Text>
      <View style={{ gap: 8 }}>
        <Text style={{ fontFamily: sans, color: C.muted, fontSize: 12, letterSpacing: .7 }}>{t('create.hint')}</Text>
        <TextInput value={hint} onChangeText={setHint} maxLength={40} placeholder={t('create.hintPlaceholder')} placeholderTextColor={PLACEHOLDER} style={[card, { color: C.ink, padding: 12 }]} />
        <Text style={{ color: C.muted, textAlign: 'right', fontSize: 12 }}>{hint.length} / 40</Text>
      </View>
    </View>

    {step === 3 && <View style={{ gap: 14 }}>
      {title(t('create.vessel'))}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12 }}>
        <ToolIcon kind="search" color={C.muted} size={18} />
        <TextInput value={vesselQuery} onChangeText={setVesselQuery} placeholder={t('create2.search')} placeholderTextColor={PLACEHOLDER} autoCorrect={false} style={{ flex: 1, paddingVertical: 11, fontFamily: sans, color: C.ink }} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ marginHorizontal: -24, paddingHorizontal: 24, flexGrow: 0 }}>
        <Chip on={vesselCat === 'all'} label={t('create2.all')} count={usableList.length} onPress={() => setVesselCat('all')} />
        {VESSEL_CATEGORIES.map(c => { const n = usableList.filter(v => vesselCategory(v) === c).length; return n ? <Chip key={c} on={vesselCat === c} label={t(`create2.cat.${c}`)} count={n} onPress={() => setVesselCat(c)} /> : null; })}
        <View style={{ width: 24 }} />
      </ScrollView>
      {predicting && vessel !== 'fortune-cookie' && cookie && canUseVessel(cookie) && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.cream, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 }}>
        <Vessel kind="fortune-cookie" size={40} /><Text style={{ flex: 1, fontFamily: sans, color: C.ink, fontSize: 13.5 }}>{t('create2.suggest')} {t('shop.vessel.fortune-cookie')}</Text>
        <Pressable accessibilityRole='button' onPress={() => { setVessel('fortune-cookie'); void haptics.tick(); }}><Text style={{ color: C.blue, fontFamily: sans }}>{t('create2.use')}</Text></Pressable>
      </View>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {shownVessels.map(v => { const usable = canUseVessel(v), on = vessel === v.id; return <Pressable key={v.id} accessibilityRole='button' accessibilityState={{ selected: on }} onPress={() => { setVessel(v.id as VesselKind); if (selectedPlace?.brand_vessel && selectedPlace.brand_vessel !== v.id) setPlace(null); if (usable) void haptics.tick(); else router.push({ pathname: '/shop', params: { focus: v.id, returnTo: 'create' } }); }}
          style={{ width: '31.5%', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 14, borderWidth: 1.5, borderColor: on ? C.blue : C.line, backgroundColor: C.white, opacity: usable ? 1 : .55 }}>
          {on && <View style={{ position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', zIndex: 1 }}><ArtIcon name="check" size={12} color={C.white} /></View>}
          <Vessel kind={v.id as VesselKind} size={78} idle={on} />
          <Text numberOfLines={2} style={{ fontFamily: serif, color: C.ink, fontSize: 13, textAlign: 'center' }}>{t(`shop.vessel.${v.id}`)}</Text>
          {!usable && <Text style={{ color: C.plum, fontSize: 10.5 }}>{t('create.getShop')}</Text>}
        </Pressable>; })}
        {!catalog.loading && !shownVessels.length && <Text style={[muted, { width: '100%', textAlign: 'center', paddingVertical: 24 }]}>{t('create2.none')}</Text>}
      </View>
      {catalog.loading && <SealLoader size={44} label={t('create.loading')} />}
      {catalog.error && <Button title={t('create.retry')} onPress={() => void catalog.refresh()} />}
    </View>}

    {step === 4 && <View style={{ gap: 16 }}>
      {title(toPublicCapsule ? t('create2.pubWhen') : t('create.whenWhere'))}
      {sectionLabel(toPublicCapsule ? t('create2.appears') : t('create.when'))}
      <PickerRow label={toPublicCapsule ? t('create2.appears') : t('create.when')} icon={<Glyph><ToolIcon kind={quick === 'custom' ? 'calendar' : 'clock'} /></Glyph>} title={quickLabel(quick)} sub={quick === 'custom' ? (openAt ? dateLabel(openAt) : t('create2.customSub')) : dateLabel(openAt)} onPress={() => setSheet('when')} />
      {quick === 'custom' && <MonthCalendar value={dateText} onChange={setDateText} language={language} />}
      {!!openAt && <Text style={{ fontFamily: serif, color: C.blue, fontSize: 15 }}>{toPublicCapsule ? t('create2.appearsOn', formatted) : t('create2.opensOn', formatted)}</Text>}
      {sectionLabel(t('create.where'))}
      {toPublicCapsule ? <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12 }}>
          <Glyph><ToolIcon kind="here" /></Glyph>
          <View style={{ flex: 1, gap: 2 }}><Text style={{ fontFamily: serif, color: C.ink, fontSize: 17 }}>{t('create2.here')}</Text><Text style={muted}>{st('spotNote')}</Text></View>
        </View>
        <Text style={muted}>{st('rules')}</Text>
      </View> : <>
        <PickerRow label={t('create.where')} icon={<Glyph><ToolIcon kind={placeMode === 'current' ? 'here' : placeMode === 'specific' ? 'landmark' : 'anywhere'} /></Glyph>} title={t(`create2.where.${placeMode}`)} sub={placeMode === 'anywhere' ? t('create2.anywhereSub') : placeMode === 'current' ? (point && point.name !== t('create2.findingName') ? placeLabel(point) : t('create2.where.currentSub')) : whereLabel || t('create2.where.specificSub')} onPress={() => setSheet('where')} />
        {placeMode === 'current' && (point ? placeCard(point.name, point.detail) : <View style={{ gap: 8 }}>
          <Text style={muted}>{location.status === 'denied' ? t('create2.locationDenied') : t('create2.locating')}</Text>
          {location.status === 'denied' && <Button title={t('create2.openSettings')} onPress={() => void location.openSettings()} />}
        </View>)}
        {placeMode === 'specific' && <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12 }}>
            <ToolIcon kind="search" color={C.muted} size={18} />
            <TextInput value={placeQuery} onChangeText={setPlaceQuery} placeholder={t('create2.placeSearch')} placeholderTextColor={PLACEHOLDER} autoCorrect={false} style={{ flex: 1, paddingVertical: 11, fontFamily: sans, color: C.ink }} />
          </View>
          {(place || point) && !placeQuery.trim() ? placeCard(whereLabel, selectedPlace ? `${language === 'zh' ? selectedPlace.city_zh : selectedPlace.city_en}` : point?.detail ?? '') : <View style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 4 }}>
            {shownLandmarks.length > 0 && <SheetGroup>{t('create2.landmarks')}</SheetGroup>}
            {shownLandmarks.map(pl => { const disabled = !!pl.brand_vessel && pl.brand_vessel !== vessel; return <SheetOption key={pl.id} icon={<Glyph size={36}><ToolIcon kind="landmark" color={disabled ? C.muted : C.wax} size={18} /></Glyph>} title={language === 'zh' ? pl.name_zh : pl.name_en} sub={disabled ? t('create.brandPlace') : language === 'zh' ? pl.city_zh : pl.city_en} onPress={() => { if (disabled) return; setPlace(pl.id); setPoint(null); setPlaceQuery(''); void haptics.tick(); }} />; })}
            {placeResults.length > 0 && <SheetGroup>{t('create2.mapResults')}</SheetGroup>}
            {placeResults.map((r, i) => <SheetOption key={`${r.lat},${r.lng},${i}`} icon={<Glyph size={36}><ToolIcon kind="search" size={18} /></Glyph>} title={r.name} sub={r.detail} onPress={() => { setPoint(r); setPlace(null); setPlaceQuery(''); void haptics.tick(); }} />)}
            {searching && <Text style={[muted, { padding: 10 }]}>{t('create.loading')}</Text>}
            {!searching && placeQuery.trim().length >= 2 && !shownLandmarks.length && !placeResults.length && <Text style={[muted, { padding: 10 }]}>{t('create2.noPlace')}</Text>}
          </View>}
        </View>}
        <Text style={{ color: C.muted, fontSize: 12 }}>{t('create.serverTime')}</Text>
      </>}
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 14 }}>
        {vessel ? <Vessel kind={vessel} size={64} /> : null}
        <View style={{ flex: 1, gap: 8 }}>
          {([['create2.sumTo', toPublicCapsule ? t('create2.anyone') : recipientName], ['create2.sumBody', insideSummary], ['create2.sumVessel', vessel ? t(`shop.vessel.${vessel}`) : '—'], ['create2.sumWhen', openAt ? formatted : '—'], ['create2.sumWhere', toPublicCapsule ? t('create2.nearPublicSpot') : whereLabel || t('create.anywhere')]] as const).map(([k, v]) => <View key={k}>
            <Text style={{ fontFamily: sans, color: C.muted, fontSize: 12 }}>{t(k)}</Text><Text style={{ fontFamily: sans, color: C.ink, fontSize: 14 }}>{v}</Text>
          </View>)}
        </View>
      </View>
    </View>}


    <Sheet open={sheet === 'to'} title={t('create2.to')} onClose={() => setSheet(null)}>
      <SheetGroup>{t('create2.groupMe')}</SheetGroup>
      <SheetOption selected={recipient === id} icon={self} title={t('create.self')} sub={t('create2.futureSub')} onPress={() => { setRecipient(id); setSheet(null); setError(''); void haptics.tick(); }} />
      <SheetGroup>{t('create2.groupFriends')}</SheetGroup>
      {(friends.data ?? []).map(f => <SheetOption key={f.friend_id} selected={recipient === f.friend_id} icon={<View pointerEvents='none'><Avatar avatar={(f as any).profiles?.avatar} size={44} /></View>} title={friendName(f)} sub={t('create2.friendSub')} onPress={() => { setRecipient(f.friend_id); setSheet(null); setError(''); void haptics.tick(); }} />)}
      {!friends.loading && !friends.data?.length && <Text style={[muted, { marginHorizontal: 10 }]}>{t('create.noFriends')}</Text>}
      <SheetOption accent icon={<Glyph><ArtIcon name="plus" color={C.blue} /></Glyph>} title={t('create.invite')} sub={t('create2.inviteSub')} onPress={() => { setSheet(null); router.push('/invite'); }} />
    </Sheet>
    <Sheet open={sheet === 'when'} title={toPublicCapsule ? t('create2.appears') : t('create.when')} onClose={() => setSheet(null)}>
      {quickList.map(q => <SheetOption key={q} selected={quick === q} icon={<Glyph><ToolIcon kind={q === 'custom' ? 'calendar' : 'clock'} /></Glyph>} title={quickLabel(q)} sub={q === 'custom' ? t('create2.customSub') : dateLabel(quickDate(q))} onPress={() => { setQuick(q); setSheet(null); setError(''); void haptics.tick(); }} />)}
    </Sheet>
    <Sheet open={sheet === 'where'} title={t('create.where')} onClose={() => setSheet(null)}>
      {(['anywhere', 'current', 'specific'] as const).map(m => <SheetOption key={m} selected={placeMode === m} icon={<Glyph><ToolIcon kind={m === 'current' ? 'here' : m === 'specific' ? 'landmark' : 'anywhere'} /></Glyph>} title={t(`create2.where.${m}`)} sub={t(m === 'anywhere' ? 'create2.anywhereSub' : `create2.where.${m}Sub`)}
        onPress={() => { setPlaceMode(m); setPlace(null); setPoint(null); setPlaceQuery(''); setSheet(null); setError(''); void haptics.tick(); if (m === 'current') void location.request(); }} />)}
    </Sheet>
  </Screen>;
}
