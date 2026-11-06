import React, { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { haptics } from "../../components/haptics";
import { C, sans } from "../../theme";
import { useReducedMotion } from "../../useReducedMotion";

export function RitualHold({ title, disabled, onProgress, onComplete }: {
  title: string; disabled?: boolean; onProgress: (progress: number) => void; onComplete: () => void;
}) {
  const reduced = useReducedMotion();
  const [progress, setProgress] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const start = useRef(0);
  const hapticAt = useRef(0);
  const completed = useRef(false);
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (!completed.current) { setProgress(0); onProgress(0); }
  };
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  const begin = () => {
    if (disabled || timer.current) return;
    completed.current = false;
    setProgress(0);
    start.current = Date.now();
    hapticAt.current = 0;
    timer.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - start.current) / 1600);
      setProgress(p);
      onProgress(p);
      if (!reduced && Date.now() >= hapticAt.current) {
        void haptics.build(Math.min(2, Math.floor(p * 3)));
        hapticAt.current = Date.now() + (180 - p * 90);
      }
      if (p >= 1) {
        completed.current = true;
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
        void (reduced ? haptics.tap() : haptics.thump());
        onComplete();
      }
    }, 33);
  };
  return <Pressable onPressIn={begin} onPressOut={stop} disabled={disabled} accessibilityRole="button" accessibilityLabel={title} style={{ opacity: disabled ? 0.5 : 1 }}>
    <View style={{ width: 150, height: 150, alignItems: "center", justifyContent: "center" }}>
      <Svg width={150} height={150} style={{ position: "absolute" }}><Circle cx={75} cy={75} r={68} fill="none" stroke={C.line} strokeWidth={4} /><Circle cx={75} cy={75} r={68} fill="none" stroke={C.brass} strokeWidth={4} strokeDasharray={`${progress * 427} 427`} /></Svg>
      <Text style={{ color: C.ink, fontFamily: sans, fontSize: 16, textAlign: "center", paddingHorizontal: 20 }}>{title}</Text>
    </View>
  </Pressable>;
}
