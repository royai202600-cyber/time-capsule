import { supabase } from "./supabase";
import type { Database } from "./database.types";

// Prediction text stays in capsule_contents. Only the recipient can open it;
// after opening, the sender gets the prediction alone through its narrow RPC.
export const PREDICTION_BACKEND = true;
export const PREDICTION_ENABLED = PREDICTION_BACKEND || __DEV__;
export const PREDICTION_MAX = 140;

export type CapsuleKind = "letter" | "prediction";
export type Verdict = boolean | null;
export type SenderPrediction = { prediction: string; verdict: Verdict; verdict_at: string | null };
export type RecordRow = { capsule_id: string; role: "sent" | "received"; other: string | null; prediction: string; verdict: Verdict; sealed_at: string; opened_at: string };

/** The defaults preserve ordinary letter sends; predictions never use message as a stub. */
export function predictionSendArgs(kind: CapsuleKind, prediction: string): Partial<Database["public"]["Functions"]["send_capsule"]["Args"]> {
  return kind === "prediction" ? { p_kind: kind, p_prediction: prediction.trim() } : {};
}

export function isPrediction(row: { id: string } & Record<string, unknown>): boolean {
  return row.kind === "prediction";
}

export function openedPrediction(_capsuleId: string, opened: Record<string, unknown>): { prediction: string; verdict: Verdict } | null {
  return typeof opened.prediction === "string" && opened.prediction
    ? { prediction: opened.prediction, verdict: typeof opened.verdict === "boolean" ? opened.verdict : null }
    : null;
}

export async function setVerdict(capsuleId: string, verdict: Verdict) {
  const { error } = await supabase.rpc("set_prediction_verdict", { p_id: capsuleId, p_verdict: verdict });
  if (error) throw error;
}

export async function senderPrediction(capsuleId: string): Promise<SenderPrediction | null> {
  const { data, error } = await supabase.rpc("prediction_for_sender", { p_id: capsuleId });
  if (error) throw error;
  return data?.[0] ?? null;
}

// The server derives identity from auth.uid(); the argument preserves the UI call contract.
export async function predictionRecord(_userId: string): Promise<RecordRow[]> {
  const { data, error } = await supabase.rpc("prediction_record");
  if (error) throw error;
  return (data ?? []).map(row => ({ ...row, role: row.role === "received" ? "received" : "sent" }));
}
