import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Animated as NativeAnimated, Image, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { Easing, type SharedValue, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Vessel as SvgVessel } from '../Vessel';
import { VESSEL_ART, type VesselKind } from '../vesselArt';
import { fxGlint, vesselParts, type ArtLayer, type IdleMotion, type OpenKey, type Point } from '../art/manifest';
import { useReducedMotion } from '../useReducedMotion';

type Variant = 'svg' | 'illustrated';
const Context = createContext<{ variant: Variant; setVariant: (v: Variant) => void }>({ variant: 'illustrated', setVariant: () => {} });
export function VesselSettingsProvider({ children }: { children: React.ReactNode }) {
  const [variant, set] = useState<Variant>('illustrated');
  useEffect(() => { void AsyncStorage.getItem('tc-vessel-variant').then(v => { if (v === 'svg' || v === 'illustrated') set(v); }); }, []);
  return <Context.Provider value={{ variant, setVariant: v => { set(v); void AsyncStorage.setItem('tc-vessel-variant', v); } }}>{children}</Context.Provider>;
}
export const useVesselSettings = () => useContext(Context);

const TAU = Math.PI * 2;
/** Linear keyframe sampling of one property; keys without the property are skipped. */
function sample(keys: OpenKey[], v: number, prop: keyof Omit<OpenKey, 'at'>, fallback: number) {
  'worklet';
  let prevAt = -1, prevVal = fallback, found = false;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i], val = k[prop];
    if (val === undefined) continue;
    if (!found) { found = true; if (v <= k.at) return val; }
    else if (v <= k.at) return prevVal + (val - prevVal) * ((v - prevAt) / Math.max(1e-6, k.at - prevAt));
    prevAt = k.at; prevVal = val;
  }
  return prevVal;
}
/** Rotate/scale about a canvas point. */
function about(pivot: Point, size: number, inner: any[]) {
  'worklet';
  const px = (pivot.x - 512) * size / 1024, py = (pivot.y - 512) * size / 1024;
  return [{ translateX: px }, { translateY: py }, ...inner, { translateX: -px }, { translateY: -py }];
}

// Opening: every moving layer follows its keyframes as lidLift goes 0 → 1 (VESSEL-SOP §3–4).
function MovingLayer({ layer, size, lidLift, ready }: { layer: ArtLayer; size: number; lidLift: SharedValue<number>; ready: boolean }) {
  const reduced = useReducedMotion();
  const pivot = layer.pivot ?? { x: 512, y: 512 };
  const keys = (ready && layer.openReady) || layer.open || [];
  const style = useAnimatedStyle(() => {
    const raw = Math.max(0, Math.min(1, lidLift.value));
    const v = reduced ? (raw > 0.5 ? 1 : 0) : raw;
    return {
      opacity: sample(keys, v, 'opacity', 1),
      transform: [
        { translateX: size * sample(keys, v, 'x', 0) }, { translateY: size * sample(keys, v, 'y', 0) },
        ...about(pivot, size, [{ rotate: `${sample(keys, v, 'rotate', 0)}deg` }, { scaleX: sample(keys, v, 'scaleX', 1) }, { scaleY: sample(keys, v, 'scaleY', 1) }, { scale: sample(keys, v, 'scale', 1) }]),
      ],
    };
  }, [keys, size, reduced, pivot.x, pivot.y]);
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, style]}><Image source={layer.source} style={{ width: size, height: size }} resizeMode="contain" /></Animated.View>;
}
/** A warm point of light revealed while opening (the Maison ring catching the light). */
function OpenGlow({ at, size, lidLift }: { at: Point; size: number; lidLift: SharedValue<number> }) {
  const reduced = useReducedMotion();
  const style = useAnimatedStyle(() => {
    const reveal = Math.max(0, Math.min(1, (lidLift.value - .35) / .45));
    const pulse = reduced ? 1 : 1 + .08 * Math.sin(lidLift.value * Math.PI * 3);
    return { opacity: reveal * (reduced ? .55 : .5 + .25 * Math.sin(lidLift.value * Math.PI * 3)), transform: [{ scale: pulse }] };
  }, [reduced]);
  const d = size * .1;
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: at.x * size / 1024 - d / 2, top: at.y * size / 1024 - d / 2, width: d, height: d, borderRadius: d / 2, backgroundColor: '#F7D782', shadowColor: '#F7D782', shadowOpacity: .8, shadowRadius: size * .035 }, style]} />;
}
/** A still vessel that is ready to open: one layer (e.g. the lantern glow) pulses under the assembled art. */
function ReadyPulse({ source, size }: { source: ArtLayer['source']; size: number }) {
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
  return <NativeAnimated.Image pointerEvents="none" source={source} resizeMode="contain" style={{ position: 'absolute', width: size, height: size, opacity: reduced ? .5 : pulse }} />;
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

// Idle: a loop while a vessel rests on screen. One linear clock per vessel (0 → 1); every term is a
// whole number of turns, so the loop is seamless and t = 0 is the rest pose (VESSEL-SOP §5).
function idleStyle(motions: IdleMotion[], t: number, size: number, ready: boolean) {
  'worklet';
  const transform: any[] = [];
  let opacity: number | undefined;
  const hump = .5 - .5 * Math.cos(TAU * t);
  const center = { x: 512, y: 512 };
  for (let i = 0; i < motions.length; i++) {
    const m = motions[i];
    if (m.type === 'sway') transform.push(...about(m.pivot ?? center, size, [{ rotate: `${m.deg * Math.sin(TAU * (m.turns ?? 1) * t)}deg` }]));
    else if (m.type === 'bob') { const d = size * m.amount * Math.sin(TAU * (m.turns ?? 1) * t); transform.push(m.axis === 'x' ? { translateX: d } : { translateY: d }); }
    else if (m.type === 'float') transform.push({ translateY: -size * m.amount * hump });
    else if (m.type === 'breathe') transform.push({ scale: 1 + m.amount * hump });
    else if (m.type === 'peek') transform.push(...about(m.pivot, size, [{ rotate: `${m.deg * hump * hump}deg` }]));
    else if (m.type === 'spin') transform.push(...about(m.pivot ?? center, size, [{ rotate: `${360 * (m.turns ?? 1) * t}deg` }]));
    else if (m.type === 'tick') transform.push(...about(m.pivot ?? center, size, [{ rotate: `${m.deg * Math.pow(Math.max(0, Math.sin(TAU * t)), 8)}deg` }]));
    else if (m.type === 'drift') { transform.push({ translateY: (m.direction === 'down' ? 1 : -1) * size * m.amount * t }); opacity = Math.sin(Math.PI * t); }
    else if (m.type === 'glow') {
      const breath = .5 - .5 * Math.cos(TAU * 2 * t), f = m.flicker ?? 0;
      const base = ready ? (m.readyBase ?? m.base) : m.base, range = ready ? (m.readyRange ?? m.range) : m.range;
      opacity = base + range * breath + f * Math.sin(TAU * 5 * t) + f * .625 * Math.sin(TAU * 9 * t);
    }
  }
  return opacity === undefined ? { transform } : { opacity, transform };
}
function IdlePart({ motions, t, size, ready, children }: { motions?: IdleMotion[]; t: SharedValue<number>; size: number; ready: boolean; children: React.ReactNode }) {
  const list = motions ?? [];
  const style = useAnimatedStyle(() => idleStyle(list, t.value, size, ready), [list, size, ready]);
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: size, height: size }, style]}>{children}</Animated.View>;
}
// The dome's highlight gleams once per loop, drifting a hair along the glass.
function Glint({ source, t, size }: { source: ArtLayer['source']; t: SharedValue<number>; size: number }) {
  const style = useAnimatedStyle(() => {
    const gleam = Math.pow(Math.max(0, Math.sin(TAU * (t.value - .3))), 3);
    return { opacity: .9 * gleam, transform: [{ translateX: size * .05 * (gleam - .5) }] };
  }, [size]);
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: size, height: size }, style]}><Image source={source} style={{ width: size, height: size }} resizeMode="contain" /></Animated.View>;
}
// A sparkle twinkles once per loop on the wax or brass: grows, turns a little, fades.
function Sparkle({ t, size, at }: { t: SharedValue<number>; size: number; at: Point }) {
  const w = size * .26;
  const style = useAnimatedStyle(() => {
    const s = Math.pow(Math.max(0, Math.sin(TAU * (t.value - .55))), 8);
    return { opacity: s, transform: [{ scale: .5 + .9 * s }, { rotate: `${35 * s}deg` }] };
  }, [size]);
  return <Animated.Image pointerEvents="none" source={fxGlint} resizeMode="contain"
    style={[{ position: 'absolute', left: at.x * size / 1024 - w / 2, top: at.y * size / 1024 - w / 2, width: w, height: w }, style]} />;
}
function IdleVessel({ kind, size, ready }: { kind: VesselKind; size: number; ready: boolean }) {
  const spec = vesselParts[kind];
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = 0;
    t.value = withRepeat(withTiming(1, { duration: spec.idleMs, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(t);
  }, [spec.idleMs, t]);
  const layer = (l: ArtLayer) => <IdlePart key={l.name} motions={l.idle} t={t} size={size} ready={ready}>
    <Image source={l.source} style={{ width: size, height: size }} resizeMode="contain" />
  </IdlePart>;
  return <View style={{ width: size, height: size }} accessible accessibilityLabel={kind}>
    {spec.layers.filter(l => l.ground).map(layer)}
    <IdlePart motions={spec.idle} t={t} size={size} ready={ready}>
      {spec.layers.filter(l => !l.ground).map(layer)}
      {spec.glint && <Glint source={spec.glint} t={t} size={size} />}
      {spec.sparkle && <Sparkle t={t} size={size} at={spec.sparkle} />}
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
  const spec = vesselParts[kind];
  // Only the original 7 vessels have SVG drawings; others always use the illustrated art.
  if ((mode ?? variant) === 'svg' && kind in VESSEL_ART) return <SvgVessel kind={kind} size={size} lidLift={lidLift} contentSway={contentSway} />;
  if (!lidLift && idle && !reduced) return <IdleVessel kind={kind} size={size} ready={ready} />;
  const pulse = ready && spec.readyPulse ? spec.layers.find(l => l.name === spec.readyPulse) : undefined;
  if (!lidLift) return pulse
    ? <View style={{ width: size, height: size }}><ReadyPulse source={pulse.source} size={size} /><Image source={spec.assembled} style={{ width: size, height: size }} resizeMode="contain" accessibilityLabel={kind} /></View>
    : <Image source={spec.assembled} style={{ width: size, height: size }} resizeMode="contain" accessibilityLabel={kind} />;
  return <View style={{ width: size, height: size }} accessible accessibilityLabel={kind}>
    {spec.layers.map(layer => layer.role === 'static' || !layer.open
      ? <Image key={layer.name} source={layer.source} style={{ position: 'absolute', width: size, height: size }} resizeMode="contain" />
      : <MovingLayer key={layer.name} layer={layer} size={size} lidLift={lidLift} ready={ready} />)}
    {spec.openGlow && <OpenGlow at={spec.openGlow} size={size} lidLift={lidLift} />}
    <AssembledOverlay source={spec.assembled} size={size} lidLift={lidLift} />
  </View>;
}
export type { VesselKind };
