import React from 'react';
import { View } from 'react-native';
import { Vessel, type VesselKind } from '../../components/Vessel';
import { C } from '../../theme';

// The 76 px view's bottom centre is the map coordinate on both renderers.
export function VesselPin({ vessel }: { vessel: VesselKind }) {
  return <View collapsable={false} style={{ width: 64, height: 76, alignItems: 'center' }}>
    <View style={{ position: 'absolute', top: 62, borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 14, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: C.brass }} />
    <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: C.brass, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' }}><Vessel kind={vessel} size={46} /></View>
  </View>;
}
