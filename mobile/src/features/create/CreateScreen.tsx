import React, { useState } from "react";
import { router } from "expo-router";
import { Screen, Heading, Body, Button } from "../../components/Screen";
import { useLanguage } from "../../i18n";
export default function CreateScreen() {
  const { t } = useLanguage();
  const [step, setStep] = useState(1);
  return (
    <Screen>
      <Heading>{t("createTitle")}</Heading>
      <Body>{t("step", step)}</Body>
      <Heading>{t(`s${step}h`)}</Heading>
      <Body>{t("coming", "F2")}</Body>
      {step < 4 && (
        <Button title={t("next")} onPress={() => setStep(step + 1)} />
      )}
      <Button
        title={t("prev")}
        onPress={() => (step > 1 ? setStep(step - 1) : router.back())}
      />
    </Screen>
  );
}
