// A quest's picture: one of our templates ("tpl:park") or the organizer's own photo (a URL).
// The templates are the Waypost scenes for now; Codex's quest templates replace them in the same list.
import type { ImageSourcePropType } from "react-native";
import { gameArt } from "../../art/manifest";
import { assetUri } from "../journey/live/types";

export const QUEST_TEMPLATES = ["park", "garden", "waterfront", "square", "publicArt"] as const;
type Template = typeof QUEST_TEMPLATES[number];

export const templateImage = (key: Template) => `tpl:${key}`;
const template = (image: string) => image.startsWith("tpl:") ? gameArt.wheel[image.slice(4) as Template] : undefined;

export function questImageSource(image: string): ImageSourcePropType {
  return template(image) ?? { uri: image };
}
/** The same picture as a URL the map page can load. */
export function questImageUri(image: string | null | undefined): string | null {
  if (!image) return null;
  return image.startsWith("tpl:") ? assetUri(template(image)) : image;
}
