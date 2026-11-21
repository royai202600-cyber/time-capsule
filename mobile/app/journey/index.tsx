import { Redirect, useLocalSearchParams } from "expo-router";

// Journey is the home screen now (docs/design/hunt-first-home.md); old links land there with their parameters.
export default function JourneyLink() {
  const params = useLocalSearchParams<{ huntCode?: string; route?: string }>();
  return <Redirect href={{ pathname: "/", params }} />;
}
