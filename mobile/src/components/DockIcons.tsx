import React from 'react';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';
import { C } from '../theme';

// Hand-built dock icons in the icon-reference style: plum ink lines over soft paper and brass fills.
const PAPER = '#FBF1E1', PAPER_SHADE = '#F1DFC4', GLASS = '#E3ECF5', BRASS = '#C9A15A', INK = C.plum;

/** Journey: a folded paper map with a dotted route to a wax-red pin. */
export function JourneyIcon({ size = 30 }: { size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <Path d="M4 8 L11 5 L20 8 L28 5 V24 L20 27 L11 24 L4 27 Z" fill={PAPER} />
    <Path d="M11 5 L20 8 V27 L11 24 Z" fill={PAPER_SHADE} />
    <Path d="M7 22 C9.5 18.5 12.5 21 15 17 S20 13.5 22 12.5" stroke={C.blue} strokeWidth={1.3} strokeLinecap="round" strokeDasharray="0.2 2.4" />
    <Path d="M4 8 L11 5 L20 8 L28 5 V24 L20 27 L11 24 L4 27 Z M11 5 V24 M20 8 V27" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
    <Path d="M23.5 16 C21.2 13.2 19.7 11.4 19.7 9.4 a3.8 3.8 0 0 1 7.6 0 c0 2 -1.5 3.8 -3.8 6.6 Z" fill={C.wax} stroke={INK} strokeWidth={1.1} strokeLinejoin="round" />
    <Circle cx={23.5} cy={9.4} r={1.35} fill={BRASS} />
  </Svg>;
}

/** Cabinet: a little glass-fronted display cabinet with a dome and a jar on its shelves. */
export function CabinetIcon({ size = 30 }: { size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <Rect x={6.5} y={7} width={19} height={19} fill={PAPER} />
    <Rect x={8.5} y={9} width={15} height={9.5} fill={GLASS} />
    {/* a tiny glass dome on the top shelf, a brass jar below */}
    <Path d="M10 13.6 v-1.4 a2.1 2.1 0 0 1 4.2 0 v1.4 Z" fill="#F7FAFD" stroke={C.blue} strokeWidth={0.8} />
    <Rect x={18.2} y={15.3} width={3.2} height={3.2} rx={0.8} fill={BRASS} opacity={0.85} />
    <G stroke={INK} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={5} y={4} width={22} height={3} rx={1} fill="#EAD3A3" strokeWidth={1.4} />
      <Rect x={6.5} y={7} width={19} height={19} strokeWidth={1.6} />
      <Rect x={8.5} y={9} width={15} height={9.5} strokeWidth={1.1} />
      <Line x1={8.5} x2={23.5} y1={13.6} y2={13.6} strokeWidth={0.9} />
      <Rect x={8.5} y={20} width={15} height={4.2} strokeWidth={1.1} />
      <Line x1={16} x2={16} y1={20} y2={24.2} strokeWidth={0.9} />
      <Path d="M8.5 26 v2.2 M23.5 26 v2.2" strokeWidth={1.8} />
    </G>
    <Circle cx={14.4} cy={22.1} r={0.75} fill={BRASS} />
    <Circle cx={17.6} cy={22.1} r={0.75} fill={BRASS} />
  </Svg>;
}

// Wax-seal outline: a circle with soft, uneven bumps like poured wax.
const SEAL = (() => {
  const cx = 34, cy = 34, n = 11, pts: string[] = [];
  for (let i = 0; i <= 90; i++) {
    const a = (i / 90) * Math.PI * 2;
    const r = 30 + 1.0 * Math.sin(a * n) + 0.9 * Math.sin(a * 3 + 1) + 0.6 * Math.sin(a * 7 + 2);
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join(' L')} Z`;
})();

/** New capsule: a wax seal with an embossed plus. Fills a 68 px button. */
export function SealPlusIcon({ size = 68 }: { size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 68 68" fill="none">
    {/* Solid fills only: a gradient referenced by id can fail to render (the button then shows white). */}
    <Path d={SEAL} fill="#9A2E48" stroke="#74203A" strokeWidth={1} />
    <Circle cx={30} cy={29} r={23} fill="#BD4A66" opacity={0.55} />
    <Circle cx={27} cy={25} r={13} fill="#C95A75" opacity={0.35} />
    <Circle cx={34} cy={34} r={21.5} stroke="#6F1D35" strokeOpacity={0.55} strokeWidth={1.6} />
    <Circle cx={34} cy={34} r={20} stroke="#E07A93" strokeOpacity={0.35} strokeWidth={0.8} />
    {/* soft highlight where light catches the wax */}
    <Path d="M17 24 A19 19 0 0 1 30 14.5" stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={2.4} strokeLinecap="round" />
    {/* embossed plus: a dark pressed groove under a cream ridge */}
    <Path d="M34 24.5 V44.5 M24 34.5 H44" stroke="#5E1529" strokeOpacity={0.55} strokeWidth={4.4} strokeLinecap="round" />
    <Path d="M34 23.5 V43.5 M24 33.5 H44" stroke="#FBF1E1" strokeWidth={3.6} strokeLinecap="round" />
  </Svg>;
}
