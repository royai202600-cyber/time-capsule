import React from "react";
import { Text } from "react-native";
import { useAuth } from "../src/services/auth";
import { useLanguage } from "../src/i18n";
import AuthScreen from "../src/features/auth/AuthScreen";
import ProfileScreen from "../src/features/profile/ProfileScreen";
import HomeScreen from "../src/features/home/HomeScreen";
export default function Index() {
  const a = useAuth(),
    { t } = useLanguage();
  if (a.loading) return <Text>{t("loading")}</Text>;
  if (!a.session || a.recovery) return <AuthScreen />;
  if (!a.profile) return <ProfileScreen />;
  return <HomeScreen />;
}
