import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated as RNAnimated, AppState, Easing, Image, PanResponder, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { characters, sealWax } from "../../art/manifest";
import { ArtIcon } from "../../components/ArtIcon";
import { figureFor } from "../../components/Figure";
import { haptics } from "../../components/haptics";
import { useLanguage } from "../../i18n";
import { DODGE_FIGHT_RPC, dodgeFights, GameError, type BallKind, type DodgeSession, type DodgeTarget } from "../../services/game";
import { C, sans, serif, shadows } from "../../theme";
import { useReducedMotion } from "../../useReducedMotion";
import { VESSELS } from "../shop/strings";
import { DodgeFight, initialFrame, LIVES, type DodgeInput } from "./dodgeFightRules";
import { FightAttack, FightBoss, GatherBall, HitEdge, PlayerThrow } from "./DodgeEffects";
import { DodgePlayer } from "./DodgePlayer";
import fightStrings from "./dodgeStrings";
import { noWebSelect, useNoWebDrag } from "./noWebDrag";
import { RestoreResultCard, type Restored } from "./RestoreResult";
import { errorKey, useGameText } from "./strings";
import { ThrowBackground, WaxBall, type ThrowScreenProps } from "./ThrowScreen";

type Props = Omit<ThrowScreenProps, "landmark" | "home"> & DodgeTarget & {
  avatar?: unknown;
  home?: { onQuit: () => void; onBack: () => void };
};
const web = Platform.OS === "web";
const moves = [
  { input: "left", icon: "←", keys: "← / A" },
  { input: "jump", icon: "↑", keys: null },
  { input: "right", icon: "→", keys: "→ / D" },
] as const;
const keyInputs: Record<string, DodgeInput> = {
  arrowleft: "left", a: "left", arrowup: "jump", w: "jump", " ": "jump",
  arrowright: "right", d: "right", s: "jump",
};
const mockLosses = new Map<string, { left: number; expiresAt: number }>();

export function DodgeFightScreen({ capsule, landmark, home, avatar, state, onState, onClose }: Props) {
  const { language, setLanguage } = useLanguage();
  const x = fightStrings[language];
  const s = useGameText();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const mode = home ? "home" : landmark ? "landmark" : "corrupted";
  const remote = !home && DODGE_FIGHT_RPC && !capsule.id.startsWith("dev-");
  const stock = { wax: state.wax_balls, gold: state.gold_balls };
  const [attempts, setAttempts] = useState(() => remote ? capsule.attempts_left : mockLosses.get(capsule.id)?.left ?? capsule.attempts_left);
  const [arena, setArena] = useState({ width: 0, height: 0 });
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const [pointer, setPointer] = useState(false);
  const [phase, setPhase] = useState<"intro" | "playing" | "finished">("intro");
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ReturnType<typeof errorKey> | null>(null);
  const [result, setResult] = useState<Restored | null>(null);
  const [, render] = useState(0);
  const engine = useRef<DodgeFight | null>(null);
  if (!engine.current) engine.current = new DodgeFight(mode, capsule.rarity, stock);
  const fight = engine.current;
  const session = useRef<DodgeSession | null>(null);
  const live = useRef(true);
  const blocked = useRef(false);
  const away = useRef(false);
  const resolving = useRef(false);
  const noticeDone = useRef(false);
  const outcome = useRef<Restored | null>(null);
  const finish = useRef<(fight: DodgeFight) => void>(() => {});
  const remoteHit = useRef<(ball: BallKind) => void>(() => {});
  const motion = useSharedValue(initialFrame);
  const finishTime = useSharedValue(0);
  const burst = useRef(new RNAnimated.Value(0)).current;
  const fill = useSharedValue(fight.hp / fight.maxHp);
  const trailing = useSharedValue(fight.hp / fight.maxHp);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  const trailingStyle = useAnimatedStyle(() => ({ width: `${trailing.value * 100}%` }));
  const health = fight.hp / fight.maxHp;
  const portrait = useMemo(() => ({ body: figureFor(avatar), feetY: characters.feetY }), [avatar]);
  const redraw = () => render((n) => n + 1);
  const describeError = (e: unknown) => errorKey(e instanceof GameError ? e.code : "unknown");

  useNoWebDrag();
  useEffect(() => {
    live.current = true;
    return () => { live.current = false; burst.stopAnimation(); };
  }, [burst]);

  useEffect(() => {
    const nowHidden = () => (web && document.hidden) || (AppState.currentState != null && AppState.currentState !== "active");
    const visibility = () => {
      away.current = nowHidden();
      if (away.current && phase === "playing") { blocked.current = true; setPaused(true); }
    };
    visibility();
    const sub = AppState.addEventListener("change", visibility);
    if (web) document.addEventListener("visibilitychange", visibility);
    return () => {
      sub.remove();
      if (web) document.removeEventListener("visibilitychange", visibility);
    };
  }, [phase]);

  useEffect(() => {
    if (!web) return;
    const query = window.matchMedia("(any-pointer: fine)");
    const update = () => setPointer(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    fill.value = reduced ? health : withTiming(health, { duration: 120 });
    trailing.value = reduced ? health : withDelay(250, withTiming(health, { duration: 500 }));
  }, [fill, health, reduced, trailing]);

  const start = async () => {
    if (resolving.current) return;
    resolving.current = true;
    setBusy(true);
    setError(null);
    try {
      if (remote) {
        const initialized = await dodgeFights.start({ capsule, landmark });
        if (!live.current) return;
        session.current = initialized;
        setAttempts(initialized.attemptsLeft);
      } else if (mode === "corrupted") {
        for (const [id, row] of mockLosses) if (row.expiresAt <= Date.now()) mockLosses.delete(id);
        if (attempts <= 0) { setError("gone"); return; }
      }
      const next = new DodgeFight(mode, capsule.rarity, stock, Math.random, session.current ? {
        ...session.current, seconds: Math.max(0, (session.current.expiresAt - Date.now()) / 1000),
      } : undefined);
      next.chooseBall(fight.selected);
      engine.current = next;
      finishTime.value = 0;
      motion.value = { ...next.frame };
      noticeDone.current = false;
      blocked.current = away.current;
      setPaused(away.current);
      setPhase("playing");
    } catch (e) {
      if (live.current) setError(describeError(e));
    } finally {
      resolving.current = false;
      if (live.current) setBusy(false);
    }
  };

  const close = () => {
    if (!resolving.current && !(home && fight.end === "won")) {
      if (home) home.onQuit();
      else onClose(fight.end === "won");
    }
  };

  finish.current = (active) => {
    if (noticeDone.current) return;
    noticeDone.current = true;
    setPhase("finished");
    finishTime.value = withTiming(1, { duration: 1000 });
    if (active.end === "won") {
      const out = outcome.current ?? {
        vessel: capsule.vessel, copies: landmark ? null : 1, stars: 1, is_new: true,
        xp_gained: home ? 0 : landmark ? 2000 : 600,
      };
      void haptics.success();
      burst.setValue(0);
      RNAnimated.timing(burst, { toValue: 1, duration: reduced ? 420 : 1150, easing: Easing.linear, useNativeDriver: !web }).start(({ finished }) => {
        if (!finished || !live.current) return;
        if (home) onClose(true);
        else setResult(out);
      });
      return;
    }
    if (active.end !== "lost" || home) return;
    if (!session.current && mode === "corrupted") {
      const left = Math.max(0, attempts - 1);
      mockLosses.set(capsule.id, { left, expiresAt: Date.parse(capsule.expires_at) });
      setAttempts(left);
    }
    if (!session.current) return;
    resolving.current = true;
    setBusy(true);
    void dodgeFights.loss({ capsule, landmark }, session.current).then((left) => {
      if (live.current) setAttempts(left);
    }).catch((e) => {
      if (live.current) setError(describeError(e));
    }).finally(() => {
      resolving.current = false;
      if (live.current) setBusy(false);
    });
  };

  remoteHit.current = (ball) => {
    const active = engine.current!;
    const current = session.current;
    if (!current || resolving.current) return;
    resolving.current = true;
    void dodgeFights.hit({ capsule, landmark }, current, ball).then((out) => {
      resolving.current = false;
      if (!live.current) return;
      active.stock = { wax: out.wax_balls, gold: out.gold_balls };
      active.selected = active.ball ?? active.selected;
      onState({ ...state, wax_balls: out.wax_balls, gold_balls: out.gold_balls });
      if (out.health === 0) outcome.current = { ...out, stars: out.stars ?? 0 };
      active.applyImpact(out.health);
      motion.value = { ...active.frame };
      redraw();
      if (active.end) finish.current(active);
    }).catch((e) => {
      resolving.current = false;
      if (!live.current) return;
      active.finish(e instanceof GameError && e.code === "no_balls" ? "empty" : "timeout");
      setError(describeError(e));
      finish.current(active);
    });
  };

  useEffect(() => {
    if (phase !== "playing" || paused) return;
    let last: number | undefined;
    let frameId: number;
    const frame = (now: number) => {
      if (blocked.current) { last = undefined; frameId = requestAnimationFrame(frame); return; }
      const active = engine.current!;
      if (active.end) return;
      const { hp, lives, flight, attack, secondsLeft } = active;
      const expiry = session.current?.expiresAt;
      const remaining = expiry === undefined ? Infinity : (expiry - Date.now()) / 1000;
      active.syncTimer(remaining);
      if (remaining <= 0 && !active.pendingHit) active.finish("timeout");
      else active.advance(last === undefined ? 0 : (now - last) / 1000, remote);
      last = now;
      motion.value = { ...active.frame };
      if (active.flight && active.flight !== flight) void haptics.tick();
      if (active.lives !== lives) void haptics.warn();
      if (active.hp !== hp || active.lives !== lives || active.flight !== flight || active.attack !== attack || active.secondsLeft !== secondsLeft) redraw();
      if (active.pendingHit && !resolving.current) remoteHit.current(active.pendingHit);
      if (active.end) { finish.current(active); return; }
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, [motion, phase, paused, remote]);

  const playing = phase === "playing" && !paused;
  const input = useRef<(key: DodgeInput) => void>(() => {});
  input.current = (key) => {
    if (playing && !blocked.current) engine.current?.input(key);
  };
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.max(Math.abs(g.dx), Math.abs(g.dy)) > 16,
    onPanResponderRelease: (_, { dx, dy }) => {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      if (Math.abs(dx) > Math.abs(dy)) input.current(dx < 0 ? "left" : "right");
      else if (dy < 0) input.current("jump");
    },
  }), []);

  useEffect(() => {
    if (!web || !playing) return;
    const keyboard = (e: KeyboardEvent) => {
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey || (e.key === " " && (e.target as HTMLElement)?.closest?.("[role=button],button"))) return;
      const action = keyInputs[e.key.toLowerCase()];
      if (!action) return;
      e.preventDefault();
      input.current(action);
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [playing]);

  const desktop = layout.width >= 600;
  const footerHeight = home ? 91 : 114;
  const stageWidth = desktop ? Math.min(480, (layout.height - footerHeight - 32) * 2 / 3) : layout.width;
  const seconds = fight.secondsLeft;
  const clock = seconds === null ? "" : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const scene = { ...arena, motion, reduced };
  const name = VESSELS[capsule.vessel as keyof typeof VESSELS]?.name[language];
  const title = s(landmark ? "challenge" : "corruptedCapsule");
  const boss = name ? `${title} · ${name}` : title;
  const errorText = error === "expired" ? x.remoteExpired : error ? s(error) : null;
  const ending = fight.end === "empty" ? s("noBalls")
    : fight.end === "timeout" ? s("timeUp") : mode === "corrupted" ? s("gone") : x.noLives;

  return <View style={[styles.root, noWebSelect]} onLayout={(e) => setLayout(e.nativeEvent.layout)}>
    {desktop && <><ThrowBackground /><View pointerEvents="none" style={styles.backdrop} /></>}
    {stageWidth > 0 && <View style={[styles.column, { width: stageWidth, paddingTop: insets.top + (desktop ? 16 : 0),
      paddingBottom: insets.bottom + (desktop ? 16 : 0) }]}>
      <View style={[styles.stage, desktop && styles.desktopStage]} onLayout={(e) => setArena(e.nativeEvent.layout)}>
        <ThrowBackground />
        <View pointerEvents="none" style={styles.dim} />
        {arena.width > 0 && <>
          <View style={[StyleSheet.absoluteFill, web ? ({ touchAction: "none" } as object) : null]} {...pan.panHandlers}>
            <FightBoss {...scene} vessel={capsule.vessel} health={health} warning={fight.attack} damage={fight.damage} burst={burst} finishTime={finishTime} />
            <DodgePlayer {...scene} figure={portrait} />
            {fight.attack && <FightAttack {...scene} attack={fight.attack} shotLabel={x.shot} waveLabel={x.wave} />}
            {playing && fight.ball && <GatherBall {...scene} ball={fight.ball} />}
            {fight.flight && <PlayerThrow {...scene} flight={fight.flight} />}
            <HitEdge motion={motion} finishTime={finishTime} />
          </View>
          <View pointerEvents="box-none" style={styles.hud}>
            <View style={styles.boss}>
              <View style={styles.bossTop}>
                <Text numberOfLines={1} style={styles.bossName}>{boss}</Text>
                <Text style={styles.hpText}>{fight.hp} / {fight.maxHp}</Text>
              </View>
              <View style={styles.bar}>
                <Animated.View style={[styles.barFill, { backgroundColor: "#F3E2BB" }, trailingStyle]} />
                <Animated.View style={[styles.barFill, { backgroundColor: C.wax }, fillStyle]} />
                {Array.from({ length: 7 }, (_, n) => <View key={n} style={[styles.tick, { left: `${(n + 1) * 12.5}%` }]} />)}
              </View>
            </View>
            <View style={styles.hudRow}>
              <View accessibilityLabel={x.lives(fight.lives)} style={styles.lives}>
                {Array.from({ length: LIVES }, (_, n) => <Image key={n} source={sealWax} style={{ height: 22, width: 22, opacity: n < fight.lives ? 1 : .25 }} />)}
              </View>
              {!!clock && <View style={styles.clock}><Text style={styles.clockText}>{clock}</Text></View>}
              <View style={styles.hudActions}>
                <Pressable accessibilityRole="button" accessibilityLabel={x.otherLanguage} style={styles.pill} onPress={() => setLanguage(language === "zh" ? "en" : "zh")}>
                  <Text style={styles.lang}>{x.languageButton}</Text>
                </Pressable>
                {(phase !== "finished" || fight.end === "won") && <Pressable accessibilityRole="button" accessibilityLabel={s("close")} style={styles.pill}
                  disabled={busy || (!!home && fight.end === "won")} onPress={close}>
                  <ArtIcon name="close" size={19} />
                </Pressable>}
              </View>
            </View>
          </View>
        </>}
        {phase === "intro" && <View style={styles.overlay}>
          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.title}>{landmark ? boss : x.intro}</Text>
            <View style={styles.rule}><View style={styles.symbol}><WaxBall kind="wax" size={28} /></View><Text style={styles.ruleText}>{x.gatherRule}</Text></View>
            <View style={styles.rule}><View style={styles.symbol}><Text style={styles.redSymbol}>← →</Text></View><Text style={styles.ruleText}>{x.dodgeRule}</Text></View>
            <View style={styles.rule}><View style={styles.symbol}><Text style={styles.jumpSymbol}>↑</Text></View><Text style={styles.ruleText}>{x.jumpRule}</Text></View>
            <Text style={styles.detail}>{errorText ?? (pointer ? x.keyHint : x.touchHint)}</Text>
            <Action label={x.start} disabled={busy} onPress={() => void start()} />
          </View>
        </View>}
        {paused && phase === "playing" && <View style={styles.overlay}>
          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.title}>{x.paused}</Text>
            <Action label={x.resume} onPress={() => { if (!away.current) { blocked.current = false; setPaused(false); } }} />
          </View>
        </View>}
        {phase === "finished" && fight.end !== "won" && <View style={styles.overlay}>
          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.title}>{errorText ?? ending}</Text>
            {fight.end === "lost" && mode === "corrupted" && !busy && !error && <Text style={styles.detail}>{x.triesLeft(attempts)}</Text>}
            {home && <Action label={x.retry} onPress={() => void start()} />}
            <Action label={s("close")} disabled={busy} onPress={home ? home.onBack : () => onClose(false)} />
          </View>
        </View>}
        {result && <RestoreResultCard result={result} bottom={0} onCollect={() => onClose(true)} />}
      </View>
      <View style={[styles.footer, { minHeight: footerHeight, paddingLeft: Math.max(10, insets.left), paddingRight: Math.max(10, insets.right) }]}>
        <View style={styles.controls}>
          {moves.map(({ input: key, icon, keys }) => <Pressable key={key} accessibilityRole="button" accessibilityLabel={x[key]}
            disabled={!playing} onPress={() => input.current(key)}
            style={({ pressed }) => [styles.control, pressed && styles.controlPressed]}>
            <Text style={[styles.arrow, !playing && styles.disabledText]}>{pointer ? keys ?? x.jumpKeys : icon}</Text>
            <Text style={styles.controlLabel}>{x[key]}</Text>
          </Pressable>)}
        </View>
        {home ? <Text style={styles.detail}>{x.homeFree}</Text> : <View style={styles.balls}>
          {(["wax", "gold"] as const).map((ball) => <Pressable key={ball} accessibilityRole="button"
            accessibilityLabel={`${s(ball)} · ${fight.stock[ball]}`} accessibilityState={{ selected: fight.selected === ball }}
            disabled={paused || phase === "finished" || fight.stock[ball] <= 0} onPress={() => { fight.chooseBall(ball); redraw(); }}
            style={[styles.ball, fight.selected === ball && styles.ballSelected, fight.stock[ball] <= 0 && styles.ballEmpty]}>
            <WaxBall kind={ball} size={23} /><Text style={styles.controlLabel}>{s(ball)} · {fight.stock[ball]}</Text>
          </Pressable>)}
        </View>}
      </View>
    </View>}
  </View>;
}

function Action({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.action, (pressed || disabled) && { opacity: .65 }]}>
    <Text style={styles.actionText}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, zIndex: 40, alignItems: "center", backgroundColor: C.paper },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(22,38,63,.24)" },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(22,38,63,.12)" },
  column: { flex: 1, minHeight: 0 },
  stage: { flex: 1, overflow: "hidden", backgroundColor: "#DDEBD3" },
  desktopStage: { borderRadius: 22, ...shadows.card },
  hud: { position: "absolute", top: 10, left: 10, right: 10, gap: 6, zIndex: 2 },
  boss: { backgroundColor: "rgba(22,38,63,.86)", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, gap: 5 },
  bossTop: { flexDirection: "row", alignItems: "baseline", gap: 8, justifyContent: "space-between" },
  bossName: { flexShrink: 1, fontFamily: serif, fontSize: 13, fontWeight: "700", color: C.white },
  hpText: { fontFamily: sans, fontSize: 12, fontVariant: ["tabular-nums"], color: "#DCE8F2" },
  bar: { height: 12, overflow: "hidden", backgroundColor: "#0B1424", borderRadius: 6, borderWidth: 1, borderColor: C.brass },
  barFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 5 },
  tick: { position: "absolute", width: 1, top: 0, bottom: 0, backgroundColor: "rgba(11,20,36,.55)" },
  hudRow: { minHeight: 36, alignItems: "center", flexDirection: "row", gap: 7 },
  lives: { flexDirection: "row", gap: 4, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 20, backgroundColor: "rgba(246,248,251,.92)" },
  hudActions: { marginLeft: "auto", flexDirection: "row", gap: 6 },
  pill: { justifyContent: "center", alignItems: "center", minWidth: 44, height: 44, paddingHorizontal: 8,
    backgroundColor: "rgba(246,248,251,.96)", borderRadius: 22 },
  lang: { color: C.blue, fontFamily: sans, fontSize: 12 },
  clock: { backgroundColor: C.paper, borderRadius: 20, paddingVertical: 4, paddingHorizontal: 9 },
  clockText: { color: C.ink, fontFamily: sans, fontVariant: ["tabular-nums"], fontSize: 12 },
  footer: { backgroundColor: C.paper, paddingVertical: 8, gap: 7, justifyContent: "center", borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  controls: { flexDirection: "row", gap: 8 },
  control: { flex: 1, minHeight: 56, borderRadius: 15, borderColor: C.line, borderWidth: 1, backgroundColor: C.white, alignItems: "center", justifyContent: "center" },
  controlPressed: { backgroundColor: "#DCE8F2" },
  arrow: { color: C.blue, fontSize: 19, lineHeight: 23, fontWeight: "700" },
  disabledText: { opacity: .65 },
  controlLabel: { color: C.ink, fontFamily: sans, fontSize: 11, textAlign: "center" },
  balls: { flexDirection: "row", gap: 8, justifyContent: "center" },
  ball: { minHeight: 35, alignItems: "center", flexDirection: "row", paddingHorizontal: 9, borderWidth: 1, borderColor: C.line,
    backgroundColor: C.white, borderRadius: 20, gap: 3 },
  ballSelected: { borderColor: C.brass, borderWidth: 2, paddingHorizontal: 8 },
  ballEmpty: { opacity: .5 },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(22,38,63,.38)", alignItems: "center", justifyContent: "center", padding: 14 },
  card: { backgroundColor: C.paper, borderRadius: 18, width: "100%", maxWidth: 330, gap: 10, padding: 16, ...shadows.card },
  title: { fontFamily: serif, fontSize: 19, fontWeight: "700", textAlign: "center", color: C.ink },
  detail: { color: C.muted, fontFamily: sans, textAlign: "center", fontSize: 12 },
  rule: { flexDirection: "row", gap: 9, alignItems: "center" },
  ruleText: { flex: 1, color: C.ink, fontFamily: sans, fontSize: 13 },
  symbol: { width: 40, height: 34, borderRadius: 9, backgroundColor: "#E7EEF5", alignItems: "center", justifyContent: "center" },
  redSymbol: { fontSize: 16, fontWeight: "700", color: C.wax },
  jumpSymbol: { fontSize: 19, fontWeight: "700", color: C.ink },
  action: { minHeight: 44, justifyContent: "center", alignItems: "center", backgroundColor: C.wax, borderRadius: 22, paddingHorizontal: 10 },
  actionText: { fontFamily: serif, fontSize: 16, color: C.white },
});
