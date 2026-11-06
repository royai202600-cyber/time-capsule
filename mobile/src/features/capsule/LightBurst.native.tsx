import React from "react";
import { View } from "react-native";
import { Canvas, Circle, RadialGradient, vec } from "@shopify/react-native-skia";
import { C } from "../../theme";

export function LightBurst({ intensity }: { intensity: number }) {
  return <View pointerEvents="none" style={{ position: "absolute", width: 220, height: 220, opacity: intensity }}>
    <Canvas style={{ width: 220, height: 220 }}>
      <Circle cx={110} cy={105} r={100}><RadialGradient c={vec(110, 105)} r={100} colors={[C.cream, C.lightBlue, "#00000000"]} /></Circle>
      {[[42, 48], [171, 35], [186, 153], [51, 181], [114, 20]].map(([x, y], i) => <Circle key={i} cx={x} cy={y} r={i % 2 ? 2 : 3} color={C.brass} />)}
    </Canvas>
  </View>;
}
