import React, { useState } from "react";
import { View } from "react-native";
import Svg, { Circle, Ellipse, Line } from "react-native-svg";
import { type VesselKind } from "../../components/Vessel";
import { VesselPin } from "./VesselPin";
import { C } from "../../theme";
import type { Fix } from "./location";

export function PlaceMap({ place, fix, vessel }: {
  place: { lat: number; lng: number; radius_m: number };
  fix: Fix | null;
  vessel: VesselKind;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const near = !fix || (Math.abs(fix.lat - place.lat) < .02 && Math.abs(fix.lng - place.lng) < .02);
  const padLat = near ? .003 : .008;
  const padLng = near ? .004 : .012;
  const minLat = Math.min(place.lat, fix?.lat ?? place.lat) - padLat;
  const maxLat = Math.max(place.lat, fix?.lat ?? place.lat) + padLat;
  const minLng = Math.min(place.lng, fix?.lng ?? place.lng) - padLng;
  const maxLng = Math.max(place.lng, fix?.lng ?? place.lng) + padLng;
  // OSM's embedded map uses a Web Mercator fitBounds, preserving aspect ratio.
  // Project against the same fitted bounds instead of stretching to the iframe.
  const mercatorX = (lng: number) => (lng + 180) / 360;
  const mercatorY = (lat: number) => {
    const rad = Math.max(-85, Math.min(85, lat)) * Math.PI / 180;
    return (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2;
  };
  const left = mercatorX(minLng), right = mercatorX(maxLng);
  const top = mercatorY(maxLat), bottom = mercatorY(minLat);
  const world = Math.min(size.width / (right - left), size.height / (bottom - top));
  const x = (lng: number) => size.width / 2 + (mercatorX(lng) - (left + right) / 2) * world;
  const y = (lat: number) => size.height / 2 + (mercatorY(lat) - (top + bottom) / 2) * world;
  const radiusY = Math.abs(y(place.lat + place.radius_m / 111_000) - y(place.lat));
  const radiusX = Math.abs(x(place.lng + place.radius_m / (111_000 * Math.cos(place.lat * Math.PI / 180))) - x(place.lng));
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${minLng}%2C${minLat}%2C${maxLng}%2C${maxLat}&layer=mapnik`;
  return <View onLayout={(event) => setSize(event.nativeEvent.layout)} style={{ flex: 1, overflow: "hidden", backgroundColor: C.glass }}>
    <iframe title="OpenStreetMap" src={src} style={{ position: "absolute", inset: 0, zIndex: 0, width: "100%", height: "100%", border: 0, pointerEvents: "none" }} />
    {size.width > 0 && size.height > 0 && <Svg style={{ position: "absolute", zIndex: 1, width: "100%", height: "100%" }} pointerEvents="none">
      {fix && <Line x1={x(fix.lng)} y1={y(fix.lat)} x2={x(place.lng)} y2={y(place.lat)} stroke={C.blue} strokeWidth="2" strokeDasharray="5 5" />}
      <Ellipse cx={x(place.lng)} cy={y(place.lat)} rx={radiusX} ry={radiusY} stroke={C.blue} strokeWidth="2" fill="#5A8FD055" />
      {fix && <Circle cx={x(fix.lng)} cy={y(fix.lat)} r="8" stroke={C.white} strokeWidth="3" fill={C.blue} />}
    </Svg>
    }
    {size.width > 0 && <View pointerEvents="none" style={{ position: "absolute", zIndex: 2, left: x(place.lng), top: y(place.lat), transform: [{ translateX: -32 }, { translateY: -76 }] }}><VesselPin vessel={vessel} /></View>}
  </View>;
}
