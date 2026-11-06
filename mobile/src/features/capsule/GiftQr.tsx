import React, { useMemo } from "react";
import Svg, { Rect } from "react-native-svg";
import qrcode from "./qrcode";

export function GiftQr({ value, label }: { value: string; label: string }) {
  const { count, cells } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    const dark: [number, number][] = [];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) dark.push([x, y]);
    return { count: n, cells: dark };
  }, [value]);
  const size = count + 8;
  return <Svg width={144} height={144} viewBox={`0 0 ${size} ${size}`} accessibilityLabel={label}>
    <Rect width={size} height={size} fill="white" />
    {cells.map(([x, y]) => <Rect key={`${x}-${y}`} x={x + 4} y={y + 4} width={1} height={1} fill="#16263F" />)}
  </Svg>;
}
