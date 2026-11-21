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
export const SEAL = (() => {
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

// Keyhole: a round head over a tapered slot, centred in the 68-unit seal.
const KEYHOLE = 'M34 22.5 a5.2 5.2 0 0 1 2.7 9.6 L38.7 44.5 h-9.4 l2-12.4 A5.2 5.2 0 0 1 34 22.5 Z';
export const RING_R = 24, RING_LEN = 2 * Math.PI * RING_R;

/** Hold to open: the Home wax seal with an embossed keyhole. A brass groove inside the seal
 *  fills clockwise from the top as `progress` goes 0 → 1, and the keyhole warms to gold. */
export function SealHoldIcon({ size = 150, progress = 0 }: { size?: number; progress?: number }) {
  const a = (progress * 360 - 90) * Math.PI / 180;
  const tipX = 34 + RING_R * Math.cos(a), tipY = 34 + RING_R * Math.sin(a);
  return <Svg width={size} height={size} viewBox="0 0 68 68" fill="none">
    <Path d={SEAL} fill="#9A2E48" stroke="#74203A" strokeWidth={1} />
    <Circle cx={30} cy={29} r={23} fill="#BD4A66" opacity={0.55} />
    <Circle cx={27} cy={25} r={13} fill="#C95A75" opacity={0.35} />
    <Path d="M14 23 A22 22 0 0 1 27 11.5" stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={2.4} strokeLinecap="round" />
    {/* pressed groove (the ring's track), then the brass that fills it */}
    <Circle cx={34} cy={34} r={RING_R} stroke="#5E1529" strokeOpacity={0.6} strokeWidth={4.6} />
    <Circle cx={34} cy={34} r={RING_R + 1.9} stroke="#E07A93" strokeOpacity={0.3} strokeWidth={0.7} />
    {progress > 0 && <Circle cx={34} cy={34} r={RING_R} stroke="#E2B867" strokeWidth={3.6} strokeLinecap="round"
      strokeDasharray={`${progress * RING_LEN} ${RING_LEN}`} transform="rotate(-90 34 34)" />}
    {progress > 0 && progress < 1 && <Circle cx={tipX} cy={tipY} r={2.3} fill="#FFF6DD" opacity={0.9} />}
    {/* embossed keyhole: dark pressed shadow under a cream face that warms to gold */}
    <Path d={KEYHOLE} fill="#5E1529" opacity={0.55} transform="translate(0 0.9)" />
    <Path d={KEYHOLE} fill="#FBF1E1" />
    <Path d={KEYHOLE} fill="#E9B95C" opacity={progress} />
  </Svg>;
}

// ---- The home dock (docs/design/hunt-first-home.md): Passport · Quests · Capsules · Cabinet, one family. ----

/** Passport: a little booklet with a brass stamp on its cover and a ribbon marker. */
export function PassportIcon({ size = 30 }: { size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    {/* pages peeking out, then the cover */}
    <Rect x={9.5} y={5.5} width={17} height={22} rx={1.6} fill={PAPER_SHADE} stroke={INK} strokeWidth={1.2} />
    <Rect x={7} y={4} width={17} height={23} rx={1.8} fill={PAPER} />
    <Rect x={7} y={4} width={3.2} height={23} fill={PAPER_SHADE} />
    {/* the stamp: a brass double ring around a tiny globe */}
    <Circle cx={16.6} cy={14} r={5.6} fill="#F6E7C6" stroke={BRASS} strokeWidth={1.5} />
    <Circle cx={16.6} cy={14} r={3.7} stroke={BRASS} strokeWidth={0.8} />
    <Path d="M12.9 14 H20.3 M16.6 10.3 C14.6 12.4 14.6 15.6 16.6 17.7 C18.6 15.6 18.6 12.4 16.6 10.3" stroke={C.blue} strokeWidth={0.8} strokeLinecap="round" />
    <Path d="M12.6 21.6 H20.6 M13.8 23.8 H19.4" stroke={INK} strokeOpacity={0.55} strokeWidth={1} strokeLinecap="round" />
    <Rect x={7} y={4} width={17} height={23} rx={1.8} stroke={INK} strokeWidth={1.6} />
    <Line x1={10.2} x2={10.2} y1={4} y2={27} stroke={INK} strokeWidth={1.1} />
    {/* ribbon marker */}
    <Path d="M21 27 V30 L22.2 28.9 L23.4 30 V27" fill={C.wax} stroke={INK} strokeWidth={0.9} strokeLinejoin="round" />
  </Svg>;
}

/** Quests: a rolled paper scroll with a wax-red flag planted in it, like an arrive quest. */
export function QuestIcon({ size = 30 }: { size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <Path d="M7 12 H25 V25 H7 Z" fill={PAPER} />
    <Path d="M7 20.5 H25 V25 H7 Z" fill={PAPER_SHADE} />
    {/* a dotted trail across the paper */}
    <Path d="M10 22.5 C12.5 19 15 22.5 18 18.5" stroke={C.blue} strokeWidth={1.3} strokeLinecap="round" strokeDasharray="0.2 2.3" />
    <G stroke={INK} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M7 12 H25 V25 H7 Z" strokeWidth={1.5} />
      {/* rolled ends, top and bottom */}
      <Rect x={5} y={9.6} width={22} height={3.4} rx={1.7} fill="#EAD3A3" strokeWidth={1.4} />
      <Rect x={5} y={24} width={22} height={3.4} rx={1.7} fill="#EAD3A3" strokeWidth={1.4} />
      <Line x1={7.6} x2={24.4} y1={15.4} y2={15.4} strokeOpacity={0.45} strokeWidth={0.9} />
    </G>
    {/* the flag: brass pole, wax-red pennant */}
    <Line x1={21} x2={21} y1={3.2} y2={19} stroke={BRASS} strokeWidth={1.6} strokeLinecap="round" />
    <Path d="M21.6 3.6 L28 6 L21.6 8.6 Z" fill={C.wax} stroke={INK} strokeWidth={0.9} strokeLinejoin="round" />
    <Circle cx={21} cy={19.2} r={1.3} fill={BRASS} stroke={INK} strokeWidth={0.7} />
  </Svg>;
}

/** Capsules: the blue-rose glass dome on its brass base, with a small wax seal: your time capsules. */
export function CapsulesIcon({ size = 30 }: { size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    {/* glass, then the rose inside */}
    <Path d="M9 23 V13.5 a7 7 0 0 1 14 0 V23 Z" fill={GLASS} />
    <Path d="M16 23 V15.5" stroke="#5E8B6A" strokeWidth={1.1} strokeLinecap="round" />
    <Path d="M16 19.6 c1.4 -0.4 2.4 -1.4 2.6 -2.6 c-1.4 0.2 -2.3 1.1 -2.6 2.6 Z" fill="#5E8B6A" />
    <Circle cx={16} cy={13.6} r={2.6} fill={C.blue} />
    <Path d="M14.6 13.4 a1.5 1.5 0 0 1 2.8 0.4" stroke="#8DB0D3" strokeWidth={0.8} strokeLinecap="round" />
    {/* glass edge and a glint */}
    <Path d="M9 23 V13.5 a7 7 0 0 1 14 0 V23" stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
    <Path d="M11.4 19 V14 a4.6 4.6 0 0 1 2.2 -3.9" stroke="#FFFFFF" strokeWidth={1.3} strokeLinecap="round" />
    {/* brass base */}
    <Rect x={6.5} y={23} width={19} height={4.2} rx={1.2} fill={BRASS} stroke={INK} strokeWidth={1.4} />
    {/* wax seal tucked on the base */}
    <Circle cx={23.8} cy={24.6} r={3.4} fill={C.wax} stroke={INK} strokeWidth={0.9} />
    <Circle cx={23.8} cy={24.6} r={1.9} stroke="#E07A93" strokeOpacity={0.6} strokeWidth={0.7} />
  </Svg>;
}
