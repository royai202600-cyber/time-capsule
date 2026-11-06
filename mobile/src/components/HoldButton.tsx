import React, { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { C } from "../theme";
import { haptics } from "./haptics";
import { useReducedMotion } from "../useReducedMotion";
export function HoldButton({
  title,
  onComplete,
  duration = 1600,
}: {
  title: string;
  onComplete: () => void;
  duration?: number;
}) {
  const reduced = useReducedMotion();
  const [progress, setProgress] = useState(0),
    timer = useRef<ReturnType<typeof setInterval> | null>(null),
    started = useRef(0),
    last = useRef(0);
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setProgress(0);
  };
  useEffect(() => stop, []);
  const begin = () => {
    stop();
    started.current = Date.now();
    last.current = 0;
    timer.current = setInterval(() => {
      const elapsed = Date.now() - started.current,
        p = Math.min(1, elapsed / duration);
      setProgress(p);
      const step = Math.floor(elapsed / (180 - 90 * p));
      if (step > last.current) {
        last.current = step;
        void haptics.build(reduced ? 0 : Math.min(2, Math.floor(p * 3)));
      }
      if (p >= 1) {
        stop();
        void (reduced ? haptics.tap() : haptics.thump());
        onComplete();
      }
    }, 40);
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPressIn={begin}
      onPressOut={stop}
    >
      <View
        style={{
          alignItems: "center",
          justifyContent: "center",
          width: 150,
          height: 150,
        }}
      >
        <Svg width={150} height={150} style={{ position: "absolute" }}>
          <Circle
            cx={75}
            cy={75}
            r={68}
            fill="none"
            stroke={C.line}
            strokeWidth={4}
          />
          <Circle
            cx={75}
            cy={75}
            r={68}
            fill="none"
            stroke={C.brass}
            strokeWidth={4}
            strokeDasharray={`${progress * 427} 427`}
            rotation={-90}
            origin="75,75"
          />
        </Svg>
        <Text>{title}</Text>
      </View>
    </Pressable>
  );
}
