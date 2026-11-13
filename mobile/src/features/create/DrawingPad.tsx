import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Platform, Text, View } from "react-native";
import Svg, { Line, Path } from "react-native-svg";
import { captureRef } from "react-native-view-shot";
import { GestureDetector, usePanGesture, type useNativeGesture } from "react-native-gesture-handler";
import { C, handwriting } from "../../theme";

const WIDTH = 320, HEIGHT = 240;
type Point = { x: number; y: number };
export type DrawingStrokes = Point[][];
export type DrawingHandle = { getStrokes: () => DrawingStrokes; clear: () => void; hasInk: () => boolean; png: () => Promise<string | null> };

// The page around the pad can scroll (keyboard handling), so drawing must block that scroll or
// the scroll view steals the finger after a few millimetres: on phones the pan below blocks the
// page's native scroll gesture; on the web the touch layer refuses to hand over and sets
// touch-action: none so the browser doesn't scroll instead.
export const DrawingPad = forwardRef<DrawingHandle, { label: string; scrollGesture?: ReturnType<typeof useNativeGesture>; initialStrokes?: DrawingStrokes }>(function DrawingPad({ label, scrollGesture, initialStrokes = [] }, ref) {
  const [strokes, setStrokes] = useState(initialStrokes);
  const strokesRef = useRef(initialStrokes);
  const inkView = useRef<any>(null);
  const size = useRef({ width: WIDTH, height: HEIGHT });
  const update = (next: Point[][]) => { strokesRef.current = next; setStrokes(next); };
  const toPoint = (x: number, y: number): Point => ({
    x: Math.max(0, Math.min(WIDTH, x * WIDTH / size.current.width)),
    y: Math.max(0, Math.min(HEIGHT, y * HEIGHT / size.current.height)),
  });
  const point = (e: any) => toPoint(e.nativeEvent.locationX, e.nativeEvent.locationY);
  const begin = (p: Point) => update([...strokesRef.current, [p]]);
  const extend = (p: Point) => { const next = strokesRef.current.slice(); const last = next[next.length - 1]; if (last) { next[next.length - 1] = [...last, p]; update(next); } };
  const pan = usePanGesture({
    minDistance: 0, runOnJS: true, shouldCancelWhenOutside: false,
    block: scrollGesture,
    onBegin: e => begin(toPoint(e.x, e.y)),
    onUpdate: e => extend(toPoint(e.x, e.y)),
  });
  useImperativeHandle(ref, () => ({
    getStrokes: () => strokesRef.current,
    clear: () => update([]),
    hasInk: () => strokesRef.current.some(s => s.length > 0),
    png: async () => {
      if (!strokesRef.current.length) return null;
      if (Platform.OS === "web") {
        const canvas = document.createElement("canvas");
        canvas.width = WIDTH * 2; canvas.height = HEIGHT * 2;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("canvas unavailable");
        ctx.scale(2, 2);
        ctx.strokeStyle = C.blue; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.lineJoin = "round";
        for (const stroke of strokesRef.current) {
          ctx.beginPath(); stroke.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
          if (stroke.length === 1) ctx.lineTo(stroke[0].x + .1, stroke[0].y + .1);
          ctx.stroke();
        }
        return canvas.toDataURL("image/png");
      }
      const base64 = await captureRef(inkView, { format: "png", result: "base64", width: WIDTH * 2, height: HEIGHT * 2 });
      return `data:image/png;base64,${base64}`;
    },
  }));
  return <View style={{ backgroundColor: "#fffdf7", borderWidth: 1.5, borderColor: C.plum, borderRadius: 12, overflow: "hidden" }}
    onLayout={e => { size.current = e.nativeEvent.layout; }}>
    <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} pointerEvents="none">
      {[56, 104, 152, 200].map(y => <Line key={y} x1="14" x2="306" y1={y} y2={y} stroke={C.line} strokeWidth="1" />)}
    </Svg>
    <View ref={inkView} collapsable={false} pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height: HEIGHT, backgroundColor: "transparent" }}>
      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        {strokes.map((stroke, i) => <Path key={i} d={stroke.map((p, j) => `${j ? "L" : "M"}${p.x} ${p.y}`).join(" ") + (stroke.length === 1 ? ` L${stroke[0].x + .1} ${stroke[0].y + .1}` : "")} stroke={C.blue} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />)}
      </Svg>
    </View>
    {!strokes.length && <Text pointerEvents="none" style={{ position: "absolute", top: 20, left: 18, color: C.muted, fontFamily: handwriting }}>{label}</Text>}
    {Platform.OS === "web"
      ? <View style={[{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }, { touchAction: "none" } as any]}
          onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
          onResponderGrant={e => begin(point(e))} onResponderMove={e => extend(point(e))} />
      : <GestureDetector gesture={pan}><View collapsable={false} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }} /></GestureDetector>}
  </View>;
});
