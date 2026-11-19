// The frame around every admin page: who you are, where you can go. Phones get a top bar and bottom tabs
// like the app; from 900 px a sidebar with the cities. The server checks the role on every call; this
// only hides what a role can't use.
import React, { createContext, useContext, useEffect, useState } from "react";
import { Image, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, usePathname } from "expo-router";
import { sealWax } from "../../art/manifest";
import { ArtIcon, type IconName } from "../../components/ArtIcon";
import { Avatar } from "../../components/Avatar";
import { useLanguage } from "../../i18n";
import AuthScreen from "../auth/AuthScreen";
import { useAuth } from "../../services/auth";
import { ADMIN_SAMPLE, ROLES, admin, adminMe, can, type AdminRole, type Region } from "../../services/admin";
import { sample } from "../../services/adminSample";
import { ADMIN_HUNT_LOOP } from "../../services/adminHuntLoop";
import { C, radii, sans, serif, spacing } from "../../theme";
import { useAdminText } from "./strings";
import { useHuntLoopText } from "./huntLoopStrings";
import { AButton, Loading, Pill, useWide } from "./ui";

type Ctx = { role: AdminRole; cities: Region[]; refresh: () => void };
const AdminContext = createContext<Ctx>({ role: "viewer", cities: [], refresh: () => {} });
export const useAdmin = () => useContext(AdminContext);

type Tab = { href: string; key: "overview" | "capsules" | "hunts" | "queue" | "activity" | "members"; icon: IconName };
const TABS: Tab[] = [
  { href: "/admin", key: "overview", icon: "map" },
  { href: "/admin/capsules", key: "capsules", icon: "album" },
  { href: "/admin/hunts", key: "hunts", icon: "quest" },
  { href: "/admin/queue", key: "queue", icon: "check" },
  { href: "/admin/activity", key: "activity", icon: "pen" },
  { href: "/admin/members", key: "members", icon: "user" },
];
/** Tab names: the hunt-loop tab keeps its wording beside the hunt-loop screens. */
function useNavLabel() {
  const a = useAdminText();
  const h = useHuntLoopText();
  return (key: Tab["key"]) => key === "hunts" ? h.nav : a.nav[key];
}
const isOn = (path: string, href: string) => href === "/admin" ? path === "/admin" || path.startsWith("/admin/city") : path.startsWith(href);

export function AdminShell({ children }: { children: React.ReactNode }) {
  const a = useAdminText();
  const auth = useAuth();
  const [role, setRole] = useState<AdminRole | null | undefined>(undefined);
  const [cities, setCities] = useState<Region[]>([]);
  const [tick, setTick] = useState(0);
  const userId = auth.session?.user.id;
  // The development sample needs no account, so the screens can be designed signed out.
  const signedIn = !!userId || ADMIN_SAMPLE;

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    adminMe().then((me) => {
      if (!live) return;
      setRole(me?.role ?? null);
      if (me) admin.cities().then((c) => live && setCities(c), () => {});
    }, () => live && setRole(null));
    return () => { live = false; };
  }, [userId, signedIn, tick]);

  if (Platform.OS !== "web") return <Message title={a.webOnly} />;
  if (auth.loading) return <Loading />;
  if (!signedIn) return <AuthScreen />;
  if (role === undefined) return <Loading />;
  if (role === null) return <Message title={a.noAccess} note={a.noAccessNote} />;
  return <AdminContext.Provider value={{ role, cities, refresh: () => setTick((n) => n + 1) }}>
    <Frame>{children}</Frame>
  </AdminContext.Provider>;
}

function Message({ title, note }: { title: string; note?: string }) {
  const a = useAdminText();
  return <SafeAreaView style={{ flex: 1, backgroundColor: C.paper, alignItems: "center", justifyContent: "center", padding: spacing.lg, gap: spacing.md }}>
    <Image source={sealWax} style={{ width: 72, height: 72 }} />
    <Text style={{ fontFamily: serif, fontSize: 22, color: C.ink, textAlign: "center" }}>{title}</Text>
    {!!note && <Text style={{ fontFamily: sans, fontSize: 14, color: C.muted, textAlign: "center", maxWidth: 360 }}>{note}</Text>}
    <AButton title={a.backToApp} tone="ghost" onPress={() => router.replace("/")} />
  </SafeAreaView>;
}

function Frame({ children }: { children: React.ReactNode }) {
  const wide = useWide();
  const { role } = useAdmin();
  const tabs = TABS.filter((t) => (t.key !== "members" || can(role, "members")) && (t.key !== "hunts" || ADMIN_HUNT_LOOP));
  return <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
    {ADMIN_SAMPLE && <SampleBanner />}
    {wide
      ? <View style={{ flex: 1, flexDirection: "row" }}>
          <Sidebar tabs={tabs} />
          <View style={{ flex: 1 }}>{children}</View>
        </View>
      : <View style={{ flex: 1 }}>
          <TopBar />
          <View style={{ flex: 1 }}>{children}</View>
          <BottomTabs tabs={tabs} />
        </View>}
  </SafeAreaView>;
}

function SampleBanner() {
  const a = useAdminText();
  const { refresh } = useAdmin();
  const [role, setRole] = useState(sample.role());
  return <View style={{ backgroundColor: "#F6EEDC", borderBottomWidth: 1, borderBottomColor: "#E8D8B4", paddingHorizontal: spacing.md, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
    <Text style={{ fontFamily: sans, fontSize: 12, color: "#8A6A2E", flexShrink: 1 }}>{a.sample}</Text>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginLeft: "auto", flexWrap: "wrap" }}>
      <Text style={{ fontFamily: sans, fontSize: 12, color: "#8A6A2E" }}>{a.viewAs}</Text>
      {ROLES.map((r) => <Pressable key={r} accessibilityRole="button" accessibilityState={{ selected: r === role }}
        onPress={() => { sample.viewAs(r); setRole(r); refresh(); }}
        style={{ borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: r === role ? "#8A6A2E" : "transparent", borderWidth: 1, borderColor: "#C9A15A" }}>
        <Text style={{ fontFamily: sans, fontSize: 11, color: r === role ? C.white : "#8A6A2E" }}>{a.role[r]}</Text>
      </Pressable>)}
    </View>
  </View>;
}

function Brand({ compact }: { compact?: boolean }) {
  const a = useAdminText();
  return <Pressable accessibilityRole="link" onPress={() => router.push("/admin" as any)} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
    <Image source={sealWax} style={{ width: compact ? 30 : 36, height: compact ? 30 : 36 }} />
    <View>
      <Text numberOfLines={2} style={{ fontFamily: serif, fontSize: compact ? 17 : 16, lineHeight: compact ? 22 : 20, color: C.ink, maxWidth: 170 }}>{compact ? a.short : a.title}</Text>
    </View>
  </Pressable>;
}

function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  return <Pressable accessibilityRole="button" accessibilityLabel={language === "zh" ? "English" : "中文"} onPress={() => setLanguage(language === "zh" ? "en" : "zh")}
    style={{ borderWidth: 1, borderColor: C.line, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: C.white }}>
    <Text style={{ fontFamily: sans, fontSize: 12, color: C.blue }}>{language === "zh" ? "EN" : "中"}</Text>
  </Pressable>;
}

function Sidebar({ tabs }: { tabs: Tab[] }) {
  const a = useAdminText();
  const navLabel = useNavLabel();
  const { language } = useLanguage();
  const { role, cities } = useAdmin();
  const { profile } = useAuth();
  const path = usePathname();
  return <View style={{ width: 248, borderRightWidth: 1, borderRightColor: C.line, backgroundColor: "#EEF2F7" }}>
    <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, flexGrow: 1 }}>
      <View style={{ paddingHorizontal: 4, paddingTop: 4 }}><Brand /></View>
      <View style={{ gap: 2 }}>
        {tabs.map((t) => <NavItem key={t.key} icon={t.icon} label={navLabel(t.key)} on={isOn(path, t.href) && !(t.key === "overview" && path.startsWith("/admin/city"))} onPress={() => router.push(t.href as any)} />)}
      </View>
      {!!cities.length && <View style={{ gap: 2 }}>
        <Text style={{ fontFamily: sans, fontSize: 11, letterSpacing: 1, color: C.muted, paddingHorizontal: 12, marginBottom: 4 }}>{a.cities.toUpperCase()}</Text>
        {cities.map((c) => <NavItem key={c.id} icon="pin" label={language === "zh" ? c.name_zh : c.name_en}
          on={path === `/admin/city/${c.id}`} onPress={() => router.push(`/admin/city/${c.id}` as any)} />)}
      </View>}
      <View style={{ flex: 1 }} />
      <View style={{ gap: spacing.md, borderTopWidth: 1, borderTopColor: C.line, paddingTop: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Avatar avatar={profile?.avatar as any} size={36} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text numberOfLines={1} style={{ fontFamily: sans, fontSize: 14, color: C.ink }}>{profile?.name ?? ""}</Text>
            <Pill label={a.role[role]} tone={role === "owner" ? "brass" : "blue"} />
          </View>
          <LanguageToggle />
        </View>
        <Pressable accessibilityRole="link" onPress={() => router.replace("/")}>
          <Text style={{ fontFamily: sans, fontSize: 13, color: C.blue }}>← {a.backToApp}</Text>
        </Pressable>
      </View>
    </ScrollView>
  </View>;
}

function NavItem({ icon, label, on, onPress }: { icon: IconName; label: string; on: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="link" accessibilityState={{ selected: on }} onPress={onPress}
    style={({ hovered }: any) => ({ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 9, borderRadius: radii.sm,
      backgroundColor: on ? C.white : hovered ? "rgba(255,255,255,.6)" : "transparent", borderWidth: 1, borderColor: on ? C.line : "transparent" })}>
    <ArtIcon name={icon} size={20} color={on ? C.blue : C.muted} />
    <Text style={{ fontFamily: sans, fontSize: 14, color: on ? C.ink : "#4A5870" }}>{label}</Text>
  </Pressable>;
}

function TopBar() {
  const { role } = useAdmin();
  const a = useAdminText();
  const { profile } = useAuth();
  return <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line, backgroundColor: C.paper }}>
    <Brand compact />
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
      <Pill label={a.role[role]} tone={role === "owner" ? "brass" : "blue"} />
      <LanguageToggle />
      <Pressable accessibilityRole="link" accessibilityLabel={a.backToApp} onPress={() => router.replace("/")}>
        <Avatar avatar={profile?.avatar as any} size={30} />
      </Pressable>
    </View>
  </View>;
}

function BottomTabs({ tabs }: { tabs: Tab[] }) {
  const navLabel = useNavLabel();
  const path = usePathname();
  return <View accessibilityRole="tablist" style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.white, paddingBottom: 4 }}>
    {tabs.map((t) => {
      const on = isOn(path, t.href);
      return <Pressable key={t.key} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => router.push(t.href as any)}
        style={{ flex: 1, alignItems: "center", paddingTop: 8, paddingBottom: 4, gap: 2 }}>
        <ArtIcon name={t.icon} size={22} color={on ? C.blue : C.muted} />
        <Text numberOfLines={1} style={{ fontFamily: sans, fontSize: 10, color: on ? C.blue : C.muted }}>{navLabel(t.key)}</Text>
      </Pressable>;
    })}
  </View>;
}
