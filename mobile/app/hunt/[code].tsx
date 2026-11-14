// A private hunt's share link (timecapsule://hunt/ABC123, or /hunt/ABC123 on the web) opens the
// Journey map with the join sheet already looking that code up.
import { Redirect, useLocalSearchParams } from "expo-router";
export default function HuntLink() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  return <Redirect href={{ pathname: "/journey", params: { huntCode: code ?? "" } }} />;
}
