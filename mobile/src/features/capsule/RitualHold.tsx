import React, { useEffect, useRef, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { SealHoldIcon } from "../../components/DockIcons";
import { haptics } from "../../components/haptics";
import { C, sans } from "../../theme";
import { useReducedMotion } from "../../useReducedMotion";

// iPhone Safari turns a long press into text selection or a callout menu, which cancels the hold.
// Nothing in the button is selectable, and the browser's long-press menu is blocked on it.
const noSelect = Platform.OS === "web" ? ({ userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none", touchAction: "manipulation" } as object) : {};

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
  const node = useRef<React.ComponentRef<typeof Pressable>>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  useEffect(() => {
    const el = node.current as unknown as HTMLElement | null;
    if (Platform.OS !== "web" || !el?.addEventListener) return;
    const block = (e: Event) => e.preventDefault();
    el.addEventListener("contextmenu", block);
    el.addEventListener("selectstart", block);
    return () => { el.removeEventListener("contextmenu", block); el.removeEventListener("selectstart", block); };
  }, []);
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
  const pressed = timer.current !== null || progress > 0;
  return <View style={[{ alignItems: "center", gap: 8 }, noSelect]}>
    <Pressable ref={node} onPressIn={begin} onPressOut={stop} disabled={disabled} accessibilityRole="button" accessibilityLabel={title} style={[{ opacity: disabled ? 0.5 : 1 }, noSelect]}>
      <View pointerEvents="none" style={{ transform: [{ scale: pressed && !reduced ? 0.95 : 1 }] }}><SealHoldIcon size={150} progress={progress} /></View>
    </Pressable>
    <Text selectable={false} style={[{ color: C.muted, fontFamily: sans, fontSize: 13, textAlign: "center" }, noSelect]}>{title}</Text>
  </View>;
}
