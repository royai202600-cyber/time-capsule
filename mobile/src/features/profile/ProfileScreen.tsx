import React, { useState } from "react";
import { View, TextInput, Pressable, Text } from "react-native";
import { Screen, Heading, Body, Button } from "../../components/Screen";
import { Avatar, PORTRAITS } from "../../components/Avatar";
import { useLanguage } from "../../i18n";
import { useAuth } from "../../services/auth";
import { profiles } from "../../services/data";
import { C } from "../../theme";
export default function ProfileScreen() {
  const { t } = useLanguage(),
    { session, refresh } = useAuth();
  const [name, setName] = useState(""),
    [city, setCity] = useState(""),
    [pick, setPick] = useState(0),
    [err, setErr] = useState("");
  const save = async () => {
    if (!session || !name.trim()) return;
    const { error } = await profiles.save({
      id: session.user.id,
      name: name.trim(),
      city: city.trim() || null,
      avatar: PORTRAITS[pick],
    });
    if (error) setErr(error.message);
    else await refresh();
  };
  return (
    <Screen>
      <Heading>{t("profileH")}</Heading>
      <Avatar avatar={PORTRAITS[pick]} size={110} />
      <Body>{t("nameLabel")}</Body>
      <TextInput
        accessibilityLabel={t("nameLabel")}
        value={name}
        onChangeText={setName}
        maxLength={40}
        style={{ borderWidth: 1, borderColor: C.line, padding: 12 }}
      />
      <Body>{t("cityLabel")}</Body>
      <TextInput
        accessibilityLabel={t("cityLabel")}
        value={city}
        onChangeText={setCity}
        maxLength={40}
        style={{ borderWidth: 1, borderColor: C.line, padding: 12 }}
      />
      <Body>{t("pickFace")}</Body>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {PORTRAITS.map((p: any, i: number) => (
          <Pressable
            key={i}
            accessibilityRole="radio"
            accessibilityState={{ checked: i === pick }}
            onPress={() => setPick(i)}
          >
            <Avatar avatar={p} />
          </Pressable>
        ))}
      </View>
      <Button title={t("save")} onPress={() => void save()} />
      {!!err && <Text>{err}</Text>}
    </Screen>
  );
}
