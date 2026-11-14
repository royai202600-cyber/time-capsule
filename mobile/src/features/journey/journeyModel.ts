import { portraits, vesselParts } from "../../art/manifest";
import { type VesselKind } from "../../components/Vessel";
import type { Tables } from "../../services/database.types";
import { type PublicCapsule } from "../../services/publicCapsule";
import { assetUri } from "./live/types";

export type JourneyPin = { place: Tables<"places">; kind: "visited" | "waiting" | "other"; vessel?: string; waiting?: boolean };

export type Item =
  | { kind: "publicCapsule"; id: string; lat: number; lng: number; meters: number; publicCapsule: PublicCapsule }
  | { kind: "place"; id: string; lat: number; lng: number; meters: number; pin: JourneyPin; capsuleId: string };

export const portraitUri = (avatar: unknown) => {
  const a = avatar as { set?: string; id?: string } | null;
  return assetUri(a?.set === "illus" && a.id ? portraits[a.id] : portraits["01"]);
};
export const vesselUri = (kind: string) => assetUri(vesselParts[kind as VesselKind]?.assembled ?? vesselParts.bottle.assembled) ?? "";
