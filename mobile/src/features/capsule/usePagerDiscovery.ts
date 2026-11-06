import { useEffect, useRef } from 'react';
import { Animated, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { motion } from '../../theme';

const NUDGED = 'tc-capsule-pager-nudged-v1';
const SWIPED = 'tc-capsule-pager-swiped-v1';
export function usePagerDiscovery(pages: React.RefObject<React.ElementRef<typeof ScrollView> | null>, enabled: boolean, reduced: boolean) {
  const hintOpacity = useRef(new Animated.Value(0)).current;
  const nudge = useRef(new Animated.Value(0)).current;
  const nudging = useRef(false);
  const interacted = useRef(false);
  const dismissed = useRef(false);
  const dismiss = () => {
    interacted.current = true;
    if (dismissed.current) return;
    dismissed.current = true;
    Animated.timing(hintOpacity, { toValue: 0, duration: motion.fade.quick, useNativeDriver: true }).start();
    void AsyncStorage.setItem(SWIPED, '1').catch(() => {});
  };
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let listener: string | undefined;
    void AsyncStorage.multiGet([NUDGED, SWIPED]).then(values => {
      if (!live) return;
      dismissed.current = !!values[1][1];
      if (!dismissed.current && !interacted.current) hintOpacity.setValue(1);
      if (values[0][1] || interacted.current) return;
      void AsyncStorage.setItem(NUDGED, '1').catch(() => {});
      if (reduced) return;
      timer = setTimeout(() => {
        if (!live || interacted.current) return;
        nudging.current = true;
        listener = nudge.addListener(({ value }) => pages.current?.scrollTo({ x: value, animated: false }));
        Animated.sequence([
          Animated.timing(nudge, { toValue: 40, duration: 260, useNativeDriver: false }),
          Animated.spring(nudge, { toValue: 0, ...motion.spring.soft, useNativeDriver: false }),
        ]).start(() => { nudging.current = false; if (listener) nudge.removeListener(listener); });
      }, 600);
    }).catch(() => { if (live) hintOpacity.setValue(1); });
    return () => { live = false; clearTimeout(timer); nudge.stopAnimation(); if (listener) nudge.removeListener(listener); nudging.current = false; };
  }, [enabled, reduced, pages, nudge, hintOpacity]);
  return { hintOpacity, nudging, dismiss, beginDrag: () => { interacted.current = true; nudge.stopAnimation(); nudging.current = false; } };
}
