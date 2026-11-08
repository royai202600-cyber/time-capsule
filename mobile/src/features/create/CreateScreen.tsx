import { canUseVessel as canAccessVessel, showVesselInShop } from "../../services/vesselAccess";
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, PanResponder, Keyboard, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { GestureDetector, useNativeGesture, usePanGesture } from 'react-native-gesture-handler';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { goBack } from "../../navigation";
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
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
import { C, handwriting, motion, serif, sans } from '../../theme';
import { DrawingPad, type DrawingHandle } from './DrawingPad';
import { letterDropFor, scenes, sealWax } from '../../art/manifest';
import { ArtIcon } from '../../components/ArtIcon';
import { SealLoader } from '../../components/SealLoader';
import { WaxSteps } from '../../components/WaxSteps';
import { VoiceRecorder } from '../voice/VoiceRecorder';
import { stubAttachVoice, uploadVoice, VOICE_BACKEND, VOICE_ENABLED, type VoiceClip } from '../../services/voice';
import { PREDICTION_ENABLED, predictionSendArgs, type CapsuleKind } from '../../services/prediction';
import { KindChoice, PredictionInput } from '../prediction/PredictionParts';
import { usePredictionText } from '../prediction/strings';
import { DRIFT_CHOICES, sea, SeaError, SEA_BACKEND, SEA_ENABLED, SEA_MESSAGE_MAX, SEA_RECIPIENT, type DriftDays, type ThrowResult } from '../../services/sea';
import { shortDate, useSeaText } from '../sea/strings';
import { openingCoordinates } from '../journey/location';

type Quick = 'm1' | 'm6' | 'y1' | 'y5' | 'custom' | 'dev';
const quickDate = (q: Quick) => { const d = new Date(); if (q === 'm1') d.setMonth(d.getMonth() + 1); if (q === 'm6') d.setMonth(d.getMonth() + 6); if (q === 'y1') d.setFullYear(d.getFullYear() + 1); if (q === 'y5') d.setFullYear(d.getFullYear() + 5); if (q === 'dev') d.setMinutes(d.getMinutes() + 2); return d; };
const dateValue = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const customDate = (s: string) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null; const d = new Date(`${s}T12:00:00`); return dateValue(d) === s && d.getTime() > Date.now() ? d : null; };
const card = { borderWidth: 1.5, borderColor: C.line, backgroundColor: C.white, borderRadius: 16, padding: 14 } as const;
const label = { fontFamily: sans, color: C.ink } as const;
// The letter's centre is at stage y=125; these drops meet each vessel's opening at stage y=270–325.

// Expo SDK 58 currently prefixes its web file accept filter with a comma, which
// leaves Chrome's macOS picker unable to select images. Use a plain image input.
function pickWebPhoto(source: 'camera' | 'library'): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    if (source === 'camera') input.capture = 'environment';
    input.style.display = 'none';
    input.oncancel = () => { input.remove(); resolve(null); };
    input.onchange = () => {
      const file = input.files?.[0]; input.remove();
      if (!file) { resolve(null); return; }
      const url = URL.createObjectURL(file);
      const image = document.createElement('img');
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image load failed')); };
      image.onload = () => {
        const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.naturalWidth * scale);
        canvas.height = Math.round(image.naturalHeight * scale);
        const context = canvas.getContext('2d');
        if (!context) { URL.revokeObjectURL(url); reject(new Error('canvas unavailable')); return; }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', .78));
      };
      image.src = url;
    };
    document.body.appendChild(input);
    input.click();
  });
}

export default function CreateScreen() {
  const { t, language, setLanguage } = useLanguage();
  const { session, profile, loading: authLoading } = useAuth();
  const params = useLocalSearchParams<{ to?: string; recipient?: string; kind?: string }>();
  const p = usePredictionText();
  const st = useSeaText();
  // A prediction is a special kind of capsule: same four steps, but its main content is one prediction line.
  const [kind, setKind] = useState<CapsuleKind>(PREDICTION_ENABLED && params.kind === 'prediction' ? 'prediction' : 'letter'), [prediction, setPrediction] = useState('');
  const predicting = kind === 'prediction';
  const id = session?.user.id ?? '';
  const friends = useFriends(id), catalog = useVessels(), owned = useOwnedVessels(id), places = usePlaces();
  const reduced = useReducedMotion();
  const [step, setStep] = useState(1), [recipient, setRecipient] = useState<string | null>(((params.to ?? params.recipient) === 'future' ? session?.user.id : (params.to ?? params.recipient)) ?? session?.user.id ?? null);
  const [mode, setMode] = useState<'type' | 'hand'>('type'), [message, setMessage] = useState(''), [hint, setHint] = useState(''), [drawingData, setDrawingData] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null), [photoChoices, setPhotoChoices] = useState(false), [voice, setVoice] = useState<VoiceClip | null>(null);
  const voicePath = useRef<{ uri: string; path: string } | null>(null);
  const [vessel, setVessel] = useState<VesselKind | null>(null), [place, setPlace] = useState<string | null>(null);
  const [quick, setQuick] = useState<Quick>('m1'), [dateText, setDateText] = useState(dateValue(quickDate('m1')));
  const [driftDays, setDriftDays] = useState<DriftDays>(7), [seaResult, setSeaResult] = useState<ThrowResult | null>(null);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [phase, setPhase] = useState<'steps' | 'seal' | 'sealed'>('steps'), [sealedAt, setSealedAt] = useState<Date | null>(null), [stamped, setStamped] = useState(false);
  const drawing = useRef<DrawingHandle>(null);
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
  const canUseVessel = (v: { id: string; price_mop: number }) => canAccessVessel(v, ownsVessel(v.id));
  const selectedPlace = places.data?.find(p => p.id === place);
  const recipientRow = friends.data?.find(f => f.friend_id === recipient);
  // A sea bottle is an ordinary capsule addressed to the sea: typed only, washes up after its drift time.
  const toSea = SEA_ENABLED && recipient === SEA_RECIPIENT;
  const recipientName = toSea ? st('toSea') : recipient === id ? t('create.self') : ((recipientRow as any)?.profiles?.name ?? '');
  const openAt = toSea ? new Date(Date.now() + driftDays * 86_400_000) : quick === 'custom' ? customDate(dateText) : quickDate(quick);
  const formatted = (sealedAt ?? openAt)?.toLocaleDateString(language === 'zh' ? 'zh-Hant' : 'en', { year: 'numeric', month: 'long', day: 'numeric', hour: quick === 'dev' ? 'numeric' : undefined, minute: quick === 'dev' ? '2-digit' : undefined }) ?? dateText;
  const placeName = selectedPlace ? (language === 'zh' ? selectedPlace.name_zh : selectedPlace.name_en) : '';
  const validate = () => {
    if (!recipient) return t('create.needRecipient');
    if (step >= 2 && predicting && !prediction.trim()) return p('need');
    if (step >= 2 && toSea && !message.trim()) return t('create.needMessage');
    if (step >= 4 && toSea && SEA_BACKEND && !openingCoordinates()) return st('needLocation');
    if (step >= 2 && !predicting && (mode === 'type' ? !message.trim() : step === 2 ? !drawing.current?.hasInk() : !drawingData)) return t('create.needMessage');
    if (step >= 3 && !vessel) return t('create.chooseFirst');
    if (step >= 3 && chosenVessel && !canUseVessel(chosenVessel)) return t('create.notOwned');
    if (step >= 4 && !openAt) return t('create.badDate');
    return '';
  };
  const next = async () => { const issue = validate(); if (issue) { setError(issue); void haptics.warn(); return; } if (step === 2 && mode === 'hand') { try { setDrawingData(drawing.current?.hasInk() ? await drawing.current.png() ?? null : null); } catch { setError(t('create.sendError')); return; } } setError(''); Keyboard.dismiss(); void haptics.tap(); if (step === 2 && predicting && !vessel) { const cookie = catalog.data?.find(v => v.id === 'fortune-cookie'); if (cookie && canUseVessel(cookie)) setVessel('fortune-cookie'); } if (step < 4) setStep(step + 1); else setPhase('seal'); };
  const choosePhoto = async (source: 'camera' | 'library') => {
    setPhotoChoices(false); setError('');
    if (Platform.OS !== 'web') { const permission = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync(); if (!permission.granted) { setError(t('create.photoPermission')); return; } }
    try {
      if (Platform.OS === 'web') {
        const image = await pickWebPhoto(source);
        if (image) { setPhoto(image); void haptics.tick(); }
        return;
      }
      const result = source === 'camera' ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0], scale = Math.min(1, 1280 / Math.max(asset.width, asset.height));
      const actions: ImageManipulator.Action[] = scale < 1 ? [{ resize: { width: Math.round(asset.width * scale), height: Math.round(asset.height * scale) } }] : [];
      const image = await ImageManipulator.manipulateAsync(asset.uri, actions, { format: ImageManipulator.SaveFormat.JPEG, compress: .78, base64: true });
      if (!image.base64) throw new Error('Missing JPEG bytes');
      setPhoto(`data:image/jpeg;base64,${image.base64}`); void haptics.tick();
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
      if (toSea) {
        const thrown = await sea.throwBottle({ message, hint: hint.trim() || t('create.hintDefault'), vessel, driftDays, at: openingCoordinates() });
        setSeaResult(thrown);
        sentOnce.current = true;
        setSealedAt(new Date(thrown.washes_up_at));
        await contact;
        setStamped(true);
        finishAnimation();
        return;
      }
      const ink = mode === 'hand' ? drawingData : null;
      if (mode === 'hand' && !ink && !predicting) throw new Error('empty drawing');
      // Upload once per recording; a retried send reuses the same pending path.
      let voiceArgs = {};
      if (voice && VOICE_BACKEND) {
        if (voicePath.current?.uri !== voice.uri) {
          try { voicePath.current = { uri: voice.uri, path: await uploadVoice(id, voice) }; }
          catch { throw new Error('voice upload'); }
        }
        voiceArgs = { p_voice: voicePath.current.path, p_voice_ms: Math.round(voice.durationMs) };
      }
      const { data: capsuleId, error: rpcError } = await capsules.send({ p_recipient: recipient, p_vessel: vessel, p_message: mode === 'type' ? message.trim() : '', p_drawing: ink ?? undefined, p_photo: photo ?? undefined, p_hint: hint.trim() || t('create.hintDefault'), p_open_at: openAt.toISOString(), p_place: place ?? undefined, ...voiceArgs, ...predictionSendArgs(kind, prediction) });
      if (rpcError) throw rpcError;
      if (voice && capsuleId) stubAttachVoice(String(capsuleId), voice);
      sentOnce.current = true;
      setSealedAt(openAt);
      await contact;
      setStamped(true);
      finishAnimation();
    } catch (e) {
      contactMotion?.stop();
      wax.stopAnimation(); waxScale.stopAnimation();
      const msg = String((e as any)?.message ?? e).toLowerCase(), code = String((e as any)?.hint ?? '');
      if (e instanceof SeaError) setError(e.code === 'rejected' ? st('errRejected') : e.code === 'no_shore' ? st('errNoShore') : t('create.sendError'));
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
  if (phase === 'sealed') return <Screen><View style={{ flex: 1, minHeight: 570, alignItems: 'center', justifyContent: 'center', gap: 18 }}><Image source={scenes.sealed} style={{ width: '100%', height: 220 }} resizeMode="contain" /><Heading>{t('create.sealed')}</Heading><Body>{toSea && seaResult ? st('sealedSea', language === 'zh' ? seaResult.shore_zh : seaResult.shore_en, shortDate(seaResult.washes_up_at, language)) : predicting ? p('sealedBody', formatted, recipientName) : t('create.sealedBody', formatted, recipientName, placeName)}</Body><Button title={t('create.done')} onPress={() => router.replace({ pathname: '/', params: { tab: 'sent' } })} /></View></Screen>;
  return <Screen scrollGesture={drawScrollGesture} footer={<View style={{ flexDirection: 'row', gap: 8, marginTop: 'auto' }}>{step > 1 && <View style={{ flex: 1 }}><Button title={t('create.back')} onPress={() => { Keyboard.dismiss(); setStep(step - 1); setError(''); void haptics.tap(); }} /></View>}<View style={{ flex: 1 }}><Button title={t(step === 4 ? 'create.sealSend' : 'create.next')} onPress={next} /></View></View>}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Pressable onPress={goBack} accessibilityRole='button' accessibilityLabel={t('create.close')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><ArtIcon name="close" color={C.plum} /></Pressable><Pressable onPress={() => setLanguage(language === 'zh' ? 'en' : 'zh')} accessibilityRole='button'><Text style={{ color: C.blue }}>{t('create.langSwitch')}</Text></Pressable></View>
    <Heading>{t('create.title')}</Heading><WaxSteps step={step} label={t('create.step', step)} labels={[t('create.stepName1'), t('create.stepName2'), t('create.stepName3'), t('create.stepName4')]} onBack={n => { Keyboard.dismiss(); setStep(n); setError(''); void haptics.tap(); }} />
    {step === 1 && PREDICTION_ENABLED && <KindChoice kind={kind} onChange={k => { setKind(k); setError(''); }} />}
    <Text style={{ fontFamily: serif, color: C.ink, fontSize: 23 }}>{step === 2 && predicting ? p('write') : t(['', 'create.who', 'create.write', 'create.vessel', 'create.whenWhere'][step])}</Text>
    {step === 1 && <View style={{ gap: 12 }}><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      <Pressable accessibilityRole='button' accessibilityState={{ selected: recipient === id }} onPress={() => { setRecipient(id); setError(''); void haptics.tick(); }} style={[card, { width: '46%', alignItems: 'center', borderColor: recipient === id ? C.blue : C.line, backgroundColor: recipient === id ? C.cream : C.white }]}><View pointerEvents='none'><Avatar avatar={profile?.avatar} size={60} future /></View><Text style={[label, { marginTop: 8 }]}>{t('create.self')}</Text></Pressable>
      {(friends.data ?? []).map(f => <Pressable key={f.friend_id} accessibilityRole='button' accessibilityState={{ selected: recipient === f.friend_id }} onPress={() => { setRecipient(f.friend_id); setError(''); void haptics.tick(); }} style={[card, { width: '46%', alignItems: 'center', borderColor: recipient === f.friend_id ? C.blue : C.line, backgroundColor: recipient === f.friend_id ? C.cream : C.white }]}><View pointerEvents='none'><Avatar avatar={(f as any).profiles?.avatar} size={60} /></View><Text style={[label, { marginTop: 8 }]}>{(f as any).profiles?.name}</Text></Pressable>)}
      {SEA_ENABLED && !predicting && <Pressable accessibilityRole='button' accessibilityState={{ selected: toSea }} onPress={() => { setRecipient(SEA_RECIPIENT); setMode('type'); setDrawingData(null); setPhoto(null); setVoice(null); setError(''); void haptics.tick(); }} style={[card, { width: '46%', alignItems: 'center', borderColor: toSea ? C.blue : C.line, backgroundColor: toSea ? C.cream : C.white }]}><View pointerEvents='none' style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: C.glass, alignItems: 'center', justifyContent: 'center' }}><Vessel kind='bottle' size={50} /></View><Text style={[label, { marginTop: 8 }]}>{st('toSea')}</Text><Text style={{ color: C.muted, fontSize: 11, textAlign: 'center' }}>{st('toSeaNote')}</Text></Pressable>}
      <Pressable onPress={() => router.push('/invite')} style={[card, { width: '46%', alignItems: 'center', justifyContent: 'center', minHeight: 116 }]}><ArtIcon name="plus" color={C.blue} /><Text style={{ color: C.blue }}>{t('create.invite')}</Text></Pressable>
    </View>{friends.loading && <SealLoader size={44} label={t('create.loading')} />}{!friends.loading && !friends.data?.length && <Body>{t('create.noFriends')}</Body>}</View>}
    {<View style={{ gap: 15, display: step === 2 ? 'flex' : 'none' }}>
      {predicting && <><PredictionInput value={prediction} onChange={setPrediction} /><Text style={label}>{p('letterOptional')}</Text></>}
      {toSea ? <Text style={{ color: C.muted, fontSize: 13, lineHeight: 20, backgroundColor: C.glass, borderRadius: 8, padding: 10 }}>{st('seaTypedOnly')}</Text> : <View style={{ flexDirection: 'row', gap: 8 }}>{(['type', 'hand'] as const).map(m => <Pressable key={m} onPress={() => { setMode(m); if (m === 'type') setDrawingData(null); void haptics.tick(); }} style={[card, { flex: 1, backgroundColor: mode === m ? C.cream : C.white }]}><Text style={{ textAlign: 'center', color: C.ink }}>{t(`create.${m}`)}</Text></Pressable>)}</View>}
      {mode === 'type' ? <><TextInput value={message} onChangeText={setMessage} placeholder={predicting ? p('letterPlaceholder') : t('create.message')} maxLength={toSea ? SEA_MESSAGE_MAX : 500} multiline textAlignVertical='top' style={[card, { minHeight: predicting ? 140 : 230, fontFamily: serif, fontSize: 18, color: C.ink }]} /><Text style={{ color: C.muted, textAlign: 'right' }}>{message.length} / {toSea ? SEA_MESSAGE_MAX : 500}</Text></> : <><DrawingPad scrollGesture={drawScrollGesture} ref={drawing} label={t('create.pad')} /><Pressable onPress={() => { drawing.current?.clear(); void haptics.tap(); }}><Text style={{ color: C.blue }}>{t('create.clear')}</Text></Pressable></>}
      {VOICE_ENABLED && !toSea && <VoiceRecorder value={voice} onChange={setVoice} active={step === 2 && phase === 'steps'} />}
      {toSea ? null : photo ? <Pressable onPress={() => setPhoto(null)} accessibilityLabel={t('create.removePhoto')} style={{ alignSelf: 'flex-start' }}><Image source={{ uri: photo }} style={{ width: 110, height: 110, borderRadius: 8 }} /><Text style={{ color: C.blue }}>{t('create.removePhoto')}</Text></Pressable> : <Pressable onPress={() => setPhotoChoices(!photoChoices)} style={[card, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}><ArtIcon name="camera" color={C.blue} size={20} /><Text style={{ color: C.blue }}>{t('create.photo')}</Text></Pressable>}
      {photoChoices && !toSea && <View style={{ flexDirection: 'row', gap: 8 }}><Button title={t('create.camera')} onPress={() => void choosePhoto('camera')} /><Button title={t('create.library')} onPress={() => void choosePhoto('library')} /></View>}
      <Text style={label}>{t('create.hint')}</Text><TextInput value={hint} onChangeText={setHint} maxLength={40} placeholder={t('create.hintPlaceholder')} style={[card, { color: C.ink }]} /><Text style={{ color: C.muted, textAlign: 'right' }}>{hint.length} / 40</Text>
    </View>}
    {step === 3 && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {(catalog.data ?? []).filter(v => showVesselInShop(v, ownsVessel(v.id))).map(v => { const usable = canUseVessel(v); return <Pressable key={v.id} onPress={() => { setVessel(v.id as VesselKind); if (selectedPlace?.brand_vessel && selectedPlace.brand_vessel !== v.id) setPlace(null); if (usable) void haptics.tick(); else router.push({ pathname: '/shop', params: { focus: v.id, returnTo: 'create' } }); }} style={[card, { width: '46%', alignItems: 'center', borderColor: vessel === v.id ? C.blue : C.line, opacity: usable ? 1 : .68 }]}><Vessel kind={v.id as VesselKind} size={105} idle={vessel === v.id} /><Text style={{ fontFamily: serif, color: C.ink, textAlign: 'center' }}>{t(`shop.vessel.${v.id}`)}</Text><Text style={{ color: usable ? C.blue : C.plum, fontSize: 12 }}>{t(usable ? 'create.owned' : 'create.getShop')}</Text></Pressable>; })}
      {catalog.loading && <SealLoader size={44} label={t('create.loading')} />}
      {catalog.error && <Button title={t('create.retry')} onPress={() => void catalog.refresh()} />}
    </View>}
    {step === 4 && toSea && <View style={{ gap: 15 }}>
      <Body>{st('driftLabel')}</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{DRIFT_CHOICES.map(d => <Pressable key={d} accessibilityRole='button' accessibilityState={{ selected: driftDays === d }} onPress={() => { setDriftDays(d); void haptics.tick(); }} style={[card, { backgroundColor: driftDays === d ? C.cream : C.white, padding: 10 }]}><Text style={{ color: C.ink }}>{st('drift', d)}</Text></Pressable>)}</View>
      <Text style={{ color: C.blue }}>{st('washesUp', formatted)}</Text>
      <View style={[card, { backgroundColor: C.glass, borderColor: C.glass, gap: 8 }]}><Text style={{ color: C.ink, lineHeight: 21 }}>{st('shoreNote')}</Text><Text style={{ color: C.muted, fontSize: 13, lineHeight: 20 }}>{st('rules')}</Text></View>
    </View>}
    {step === 4 && !toSea && <View style={{ gap: 15 }}>
      <Body>{t('create.when')}</Body><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(['m1', 'm6', 'y1', 'y5', 'custom', ...(__DEV__ ? ['dev'] : [])] as Quick[]).map(q => <Pressable key={q} onPress={() => { setQuick(q); if (q !== 'custom') setDateText(dateValue(quickDate(q))); void haptics.tick(); }} style={[card, { backgroundColor: quick === q ? C.cream : C.white, padding: 10 }]}><Text style={{ color: C.ink }}>{t(`create.${q}`)}</Text></Pressable>)}</View>
      {quick === 'custom' && <TextInput value={dateText} onChangeText={setDateText} placeholder={t('create.dateHint')} keyboardType='numbers-and-punctuation' style={[card, { color: C.ink }]} />}
      <Text style={{ color: C.blue }}>{t('create.arrives', formatted)}</Text><View style={[card, { backgroundColor: C.cream }]}><Text style={{ fontFamily: serif, color: C.plum }}>{t('create.memoryTitle')}</Text><Text style={{ color: C.ink, marginTop: 6 }}>{t('create.memoryBody')}</Text></View>
      <Body>{t('create.where')}</Body><Pressable onPress={() => { setPlace(null); void haptics.tick(); }} style={[card, { borderColor: !place ? C.blue : C.line }]}><Text style={label}>{t('create.anywhere')}</Text></Pressable>
      {(places.data ?? []).map(p => { const disabled = !!p.brand_vessel && p.brand_vessel !== vessel; return <Pressable key={p.id} disabled={disabled} onPress={() => { setPlace(p.id); void haptics.tick(); }} style={[card, { borderColor: place === p.id ? C.blue : C.line, opacity: disabled ? .45 : 1 }]}><Text style={{ fontFamily: serif, color: C.ink }}>{language === 'zh' ? p.name_zh : p.name_en}</Text><Text style={{ color: C.muted }}>{language === 'zh' ? p.city_zh : p.city_en} · {language === 'zh' ? p.why_zh : p.why_en}</Text>{disabled && <Text style={{ color: C.plum, fontSize: 12 }}>{t('create.brandPlace')}</Text>}</Pressable>; })}
      <Body>{t('create.radius')}</Body><Text style={{ color: C.muted, fontSize: 12 }}>{t('create.serverTime')}</Text>
    </View>}
    <Toast message={error || ((friends.error || catalog.error || places.error) ? t('create.noData') : '')} />

  </Screen>;
}
