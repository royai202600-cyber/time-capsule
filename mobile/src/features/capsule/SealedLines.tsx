import React, { useState } from "react";
import { View } from "react-native";
import Svg, { Defs, FeGaussianBlur, Filter, G, Rect } from "react-native-svg";

// The original four solid lines (92/76/88/56% wide), softly blurred like writing behind frosted glass.
const WIDTHS = [0.92, 0.76, 0.88, 0.56];
const BAR = 7, GAP = 7, PAD = 6, HEIGHT = WIDTHS.length * (BAR + GAP) - GAP + PAD * 2;

export function SealedLines() {
  const [width, setWidth] = useState(0);
  return <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ height: HEIGHT }} accessible={false}>
    {width > 0 && <Svg width={width} height={HEIGHT}>
      <Defs>
        <Filter id="sealedBlur" x="-10%" y="-60%" width="120%" height="220%">
          <FeGaussianBlur stdDeviation="2" />
        </Filter>
      </Defs>
      <G filter="url(#sealedBlur)" opacity={0.6}>
        {WIDTHS.map((w, i) => <Rect key={i} x={0} y={PAD + i * (BAR + GAP)} width={width * w} height={BAR} rx={BAR / 2} fill="#A9B4C3" />)}
      </G>
    </Svg>}
  </View>;
}
