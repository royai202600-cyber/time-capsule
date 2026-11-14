// A quest's picture: one of our templates ("tpl:park"), the organizer's photo in the private hunt-media
// bucket ("<hunt_id>/<uuid>.jpg", shown through a signed URL) or, in the demo, a data URL.
// Every quest has a picture: one saved without (or from before pictures) shows the first template.
import { useEffect, useState } from "react";
import type { ImageSourcePropType } from "react-native";
import { questTemplates } from "../../art/manifest";
import { assetUri } from "../journey/live/types";
import { isMediaPath, signedMediaUrl, signMedia } from "../../services/huntMedia";

// The order the editor offers them in; the keys must match the server's allow-list for hunt_waypoints.image.
export const QUEST_TEMPLATES = ["park", "garden", "waterfront", "square", "publicArt", "oldStreet"] as const satisfies readonly (keyof typeof questTemplates)[];
type Template = typeof QUEST_TEMPLATES[number];

export const templateImage = (key: Template) => `tpl:${key}`;
export const DEFAULT_QUEST_IMAGE = templateImage(QUEST_TEMPLATES[0]);

const template = (image: string) => image.startsWith("tpl:") ? questTemplates[image.slice(4) as Template] : undefined;
// A stored photo whose link isn't signed yet shows the default picture until it is.
const picture = (image: string | null | undefined) =>
  !image ? DEFAULT_QUEST_IMAGE : isMediaPath(image) ? signedMediaUrl(image) ?? DEFAULT_QUEST_IMAGE : image;

export function questImageSource(image: string | null | undefined): ImageSourcePropType {
  const p = picture(image);
  return template(p) ?? { uri: p };
}
/** The same picture as a URL the map page can load. */
export function questImageUri(image: string | null | undefined): string | null {
  const p = picture(image);
  return p.startsWith("tpl:") ? assetUri(template(p)) : p;
}

/** Signs the stored photos among these images; the number changes once they can be shown. */
export function useQuestImages(images: (string | null | undefined)[]) {
  const [version, setVersion] = useState(0);
  const key = images.filter(isMediaPath).join("|");
  useEffect(() => {
    let live = true;
    void signMedia(key ? key.split("|") : []).then((fresh) => { if (live && fresh) setVersion((n) => n + 1); });
    return () => { live = false; };
  }, [key]);
  return version;
}
