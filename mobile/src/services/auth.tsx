import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import Constants, { ExecutionEnvironment } from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { invites, profiles, Profile } from "./data";
import { setTestLocationForUser } from "../features/journey/location";
WebBrowser.maybeCompleteAuthSession();
export const redirectUri = () =>
  AuthSession.makeRedirectUri({ scheme: "timecapsule", path: "auth/callback" });
type AuthState = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  recovery: boolean;
  inviter: { name: string; avatar: any } | null;
  refresh: () => Promise<void>;
  finishRecovery: () => void;
};
const Context = createContext<AuthState>({
  session: null,
  profile: null,
  loading: true,
  error: null,
  recovery: false,
  inviter: null,
  refresh: async () => {},
  finishRecovery: () => {},
});
const exchanges = new Map<string, Promise<boolean>>();
export function handleAuthUrl(url: string): Promise<boolean> {
  const existing = exchanges.get(url);
  if (existing) return existing;
  const pending = processAuthUrl(url);
  exchanges.set(url, pending);
  pending.catch(() => exchanges.delete(url));
  return pending;
}
async function processAuthUrl(url: string) {
  const parsed = new URL(url);
  const invite = parsed.searchParams.get("invite");
  if (invite) await AsyncStorage.setItem("tc-invite", invite);
  const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  const code = parsed.searchParams.get("code");
  const access = fragment.get("access_token");
  const refresh = fragment.get("refresh_token");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
  } else if (access && refresh) {
    const { error } = await supabase.auth.setSession({
      access_token: access,
      refresh_token: refresh,
    });
    if (error) throw error;
  }
  return (
    parsed.searchParams.get("type") === "recovery" ||
    fragment.get("type") === "recovery"
  );
}
export async function signInGoogle() {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient)
    throw new Error("EXPO_GO_OAUTH_UNSUPPORTED");
  const redirect = redirectUri();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: redirect, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw Error("OAuth URL missing");
  if (Platform.OS === "web") {
    globalThis.location.assign(data.url);
    return;
  }
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirect);
  if (result.type === "success") await handleAuthUrl(result.url);
}
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const refreshVersion = useRef(0);
  const [session, setSession] = useState<Session | null>(null),
    [profile, setProfile] = useState<Profile | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null),
    [recovery, setRecovery] = useState(false),
    [inviter, setInviter] = useState<{ name: string; avatar: any } | null>(
      null,
    );
  const refresh = async () => {
    const version = ++refreshVersion.current;
    try {
      const {
        data: { session: s },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const result = s ? await profiles.get(s.user.id) : null;
      if (result?.error) throw result.error;
      if (version !== refreshVersion.current) return;
      setSession(s);
      setProfile((result?.data as Profile | null) ?? null);
      setError(null);
      if (s && result?.data) {
        const code = await AsyncStorage.getItem("tc-invite");
        if (code) {
          const { error: inviteError } = await invites.accept(code);
          if (!inviteError) await AsyncStorage.removeItem("tc-invite");
        }
      }
    } catch (err) {
      if (version === refreshVersion.current)
        setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (version === refreshVersion.current) setLoading(false);
    }
  };
  useEffect(() => {
    setTestLocationForUser(session?.user.id ?? null);
  }, [session?.user.id]);
  useEffect(() => {
    let alive = true;
    const process = async (url: string | null) => {
      if (url) {
        try {
          if (await handleAuthUrl(url)) setRecovery(true);
        } catch (e) {
          console.error("auth link", e);
        }
      }
      const code = await AsyncStorage.getItem("tc-invite");
      if (code) {
        const { data } = await invites.info(code);
        if (alive && data?.[0]) setInviter(data[0]);
      }
      await refresh();
    };
    void Linking.getInitialURL().then(process);
    const sub = Linking.addEventListener("url", (e) => void process(e.url));
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setTimeout(() => void refresh(), 0);
    });
    const app = AppState.addEventListener("change", (state) => {
      if (state === "active") supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    return () => {
      alive = false;
      sub.remove();
      data.subscription.unsubscribe();
      app.remove();
    };
  }, []);
  return (
    <Context.Provider
      value={{
        session,
        profile,
        loading,
        error,
        recovery,
        inviter,
        refresh,
        finishRecovery: () => setRecovery(false),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useAuth = () => useContext(Context);
