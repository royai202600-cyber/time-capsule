import React, { createContext, useContext, useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import Constants, { ExecutionEnvironment } from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { invites, profiles, Profile } from "./data";
WebBrowser.maybeCompleteAuthSession();
export const redirectUri = () =>
  AuthSession.makeRedirectUri({ scheme: "timecapsule", path: "auth/callback" });
type AuthState = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  recovery: boolean;
  inviter: { name: string; avatar: any } | null;
  refresh: () => Promise<void>;
  finishRecovery: () => void;
};
const Context = createContext<AuthState>({
  session: null,
  profile: null,
  loading: true,
  recovery: false,
  inviter: null,
  refresh: async () => {},
  finishRecovery: () => {},
});
export async function handleAuthUrl(url: string) {
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
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) throw new Error("EXPO_GO_OAUTH_UNSUPPORTED");
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
  const [session, setSession] = useState<Session | null>(null),
    [profile, setProfile] = useState<Profile | null>(null),
    [loading, setLoading] = useState(true),
    [recovery, setRecovery] = useState(false),
    [inviter, setInviter] = useState<{ name: string; avatar: any } | null>(
      null,
    );
  const refresh = async () => {
    const {
      data: { session: s },
    } = await supabase.auth.getSession();
    setSession(s);
    if (s) {
      const { data } = await profiles.get(s.user.id);
      setProfile(data as Profile | null);
      if (data) {
        const code = await AsyncStorage.getItem("tc-invite");
        if (code) {
          const { error } = await invites.accept(code);
          if (!error) await AsyncStorage.removeItem("tc-invite");
        }
      }
    } else setProfile(null);
    setLoading(false);
  };
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
