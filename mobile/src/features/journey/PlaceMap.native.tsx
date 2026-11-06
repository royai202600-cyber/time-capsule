import React, { useEffect, useRef } from "react";
import { View } from "react-native";
import MapView, { Circle, Marker, Polyline } from "react-native-maps";
import { type VesselKind } from "../../components/Vessel";
import { VesselPin } from "./VesselPin";
import { C } from "../../theme";
import type { Fix } from "./location";
import { distanceMeters } from "../../services/data";

export function PlaceMap({ place, fix, vessel }: {
  place: { lat: number; lng: number; radius_m: number };
  fix: Fix | null;
  vessel: VesselKind;
}) {
  const map = useRef<MapView>(null);
  useEffect(() => {
    const target = { latitude: place.lat, longitude: place.lng };
    if (fix && distanceMeters(fix.lat, fix.lng, place.lat, place.lng) > 250) map.current?.fitToCoordinates([target, { latitude: fix.lat, longitude: fix.lng }], {
      edgePadding: { top: 60, right: 50, bottom: 60, left: 50 }, animated: true,
    });
    else map.current?.animateToRegion({ ...target, latitudeDelta: 0.006, longitudeDelta: 0.006 }, 350);
  }, [place.lat, place.lng, fix?.lat, fix?.lng]);
  return <MapView ref={map} style={{ flex: 1 }} initialRegion={{ latitude: place.lat, longitude: place.lng, latitudeDelta: 0.012, longitudeDelta: 0.012 }}>
    <Circle center={{ latitude: place.lat, longitude: place.lng }} radius={place.radius_m} strokeColor={C.blue} fillColor="#5A8FD02B" strokeWidth={2} />
    {fix && <>
      <Polyline coordinates={[{ latitude: fix.lat, longitude: fix.lng }, { latitude: place.lat, longitude: place.lng }]} strokeColor={C.blue} strokeWidth={2} lineDashPattern={[5, 5]} />
      <Marker coordinate={{ latitude: fix.lat, longitude: fix.lng }} anchor={{ x: .5, y: .5 }}>
        <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: C.lightBlue, borderColor: C.white, borderWidth: 3 }} />
      </Marker>
    </>}
    <Marker coordinate={{ latitude: place.lat, longitude: place.lng }} anchor={{ x: .5, y: 1 }} centerOffset={{ x: 0, y: -38 }} zIndex={1000} tracksViewChanges>
      <VesselPin vessel={vessel} />
    </Marker>
  </MapView>;
}
