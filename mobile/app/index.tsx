import React from "react";
import { Text } from "react-native";
import { useAuth } from "../src/services/auth";
import { useLanguage } from "../src/i18n";
import AuthScreen from "../src/features/auth/AuthScreen";
import ProfileScreen from "../src/features/profile/ProfileScreen";
import JourneyScreen from "../src/features/journey/JourneyScreen";
import { Screen, Body, Button } from "../src/components/Screen";
export default function Index() {
  const a = useAuth(),
    { t } = useLanguage();
  if (a.loading) return <Text>{t("loading")}</Text>;
  if (a.error)
    return (
      <Screen>
        <Body>{t("errGeneric")}</Body>
        <Button title={t("retry")} onPress={() => void a.refresh()} />
      </Screen>
    );
  if (!a.session || a.recovery) return <AuthScreen />;
  if (!a.profile) return <ProfileScreen />;
  // The app opens on Today's Hunt; time capsules pop up from the dock (docs/design/hunt-first-home.md).
  return <JourneyScreen />;
}
