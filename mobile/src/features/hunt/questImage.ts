// A quest's picture: one of our templates ("tpl:park") or the organizer's own photo (a URL).
// The templates are the Waypost scenes for now; Codex's quest templates replace them in the same list.
// Every quest has a picture: one saved without (or from before pictures) shows the first template.
import type { ImageSourcePropType } from "react-native";
import { gameArt } from "../../art/manifest";
import { assetUri } from "../journey/live/types";

export const QUEST_TEMPLATES = ["park", "garden", "waterfront", "square", "publicArt"] as const;
type Template = typeof QUEST_TEMPLATES[number];

export const templateImage = (key: Template) => `tpl:${key}`;
export const DEFAULT_QUEST_IMAGE = templateImage(QUEST_TEMPLATES[0]);
const template = (image: string) => image.startsWith("tpl:") ? gameArt.wheel[image.slice(4) as Template] : undefined;

export function questImageSource(image: string | null | undefined): ImageSourcePropType {
  const picture = image || DEFAULT_QUEST_IMAGE;
  return template(picture) ?? { uri: picture };
}
/** The same picture as a URL the map page can load. */
export function questImageUri(image: string | null | undefined): string | null {
  const picture = image || DEFAULT_QUEST_IMAGE;
  return picture.startsWith("tpl:") ? assetUri(template(picture)) : picture;
}
