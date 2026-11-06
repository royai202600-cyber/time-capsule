import React, { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Avatar } from "../../components/Avatar";
import { Screen, Heading, Button, Bar } from "../../components/Screen";
import { haptics } from "../../components/haptics";
import { useLanguage } from "../../i18n";
import { useAuth } from "../../services/auth";
import { friendships } from "../../services/data";
import { C, sans } from "../../theme";
type Friend = { friend_id: string; profiles: { name: string; city: string | null; avatar: Record<string, unknown> } | null };
export default function FriendsScreen() {
  const { t } = useLanguage();
  const { session } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [error, setError] = useState("");
  useFocusEffect(useCallback(() => {
    if (!session) return;
    let alive = true;
    void friendships.list(session.user.id).then(({ data, error: e }) => {
      if (!alive) return;
      if (e) setError(e.message);
      else setFriends((data ?? []) as unknown as Friend[]);
    });
    return () => { alive = false; };
  }, [session?.user.id]));
  return <Screen>
    <Bar><Heading>{t("friends.title")}</Heading><Button title={t("back")} onPress={() => router.back()} /></Bar>
    <Button title={t("friends.invite")} onPress={() => router.push("/invite")} />
    {!friends.length && !error && <Text style={{ color: C.muted, fontFamily: sans }}>{t("friends.empty")}</Text>}
    {friends.map(f => <View key={f.friend_id} style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Avatar avatar={f.profiles?.avatar} size={54} />
      <View style={{ flex: 1 }}><Text style={{ color: C.ink, fontFamily: sans, fontSize: 17 }}>{f.profiles?.name}</Text>{!!f.profiles?.city && <Text style={{ color: C.muted }}>{f.profiles.city}</Text>}</View>
      <Pressable accessibilityRole="button" onPress={() => { haptics.tap(); router.push({ pathname: "/create", params: { recipient: f.friend_id } }); }} style={{ backgroundColor: C.blue, padding: 10, borderRadius: 10 }}><Text style={{ color: C.white }}>{t("friends.send")}</Text></Pressable>
    </View>)}
    {!!error && <Text style={{ color: C.wax }}>{error}</Text>}
  </Screen>;
}
