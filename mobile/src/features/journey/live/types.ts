import { Image, type ImageSourcePropType } from "react-native";
import type { PrivateHuntQuestType } from "../../../services/questTypes";

export type PinKind = "publicCapsule" | "place" | "corrupted" | "waypost" | "landmark" | "keeper" | "quest" | "spot";
export type LivePin = { id: string; lat: number; lng: number; vessel: string; label?: string; cracks?: string; portrait?: string | null; tag?: string; kind: PinKind; hunt?: boolean;
  /** Which map filter shows this pin, when not its kind's (a private hunt's guide is drawn as a Keeper but belongs to private hunts). */
  filterAs?: PinKind;
  /** Private-hunt quests (kind "quest"): which glyph the brass pin carries, and whether the route still locks it. */
  quest?: PrivateHuntQuestType; locked?: boolean; /** A quest's picture: shown as a big round photo pin instead of the brass pin. */ photo?: string | null; mark?: string | null; figure?: string | null; lift?: number; rarity?: "common" | "uncommon" | "rare"; done?: boolean;
  /** A quest made by us (Today's Hunt, City Hunt): the blue quest pin instead of brass. */ blue?: boolean;
  /** Drops from the sky this many ms after it first appears (Today's Hunt). */ drop?: number; near?: boolean; far?: boolean; selected?: boolean; sealed?: boolean; private?: boolean; opened?: boolean; timer?: string };
export type LiveState = { you: { lat: number; lng: number } | null; heading?: number | null; portrait?: string | null; figure?: string | null; youLabel?: string | null; reach: number; pins: LivePin[];
  /** A dotted line through these points, in order (an ordered hunt's route in the quest editor). */
  route?: { lat: number; lng: number }[] };
/** walk: the player's figure strolls to a spot inside the pickup circle (a picture only; the real position and the server's checks never change). */
export type LiveMapHandle = { recenter: () => void; focus: (lat: number, lng: number) => void; walk: (lat: number, lng: number) => void;
  /** Fly to another city and look around it from above its buildings (the City Explorer). */
  city: (lat: number, lng: number) => void;
  /** Frame every point on screen (the quest editor shows the whole hunt). */
  fit: (points: { lat: number; lng: number }[], view?: FitView) => void;
  /** Today's Hunt's motion: the figure hops along a trail, pins bounce or burst, everything runs k times faster. */
  motion: (m: MapMotion) => void };
/** Optional framing for fit: room kept clear for cards, the camera's tilt and turn, and its duration at normal speed. */
export type FitView = { padding?: { top: number; bottom: number; left: number; right: number }; pitch?: number; bearing?: number; ms?: number };
/** ms are at normal speed; the map divides them by the current speed. Reduce Motion makes them instant. */
export type MapMotion =
  | { type: "hop"; lat: number; lng: number; ms: number }
  | { type: "ping"; id: string; kind: "arrive" | "burst" | "shake" }
  | { type: "speed"; k: number }
  | { type: "hopReset" };
export type LiveMapProps = {
  html: string;
  state: LiveState;
  onSelect: (id: string) => void;
  onTap?: (lat: number, lng: number) => void;
  onFollowChange?: (follow: boolean) => void;
};
export type MapMessage = { type: "ready" } | { type: "select"; id: string } | { type: "tap"; lat: number; lng: number } | { type: "follow"; follow: boolean } | { type: "error"; message: string };

/** A bundled image as a URL the map page can load (Metro dev server, web path or bundled file). */
export function assetUri(source: ImageSourcePropType | undefined | null): string | null {
  if (!source) return null;
  if (typeof source === "string") return source;
  if (typeof source === "object" && !Array.isArray(source) && "uri" in source && source.uri) return absolute(source.uri);
  const resolved = Image.resolveAssetSource?.(source as number);
  return resolved?.uri ? absolute(resolved.uri) : null;
}
const absolute = (uri: string) => (typeof window !== "undefined" && window.location && uri.startsWith("/")) ? `${window.location.origin}${uri}` : uri;
