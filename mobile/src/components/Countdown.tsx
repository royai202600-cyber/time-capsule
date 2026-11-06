import React, { useEffect, useState } from "react";
import { Text } from "react-native";
export function Countdown({ until }: { until: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const s = Math.max(0, Math.floor((new Date(until).getTime() - now) / 1000));
  return (
    <Text>
      {Math.floor(s / 86400)} :{" "}
      {String(Math.floor((s % 86400) / 3600)).padStart(2, "0")} :{" "}
      {String(Math.floor((s % 3600) / 60)).padStart(2, "0")} :{" "}
      {String(s % 60).padStart(2, "0")}
    </Text>
  );
}
