import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { C } from '../theme';

export type IconName = 'pin' | 'back' | 'close' | 'plus' | 'lock' | 'check' | 'shop' | 'user' | 'map' | 'cabinet' | 'share' | 'camera' | 'pen' | 'mic' | 'alarm' | 'up' | 'down' | 'locate';
const lines: Record<IconName, string> = {
  locate: 'M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM12 2v3m0 14v3M2 12h3m14 0h3',
  pin: 'M12 22C8 17 4 13.5 4 9a8 8 0 0 1 16 0c0 4.5-4 8-8 13Z',
  back: 'M19 12H5m7-7-7 7 7 7',
  close: 'M5 5l14 14M19 5 5 19',
  plus: 'M12 4v16M4 12h16',
  lock: 'M5 10h14v11H5zM8 10V7a4 4 0 0 1 8 0v3',
  check: 'M4 12l5 5L20 6',
  shop: 'M4 9h16l-1 12H5L4 9ZM8 9V7a4 4 0 0 1 8 0v2',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21c0-4 3-7 8-7s8 3 8 7H4Z',
  map: 'M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16',
  cabinet: 'M4 2h16v20H4V2Zm0 7h16M4 16h16m8 0v6m4-6v6',
  share: 'M4 20c0-7 6-11 13-11V4l5 7-5 7v-5c-6 0-10 2-13 7Z',
  camera: 'M3 7h4l2-3h6l2 3h4v13H3V7Zm9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  pen: 'M12 2 5 13l7 9 7-9-7-11Zm0 0v12m-3 0a3 3 0 1 0 6 0 3 3 0 0 0-6 0Z',
  alarm: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm0-12v4l3 2M3.5 6.5l3-3m14 3-3-3M7 20l-1.5 2m11.5-2 1.5 2',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  mic: 'M9 5a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0V5ZM5 11a7 7 0 0 0 14 0M12 18v3m-4 0h8',
};
export function ArtIcon({ name, size = 24, color = C.ink }: { name: IconName; size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d={lines[name]} stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    {name === 'locate' && <Circle cx={12} cy={12} r={2} fill={color} />}
    {name === 'pin' && <Circle cx={12} cy={9} r={2.5} stroke={color} strokeWidth={1.8} />}
  </Svg>;
}
