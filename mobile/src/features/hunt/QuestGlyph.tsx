import React from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { C } from "../../theme";
import type { AnyQuestType } from "../quests/questArt";

/** One glyph per quest type, matching the glyph drawn on its brass pin. A catch quest's is a capsule. */
export function QuestGlyph({ type, size = 18, color = C.blue }: { type: AnyQuestType; size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
    {type === "arrive" && <Path d="M7 21V4m0 0 10 2.5L7 11" />}
    {type === "spin" && <><Circle cx={12} cy={12} r={7.5} /><Path d="M12 4.5v15M4.5 12h15" /></>}
    {(type === "puzzle" || type === "question") && <Path d="M8.6 9a3.5 3.5 0 1 1 3.6 4v2.4M12 19v.1" />}
    {type === "price" && <><Path d="M3.5 12.5 11 5h8v8l-7.5 7.5z" /><Circle cx={15.5} cy={8.5} r={1.4} /></>}
    {type === "landmark" && <Path d="M12 3v3m-3 15 1.5-12h3L15 21M7 21h10M10 13h4" />}
    {(type === "restore" || type === "catch") && <><Rect x={4} y={8.5} width={16} height={7} rx={3.5} transform="rotate(-35 12 12)" /><Path d="m10.6 9.4 1.6 2.4-1.2 1.4 1.4 1.6" /></>}
  </Svg>;
}
