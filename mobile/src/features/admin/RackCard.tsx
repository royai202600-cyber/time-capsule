// What hangs on a Waypost's capsule rack (HL-C1 admin): who left each capsule, its hint, when it opens, its lock
// question and what happened to it. Reported capsules show their content to roles that may read it. Moderators and
// up can remove one with a reason; Undo is in Activity.
import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Avatar } from "../../components/Avatar";
import { useLanguage } from "../../i18n";
import { can } from "../../services/admin";
import { adminHuntLoop, type RackEntry, type RackPage, type RackStatus } from "../../services/adminHuntLoop";
import { C, radii, sans, serif, spacing } from "../../theme";
import { useAdmin } from "./AdminShell";
import { sayError, useHuntLoopText, type Say } from "./huntLoopStrings";
import { AButton, Card, Field, Loading, Notice, Pill, shortDate, type Tone } from "./ui";

const TONE: Record<RackStatus, Tone> = { waiting: "muted", ready: "blue", claimed: "ink", opened: "plum", reported: "wax", removed: "muted" };

export function RackCard({ waypost }: { waypost: string }) {
  const h = useHuntLoopText();
  const { role } = useAdmin();
  const [page, setPage] = useState<RackPage | null>(null);
  const [failed, setFailed] = useState<Say | null>(null);
  const load = async (more = false) => {
    setFailed(null);
    try {
      const next = await adminHuntLoop.rack(waypost, more ? page?.next_cursor : null);
      setPage((x) => more && x ? { ...next, items: [...x.items, ...next.items] } : next);
    } catch (e) { setFailed(() => sayError(e)); }
  };
  useEffect(() => { setPage(null); void load(); }, [waypost, role]);
  const removed = (id: string) => setPage((x) => x && { ...x, items: x.items.map((c) => c.capsule_id === id ? { ...c, status: "removed" } : c) });

  return <Card style={{ gap: spacing.sm }}>
    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
      <Text style={{ fontFamily: serif, fontSize: 17, color: C.ink }}>{h.rack}</Text>
      {page && <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{h.rackCount(page.count)}</Text>}
    </View>
    {failed ? <Notice tone="stop" text={failed(h)} /> : !page ? <Loading /> : !page.items.length
      ? <Text style={{ fontFamily: sans, fontSize: 13, color: C.muted }}>{h.rackEmpty}</Text>
      : page.items.map((c) => <RackRow key={c.capsule_id} entry={c} mayRemove={can(role, "queue")} onRemoved={() => removed(c.capsule_id)} />)}
    {!!page?.next_cursor && <View style={{ alignItems: "center" }}><AButton small tone="ghost" title={h.more} onPress={() => void load(true)} /></View>}
  </Card>;
}

function RackRow({ entry: c, mayRemove, onRemoved }: { entry: RackEntry; mayRemove: boolean; onRemoved: () => void }) {
  const h = useHuntLoopText();
  const { language } = useLanguage();
  const [removing, setRemoving] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "info" | "stop"; say: Say } | null>(null);
  const remove = async () => {
    setBusy(true); setNote(null);
    try { await adminHuntLoop.removeFromRack(c.capsule_id, reason.trim()); setRemoving(false); setNote({ tone: "info", say: (t) => t.removed }); onRemoved(); }
    catch (e) { setNote({ tone: "stop", say: sayError(e) }); }
    finally { setBusy(false); }
  };
  return <View style={{ gap: 6, backgroundColor: C.paper, borderRadius: radii.sm, padding: spacing.sm, opacity: c.status === "removed" ? .6 : 1 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
      <Avatar avatar={c.sender.portrait as never} size={30} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontFamily: sans, fontSize: 13, color: C.ink }}>{c.sender.name}</Text>
        <Text style={{ fontFamily: sans, fontSize: 11, color: C.muted }}>{h.opens(shortDate(c.opens_at, language))}</Text>
      </View>
      <Pill tone={TONE[c.status]} label={h.rackStatus[c.status]} />
    </View>
    {!!c.hint && <Text style={{ fontFamily: serif, fontSize: 14, color: C.plum }}>「{c.hint}」</Text>}
    {!!c.lock_question && <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{h.lock(c.lock_question)}</Text>}
    {c.report_count > 0 && <Text style={{ fontFamily: sans, fontSize: 12, color: C.wax }}>{h.reports(c.report_count)}</Text>}
    {!!c.body && <View style={{ gap: 2, borderLeftWidth: 2, borderLeftColor: C.wax, paddingLeft: 8 }}>
      <Text style={{ fontFamily: sans, fontSize: 11, color: C.muted }}>{h.body}</Text>
      <Text style={{ fontFamily: sans, fontSize: 13, lineHeight: 19, color: C.ink }}>{c.body}</Text>
    </View>}
    {!!note && <Notice tone={note.tone} text={note.say(h)} />}
    {mayRemove && c.status !== "removed" && (removing
      ? <View style={{ gap: spacing.sm }}>
          <Field label={h.removeReason} value={reason} onChangeText={setReason} autoFocus />
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <AButton small tone="wax" title={h.removeConfirm} disabled={busy || !reason.trim()} onPress={() => void remove()} />
            <AButton small tone="ghost" title={h.cancel} onPress={() => setRemoving(false)} />
          </View>
        </View>
      : <View style={{ alignItems: "flex-start" }}><AButton small tone="ghost" title={h.remove} onPress={() => setRemoving(true)} /></View>)}
  </View>;
}
