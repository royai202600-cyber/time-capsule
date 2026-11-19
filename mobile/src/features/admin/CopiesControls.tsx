// Vessel copies in the admin (HL-C2): how many copies a catch gives, which vessels are unlimited, and adjusting
// one player's copies. Owner and admin only; each write is logged with Undo in Activity.
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { SpawnRule, WaveConfig } from "../../services/admin";
import { adminHuntLoop, sampleCopies } from "../../services/adminHuntLoop";
import { C, sans, spacing } from "../../theme";
import { loopError, useHuntLoopText } from "./huntLoopStrings";
import { AButton, Field, Notice, Pill, Sheet, Stepper } from "./ui";

/** Starters and earned Landmark vessels can never be finite (the server refuses). */
const fixed = (r: SpawnRule) => r.never === "starter" || r.never === "earned";
export const perCatchOf = (c: WaveConfig) => c.copies_per_catch ?? sampleCopies.perCatch();
export const unlimitedOf = (r: SpawnRule) => r.unlimited_copies ?? sampleCopies.unlimited(r.vessel) ?? fixed(r);

export function CopiesButton({ config, onSaved }: { config: WaveConfig; onSaved: () => void }) {
  const h = useHuntLoopText();
  const [open, setOpen] = useState(false);
  const [n, setN] = useState(perCatchOf(config));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const save = async () => {
    setBusy(true); setNote("");
    try { await adminHuntLoop.setCopiesPerCatch(n, null); setOpen(false); onSaved(); }
    catch (e) { setNote(loopError(h, e)); }
    finally { setBusy(false); }
  };
  return <>
    <AButton small tone="ghost" title={h.editCopies} onPress={() => { setN(perCatchOf(config)); setOpen(true); }} />
    {open && <Sheet title={h.copiesTitle} onClose={() => setOpen(false)}
      footer={<View style={{ gap: spacing.sm }}>
        {!!note && <Notice tone="stop" text={note} />}
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <AButton title={h.save} disabled={busy || n === perCatchOf(config)} onPress={() => void save()} />
          <AButton tone="ghost" title={h.cancel} onPress={() => setOpen(false)} />
        </View>
      </View>}>
      <Stepper label={h.copiesTitle} value={n} min={1} max={1000} onChange={setN} />
      <Text style={{ fontFamily: sans, fontSize: 13, lineHeight: 19, color: C.muted }}>{h.copiesNote}</Text>
    </Sheet>}
  </>;
}

/** On a vessel card: Unlimited or Finite, and in edit mode the switch and the player adjustment. */
export function VesselCopies({ rule, name, onSaved }: { rule: SpawnRule; name: string; onSaved?: () => void }) {
  const h = useHuntLoopText();
  const on = unlimitedOf(rule);
  const [confirm, setConfirm] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const flip = async () => {
    setBusy(true); setNote("");
    try { await adminHuntLoop.setUnlimited(rule.vessel, !on); setConfirm(false); onSaved?.(); }
    catch (e) { setNote(loopError(h, e)); }
    finally { setBusy(false); }
  };
  return <View style={{ gap: 6 }}>
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
      <Pill tone={on ? "brass" : "muted"} label={on ? h.unlimited : h.finite} />
      {onSaved && !fixed(rule) && <Pressable accessibilityRole="button" onPress={() => setConfirm(true)}>
        <Text style={{ fontFamily: sans, fontSize: 12, color: C.blue }}>{on ? h.unlimitedOff : h.unlimitedOn}</Text>
      </Pressable>}
    </View>
    {onSaved && !on && <Pressable accessibilityRole="button" onPress={() => setAdjusting(true)}>
      <Text style={{ fontFamily: sans, fontSize: 12, color: C.blue }}>{h.adjust} ›</Text>
    </Pressable>}
    {confirm && <Sheet title={`${name} · ${on ? h.unlimitedOff : h.unlimitedOn}`} onClose={() => setConfirm(false)}
      footer={<View style={{ gap: spacing.sm }}>
        {!!note && <Notice tone="stop" text={note} />}
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <AButton title={on ? h.unlimitedOff : h.unlimitedOn} disabled={busy} onPress={() => void flip()} />
          <AButton tone="ghost" title={h.cancel} onPress={() => setConfirm(false)} />
        </View>
      </View>}>
      <Notice tone={on ? "warn" : "info"} text={on ? h.unlimitedOffNote : h.unlimitedOnNote} />
    </Sheet>}
    {adjusting && <AdjustSheet vessel={rule.vessel} name={name} onClose={() => setAdjusting(false)} />}
  </View>;
}

function AdjustSheet({ vessel, name, onClose }: { vessel: string; name: string; onClose: () => void }) {
  const h = useHuntLoopText();
  const [player, setPlayer] = useState("");
  const [delta, setDelta] = useState(1);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "info" | "stop"; text: string } | null>(null);
  const save = async () => {
    setBusy(true); setNote(null);
    try { const out = await adminHuntLoop.adjustCopies(player.trim(), vessel, delta, reason.trim()); setNote({ tone: "info", text: h.adjusted(out.copies) }); }
    catch (e) { setNote({ tone: "stop", text: loopError(h, e) }); }
    finally { setBusy(false); }
  };
  return <Sheet title={h.adjustTitle(name)} onClose={onClose}
    footer={<View style={{ gap: spacing.sm }}>
      {!!note && <Notice tone={note.tone} text={note.text} />}
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <AButton title={h.save} disabled={busy || !player.trim() || !reason.trim() || delta === 0} onPress={() => void save()} />
        <AButton tone="ghost" title={h.cancel} onPress={onClose} />
      </View>
    </View>}>
    <Field label={h.player} hint={h.playerHint} value={player} onChangeText={setPlayer} autoCapitalize="none" />
    <View style={{ gap: 4 }}>
      <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{h.delta}</Text>
      <Stepper label={h.delta} value={delta} min={-100} max={100} onChange={setDelta} format={(n) => n > 0 ? `+${n}` : String(n)} />
    </View>
    <Field label={h.adjustReason} value={reason} onChangeText={setReason} />
  </Sheet>;
}
