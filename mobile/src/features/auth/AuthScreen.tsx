import React, { useState } from "react";
import { Image, TextInput, Text, View, Pressable, ScrollView, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { scenes } from "../../art/manifest";
import { Avatar } from "../../components/Avatar";
import { useLanguage } from "../../i18n";
import { useAuth, redirectUri, signInGoogle } from "../../services/auth";
import { supabase, isConfigured } from "../../services/supabase";
import { C, handwriting, sans, serif } from "../../theme";

function GoogleMark() {
  return <Svg width={20} height={20} viewBox="0 0 48 48" aria-hidden>
    <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </Svg>;
}
export default function AuthScreen() {
  const { t, language, setLanguage } = useLanguage(),
    auth = useAuth();
  const { width } = useWindowDimensions();
  const welcomeWidth = Math.min(320, width - 44);
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "check">(
      "signin",
    ),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [message, setMessage] = useState(""),
    [checkKind, setCheckKind] = useState<"verify" | "reset">("verify"),
    [showPw, setShowPw] = useState(false),
    [busy, setBusy] = useState(false);
  const input = { borderWidth: 1.5, borderColor: "#CDD5DF", borderRadius: 10, paddingHorizontal: 12, height: 46, backgroundColor: C.white, color: C.ink, fontFamily: sans, fontSize: 15 } as const;
  const pill = { minHeight: 50, borderRadius: 999, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 } as const;
  const fieldLabel = { fontFamily: sans, color: "#4A5466", fontSize: 13, marginBottom: 6 } as const;
  const run = async () => {
    setBusy(true);
    setMessage("");
    try {
      if (auth.recovery) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        auth.finishRecovery();
        await auth.refresh();
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      } else if (mode === "signup") {
        if (password.length < 8) {
          setMessage(t("weakPw", 8));
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: redirectUri() },
        });
        if (error) throw error;
        if (!data.session) {
          setCheckKind("verify");
          setMode("check");
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: redirectUri() },
        );
        if (error) throw error;
        setCheckKind("reset");
        setMode("check");
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t("errGeneric"));
    } finally {
      setBusy(false);
    }
  };
  const primary = auth.recovery ? "newPwBtn" : mode === "forgot" ? "sendReset" : mode === "signup" ? "signUpBtn" : "signInBtn";
  return <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, width: "100%", maxWidth: 600, alignSelf: "center", paddingHorizontal: 22, paddingBottom: 28 }}>
    <View style={{ alignItems: "flex-end", paddingTop: 10 }}><Pressable accessibilityRole="button" accessibilityLabel={t("langAria")} onPress={() => setLanguage(language === "zh" ? "en" : "zh")} style={{ height: 30, minWidth: 34, paddingHorizontal: 8, borderWidth: 1.5, borderColor: "#CDD5DF", borderRadius: 999, backgroundColor: C.white, justifyContent: "center", alignItems: "center" }}><Text style={{ color: "#4A5466", fontSize: 13, fontFamily: sans }}>{language === "zh" ? "EN" : "繁中"}</Text></Pressable></View>
    <View style={{ alignItems: "center", marginTop: 8 }}><Image source={scenes.welcome} resizeMode="contain" accessibilityLabel={t("appTitle")} style={{ width: welcomeWidth, height: welcomeWidth * 2 / 3 }} /><Text style={{ fontFamily: serif, fontWeight: "700", fontSize: 30, color: C.ink, letterSpacing: language === "zh" ? 3 : 0, marginTop: 10 }}>{t("appTitle")}</Text><Text style={{ fontFamily: handwriting, color: "#4A5466", fontSize: 17, textAlign: "center", marginBottom: 18 }}>{t("tagline")}</Text></View>
    {auth.inviter && <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.line, borderRadius: 12, padding: 12, marginBottom: 14 }}><Avatar avatar={auth.inviter.avatar} size={36} /><Text style={{ color: C.ink, flex: 1 }}>{t("inviteBanner", auth.inviter.name)}</Text></View>}
    {!isConfigured && <Text style={{ color: C.wax }}>{t("configMissing")}</Text>}
    {mode === "check" && !auth.recovery ? <View style={{ gap: 16 }}><Text style={{ fontFamily: serif, fontSize: 20, color: C.ink }}>{t("checkEmail")}</Text><Text style={{ color: C.ink }}>{t(checkKind === "reset" ? "checkReset" : "checkVerify", email)}</Text><Pressable onPress={() => setMode("signin")} style={[pill, { backgroundColor: C.blue }]}><Text style={{ color: C.white }}>{t("backToSignIn")}</Text></Pressable></View> : <>
      {!auth.recovery && mode !== "forgot" && <><Pressable accessibilityRole="button" disabled={busy || !isConfigured} onPress={() => { setBusy(true); signInGoogle().catch(e => setMessage(e.message === "EXPO_GO_OAUTH_UNSUPPORTED" ? t("oauthNeedsBuild") : e.message)).finally(() => setBusy(false)); }} style={[pill, { backgroundColor: C.white, borderWidth: 1, borderColor: "#4A5466" }]}><GoogleMark /><Text style={{ fontFamily: sans, fontSize: 16, color: "#1F1F1F" }}>{t("google")}</Text></Pressable><View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 18, marginBottom: 10 }}><View style={{ flex: 1, height: 1, backgroundColor: "#CDD5DF" }} /><Text style={{ fontFamily: sans, fontSize: 13, color: C.muted }}>{t("orEmail")}</Text><View style={{ flex: 1, height: 1, backgroundColor: "#CDD5DF" }} /></View><View accessibilityRole="tablist" style={{ flexDirection: "row", borderWidth: 1.5, borderColor: "#4A5466", borderRadius: 999, padding: 3, backgroundColor: C.white, marginBottom: 14 }}>{(["signin", "signup"] as const).map(m => <Pressable key={m} accessibilityRole="tab" accessibilityState={{ selected: mode === m }} onPress={() => setMode(m)} style={{ flex: 1, borderWidth: 1.5, borderColor: mode === m ? "#4A5466" : "transparent", borderRadius: 999, alignItems: "center", paddingVertical: 6 }}><Text style={{ color: mode === m ? C.blue : "#4A5466", fontFamily: serif, fontWeight: mode === m ? "700" : "400", fontSize: 17 }}>{t(m === "signin" ? "signInTab" : "signUpTab")}</Text></Pressable>)}</View></>}
      {auth.recovery && <Text style={{ fontFamily: serif, fontSize: 20, color: C.ink, marginBottom: 12 }}>{t("newPwH")}</Text>}
      {mode === "forgot" && <Text style={{ fontFamily: serif, fontSize: 20, color: C.ink, marginBottom: 8 }}>{t("forgotH")}</Text>}
      {!auth.recovery && <View style={{ marginBottom: 12 }}><Text style={fieldLabel}>{t("emailLabel")}</Text><TextInput accessibilityLabel={t("emailLabel")} autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={C.muted} style={input} /></View>}
      {mode !== "forgot" && <View style={{ marginBottom: 12 }}><Text style={fieldLabel}>{t("pwLabel")}</Text><View style={{ justifyContent: "center" }}><TextInput accessibilityLabel={t("pwLabel")} secureTextEntry={!showPw} autoCapitalize="none" value={password} onChangeText={setPassword} style={[input, { paddingRight: 64 }]} /><Pressable accessibilityRole="button" onPress={() => setShowPw(!showPw)} style={{ position: "absolute", right: 6, padding: 8 }}><Text style={{ color: C.blue, fontFamily: sans, fontSize: 13 }}>{t(showPw ? "hidePw" : "showPw")}</Text></Pressable></View></View>}
      <Pressable disabled={busy || !isConfigured} accessibilityRole="button" onPress={() => void run()} style={[pill, { backgroundColor: C.blue, marginTop: 14, opacity: busy || !isConfigured ? .5 : 1 }]}><Text style={{ color: C.white, fontFamily: sans, fontSize: 16, fontWeight: "500" }}>{t(primary)}</Text></Pressable>
      {((mode === "signin" && !auth.recovery) || mode === "forgot") && <Pressable onPress={() => setMode(mode === "forgot" ? "signin" : "forgot")} style={{ alignSelf: "center", marginTop: 14 }}><Text style={{ color: C.blue, fontFamily: sans, fontSize: 14, textDecorationLine: "underline" }}>{t(mode === "forgot" ? "backToSignIn" : "forgot")}</Text></Pressable>}
    </>}
    {!!message && <Text accessibilityRole="alert" style={{ color: C.wax, fontSize: 13, textAlign: "center", marginTop: 10 }}>{message}</Text>}
  </ScrollView></SafeAreaView>;
}
