import { Image, type ImageSourcePropType } from "react-native";

export type LivePin = { id: string; lat: number; lng: number; vessel: string; cracks?: string; portrait?: string | null; tag?: string; kind: "sea" | "place" | "corrupted" | "waypost" | "landmark" | "keeper"; hunt?: boolean; mark?: string | null; figure?: string | null; lift?: number; rarity?: "common" | "uncommon" | "rare"; done?: boolean; near?: boolean; far?: boolean; selected?: boolean; sealed?: boolean; private?: boolean; opened?: boolean; timer?: string };
export type LiveState = { you: { lat: number; lng: number } | null; heading?: number | null; portrait?: string | null; figure?: string | null; youLabel?: string | null; reach: number; pins: LivePin[] };
export type LiveMapHandle = { recenter: () => void; focus: (lat: number, lng: number) => void };
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
