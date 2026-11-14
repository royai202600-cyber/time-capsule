// Quest photos in the private `hunt-media` bucket (docs/design/city-orienteering.md, Codex PR #119).
// The organizer uploads JPEG bytes to `<hunt_id>/<uuid>.jpg` and saves that path as the quest's image;
// the organizer and the hunt's members read it through short-lived signed URLs.
import * as Crypto from "expo-crypto";
import { supabase } from "./supabase";
import { HUNT_PRIVATE_BACKEND } from "./huntPrivate";

export const HUNT_MEDIA_BUCKET = "hunt-media";
const SIGNED_SECONDS = 3600;

/** A photo in the bucket, as opposed to a template, a data URL or a web address. */
export const isMediaPath = (image: string | null | undefined): image is string =>
  !!image && !/^(tpl:|data:|https?:|file:|blob:)/.test(image);

const signed = new Map<string, { url: string; until: number }>();
export const signedMediaUrl = (path: string) => {
  const s = signed.get(path);
  return s && s.until > Date.now() ? s.url : null;
};

/** Returns the path to save. Without the backend (the demo) the photo stays on this phone as its data URL. */
export async function uploadQuestImage(huntId: string, dataUrl: string): Promise<string> {
  if (!HUNT_PRIVATE_BACKEND || !(await supabase.auth.getSession()).data.session) return dataUrl;
  const bytes = Uint8Array.from(atob(dataUrl.slice(dataUrl.indexOf(",") + 1)), (c) => c.charCodeAt(0));
  const path = `${huntId}/${Crypto.randomUUID().toLowerCase()}.jpg`;
  const { error } = await supabase.storage.from(HUNT_MEDIA_BUCKET).upload(path, bytes, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  // The organizer already has the picture; show it from memory instead of downloading it again.
  signed.set(path, { url: dataUrl, until: Infinity });
  return path;
}

/** Signs whichever of these paths aren't signed yet. True when something new can be shown. */
export async function signMedia(paths: string[]): Promise<boolean> {
  const want = [...new Set(paths.filter((p) => isMediaPath(p) && !signedMediaUrl(p)))];
  if (!want.length) return false;
  const { data, error } = await supabase.storage.from(HUNT_MEDIA_BUCKET).createSignedUrls(want, SIGNED_SECONDS);
  if (error || !data) return false;
  // Renew a few minutes early, so a picture never points at an expired link.
  const until = Date.now() + (SIGNED_SECONDS - 300) * 1000;
  for (const d of data) if (d.path && d.signedUrl) signed.set(d.path, { url: d.signedUrl, until });
  return true;
}
