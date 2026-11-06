import React from "react";
import { View, Text } from "react-native";
import Svg, { Circle, Ellipse, Line } from "react-native-svg";
import { Vessel, type VesselKind } from "../../components/Vessel";
import { C, sans } from "../../theme";
import type { Fix } from "./location";

export function PlaceMap({ place, fix, vessel }: {
  place: { lat: number; lng: number; radius_m: number };
  fix: Fix | null;
  vessel: VesselKind;
}) {
  const near = !fix || (Math.abs(fix.lat - place.lat) < .02 && Math.abs(fix.lng - place.lng) < .02);
  const padLat = near ? .003 : .008;
  const padLng = near ? .004 : .012;
  const minLat = Math.min(place.lat, fix?.lat ?? place.lat) - padLat;
  const maxLat = Math.max(place.lat, fix?.lat ?? place.lat) + padLat;
  const minLng = Math.min(place.lng, fix?.lng ?? place.lng) - padLng;
  const maxLng = Math.max(place.lng, fix?.lng ?? place.lng) + padLng;
  const x = (lng: number) => (lng - minLng) / (maxLng - minLng) * 100;
  const y = (lat: number) => (maxLat - lat) / (maxLat - minLat) * 100;
  const radiusY = place.radius_m / 111_000 / (maxLat - minLat) * 100;
  const radiusX = place.radius_m / (111_000 * Math.cos(place.lat * Math.PI / 180)) / (maxLng - minLng) * 100;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${minLng}%2C${minLat}%2C${maxLng}%2C${maxLat}&layer=mapnik`;
  return <View style={{ flex: 1, overflow: "hidden", backgroundColor: C.glass }}>
    <iframe title="OpenStreetMap" src={src} style={{ width: "100%", height: "100%", border: 0, pointerEvents: "none" }} />
    <Svg style={{ position: "absolute", width: "100%", height: "100%" }} viewBox="0 0 100 100" preserveAspectRatio="none" pointerEvents="none">
      {fix && <Line x1={x(fix.lng)} y1={y(fix.lat)} x2={x(place.lng)} y2={y(place.lat)} stroke={C.blue} strokeWidth=".6" strokeDasharray="1.5 1.5" />}
      <Ellipse cx={x(place.lng)} cy={y(place.lat)} rx={radiusX} ry={radiusY} stroke={C.blue} strokeWidth=".5" fill="#5A8FD055" />
      {fix && <Circle cx={x(fix.lng)} cy={y(fix.lat)} r="1.5" stroke={C.white} strokeWidth=".5" fill={C.lightBlue} />}
    </Svg>
    <View pointerEvents="none" style={{ position: "absolute", left: `${x(place.lng)}%`, top: `${y(place.lat)}%`, transform: [{ translateX: -30 }, { translateY: -60 }], width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: C.brass, backgroundColor: C.white, alignItems: "center", justifyContent: "center" }}><Vessel kind={vessel} size={42} /></View>
    <Text style={{ position: "absolute", bottom: 4, right: 6, fontFamily: sans, fontSize: 10, color: C.ink }}>© OpenStreetMap contributors</Text>
  </View>;
}
