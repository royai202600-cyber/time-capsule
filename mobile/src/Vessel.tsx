import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';
import { VESSEL_ART, VESSEL_PIVOTS, VesselKind } from './vesselArt';
const wrap = (part: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 170">${part}</svg>`;
export function Vessel({kind, size=180, lidLift, contentSway, style}: {kind:VesselKind; size?:number; lidLift?:SharedValue<number>; contentSway?:SharedValue<number>; style?:StyleProp<ViewStyle>}) {
  const pivot=VESSEL_PIVOTS[kind],px=(pivot.x-.5)*size,py=(pivot.y-.5)*size*170/160;
  const lidStyle=useAnimatedStyle(()=>({transform:[{translateY:-(lidLift?.value??0)*size*.48},{translateX:px},{translateY:py},{rotate:`${-(lidLift?.value??0)*13}deg`},{translateY:-py},{translateX:-px}],opacity:1-Math.min(1,lidLift?.value??0)*.7}));
  const contentStyle=useAnimatedStyle(()=>({transform:[{rotate:`${contentSway?.value??0}deg`},{translateY: (contentSway?.value??0)*.15}]}));
  const dim={width:size,height:size*170/160};
  return <View style={[dim,style]} accessible accessibilityLabel={kind}>
    <SvgXml xml={wrap(VESSEL_ART[kind].body)} width={dim.width} height={dim.height} style={{position:'absolute'}} />
    <Animated.View style={[{position:'absolute'},contentStyle]}><SvgXml xml={wrap(VESSEL_ART[kind].contents)} width={dim.width} height={dim.height}/></Animated.View>
    <Animated.View style={[{position:'absolute'},lidStyle]}><SvgXml xml={wrap(VESSEL_ART[kind].lid)} width={dim.width} height={dim.height}/></Animated.View>
  </View>;
}
