import React, { useState } from "react";
import { View } from "react-native";
import Svg, { Defs, FeGaussianBlur, Filter, G, Rect } from "react-native-svg";

// Four lines of "writing" seen through frosted glass: word-shaped blocks of varying width,
// softly blurred so they read as text you can't make out. Widths are fixed, so it looks the
// same every time (not random on each render).
const LINES: number[][] = [
  [14, 9, 18, 7, 12, 16, 10],
  [11, 16, 8, 13, 19, 9],
  [17, 7, 12, 10, 15, 8, 13],
  [9, 14, 11, 16],
];
const ROW = 18, WORD_GAP = 2.2, HEIGHT = LINES.length * ROW + 8;

export function SealedLines() {
  const [width, setWidth] = useState(0);
  return <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ height: HEIGHT }} accessible={false}>
    {width > 0 && <Svg width={width} height={HEIGHT}>
      <Defs>
        <Filter id="sealedBlur" x="-10%" y="-60%" width="120%" height="220%">
          <FeGaussianBlur stdDeviation="2.8" />
        </Filter>
      </Defs>
      <G filter="url(#sealedBlur)" opacity={0.42}>
        {LINES.map((words, row) => {
          const total = words.reduce((a, b) => a + b, 0) + WORD_GAP * (words.length - 1);
          // Last line is shorter, like the end of a paragraph.
          const lineWidth = row === LINES.length - 1 ? width * 0.58 : width;
          let x = 0;
          return words.map((w, i) => {
            const px = (w / total) * lineWidth, gap = (WORD_GAP / total) * lineWidth;
            const rect = <Rect key={`${row}-${i}`} x={x} y={6 + row * ROW} width={px} height={7} rx={3.5} fill="#7D8A9C" />;
            x += px + gap;
            return rect;
          });
        })}
      </G>
    </Svg>}
  </View>;
}
