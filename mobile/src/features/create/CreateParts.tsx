import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { C, radii, sans, serif } from '../../theme';

/** Create v2 pieces: a bottom sheet, the dropdown row that opens it, a month calendar,
 *  toolbar icons and the client-side vessel categories (docs/design/create-v2.md). */

export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
      {/* The shade is a sibling, not a parent, so the options aren't buttons nested in a button on web. */}
      <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onClose} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(22,38,63,.38)' }} />
      <View style={{ width: '100%', maxWidth: 640, alignSelf: 'center', maxHeight: '78%', backgroundColor: C.paper, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingTop: 8, paddingBottom: 24 }}>
        <View style={{ width: 40, height: 4, borderRadius: 4, backgroundColor: C.line, alignSelf: 'center', marginBottom: 10 }} />
        <Text style={{ fontFamily: serif, fontSize: 17, color: C.ink, paddingHorizontal: 20, marginBottom: 6 }}>{title}</Text>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 12, gap: 2 }}>{children}</ScrollView>
      </View>
    </View>
  </Modal>;
}

export function SheetGroup({ children }: { children: string }) {
  return <Text style={{ fontFamily: sans, fontSize: 11.5, color: C.muted, letterSpacing: .8, marginTop: 8, marginHorizontal: 10 }}>{children}</Text>;
}

export function SheetOption({ selected, icon, title, sub, onPress, accent }: { selected?: boolean; icon: React.ReactNode; title: string; sub?: string; onPress: () => void; accent?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: !!selected }} onPress={onPress}
    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 9, borderRadius: 12, borderWidth: 1, borderColor: selected ? C.blue : 'transparent', backgroundColor: selected || pressed ? C.white : 'transparent' })}>
    {icon}
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={{ fontFamily: sans, color: accent ? C.blue : C.ink, fontSize: 15 }}>{title}</Text>
      {!!sub && <Text style={{ fontFamily: sans, color: C.muted, fontSize: 12.5 }}>{sub}</Text>}
    </View>
  </Pressable>;
}

/** The closed dropdown: icon, value, a short explanation and a chevron. */
export function PickerRow({ icon, title, sub, onPress, label }: { icon: React.ReactNode; title: string; sub?: string; onPress: () => void; label: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${title}`} onPress={onPress}
    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderWidth: 1, borderColor: pressed ? C.lightBlue : C.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 })}>
    {icon}
    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
      <Text numberOfLines={1} style={{ fontFamily: serif, fontSize: 17, color: C.ink }}>{title}</Text>
      {!!sub && <Text style={{ fontFamily: sans, fontSize: 13, color: C.muted }}>{sub}</Text>}
    </View>
    <Chevron />
  </Pressable>;
}

export const Glyph = ({ children, size = 44 }: { children: React.ReactNode; size?: number }) =>
  <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.glass, alignItems: 'center', justifyContent: 'center' }}>{children}</View>;

const Chevron = () => <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M6 9l6 6 6-6" stroke={C.muted} strokeWidth={2} strokeLinecap="round" /></Svg>;

export type ToolKind = 'text' | 'voice' | 'photo' | 'hand' | 'predict' | 'clock' | 'calendar' | 'anywhere' | 'landmark' | 'search' | 'here';
export function ToolIcon({ kind, color = C.blue, size = 22 }: { kind: ToolKind; color?: string; size?: number }) {
  const s = { stroke: color, strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return <Svg width={size} height={size} viewBox="0 0 24 24">
    {kind === 'text' && <Path d="M5 6h14M5 11h14M5 16h9" {...s} />}
    {kind === 'voice' && <><Path d="M9 6a3 3 0 016 0v5a3 3 0 01-6 0z" {...s} /><Path d="M5 11a7 7 0 0014 0M12 18v3" {...s} /></>}
    {kind === 'photo' && <><Path d="M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" {...s} /><Circle cx={9} cy={10} r={1.6} {...s} /><Path d="M21 16l-5-5-8 8" {...s} /></>}
    {kind === 'hand' && <><Path d="M4 20l4-1 11-11-3-3L5 16l-1 4z" {...s} /><Path d="M14 7l3 3" {...s} /></>}
    {kind === 'predict' && <><Circle cx={12} cy={11} r={7} {...s} /><Path d="M8 21h8M12 18v3M9.5 9.5a3 3 0 013-2" {...s} /></>}
    {kind === 'clock' && <><Circle cx={12} cy={12} r={9} {...s} /><Path d="M12 7v5l3 2" {...s} /></>}
    {kind === 'calendar' && <><Path d="M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2zM3 10h18M8 3v4M16 3v4" {...s} /></>}
    {kind === 'anywhere' && <><Circle cx={12} cy={12} r={9} {...s} /><Path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" {...s} /></>}
    {kind === 'landmark' && <Path d="M5 21V4M5 4h11l-2 4 2 4H5" {...s} />}
    {kind === 'search' && <><Circle cx={11} cy={11} r={7} {...s} /><Path d="M20 20l-4-4" {...s} /></>}
    {kind === 'here' && <><Circle cx={12} cy={12} r={4} {...s} /><Path d="M12 2v3M12 19v3M2 12h3M19 12h3" {...s} /></>}
  </Svg>;
}

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Month grid for a custom opening day. Today and earlier are disabled; value is YYYY-MM-DD. */
export function MonthCalendar({ value, onChange, language }: { value: string; onChange: (v: string) => void; language: 'zh' | 'en' }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const picked = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : null;
  const start = picked && picked > today ? picked : new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const [month, setMonth] = React.useState(new Date(start.getFullYear(), start.getMonth(), 1));
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const canPrev = month > new Date(today.getFullYear(), today.getMonth(), 1);
  const weekdays = language === 'zh' ? ['日', '一', '二', '三', '四', '五', '六'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const cells: (Date | null)[] = [...Array(month.getDay()).fill(null), ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const arrow = (n: number, enabled: boolean) => <Pressable accessibilityRole="button" accessibilityLabel={n < 0 ? '‹' : '›'} disabled={!enabled} onPress={() => shift(n)}
    style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', opacity: enabled ? 1 : .35 }}>
    <Text style={{ fontSize: 18, color: C.ink }}>{n < 0 ? '‹' : '›'}</Text>
  </Pressable>;
  return <View style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12, gap: 8 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      {arrow(-1, canPrev)}
      <Text style={{ fontFamily: serif, fontSize: 16, color: C.ink }}>{month.toLocaleDateString(language === 'zh' ? 'zh-Hant' : 'en', { year: 'numeric', month: 'long' })}</Text>
      {arrow(1, true)}
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {weekdays.map((w, i) => <Text key={`w${i}`} style={{ width: `${100 / 7}%`, textAlign: 'center', fontFamily: sans, fontSize: 11, color: C.muted, paddingVertical: 4 }}>{w}</Text>)}
      {cells.map((d, i) => {
        if (!d) return <View key={`e${i}`} style={{ width: `${100 / 7}%` }} />;
        const past = d <= today, on = value === dayKey(d);
        return <View key={dayKey(d)} style={{ width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 2 }}>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: on, disabled: past }} disabled={past} onPress={() => onChange(dayKey(d))}
            style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.wax : 'transparent' }}>
            <Text style={{ fontFamily: sans, fontSize: 14, color: on ? C.white : past ? '#C4CBD6' : C.ink }}>{d.getDate()}</Text>
          </Pressable>
        </View>;
      })}
    </View>
  </View>;
}

export function Chip({ on, label, count, onPress }: { on: boolean; label: string; count?: number; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress}
    style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, borderWidth: 1, borderColor: on ? C.ink : C.line, backgroundColor: on ? C.ink : C.white, borderRadius: radii.pill, paddingHorizontal: 13, paddingVertical: 6 }}>
    <Text style={{ fontFamily: sans, fontSize: 13.5, color: on ? C.white : C.ink }}>{label}</Text>
    {count != null && <Text style={{ fontFamily: sans, fontSize: 11.5, color: on ? C.glass : C.muted }}>{count}</Text>}
  </Pressable>;
}

export type VesselCategory = 'classic' | 'festival' | 'keepsake' | 'food' | 'landmark' | 'brand';
export const VESSEL_CATEGORIES: VesselCategory[] = ['classic', 'festival', 'keepsake', 'food', 'landmark', 'brand'];
const CATEGORY: Record<string, VesselCategory> = {
  lantern: 'festival', 'mooncake-tin': 'festival', 'red-packet': 'festival', 'rice-dumpling': 'festival', pumpkin: 'festival', stocking: 'festival',
  'river-lantern': 'festival', 'cake-box': 'festival', 'candy-box': 'festival', 'wish-tag': 'festival', 'lucky-cat': 'festival', 'lucky-stars': 'festival', 'camp-lantern': 'festival',
  mixtape: 'keepsake', 'instant-camera': 'keepsake', vinyl: 'keepsake', vhs: 'keepsake', 'photo-strip': 'keepsake', arcade: 'keepsake', pager: 'keepsake',
  'rotary-phone': 'keepsake', 'phone-booth': 'keepsake', 'love-padlock': 'keepsake', 'paper-cranes': 'keepsake', 'heart-locket': 'keepsake', gashapon: 'keepsake',
  'diploma-tube': 'keepsake', 'baby-shoes': 'keepsake', 'memorial-candle': 'keepsake', suitcase: 'keepsake', umbrella: 'keepsake', 'paper-plane': 'keepsake',
  ramen: 'food', 'fortune-cookie': 'food', 'chocolate-heart': 'food', 'bubble-tea': 'food', 'dim-sum-steamer': 'food', bento: 'food',
  'red-bird': 'landmark', 'clock-tower': 'landmark', 'senado-fountain': 'landmark', 'bamboo-tower': 'landmark', 'gate-lantern': 'landmark', 'torii-scroll': 'landmark',
  'palace-pavilion': 'landmark', 'lionfish-fountain': 'landmark', 'golden-roof': 'landmark', 'gate-lacquer': 'landmark', 'twin-towers': 'landmark',
};
/** Unlisted vessels fall back to Classic; any brand collaboration is Brand. */
export const vesselCategory = (v: { id: string; brand?: string | null }): VesselCategory => v.brand ? 'brand' : CATEGORY[v.id] ?? 'classic';
