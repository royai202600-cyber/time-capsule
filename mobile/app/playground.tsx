import React from "react";
import { Redirect } from "expo-router";
import Playground from "../src/SkiaGate";
export default function Route() {
  return __DEV__ ? <Playground /> : <Redirect href="/" />;
}
