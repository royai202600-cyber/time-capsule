import React, { useEffect, useState } from 'react';
import { Animated, Platform, Pressable, Text, View } from 'react-native';
import { useF1Text } from '../i18n/f1';
import { C, serif } from '../theme';

type Props = { count: number; index: number; position: Animated.Value; onSelect: (index: number) => void; label: (page: number) => string };
export function PagerDots({ count, index, position, onSelect, label }: Props) {
  return <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' }}>{Array.from({ length: count }, (_, i) => <Pressable key={i} accessibilityRole="button" accessibilityLabel={label(i + 1)} accessibilityState={{ selected: i === index }} onPress={() => onSelect(i)} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
    <Animated.View style={{ height: 8, borderRadius: 4, backgroundColor: C.blue, width: position.interpolate({ inputRange: [i - 1, i, i + 1], outputRange: [8, 20, 8], extrapolate: 'clamp' }), opacity: position.interpolate({ inputRange: [i - 1, i, i + 1], outputRange: [.2, 1, .2], extrapolate: 'clamp' }) }} />
  </Pressable>)}</View>;
}
export function PagerArrows({ count, index, onSelect }: Pick<Props, 'count' | 'index' | 'onSelect'>) {
  const [pointer, setPointer] = useState(false);
  const t = useF1Text();
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const query = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setPointer(query.matches);
    update(); query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  if (!pointer || count < 2) return null;
  return <View pointerEvents="box-none" style={{ position: 'absolute', top: '45%', left: 6, right: 6, flexDirection: 'row', justifyContent: 'space-between', zIndex: 10 }}>
    {[-1, 1].map(direction => <View key={direction} style={{ width: 36 }}>{(direction < 0 ? index > 0 : index < count - 1) && <Pressable accessibilityRole="button" accessibilityLabel={t(direction < 0 ? 'pager.previous' : 'pager.next')} onPress={() => onSelect(index + direction)} style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: serif, fontSize: 28, lineHeight: 32, color: C.blue }}>{direction < 0 ? '‹' : '›'}</Text></Pressable>}</View>)}
  </View>;
}
