import React, { useState } from "react";
import { TextInput, Text, View, Pressable } from "react-native";
import { Screen, Heading, Body, Button, Bar } from "../../components/Screen";
import { Avatar } from "../../components/Avatar";
import { useLanguage } from "../../i18n";
import { useAuth, redirectUri, signInGoogle } from "../../services/auth";
import { supabase, isConfigured } from "../../services/supabase";
import { C } from "../../theme";
export default function AuthScreen() {
  const { t, language, setLanguage } = useLanguage(),
    auth = useAuth();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "check">(
      "signin",
    ),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [message, setMessage] = useState(""),
    [checkKind, setCheckKind] = useState<"verify" | "reset">("verify"),
    [showPw, setShowPw] = useState(false),
    [busy, setBusy] = useState(false);
  const input = {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    padding: 14,
    color: C.ink,
  };
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
  return (
    <Screen>
      <Bar>
        <Heading>{t("appTitle")}</Heading>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("langAria")}
          onPress={() => setLanguage(language === "zh" ? "en" : "zh")}
        >
          <Body>{language === "zh" ? "EN" : "繁中"}</Body>
        </Pressable>
      </Bar>
      <Body>{t("tagline")}</Body>
      {auth.inviter && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Avatar avatar={auth.inviter.avatar} />
          <Body>{t("inviteBanner", auth.inviter.name)}</Body>
        </View>
      )}
      {!isConfigured && <Body>{t("configMissing")}</Body>}
      {mode === "check" && !auth.recovery ? (
        <>
          <Heading>{t("checkEmail")}</Heading>
          <Body>
            {t(checkKind === "reset" ? "checkReset" : "checkVerify", email)}
          </Body>
          <Button title={t("backToSignIn")} onPress={() => setMode("signin")} />
        </>
      ) : (
        <>
          {!auth.recovery && mode !== "forgot" && (
            <>
              <Button
                title={t("google")}
                onPress={() => {
                  setBusy(true);
                  signInGoogle()
                    .catch((e) =>
                      setMessage(
                        e.message === "EXPO_GO_OAUTH_UNSUPPORTED"
                          ? t("oauthNeedsBuild")
                          : e.message,
                      ),
                    )
                    .finally(() => setBusy(false));
                }}
                disabled={busy || !isConfigured}
              />
              <Body>{t("orEmail")}</Body>
              <Bar>
                <Button
                  title={t("signInTab")}
                  onPress={() => setMode("signin")}
                />
                <Button
                  title={t("signUpTab")}
                  onPress={() => setMode("signup")}
                />
              </Bar>
            </>
          )}
          {auth.recovery ? <Heading>{t("newPwH")}</Heading> : null}
          {!auth.recovery && (
            <>
              <Body>{t("emailLabel")}</Body>
              <TextInput
                accessibilityLabel={t("emailLabel")}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                style={input}
              />
            </>
          )}
          {mode !== "forgot" && (
            <>
              <Body>{t("pwLabel")}</Body>
              <TextInput
                accessibilityLabel={t("pwLabel")}
                secureTextEntry={!showPw}
                autoCapitalize="none"
                value={password}
                onChangeText={setPassword}
                style={input}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowPw(!showPw)}
              >
                <Body>{t(showPw ? "hidePw" : "showPw")}</Body>
              </Pressable>
            </>
          )}
          <Button
            disabled={busy || !isConfigured}
            title={t(
              auth.recovery
                ? "newPwBtn"
                : mode === "forgot"
                  ? "sendReset"
                  : mode === "signup"
                    ? "signUpBtn"
                    : "signInBtn",
            )}
            onPress={() => void run()}
          />
          {!auth.recovery && mode === "signin" && (
            <Pressable onPress={() => setMode("forgot")}>
              <Body>{t("forgot")}</Body>
            </Pressable>
          )}
          {mode === "forgot" && (
            <Pressable onPress={() => setMode("signin")}>
              <Body>{t("backToSignIn")}</Body>
            </Pressable>
          )}
        </>
      )}
      {message !== "" && (
        <Text accessibilityRole="alert" style={{ color: C.wax }}>
          {message}
        </Text>
      )}
    </Screen>
  );
}
