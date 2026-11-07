import { supabase } from "./supabase";

// Predict me (預言膠囊): a special kind of capsule. It goes through the normal Create flow,
// but its main content is one prediction line (the letter is optional).
//
// Backend contract (Codex wires this; see docs/design/game-loops.md):
// - `capsules.kind` text, 'letter' (default) or 'prediction'. Public like the hint and vessel,
//   so both sides can see "this is a prediction" before opening, but never the text.
// - `send_capsule(..., p_kind, p_prediction)`: stores the prediction in `capsule_contents`
//   (sealed like the letter). For kind 'prediction' the prediction is required and the
//   message may be empty.
// - `open_capsule()` also returns `prediction` and `verdict` to the recipient.
// - `set_prediction_verdict(p_id, p_verdict)`: recipient only, after opening; true = stamped
//   "came true", false = "didn't", null = cleared. Can be changed later. Stamps `verdict_at`.
// - `prediction_for_sender(p_id)`: sender only, and only once the capsule is opened. Returns
//   the prediction line and the verdict. The rest of the letter stays sealed to the sender.
// - `prediction_record()`: the signed-in user's opened predictions, written or received.

/** Codex sets this to true once the migration and functions above are live. */
export const PREDICTION_BACKEND = false;
/** The "Predict me" choice in Create: live with the backend; in development it runs on a stub. */
export const PREDICTION_ENABLED = PREDICTION_BACKEND || __DEV__;
export const PREDICTION_MAX = 140;

export type CapsuleKind = "letter" | "prediction";
export type Verdict = boolean | null;
export type SenderPrediction = { prediction: string; verdict: Verdict; verdict_at: string | null };
export type RecordRow = { capsule_id: string; role: "sent" | "received"; other: string | null; prediction: string; verdict: Verdict; sealed_at: string; opened_at: string };

// ---- Development stub (until Codex ships the backend) --------------------------------------
// Keyed by the capsule id `send_capsule` returns, so a capsule sent with the dev
// "in 2 minutes" option can be opened, stamped and seen from the sender side in one session.
type Stub = { prediction: string; verdict: Verdict; verdict_at: string | null };
const stub = new Map<string, Stub>();
const useStub = () => !PREDICTION_BACKEND && __DEV__;
export function stubAttachPrediction(capsuleId: string, prediction: string) { if (useStub()) stub.set(capsuleId, { prediction, verdict: null, verdict_at: null }); }

/** Extra args for `send_capsule`. Empty for an ordinary letter, so the current RPC keeps working. */
export function predictionSendArgs(kind: CapsuleKind, prediction: string): Record<string, string> {
  if (kind !== "prediction" || !PREDICTION_BACKEND) return {};
  return { p_kind: "prediction", p_prediction: prediction.trim() };
}

/** Whether a capsule row is a prediction (public column, or the dev stub). */
export function isPrediction(row: { id: string } & Record<string, unknown>): boolean {
  if (row.kind === "prediction") return true;
  return useStub() && stub.has(row.id);
}

/** The recipient's view after opening: the prediction and verdict from `open_capsule()`. */
export function openedPrediction(capsuleId: string, opened: Record<string, unknown>): { prediction: string; verdict: Verdict } | null {
  if (typeof opened.prediction === "string" && opened.prediction) return { prediction: opened.prediction, verdict: (opened.verdict as Verdict) ?? null };
  const s = useStub() ? stub.get(capsuleId) : undefined;
  return s ? { prediction: s.prediction, verdict: s.verdict } : null;
}

export async function setVerdict(capsuleId: string, verdict: Verdict) {
  if (useStub()) {
    const s = stub.get(capsuleId);
    if (s) stub.set(capsuleId, { ...s, verdict, verdict_at: verdict === null ? null : new Date().toISOString() });
    return;
  }
  const { error } = await supabase.rpc("set_prediction_verdict" as never, { p_id: capsuleId, p_verdict: verdict } as never);
  if (error) throw error;
}

export async function senderPrediction(capsuleId: string): Promise<SenderPrediction | null> {
  if (useStub()) return stub.get(capsuleId) ?? null;
  const { data, error } = await supabase.rpc("prediction_for_sender" as never, { p_id: capsuleId } as never);
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as SenderPrediction | undefined;
  return row ?? null;
}

export async function predictionRecord(userId: string): Promise<RecordRow[]> {
  if (useStub()) {
    if (!stub.size) return [];
    const { data } = await supabase.from("capsules").select("id,sender,recipient,sealed_at,opened_at").in("id", [...stub.keys()]);
    return (data ?? []).filter(c => c.opened_at).map(c => {
      const s = stub.get(c.id)!;
      const role = c.sender === userId ? "sent" : "received";
      return { capsule_id: c.id, role, other: role === "sent" ? c.recipient : c.sender, prediction: s.prediction, verdict: s.verdict, sealed_at: c.sealed_at, opened_at: c.opened_at! };
    });
  }
  const { data, error } = await supabase.rpc("prediction_record" as never);
  if (error) throw error;
  return (data ?? []) as RecordRow[];
}
