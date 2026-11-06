import type { VesselKind } from "../../components/Vessel";
import type { Fix } from "./location";
export declare function PlaceMap(props: {
  place: { lat: number; lng: number; radius_m: number };
  fix: Fix | null;
  vessel: VesselKind;
}): React.ReactElement;
