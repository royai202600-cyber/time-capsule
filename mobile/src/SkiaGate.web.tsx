import React from 'react';
import { View } from 'react-native';
import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

export default function SkiaGate() {
  return <WithSkiaWeb getComponent={() => import('./FeelDemo')} opts={{locateFile: () => '/canvaskit.wasm'}} fallback={<View style={{flex:1,backgroundColor:'#F6F8FB'}}/>}/>;
}
