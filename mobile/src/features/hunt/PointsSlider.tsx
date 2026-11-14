// A quest's points: a slider for the usual range and a box for an exact number (docs/design/city-orienteering.md).
// The slider runs 5–200 in steps of 5; the box takes anything from 1 to 999, and past 200 the slider rests at its end.
import React, { useRef, useState } from "react";
import { PanResponder, Platform, Text, TextInput, View } from "react-native";
import { haptics } from "../../components/haptics";
import { C, radii, sans, serif } from "../../theme";
import { SLIDER, sliderSpot, sliderValue } from "./pointsScale";

const THUMB = 26;

export function PointsSlider({ value, max, label, onChange }: {
  value: number; max: number; label: string; onChange: (points: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const track = useRef<React.ComponentRef<typeof View>>(null);
  const left = useRef(0);
  const last = useRef(value);
  last.current = value;
  const move = (pageX: number) => {
    if (!width) return;
    const next = sliderValue((pageX - left.current - THUMB / 2) / (width - THUMB));
    if (next !== last.current) { last.current = next; void haptics.tick(); onChange(next); }
  };
  // The handlers below are made once, so they reach the latest width and value through this ref.
  const moveRef = useRef(move);
  moveRef.current = move;
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    // Once you hold the thumb, the sheet underneath doesn't take the drag away to scroll.
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => {
      const x = e.nativeEvent.pageX;
      track.current?.measure((_x: number, _y: number, _w: number, _h: number, pageX: number) => { left.current = pageX; moveRef.current(x); });
    },
    onPanResponderMove: (e) => moveRef.current(e.nativeEvent.pageX),
  })).current;

  const at = sliderSpot(value) * Math.max(0, width - THUMB);
  const step = (by: number) => onChange(Math.max(1, Math.min(max, value + by)));

  return <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
    <View ref={track} {...pan.panHandlers}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessible accessibilityRole="adjustable" accessibilityLabel={label}
      accessibilityValue={{ min: 1, max, now: value }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => step(e.nativeEvent.actionName === "increment" ? SLIDER.step : -SLIDER.step)}
      style={[{ flex: 1, height: 40, justifyContent: "center" }, Platform.OS === "web" ? { touchAction: "none", cursor: "pointer", userSelect: "none" } as object : null]}>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: C.line, marginHorizontal: THUMB / 2 }} />
      <View style={{ position: "absolute", left: THUMB / 2, width: at, height: 6, borderRadius: 3, backgroundColor: C.blue }} />
      <View pointerEvents="none" style={{ position: "absolute", left: at, width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: C.white, borderWidth: 2, borderColor: C.blue, shadowColor: C.ink, shadowOpacity: .2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3 }} />
      <View pointerEvents="none" style={{ position: "absolute", left: THUMB / 2, right: THUMB / 2, bottom: -6, flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontFamily: sans, fontSize: 10, color: C.muted }}>{SLIDER.min}</Text>
        <Text style={{ fontFamily: sans, fontSize: 10, color: C.muted }}>{SLIDER.max}+</Text>
      </View>
    </View>
    <TextInput accessibilityLabel={label} value={value ? String(value) : ""} keyboardType="number-pad" selectTextOnFocus
      onChangeText={(v) => onChange(Math.min(max, Number(v.replace(/[^0-9]/g, "")) || 0))}
      style={{ width: 76, fontFamily: serif, fontSize: 18, color: C.ink, textAlign: "center", backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: radii.md, paddingVertical: 10 }} />
  </View>;
}
