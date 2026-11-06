import React, { useCallback, useRef, useState } from 'react';
import { Animated, Image, PanResponder, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
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

type Quick = 'm1' | 'm6' | 'y1' | 'y5' | 'custom' | 'dev';
const quickDate = (q: Quick) => { const d = new Date(); if (q === 'm1') d.setMonth(d.getMonth() + 1); if (q === 'm6') d.setMonth(d.getMonth() + 6); if (q === 'y1') d.setFullYear(d.getFullYear() + 1); if (q === 'y5') d.setFullYear(d.getFullYear() + 5); if (q === 'dev') d.setMinutes(d.getMinutes() + 2); return d; };
const dateValue = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const customDate = (s: string) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null; const d = new Date(`${s}T12:00:00`); return dateValue(d) === s && d.getTime() > Date.now() ? d : null; };
const card = { borderWidth: 1.5, borderColor: C.line, backgroundColor: C.white, borderRadius: 16, padding: 14 } as const;
const label = { fontFamily: sans, color: C.ink } as const;

export default function CreateScreen() {
  const { t, language, setLanguage } = useLanguage();
  const { session, profile } = useAuth();
  const params = useLocalSearchParams<{ to?: string; recipient?: string }>();
  const id = session?.user.id ?? '';
  const friends = useFriends(id), catalog = useVessels(), owned = useOwnedVessels(id), places = usePlaces();
  const reduced = useReducedMotion();
  const [step, setStep] = useState(1), [recipient, setRecipient] = useState<string | null>(params.to ?? params.recipient ?? null);
  const [mode, setMode] = useState<'type' | 'hand'>('type'), [message, setMessage] = useState(''), [hint, setHint] = useState(''), [drawingData, setDrawingData] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null), [photoChoices, setPhotoChoices] = useState(false);
  const [vessel, setVessel] = useState<VesselKind | null>(null), [place, setPlace] = useState<string | null>(null);
  const [quick, setQuick] = useState<Quick>('m1'), [dateText, setDateText] = useState(dateValue(quickDate('m1')));
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [phase, setPhase] = useState<'steps' | 'seal' | 'sealed'>('steps'), [sealedAt, setSealedAt] = useState<Date | null>(null);
  const drawing = useRef<DrawingHandle>(null);
  const wax = useRef(new Animated.ValueXY()).current, waxScale = useRef(new Animated.Value(1)).current, letter = useRef(new Animated.Value(1)).current, letterDrop = useRef(new Animated.Value(0)).current, drift = useRef(new Animated.Value(0)).current;
  const lidLift = useSharedValue(1);
  useFocusEffect(useCallback(() => { void owned.refresh(); void catalog.refresh(); }, [id]));
  const chosenVessel = catalog.data?.find(v => v.id === vessel);
  const canUseVessel = (v: { id: string; price_mop: number }) => v.price_mop === 0 || !!owned.data?.some(o => o.vessel === v.id);
  const selectedPlace = places.data?.find(p => p.id === place);
  const recipientRow = friends.data?.find(f => f.friend_id === recipient);
  const recipientName = recipient === id ? t('create.self') : ((recipientRow as any)?.profiles?.name ?? '');
  const openAt = quick === 'custom' ? customDate(dateText) : quickDate(quick);
  const formatted = (sealedAt ?? openAt)?.toLocaleDateString(language === 'zh' ? 'zh-Hant' : 'en', { year: 'numeric', month: 'long', day: 'numeric', hour: quick === 'dev' ? 'numeric' : undefined, minute: quick === 'dev' ? '2-digit' : undefined }) ?? dateText;
  const placeName = selectedPlace ? (language === 'zh' ? selectedPlace.name_zh : selectedPlace.name_en) : '';
  const validate = () => {
    if (!recipient) return t('create.needRecipient');
    if (step >= 2 && (mode === 'type' ? !message.trim() : step === 2 ? !drawing.current?.hasInk() : !drawingData)) return t('create.needMessage');
    if (step >= 3 && !vessel) return t('create.chooseFirst');
    if (step >= 3 && chosenVessel && !canUseVessel(chosenVessel)) return t('create.notOwned');
    if (step >= 4 && !openAt) return t('create.badDate');
    return '';
  };
  const next = async () => { const issue = validate(); if (issue) { setError(issue); void haptics.warn(); return; } if (step === 2 && mode === 'hand') { try { setDrawingData(await drawing.current?.png() ?? null); } catch { setError(t('create.sendError')); return; } } setError(''); void haptics.tap(); if (step < 4) setStep(step + 1); else setPhase('seal'); };
  const choosePhoto = async (source: 'camera' | 'library') => {
    setPhotoChoices(false); setError('');
    if (Platform.OS !== 'web') { const permission = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync(); if (!permission.granted) { setError(t('create.photoPermission')); return; } }
    try {
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
    if (reduced) { Animated.timing(drift, { toValue: 1, duration: motion.fade.quick, useNativeDriver: true }).start(() => { setPhase('sealed'); void haptics.success(); }); return; }
    Animated.sequence([Animated.spring(letter, { toValue: .65, ...motion.spring.soft, useNativeDriver: true }), Animated.spring(letter, { toValue: .16, ...motion.spring.soft, useNativeDriver: true }), Animated.parallel([Animated.spring(letterDrop, { toValue: 150, ...motion.spring.soft, useNativeDriver: true }), Animated.spring(drift, { toValue: .35, ...motion.spring.soft, useNativeDriver: true })])]).start(() => {
      lidLift.value = withSpring(0, motion.spring.heavy); void haptics.thump();
      Animated.spring(drift, { toValue: 1, ...motion.spring.soft, useNativeDriver: true }).start(() => { setPhase('sealed'); void haptics.success(); });
    });
  };
  const sendRef = useRef<() => void>(() => {});
  const send = async () => {
    if (busy || !recipient || !vessel || !openAt) return;
    setBusy(true); setError('');
    try {
      const ink = mode === 'hand' ? drawingData : null;
      if (mode === 'hand' && !ink) throw new Error('empty drawing');
      const { error: rpcError } = await capsules.send({ p_recipient: recipient, p_vessel: vessel, p_message: mode === 'type' ? message.trim() : '', p_drawing: ink ?? undefined, p_photo: photo ?? undefined, p_hint: hint.trim() || t('create.hintDefault'), p_open_at: openAt.toISOString(), p_place: place ?? undefined });
      if (rpcError) throw rpcError;
      setSealedAt(openAt);
      void (reduced ? haptics.tap() : haptics.thump());
      if (reduced) { finishAnimation(); return; }
      Animated.spring(wax, { toValue: { x: 0, y: -300 }, ...motion.spring.heavy, useNativeDriver: true }).start(() => Animated.sequence([
        Animated.spring(waxScale, { toValue: 1.25, ...motion.spring.heavy, useNativeDriver: true }),
        Animated.spring(waxScale, { toValue: .95, ...motion.spring.heavy, useNativeDriver: true }),
        Animated.spring(waxScale, { toValue: 1, ...motion.spring.soft, useNativeDriver: true }),
      ]).start(finishAnimation));
    } catch (e) {
      const msg = String((e as any)?.message ?? e).toLowerCase(), code = String((e as any)?.hint ?? '');
      setError(code === 'not_owned' || msg.includes('not owned') ? t('create.notOwned') : code === 'brand_place' || msg.includes('brand vessel') ? t('create.brandRefusal') : msg.includes('not a friend') ? t('create.friendRefusal') : msg.includes('future') ? t('create.badDate') : t('create.sendError'));
      Animated.spring(wax, { toValue: { x: 0, y: 0 }, ...motion.spring.soft, useNativeDriver: true }).start(); void haptics.warn();
    } finally { setBusy(false); }
  };
  sendRef.current = () => { void send(); };
  const pan = useRef(PanResponder.create({ onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_, g) => wax.setValue({ x: g.dx, y: g.dy }),
    onPanResponderRelease: (_, g) => { if (g.dy < -160 && Math.abs(g.dx) < 130) sendRef.current(); else Animated.spring(wax, { toValue: { x: 0, y: 0 }, ...motion.spring.soft, useNativeDriver: true }).start(); },
  })).current;

  if (phase !== 'steps') return <Screen><View style={{ minHeight: 610, alignItems: 'center', justifyContent: 'center', gap: 18 }}>
    {phase === 'seal' ? <>
      <Text style={{ fontFamily: serif, fontSize: 26, color: C.ink }}>{t('create.sealSend')}</Text>
      <Animated.View style={[card, { width: '88%', height: 230, alignItems: 'center', justifyContent: 'center', transform: [{ scaleY: letter }, { translateY: letterDrop }], opacity: drift.interpolate({ inputRange: [0, .5, 1], outputRange: [1, 1, 0] }) }]}>
        <Text style={{ color: C.muted, fontFamily: handwriting, fontSize: 19 }}>{recipientName}</Text><View style={{ width: '75%', marginTop: 28, gap: 18 }}><View style={{ borderBottomWidth: 1, borderColor: C.line }} /><View style={{ borderBottomWidth: 1, borderColor: C.line }} /><View style={{ borderBottomWidth: 1, borderColor: C.line }} /></View>
      </Animated.View>
      <Animated.View style={{ transform: [{ translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [30, -90] }) }, { scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1, .5] }) }], opacity: drift.interpolate({ inputRange: [0, .8, 1], outputRange: [1, 1, 0] }) }}><Vessel kind={vessel ?? 'dome'} size={150} lidLift={lidLift} /></Animated.View>
      <Text style={{ fontFamily: sans, color: C.muted }}>{busy ? t('create.sending') : t('create.drag')}</Text>
      <Animated.View {...pan.panHandlers} accessible accessibilityRole='button' accessibilityLabel={t('create.drag')} accessibilityActions={[{ name: 'activate', label: t('create.sealSend') }]} onAccessibilityAction={() => sendRef.current()} style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: C.wax, borderWidth: 3, borderColor: C.plum, justifyContent: 'center', alignItems: 'center', transform: [...wax.getTranslateTransform(), { scale: waxScale }] }}><Text style={{ color: C.cream, fontSize: 31 }}>✦</Text></Animated.View>
      <Toast message={error} /><Button title={t('create.back')} onPress={() => { setPhase('steps'); setError(''); }} disabled={busy} />
    </> : <><Vessel kind={vessel ?? 'dome'} size={180} /><Heading>{t('create.sealed')}</Heading><Body>{t('create.sealedBody', formatted, recipientName, placeName)}</Body><Button title={t('create.done')} onPress={() => router.replace({ pathname: '/', params: { tab: 'sent' } })} /></>}
  </View></Screen>;
  return <Screen>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Pressable onPress={() => router.back()} accessibilityRole='button'><Text style={{ color: C.plum, fontFamily: sans }}>{t('create.close')}</Text></Pressable><Pressable onPress={() => setLanguage(language === 'zh' ? 'en' : 'zh')} accessibilityRole='button'><Text style={{ color: C.blue }}>{t('create.langSwitch')}</Text></Pressable></View>
    <Heading>{t('create.title')}</Heading><Body>{t('create.step', step)}</Body><View style={{ height: 5, backgroundColor: C.line, borderRadius: 5 }}><View style={{ width: `${step * 25}%`, height: 5, backgroundColor: C.wax, borderRadius: 5 }} /></View>
    <Text style={{ fontFamily: serif, color: C.ink, fontSize: 23 }}>{t(['', 'create.who', 'create.write', 'create.vessel', 'create.whenWhere'][step])}</Text>
    {step === 1 && <View style={{ gap: 12 }}><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      <Pressable onPress={() => { setRecipient(id); void haptics.tick(); }} style={[card, { width: '46%', alignItems: 'center', borderColor: recipient === id ? C.blue : C.line }]}><Avatar avatar={profile?.avatar} size={60} future /><Text style={[label, { marginTop: 8 }]}>{t('create.self')}</Text></Pressable>
      {(friends.data ?? []).map(f => <Pressable key={f.friend_id} onPress={() => { setRecipient(f.friend_id); void haptics.tick(); }} style={[card, { width: '46%', alignItems: 'center', borderColor: recipient === f.friend_id ? C.blue : C.line }]}><Avatar avatar={(f as any).profiles?.avatar} size={60} /><Text style={[label, { marginTop: 8 }]}>{(f as any).profiles?.name}</Text></Pressable>)}
      <Pressable onPress={() => router.push('/invite')} style={[card, { width: '46%', alignItems: 'center', justifyContent: 'center', minHeight: 116 }]}><Text style={{ color: C.blue, fontSize: 18 }}>＋</Text><Text style={{ color: C.blue }}>{t('create.invite')}</Text></Pressable>
    </View>{friends.loading && <Body>{t('create.loading')}</Body>}{!friends.loading && !friends.data?.length && <Body>{t('create.noFriends')}</Body>}</View>}
    {<View style={{ gap: 15, display: step === 2 ? 'flex' : 'none' }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>{(['type', 'hand'] as const).map(m => <Pressable key={m} onPress={() => { setMode(m); if (m === 'type') setDrawingData(null); void haptics.tick(); }} style={[card, { flex: 1, backgroundColor: mode === m ? C.cream : C.white }]}><Text style={{ textAlign: 'center', color: C.ink }}>{t(`create.${m}`)}</Text></Pressable>)}</View>
      {mode === 'type' ? <><TextInput value={message} onChangeText={setMessage} placeholder={t('create.message')} maxLength={500} multiline textAlignVertical='top' style={[card, { minHeight: 230, fontFamily: serif, fontSize: 18, color: C.ink }]} /><Text style={{ color: C.muted, textAlign: 'right' }}>{message.length} / 500</Text></> : <><DrawingPad ref={drawing} label={t('create.pad')} /><Pressable onPress={() => { drawing.current?.clear(); void haptics.tap(); }}><Text style={{ color: C.blue }}>{t('create.clear')}</Text></Pressable></>}
      {photo ? <Pressable onPress={() => setPhoto(null)} accessibilityLabel={t('create.removePhoto')} style={{ alignSelf: 'flex-start' }}><Image source={{ uri: photo }} style={{ width: 110, height: 110, borderRadius: 8 }} /><Text style={{ color: C.blue }}>{t('create.removePhoto')}</Text></Pressable> : <Pressable onPress={() => setPhotoChoices(!photoChoices)} style={card}><Text style={{ color: C.blue }}>{t('create.photo')}</Text></Pressable>}
      {photoChoices && <View style={{ flexDirection: 'row', gap: 8 }}><Button title={t('create.camera')} onPress={() => void choosePhoto('camera')} /><Button title={t('create.library')} onPress={() => void choosePhoto('library')} /></View>}
      <Text style={label}>{t('create.hint')}</Text><TextInput value={hint} onChangeText={setHint} maxLength={40} placeholder={t('create.hintPlaceholder')} style={[card, { color: C.ink }]} /><Text style={{ color: C.muted, textAlign: 'right' }}>{hint.length} / 40</Text>
    </View>}
    {step === 3 && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {(catalog.data ?? []).map(v => { const usable = canUseVessel(v); return <Pressable key={v.id} onPress={() => { setVessel(v.id as VesselKind); if (selectedPlace?.brand_vessel && selectedPlace.brand_vessel !== v.id) setPlace(null); if (usable) void haptics.tick(); else router.push({ pathname: '/shop', params: { focus: v.id, returnTo: 'create' } }); }} style={[card, { width: '46%', alignItems: 'center', borderColor: vessel === v.id ? C.blue : C.line, opacity: usable ? 1 : .68 }]}><Vessel kind={v.id as VesselKind} size={105} /><Text style={{ fontFamily: serif, color: C.ink, textAlign: 'center' }}>{t(`shop.vessel.${v.id}`)}</Text><Text style={{ color: usable ? C.blue : C.plum, fontSize: 12 }}>{t(usable ? 'create.owned' : 'create.getShop')}</Text></Pressable>; })}
      {catalog.loading && <Body>{t('create.loading')}</Body>}
      {catalog.error && <Button title={t('create.retry')} onPress={() => void catalog.refresh()} />}
    </View>}
    {step === 4 && <View style={{ gap: 15 }}>
      <Body>{t('create.when')}</Body><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(['m1', 'm6', 'y1', 'y5', 'custom', ...(__DEV__ ? ['dev'] : [])] as Quick[]).map(q => <Pressable key={q} onPress={() => { setQuick(q); if (q !== 'custom') setDateText(dateValue(quickDate(q))); void haptics.tick(); }} style={[card, { backgroundColor: quick === q ? C.cream : C.white, padding: 10 }]}><Text style={{ color: C.ink }}>{t(`create.${q}`)}</Text></Pressable>)}</View>
      {quick === 'custom' && <TextInput value={dateText} onChangeText={setDateText} placeholder={t('create.dateHint')} keyboardType='numbers-and-punctuation' style={[card, { color: C.ink }]} />}
      <Text style={{ color: C.blue }}>{t('create.arrives', formatted)}</Text><View style={[card, { backgroundColor: C.cream }]}><Text style={{ fontFamily: serif, color: C.plum }}>{t('create.memoryTitle')}</Text><Text style={{ color: C.ink, marginTop: 6 }}>{t('create.memoryBody')}</Text></View>
      <Body>{t('create.where')}</Body><Pressable onPress={() => { setPlace(null); void haptics.tick(); }} style={[card, { borderColor: !place ? C.blue : C.line }]}><Text style={label}>{t('create.anywhere')}</Text></Pressable>
      {(places.data ?? []).map(p => { const disabled = !!p.brand_vessel && p.brand_vessel !== vessel; return <Pressable key={p.id} disabled={disabled} onPress={() => { setPlace(p.id); void haptics.tick(); }} style={[card, { borderColor: place === p.id ? C.blue : C.line, opacity: disabled ? .45 : 1 }]}><Text style={{ fontFamily: serif, color: C.ink }}>{language === 'zh' ? p.name_zh : p.name_en}</Text><Text style={{ color: C.muted }}>{language === 'zh' ? p.city_zh : p.city_en} · {language === 'zh' ? p.why_zh : p.why_en}</Text>{disabled && <Text style={{ color: C.plum, fontSize: 12 }}>{t('create.brandPlace')}</Text>}</Pressable>; })}
      <Body>{t('create.radius')}</Body><Text style={{ color: C.muted, fontSize: 12 }}>{t('create.serverTime')}</Text>
    </View>}
    <Toast message={error || ((friends.error || catalog.error || places.error) ? t('create.noData') : '')} />
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 'auto' }}>{step > 1 && <View style={{ flex: 1 }}><Button title={t('create.back')} onPress={() => { setStep(step - 1); setError(''); void haptics.tap(); }} /></View>}<View style={{ flex: 1 }}><Button title={t(step === 4 ? 'create.sealSend' : 'create.next')} onPress={next} /></View></View>
  </Screen>;
}
