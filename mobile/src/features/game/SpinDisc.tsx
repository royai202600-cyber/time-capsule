import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, PanResponder, Platform, View, type ImageSourcePropType } from "react-native";
import Svg, { Path } from "react-native-svg";
import { haptics } from "../../components/haptics";
import { C } from "../../theme";
import { useReducedMotion } from "../../useReducedMotion";

const NATIVE = Platform.OS !== "web";
export const DISC = 250;

/** A round picture in a brass rim: a Waypost's kind of place, or a quest's picture. */
export function RoundPicture({ source, size = DISC }: { source: ImageSourcePropType; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", borderWidth: 8, borderColor: C.brass, backgroundColor: C.paper }}>
    <Image source={source} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
  </View>;
}

/** Points the way to swipe; brightens and slides out as the picture sways toward it. */
function SwipeArrow({ side, nudge, size }: { side: -1 | 1; nudge: Animated.Value; size: number }) {
  return <Animated.View pointerEvents="none" style={{
    position: "absolute", top: size / 2 - 16, [side < 0 ? "left" : "right"]: -40,
    opacity: nudge.interpolate({ inputRange: [-1, 0, 1], outputRange: side < 0 ? [1, .6, .3] : [.3, .6, 1] }),
    transform: [{ translateX: nudge.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] }) }],
  }}>
    <Svg width={32} height={32} viewBox="0 0 32 32" fill="none" stroke={C.ink} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <Path d={side < 0 ? "M15 7l-9 9 9 9M25 7l-9 9 9 9" : "M17 7l9 9-9 9M7 7l9 9-9 9"} />
    </Svg>
  </Animated.View>;
}

/**
 * The picture a Waypost is spun with, shared by Waypost and spin quests so both play the same way. While
 * `spinnable`, it sways with arrows until touched; a swipe spins it once and calls `onSpin`. Remount it
 * (change its key) to allow another spin. `children` sit over the picture, such as the rising balls.
 */
export function SpinDisc({ source, spinnable, dim, size = DISC, label, onSpin, children }: {
  source: ImageSourcePropType; spinnable: boolean; dim?: boolean; size?: number; label: string;
  onSpin: (direction: -1 | 1) => void; children?: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const [touched, setTouched] = useState(false);
  const [spun, setSpun] = useState(false);
  const hinting = spinnable && !touched && !spun;
  const nudge = useRef(new Animated.Value(0)).current;
  const rotation = useRef(new Animated.Value(0)).current;
  const turned = useRef(0);
  const busy = useRef(!spinnable);
  busy.current = !spinnable || spun;
  const spin = (direction: -1 | 1) => {
    busy.current = true;
    setSpun(true);
    void haptics.tap();
    Animated.timing(rotation, { toValue: turned.current + direction * 1440, duration: 1500, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE }).start();
    onSpin(direction);
  };
  const spinRef = useRef(spin);
  spinRef.current = spin;
  useEffect(() => {
    if (!hinting || reduced) return;
    const step = (toValue: number, duration: number) => Animated.timing(nudge, { toValue, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE });
    const loop = Animated.loop(Animated.sequence([step(1, 420), step(-1, 720), step(0, 420), Animated.delay(800)]));
    loop.start();
    return () => { loop.stop(); nudge.setValue(0); };
  }, [hinting, reduced, nudge]);

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !busy.current,
    onMoveShouldSetPanResponder: () => !busy.current,
    onPanResponderGrant: () => setTouched(true),
    onPanResponderMove: (_, g) => { turned.current = g.dx * .9; rotation.setValue(turned.current); },
    onPanResponderRelease: (_, g) => {
      if (Math.abs(g.dx) > 50 || Math.abs(g.vx) > .4) spinRef.current(g.dx < 0 ? -1 : 1);
      else { turned.current = 0; setTouched(false); Animated.spring(rotation, { toValue: 0, useNativeDriver: NATIVE }).start(); }
    },
  }), [rotation]);

  return <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
    {hinting && <SwipeArrow side={-1} nudge={nudge} size={size} />}
    {hinting && <SwipeArrow side={1} nudge={nudge} size={size} />}
    <Animated.View style={{ transform: [{ perspective: 900 }, { rotateY: nudge.interpolate({ inputRange: [-1, 1], outputRange: ["-18deg", "18deg"] }) }] }}>
      <Animated.View {...(spinnable ? pan.panHandlers : {})} accessibilityRole={spinnable ? "adjustable" : "image"} accessibilityLabel={label}
        style={{
          width: size, height: size, opacity: dim ? .5 : 1,
          transform: [{ perspective: 900 }, { rotateY: rotation.interpolate({ inputRange: [-3600, 3600], outputRange: ["-3600deg", "3600deg"] }) }],
          ...(Platform.OS === "web" && spinnable ? ({ touchAction: "none", cursor: "grab", userSelect: "none" } as object) : {}),
        }}>
        <RoundPicture source={source} size={size} />
      </Animated.View>
    </Animated.View>
    {children}
  </View>;
}
