import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Animated as NativeAnimated, Image, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Vessel as SvgVessel } from '../Vessel';
import type { VesselKind } from '../vesselArt';
import { vesselParts, type ArtLayer } from '../art/manifest';
import { useReducedMotion } from '../useReducedMotion';

type Variant = 'svg' | 'illustrated';
const Context = createContext<{ variant: Variant; setVariant: (v: Variant) => void }>({ variant: 'illustrated', setVariant: () => {} });
export function VesselSettingsProvider({ children }: { children: React.ReactNode }) {
  const [variant, set] = useState<Variant>('illustrated');
  useEffect(() => { void AsyncStorage.getItem('tc-vessel-variant').then(v => { if (v === 'svg' || v === 'illustrated') set(v); }); }, []);
  return <Context.Provider value={{ variant, setVariant: v => { set(v); void AsyncStorage.setItem('tc-vessel-variant', v); } }}>{children}</Context.Provider>;
}
export const useVesselSettings = () => useContext(Context);

function MovingLayer({ kind, layer, size, lidLift, ready }: { kind: VesselKind; layer: ArtLayer; size: number; lidLift: SharedValue<number>; ready: boolean }) {
  const reduced = useReducedMotion();
  const pivot = layer.pivot ?? { x: 512, y: 512 };
  const px = (pivot.x - 512) * size / 1024, py = (pivot.y - 512) * size / 1024;
  const style = useAnimatedStyle(() => {
    const raw = Math.max(0, Math.min(1, lidLift.value));
    const value = reduced ? (raw > 0.5 ? 1 : 0) : raw;
    const flap = Math.max(0, (value - .3) / .7);
    const letter = Math.max(0, (value - .42) / .58);
    const corkFall = Math.max(0, (value - .5) / .5);
    const isLid = layer.name === 'lid';
    const isCork = kind === 'bottle' && layer.name === 'cork';
    const x = isCork ? size * (.16 * Math.min(1, value * 2) + .12 * corkFall) : kind === 'bottle' && layer.name === 'letter' ? size * .19 * letter : 0;
    const y = isCork ? size * (-.18 * Math.min(1, value * 2) + .27 * corkFall) : kind === 'bottle' && layer.name === 'letter' ? -size * .32 * letter : layer.name === 'cap' ? -size * .09 * value : layer.name === 'glass' ? -size * .35 * value : 0;
    const rotation = isLid ? -22 * value : isCork ? -18 * value : 0;
    const scaleY = kind === 'envelope' && layer.name === 'flap' ? 1 - 2 * flap : isLid ? 1 - .3 * value : 1;
    const opacity = kind === 'lantern' && layer.name === 'glow' ? (ready ? .5 + .5 * value : .25 + .75 * value) : kind === 'envelope' && layer.name === 'seal' ? 1 - Math.min(1, value / .3) : isCork ? 1 - corkFall : layer.name === 'cap' ? 1 - .2 * value : kind === 'dome' && layer.name === 'glass' ? 1 - value : 1;
    const scale = kind === 'envelope' && layer.name === 'seal' ? 1 - .18 * Math.min(1, value / .3) : 1;
    return { opacity, transform: [
      { translateX: x }, { translateY: y },
      { translateX: px }, { translateY: py }, { rotate: `${rotation}deg` }, { scaleY }, { scale }, { translateX: -px }, { translateY: -py },
    ] };
  }, [kind, layer.name, layer.role, size, reduced, px, py, ready]);
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, style]}><Image source={layer.source} style={{ width: size, height: size }} resizeMode="contain" /></Animated.View>;
}
function RingGlint({ size, lidLift }: { size: number; lidLift: SharedValue<number> }) {
  const reduced = useReducedMotion();
  const style = useAnimatedStyle(() => {
    const reveal = Math.max(0, Math.min(1, (lidLift.value - .35) / .45));
    const pulse = reduced ? 1 : 1 + .08 * Math.sin(lidLift.value * Math.PI * 3);
    return { opacity: reveal * (reduced ? .55 : .5 + .25 * Math.sin(lidLift.value * Math.PI * 3)), transform: [{ scale: pulse }] };
  }, [reduced]);
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: size * .46, top: size * .48, width: size * .1, height: size * .1, borderRadius: size * .05, backgroundColor: '#F7D782', shadowColor: '#F7D782', shadowOpacity: .8, shadowRadius: size * .035 }, style]} />;
}
function RingLayer({ source, size, lidLift }: { source: ArtLayer['source']; size: number; lidLift: SharedValue<number> }) {
  const reduced = useReducedMotion();
  const style = useAnimatedStyle(() => {
    const reveal = Math.max(0, Math.min(1, (lidLift.value - .22) / .55));
    return { transform: [{ translateY: -size * .035 * reveal }, { scale: 1 + .22 * reveal }], opacity: reduced ? 1 : .85 + .15 * reveal };
  }, [reduced, size]);
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, style]}><Image source={source} style={{ width: size, height: size }} resizeMode="contain" /></Animated.View>;
}
function ReadyLantern({ size }: { size: number }) {
  const reduced = useReducedMotion();
  const pulse = useRef(new NativeAnimated.Value(.4)).current;
  useEffect(() => {
    if (reduced) return;
    const animation = NativeAnimated.loop(NativeAnimated.sequence([
      NativeAnimated.timing(pulse, { toValue: .85, duration: 1300, useNativeDriver: true }),
      NativeAnimated.timing(pulse, { toValue: .4, duration: 1300, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [pulse, reduced]);
  return <NativeAnimated.Image pointerEvents="none" source={vesselParts.lantern.layers[0].source} resizeMode="contain" style={{ position: 'absolute', width: size, height: size, opacity: reduced ? .5 : pulse }} />;
}
function AssembledOverlay({ source, size, lidLift }: { source: ArtLayer['source']; size: number; lidLift: SharedValue<number> }) {
  const reduced = useReducedMotion();
  const style = useAnimatedStyle(() => ({
    opacity: reduced ? (lidLift.value > .5 ? 0 : 1) : Math.max(0, 1 - lidLift.value / .08),
  }), [reduced]);
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, style]}>
    <Image source={source} style={{ width: size, height: size }} resizeMode="contain" />
  </Animated.View>;
}
export function Vessel({ kind, size = 180, lidLift, contentSway, mode, ready = false }: {
  kind: VesselKind; size?: number; lidLift?: SharedValue<number>; contentSway?: SharedValue<number>; mode?: Variant; ready?: boolean;
}) {
  const { variant } = useVesselSettings();
  if ((mode ?? variant) === 'svg') return <SvgVessel kind={kind} size={size} lidLift={lidLift} contentSway={contentSway} />;
  const parts = vesselParts[kind];
  if (!lidLift) return ready && kind === 'lantern'
    ? <View style={{ width: size, height: size }}><ReadyLantern size={size} /><Image source={parts.assembled} style={{ width: size, height: size }} resizeMode="contain" accessibilityLabel={kind} /></View>
    : <Image source={parts.assembled} style={{ width: size, height: size }} resizeMode="contain" accessibilityLabel={kind} />;
  return <View style={{ width: size, height: size }} accessible accessibilityLabel={kind}>
    {parts.layers.map(layer => kind === 'maison' && layer.name === 'ring'
      ? <RingLayer key={layer.name} source={layer.source} size={size} lidLift={lidLift} /> : layer.role === 'static'
      ? <Image key={layer.name} source={layer.source} style={{ position: 'absolute', width: size, height: size }} resizeMode="contain" />
      : <MovingLayer key={layer.name} kind={kind} layer={layer} size={size} lidLift={lidLift} ready={ready} />)}
    {kind === 'maison' && <RingGlint size={size} lidLift={lidLift} />}
    <AssembledOverlay source={parts.assembled} size={size} lidLift={lidLift} />
  </View>;
}
export type { VesselKind };
