import "react-native-gesture-handler";
import React from "react";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { NotoSerifTC_400Regular } from "@expo-google-fonts/noto-serif-tc";
import { NotoSansTC_400Regular } from "@expo-google-fonts/noto-sans-tc";
import { LXGWWenKaiTC_400Regular } from "@expo-google-fonts/lxgw-wenkai-tc";
import { VesselSettingsProvider } from "../src/components/Vessel";
import { LanguageProvider } from "../src/i18n";
import { AuthProvider } from "../src/services/auth";
export default function RootLayout() {
  const [loaded] = useFonts({
    NotoSerifTC: NotoSerifTC_400Regular,
    NotoSansTC: NotoSansTC_400Regular,
    LXGWWenKaiTC: LXGWWenKaiTC_400Regular,
  });
  if (!loaded) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LanguageProvider>
        <AuthProvider>
          <VesselSettingsProvider>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen
                name="create/index"
                options={{ presentation: "modal" }}
              />
            </Stack>
          </VesselSettingsProvider>
        </AuthProvider>
      </LanguageProvider>
    </GestureHandlerRootView>
  );
}
