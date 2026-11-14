import React, { useEffect, useState } from 'react';
import { Animated, Platform, Pressable, View, useWindowDimensions } from 'react-native';
import { useScreenText } from '../i18n/useScreenText';
import { C } from '../theme';
import Svg, { Path } from 'react-native-svg';

type Props = { count: number; index: number; position: Animated.Value; onSelect: (index: number) => void; label: (page: number) => string };

// Compact dots: 6 px, 6 px apart; the active one stretches into a 14 px ink-blue pill as you swipe.
export function PagerDots({ count, index, position, onSelect, label }: Props) {
  return <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 8 }}>
    {Array.from({ length: count }, (_, i) => {
      const near = { inputRange: [i - 1, i, i + 1], extrapolate: 'clamp' as const };
      return <Pressable key={i} accessibilityRole="button" accessibilityLabel={label(i + 1)} accessibilityState={{ selected: i === index }}
        onPress={() => onSelect(i)} hitSlop={{ top: 12, bottom: 12, left: 3, right: 3 }}>
        <View style={{ height: 6, borderRadius: 3, overflow: 'hidden' }}>
          <Animated.View style={{ height: 6, borderRadius: 3, backgroundColor: C.line, width: position.interpolate({ ...near, outputRange: [6, 14, 6] }) }} />
          <Animated.View style={{ position: 'absolute', top: 0, left: 0, height: 6, borderRadius: 3, backgroundColor: C.blue, width: position.interpolate({ ...near, outputRange: [6, 14, 6] }), opacity: position.interpolate({ ...near, outputRange: [0, 1, 0] }) }} />
        </View>
      </Pressable>;
    })}
  </View>;
}

// Desktop only: quiet line chevrons in the margin beside the card. Hidden on touch devices and
// whenever there isn't room outside the card, so they never sit on top of content.
export function PagerArrows({ count, index, onSelect, contentWidth = 600 }: Pick<Props, 'count' | 'index' | 'onSelect'> & { contentWidth?: number }) {
  const [pointer, setPointer] = useState(false);
  const { width } = useWindowDimensions();
  const [hover, setHover] = useState<number | null>(null);
  const t = useScreenText();
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const query = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setPointer(query.matches);
    update(); query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const margin = (width - contentWidth) / 2;
  const show = pointer && count > 1 && margin >= 64;
  return <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 10 }}>
    {show && [-1, 1].map(direction => (direction < 0 ? index > 0 : index < count - 1) && <Pressable key={direction}
      accessibilityRole="button" accessibilityLabel={t(direction < 0 ? 'pager.previous' : 'pager.next')}
      onPress={() => onSelect(index + direction)} onHoverIn={() => setHover(direction)} onHoverOut={() => setHover(null)}
      style={{ position: 'absolute', top: '45%', [direction < 0 ? 'left' : 'right']: margin - 52, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', opacity: hover === direction ? 1 : .45 }}>
      <Svg width={22} height={22} viewBox="0 0 24 24"><Path d={direction < 0 ? 'M15 4 L7 12 L15 20' : 'M9 4 L17 12 L9 20'} stroke={hover === direction ? C.blue : C.muted} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" fill="none" /></Svg>
    </Pressable>)}
  </View>;
}
