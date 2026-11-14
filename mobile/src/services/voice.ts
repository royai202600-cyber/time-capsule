import { Platform } from "react-native";
import * as Crypto from "expo-crypto";
import { setAudioModeAsync } from "expo-audio";
import { supabase } from "./supabase";
import type { Database } from "./database.types";

// Sender voice notes. A voice note is sealed exactly like the letter:
// 1. The sender uploads the recording to the private `voice-notes` bucket at
//    `<sender id>/<uuid>.<ext>`. Storage lets the sender insert there, but nobody can read it.
// 2. `send_capsule(..., p_voice, p_voice_ms)` attaches that path to the capsule's sealed content.
// 3. `open_capsule()` returns `voice_path` and `voice_ms` only to the recipient, after the
//    server's time (and place) check. Only then does the storage read policy let the recipient
//    create a short-lived signed URL for it. The sender can never read it back.

/** Recording is available with the live voice-note backend. */
export const VOICE_ENABLED = true;
export const VOICE_BUCKET = "voice-notes";
export const VOICE_MAX_MS = 60_000;
export const VOICE_MAX_BYTES = 2 * 1024 * 1024;
const SIGNED_URL_SECONDS = 600;

export type VoiceClip = { uri: string; durationMs: number };
/** What `open_capsule()` adds to each returned row. */
export type OpenedVoice = Pick<Database["public"]["Functions"]["open_capsule"]["Returns"][number], "voice_path" | "voice_ms">;

// iPhone Safari records only audio/mp4. Prefer it everywhere it is supported, so a note recorded
// in a desktop browser still plays in the iOS app and alarm; fall back to WebM (older Chrome/Firefox).
export function webVoiceMime() {
  if (typeof MediaRecorder === "undefined") return "audio/mp4";
  return ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find(t => MediaRecorder.isTypeSupported(t)) ?? "audio/webm";
}
const extFor = (mime: string) => (mime.includes("webm") ? "webm" : "m4a");

/** Upload the recording to the sender's own folder. Returns the storage path to pass as `p_voice`. */
export async function uploadVoice(userId: string, clip: VoiceClip): Promise<string> {
  const response = await fetch(clip.uri);
  const blob = Platform.OS === "web" ? await response.blob() : null;
  const mime = blob?.type?.split(";")[0] || "audio/mp4";
  const body = blob ?? await response.arrayBuffer();
  const size = blob ? blob.size : (body as ArrayBuffer).byteLength;
  if (size > VOICE_MAX_BYTES) throw new Error("voice too large");
  const path = `${userId}/${Crypto.randomUUID()}.${extFor(mime)}`;
  const { error } = await supabase.storage.from(VOICE_BUCKET).upload(path, body, { contentType: mime, upsert: false });
  if (error) throw error;
  return path;
}

/** A short-lived URL for an opened capsule's voice note (recipient only; enforced by storage policy). */
export async function voiceUrl(capsuleId: string, content: OpenedVoice | null | undefined): Promise<string | null> {
  if (!content?.voice_path) return null;
  const { data, error } = await supabase.storage.from(VOICE_BUCKET).createSignedUrl(content.voice_path, SIGNED_URL_SECONDS);
  if (error) throw error;
  return data.signedUrl;
}

/**
 * For the daily alarm: the sender's voice for an opened capsule, or null if it has none.
 * Re-reads the opened content through `open_capsule()` (allowed again once opened) and signs a
 * 10-minute URL. Download/cache the file right away if it must play later.
 */
export async function voiceNoteForCapsule(capsuleId: string): Promise<{ url: string; durationMs: number | null } | null> {
  const { data, error } = await supabase.rpc("open_capsule", { p_id: capsuleId });
  if (error) throw error;
  const row = data?.[0];
  const url = await voiceUrl(capsuleId, row);
  return url ? { url, durationMs: row?.voice_ms ?? null } : null;
}

/** iOS needs a recording session to use the mic, and silent mode must not mute a voice the user asked to hear. */
export async function setVoiceAudioMode(mode: "record" | "play" | "idle") {
  if (Platform.OS === "web") return;
  try {
    if (mode === "record") await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    else if (mode === "play") await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    else await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: false, interruptionMode: "mixWithOthers", shouldPlayInBackground: false });
  } catch { /* audio mode is best effort */ }
}

export const formatClock = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
