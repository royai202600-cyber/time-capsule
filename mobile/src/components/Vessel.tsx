import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Animated as NativeAnimated, Image, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { Easing, type SharedValue, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Vessel as SvgVessel } from '../Vessel';
import type { VesselKind } from '../vesselArt';
import { domeGlint, fxGlint, vesselParts, type ArtLayer } from '../art/manifest';
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
// Idle motion: a quiet loop while a vessel rests on screen. One linear clock per vessel (0 → 1),
// every term is sin/cos of a whole number of turns, so the loop is seamless and t = 0 or 1 is the rest pose.
const IDLE_MS: Record<VesselKind, number> = { dome: 5600, bottle: 4800, lantern: 4400, envelope: 5200, tin: 6000, musicbox: 5000, maison: 6400 };
const TAU = Math.PI * 2;
function idleStyle(kind: VesselKind, part: string, t: number, size: number, ready: boolean) {
  'worklet';
  const wave = (turns: number) => Math.sin(TAU * turns * t);
  const hump = .5 - .5 * Math.cos(TAU * t);
  const at = (x: number, y: number, inner: any[]) => {
    const px = (x - 512) * size / 1024, py = (y - 512) * size / 1024;
    return [{ translateX: px }, { translateY: py }, ...inner, { translateX: -px }, { translateY: -py }];
  };
  switch (`${kind}:${part}`) {
    case 'dome:rose': return { transform: at(505, 790, [{ rotate: `${2.4 * wave(1)}deg` }]) };
    case 'bottle:waves': return { transform: [{ translateX: size * .014 * wave(1) }] };
    case 'bottle:float': return { transform: [{ translateY: size * .009 * wave(2) }, ...at(500, 640, [{ rotate: `${2.2 * wave(1)}deg` }])] };
    case 'lantern:outer': return { transform: at(512, 110, [{ rotate: `${1.5 * wave(1)}deg` }]) };
    case 'lantern:glow': {
      const breath = .5 - .5 * Math.cos(TAU * 2 * t), flicker = .04 * wave(5) + .02 * wave(9);
      return { opacity: (ready ? .5 + .32 * breath : .22 + .2 * breath) + flicker };
    }
    case 'envelope:outer': return { transform: [{ translateY: -size * .012 * hump }, { rotate: `${.7 * wave(1)}deg` }] };
    case 'tin:outer': return { transform: [{ translateY: -size * .009 * hump }, { scale: 1 + .012 * hump }] };
    case 'musicbox:outer': return { transform: [{ scale: 1 + .008 * hump }] };
    case 'musicbox:lid': return { transform: at(541, 292, [{ rotate: `${-3 * hump * hump}deg` }]) };
    case 'maison:outer': return { transform: [{ translateY: -size * .01 * hump }] };
    case 'maison:lid': return { transform: at(605, 300, [{ rotate: `${-1.5 * hump * hump}deg` }]) };
    // The dome's highlight gleams once per loop, drifting a hair along the glass.
    case 'dome:glint': {
      const gleam = Math.pow(Math.max(0, Math.sin(TAU * (t - .3))), 3);
      return { opacity: .9 * gleam, transform: [{ translateX: size * .01 * (gleam - .5) }] };
    }
    // A sparkle twinkles once per loop on the wax or brass: grows, turns a little, fades.
    case 'envelope:sparkle': case 'tin:sparkle': case 'maison:sparkle': case 'lantern:sparkle': {
      const s = Math.pow(Math.max(0, Math.sin(TAU * (t - .55))), 8);
      return { opacity: s, transform: [{ scale: .45 + .65 * s }, { rotate: `${25 * s}deg` }] };
    }
    default: return {};
  }
}
function IdlePart({ kind, part, t, size, ready, children }: { kind: VesselKind; part: string; t: SharedValue<number>; size: number; ready: boolean; children: React.ReactNode }) {
  const style = useAnimatedStyle(() => idleStyle(kind, part, t.value, size, ready), [kind, part, size, ready]);
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: size, height: size }, style]}>{children}</Animated.View>;
}
// Where the sparkle sits on each vessel's 1024 canvas (wax seal, tin lid front edge, Maison clasp, lantern top ring).
const SPARKLE: Partial<Record<VesselKind, { x: number; y: number }>> = {
  envelope: { x: 440, y: 512 }, tin: { x: 300, y: 470 }, maison: { x: 438, y: 612 }, lantern: { x: 578, y: 214 },
};
function Sparkle({ kind, t, size, at }: { kind: VesselKind; t: SharedValue<number>; size: number; at: { x: number; y: number } }) {
  const w = size * .2;
  const style = useAnimatedStyle(() => idleStyle(kind, 'sparkle', t.value, size, false), [kind, size]);
  return <Animated.Image pointerEvents="none" source={fxGlint} resizeMode="contain"
    style={[{ position: 'absolute', left: at.x * size / 1024 - w / 2, top: at.y * size / 1024 - w / 2, width: w, height: w }, style]} />;
}
function IdleVessel({ kind, size, ready }: { kind: VesselKind; size: number; ready: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = 0;
    t.value = withRepeat(withTiming(1, { duration: IDLE_MS[kind], easing: Easing.linear }), -1, false);
    return () => cancelAnimation(t);
  }, [kind, t]);
  const layers = vesselParts[kind].layers;
  const layer = (l: ArtLayer) => <IdlePart key={l.name} kind={kind} part={l.name} t={t} size={size} ready={ready}>
    <Image source={l.source} style={{ width: size, height: size }} resizeMode="contain" />
  </IdlePart>;
  const body = kind === 'bottle'
    ? [layer(layers[0]), <IdlePart key="float" kind={kind} part="float" t={t} size={size} ready={ready}>{layers.slice(1).map(layer)}</IdlePart>]
    : layers.map(layer);
  const sparkle = SPARKLE[kind];
  return <View style={{ width: size, height: size }} accessible accessibilityLabel={kind}>
    <IdlePart kind={kind} part="outer" t={t} size={size} ready={ready}>
      {body}
      {kind === 'dome' && <IdlePart kind={kind} part="glint" t={t} size={size} ready={ready}><Image source={domeGlint} style={{ width: size, height: size }} resizeMode="contain" /></IdlePart>}
      {sparkle && <Sparkle kind={kind} t={t} size={size} at={sparkle} />}
    </IdlePart>
  </View>;
}
export function Vessel({ kind, size = 180, lidLift, contentSway, mode, ready = false, idle = false }: {
  kind: VesselKind; size?: number; lidLift?: SharedValue<number>; contentSway?: SharedValue<number>; mode?: Variant; ready?: boolean;
  /** Gentle resting loop. Pass true only for the visible/active vessel; ignored with Reduce Motion or lidLift. */
  idle?: boolean;
}) {
  const { variant } = useVesselSettings();
  const reduced = useReducedMotion();
  if ((mode ?? variant) === 'svg') return <SvgVessel kind={kind} size={size} lidLift={lidLift} contentSway={contentSway} />;
  const parts = vesselParts[kind];
  if (!lidLift && idle && !reduced) return <IdleVessel kind={kind} size={size} ready={ready} />;
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
