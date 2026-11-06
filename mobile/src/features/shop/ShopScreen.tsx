import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Vessel, type VesselKind } from '../../components/Vessel';
import { Screen, Button, Heading, Body } from '../../components/Screen';
import { Toast } from '../../components/Toast';
import { haptics } from '../../components/haptics';
import { useLanguage } from '../../i18n';
import { useAuth } from '../../services/auth';
import { useOwnedVessels, useVessels, useVesselStock } from '../../services/hooks';
import { vessels } from '../../services/data';
import { useReducedMotion } from '../../useReducedMotion';
import { C, motion, serif, sans } from '../../theme';

const card = { borderWidth: 1.5, borderColor: C.line, backgroundColor: C.white, borderRadius: 16, padding: 14 } as const;
export default function ShopScreen() {
  const { t, language, setLanguage } = useLanguage();
  const { session } = useAuth();
  const params = useLocalSearchParams<{ focus?: string; returnTo?: string }>();
  const catalog = useVessels(), owned = useOwnedVessels(session?.user.id ?? ''), stock = useVesselStock();
  const reduced = useReducedMotion();
  const [sheet, setSheet] = useState<string | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const flight = useRef(new Animated.Value(0)).current;
  const featured = catalog.data?.find(v => v.id === 'maison');
  const focused = catalog.data?.find(v => v.id === params.focus);
  const selected = catalog.data?.find(v => v.id === sheet);
  const own = (id: string) => owned.data?.find(o => o.vessel === id);
  const remainder = stock.data?.find(s => s.vessel === 'maison')?.remaining;
  const name = (id: string) => t(`shop.vessel.${id}`);
  const didFocus = useRef(false);
  useEffect(() => { if (!didFocus.current && focused && !owned.loading && focused.price_mop > 0 && !owned.data?.some(o => o.vessel === focused.id)) { didFocus.current = true; setSheet(focused.id); } }, [focused?.id, owned.loading, owned.data]);
  const openSheet = (id: string) => { setError(''); setSheet(id); flight.setValue(0); void haptics.tap(); };
  const acquire = async () => {
    if (!selected || busy) return;
    setBusy(true); setError('');
    const { error: rpcError } = await vessels.acquire(selected.id);
    if (rpcError) { const code = String((rpcError as any).hint ?? ''); setError(code === 'sold_out' || rpcError.message.includes('sold out') ? t('shop.soldOut') : t('shop.error')); setBusy(false); void haptics.warn(); return; }
    await Promise.all([owned.refresh(), stock.refresh()]);
    void haptics.success(); setNotice(t('shop.acquired', name(selected.id)));
    Animated.timing(flight, { toValue: 1, duration: reduced ? motion.fade.quick : 650, useNativeDriver: true }).start(() => { setSheet(null); setBusy(false); flight.setValue(0); if (params.returnTo === 'create') router.back(); });
  };
  const vesselCard = (v: NonNullable<typeof catalog.data>[number]) => {
    const mine = own(v.id), sold = v.edition_total !== null && v.id === 'maison' && remainder === 0;
    return <Pressable key={v.id} onPress={() => !mine && v.price_mop > 0 ? openSheet(v.id) : void haptics.tick()} style={[card, { width: '46%', alignItems: 'center', borderColor: params.focus === v.id ? C.brass : C.line, opacity: sold && !mine ? .55 : 1 }]}>
      <Vessel kind={v.id as VesselKind} size={110} /><Text style={{ fontFamily: serif, fontSize: 16, color: C.ink, textAlign: 'center' }}>{name(v.id)}</Text>
      <Text style={{ fontFamily: sans, color: C.muted, fontSize: 12, textAlign: 'center' }}>{t(`shop.desc.${v.id}`)}</Text>
      <Text style={{ fontFamily: sans, color: mine ? C.blue : C.plum, marginTop: 7 }}>{mine ? t('shop.owned') : sold ? t('shop.soldOut') : v.price_mop ? t('shop.price', v.price_mop) : t('shop.free')}</Text>
    </Pressable>;
  };
  return <Screen>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Pressable onPress={() => router.back()} accessibilityRole='button'><Text style={{ color: C.plum, fontFamily: sans }}>{t('shop.back')}</Text></Pressable><Pressable onPress={() => setLanguage(language === 'zh' ? 'en' : 'zh')} accessibilityRole='button'><Text style={{ color: C.blue }}>{t('shop.langSwitch')}</Text></Pressable></View><Heading>{t('shop.title')}</Heading>
    {featured && <View style={{ backgroundColor: C.ink, borderRadius: 20, padding: 20, alignItems: 'center', gap: 8 }}>
      <Vessel kind='maison' size={176} /><Text style={{ color: C.brass, fontFamily: serif, fontSize: 20, textAlign: 'center' }}>{t('shop.brandTitle')}</Text><Text style={{ color: C.white, textAlign: 'center', fontFamily: sans }}>{t('shop.brandBody')}</Text>
      <Text style={{ color: C.brass }}>{own('maison')?.edition_no ? t('shop.yourNo', own('maison')!.edition_no, featured.edition_total ?? 300) : remainder !== undefined ? t('shop.stock', remainder, featured.edition_total ?? 300) : ''}</Text>
      {!own('maison') && <Button title={remainder === 0 ? t('shop.soldOut') : t('shop.get')} disabled={remainder === 0} onPress={() => openSheet('maison')} />}
    </View>}
    {focused && <View style={[card, { borderColor: C.brass }]}><Text style={{ color: C.plum, fontFamily: serif }}>{name(focused.id)}</Text><Body>{t(`shop.desc.${focused.id}`)}</Body>{!own(focused.id) && focused.price_mop > 0 && <Button title={t('shop.get')} onPress={() => openSheet(focused.id)} />}</View>}
    <Heading>{t('shop.all')}</Heading>{catalog.loading && <Body>{t('shop.loading')}</Body>}<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{(catalog.data ?? []).map(vesselCard)}</View><Body>{t('shop.testing')}</Body>
    {(catalog.error || owned.error || stock.error) && <Button title={t('shop.retry')} onPress={() => { void catalog.refresh(); void owned.refresh(); void stock.refresh(); }} />}
    <Toast message={notice || (catalog.error || owned.error || stock.error ? t('shop.error') : '')} />
    <Pressable onPress={() => router.push('/cabinet')} style={{ alignSelf: 'flex-end', backgroundColor: C.cream, borderRadius: 20, padding: 12 }}><Text style={{ color: C.plum }}>{t('shop.cabinet')} →</Text></Pressable>
    <Modal transparent visible={!!selected} animationType={reduced ? 'fade' : 'slide'} onRequestClose={() => { if (!busy) setSheet(null); }}>{selected && <View style={{ flex: 1, backgroundColor: '#16263FAA', justifyContent: 'flex-end' }}><View style={{ backgroundColor: C.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, alignItems: 'center', gap: 10 }}>
      <Animated.View style={{ transform: [{ translateX: flight.interpolate({ inputRange: [0, 1], outputRange: [0, 135] }) }, { translateY: flight.interpolate({ inputRange: [0, 1], outputRange: [0, 240] }) }, { scale: flight.interpolate({ inputRange: [0, 1], outputRange: [1, .2] }) }], opacity: flight.interpolate({ inputRange: [0, .8, 1], outputRange: [1, 1, 0] }) }}><Vessel kind={selected.id as VesselKind} size={160} /></Animated.View>
      <Text style={{ fontFamily: serif, fontSize: 22, color: C.ink }}>{t('shop.getTitle', name(selected.id))}</Text><Text style={{ color: C.plum }}>{t('shop.price', selected.price_mop)}</Text><Body>{t('shop.getNote')}</Body><Toast message={error} />
      <View style={{ width: '100%', gap: 8 }}><Button title={t('shop.get')} disabled={busy} onPress={() => void acquire()} /><Button title={t('shop.cancel')} disabled={busy} onPress={() => setSheet(null)} /></View>
    </View></View>}</Modal>
  </Screen>;
}
