import { Image, type ImageSourcePropType } from "react-native";

export type LivePin = { id: string; lat: number; lng: number; vessel: string; cracks?: string; portrait?: string | null; tag?: string; kind: "publicCapsule" | "place" | "corrupted" | "waypost" | "landmark" | "keeper" | "quest"; hunt?: boolean;
  /** Private-hunt quests (kind "quest"): which glyph the brass pin carries, and whether the route still locks it. */
  quest?: "arrive" | "spin" | "puzzle"; locked?: boolean; /** A quest's picture: shown as a big round photo pin instead of the brass pin. */ photo?: string | null; mark?: string | null; figure?: string | null; lift?: number; rarity?: "common" | "uncommon" | "rare"; done?: boolean; near?: boolean; far?: boolean; selected?: boolean; sealed?: boolean; private?: boolean; opened?: boolean; timer?: string };
export type LiveState = { you: { lat: number; lng: number } | null; heading?: number | null; portrait?: string | null; figure?: string | null; youLabel?: string | null; reach: number; pins: LivePin[];
  /** A dotted line through these points, in order (an ordered hunt's route in the quest editor). */
  route?: { lat: number; lng: number }[] };
/** walk: the player's figure strolls to a spot inside the pickup circle (a picture only; the real position and the server's checks never change). */
export type LiveMapHandle = { recenter: () => void; focus: (lat: number, lng: number) => void; walk: (lat: number, lng: number) => void;
  /** Frame every point on screen (the quest editor shows the whole hunt). */
  fit: (points: { lat: number; lng: number }[]) => void };
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
