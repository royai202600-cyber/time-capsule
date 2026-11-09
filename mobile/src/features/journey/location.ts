import { useEffect, useState } from "react";
import { AppState, Linking, Platform } from "react-native";
import * as Location from "expo-location";
import { distanceMeters } from "../../services/data";

export type Fix = { lat: number; lng: number; accuracy: number; at: number };
export type LocationStatus = "checking" | "explain" | "granted" | "denied" | "unavailable";
type State = { status: LocationStatus; fix: Fix | null; fake: boolean; error: string | null };
let state: State = { status: "checking", fix: null, fake: false, error: null };
const listeners = new Set<() => void>();
let subscription: { remove(): void } | null = null;
let starting: Promise<void> | null = null;
let fixTimer: ReturnType<typeof setTimeout> | null = null;
let generation = 0;
let requesting = false;
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
const WEB_LOCATION_CHOICE = "time-capsule.location-approved.v1";
function browserLocationApproved() {
  try { return typeof localStorage !== "undefined" && localStorage.getItem(WEB_LOCATION_CHOICE) === "1"; }
  catch { return false; }
}
function rememberBrowserLocation(approved: boolean) {
  try {
    if (typeof localStorage === "undefined") return;
    if (approved) localStorage.setItem(WEB_LOCATION_CHOICE, "1");
    else localStorage.removeItem(WEB_LOCATION_CHOICE);
  } catch { /* Storage may be unavailable; the browser still controls permission. */ }
}
// Roy's dedicated test account can explore Taipei shores in production.
// This is a client-side test fix; all Sea RPCs still perform their distance checks.
const TAIPEI_TEST_USER_ID = "1ca3f9b3-c405-4daa-a05a-22cbc3689774";
const TAIPEI_TEST_FIX = { lat: 25.037546, lng: 121.562754 }; // Taipei Civic Square
let testLocationEnabled = false;
export const isTestLocationUser = (userId: string | null) => userId === TAIPEI_TEST_USER_ID;
const publish = (next: Partial<State>) => {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
};
const receive = (position: { coords: { latitude: number; longitude: number; accuracy: number | null }; timestamp: number }) => {
  if (state.fake) return;
  const { latitude, longitude, accuracy } = position.coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
  if (state.fix && position.timestamp < state.fix.at) return;
  if (fixTimer) clearTimeout(fixTimer);
  fixTimer = null;
  publish({ status: "granted", fix: { lat: latitude, lng: longitude, accuracy: accuracy ?? 9999, at: position.timestamp }, error: null });
};
function stop() {
  generation++;
  if (fixTimer) clearTimeout(fixTimer);
  fixTimer = null;
  subscription?.remove();
  subscription = null;
}

// Browser geolocation is used directly: Expo's web permissions query is not
// available in all Safari versions, and its watcher can discard browser events.
function watchWeb() {
  if (subscription) return;
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    publish({ status: "unavailable", fix: null });
    return;
  }
  publish({ status: "granted", error: null });
  const run = generation;
  const id = navigator.geolocation.watchPosition((fix) => { if (run === generation) receive(fix); }, (error) => {
    if (run !== generation) return;
    stop();
    if (error.code === 1) rememberBrowserLocation(false);
    publish({ status: error.code === 1 ? "denied" : "unavailable", fix: null, error: error.message });
  }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 });
  subscription = { remove: () => navigator.geolocation.clearWatch(id) };
  navigator.geolocation.getCurrentPosition?.((fix) => { if (run === generation) receive(fix); }, () => {},
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 15000 });
}

async function watchNative() {
  if (subscription) return;
  if (starting) {
    await starting;
    if (!subscription && state.status === "granted" && listeners.size) return watchNative();
    return;
  }
  const run = generation;
  starting = (async () => {
    try {
      if (!await Location.hasServicesEnabledAsync()) {
        if (run === generation) publish({ status: "unavailable", fix: null });
        return;
      }
      if (run !== generation) return;
      fixTimer = setTimeout(() => {
        if (run === generation && !state.fix) publish({ status: "unavailable", error: "Location timed out" });
      }, 12000);
      // A missing cached fix must not prevent the live watcher from starting.
      void Location.getLastKnownPositionAsync({ maxAge: 60000, requiredAccuracy: 200 })
        .then((fix) => { if (fix && run === generation) receive(fix); }).catch(() => {});
      // A balanced one-shot fix can arrive before a high-accuracy GPS fix.
      void Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        .then((fix) => { if (run === generation) receive(fix); }).catch(() => {});
      const opened = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 2 },
        (fix) => { if (run === generation) receive(fix); },
        (error) => { if (run === generation) publish({ status: "unavailable", fix: null, error }); },
      );
      if (run !== generation || listeners.size === 0) opened.remove();
      else subscription = opened;
    } catch (error) {
      if (run === generation) publish({ status: "unavailable", fix: null, error: String(error) });
    } finally { starting = null; }
  })();
  return starting;
}

/** Reads saved permission; Safari resumes a watch only after a prior in-app choice. */
export async function checkLocation() {
  if (state.fake || requesting) return;
  const run = generation;
  try {
    if (Platform.OS === "web") {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        publish({ status: "unavailable", fix: null });
        return;
      }
      // Safari may not implement the permissions API for geolocation.
      let permission: PermissionState | "unknown" = "unknown";
      try { if (navigator.permissions?.query) permission = (await navigator.permissions.query({ name: "geolocation" })).state; } catch { /* ask on tap */ }
      if (run !== generation || requesting) return;
      if (permission === "granted" || (permission === "unknown" && browserLocationApproved())) watchWeb();
      else if (permission === "denied") { rememberBrowserLocation(false); stop(); publish({ status: "denied", fix: null }); }
      else if (!subscription) publish({ status: "explain", fix: null });
      return;
    }
    const permission = await Location.getForegroundPermissionsAsync();
    if (run !== generation || requesting) return;
    if (permission.granted) { publish({ status: "granted" }); await watchNative(); }
    else { stop(); publish({ status: permission.status === "denied" || !permission.canAskAgain ? "denied" : "explain", fix: null }); }
  } catch (error) {
    if (run === generation) publish({ status: "unavailable", fix: null, error: String(error) });
  }
}

/** Call only after the user taps the explainer card's action. */
export async function requestLocation() {
  generation++;
  stop();
  requesting = true;
  try {
    if (Platform.OS === "web") { rememberBrowserLocation(true); watchWeb(); return; }
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) { stop(); publish({ status: "denied", fix: null }); return; }
    publish({ status: "granted", error: null });
    await watchNative();
  } catch (error) {
    publish({ status: "unavailable", fix: null, error: String(error) });
  } finally { requesting = false; }
}
export const openLocationSettings = () => Platform.OS === "web" ? checkLocation() : Linking.openSettings();
export const currentFix = () => state.fix;
export function openingCoordinates() {
  const fix = state.fix;
  return fix && (state.fake || Date.now() - fix.at <= 60000)
    ? { lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy } : null;
}
export function setFakeLocation(fix: Pick<Fix, "lat" | "lng"> | null) {
  if (!__DEV__ && !testLocationEnabled) return;
  stop();
  publish({ fake: !!fix, fix: fix ? { ...fix, accuracy: 10, at: Date.now() } : null, status: fix ? "granted" : state.status });
  if (!fix) void checkLocation();
}
export function setTestLocationForUser(userId: string | null) {
  const wasEnabled = testLocationEnabled;
  testLocationEnabled = isTestLocationUser(userId);
  if (testLocationEnabled && !wasEnabled) setFakeLocation(TAIPEI_TEST_FIX);
  else if (!testLocationEnabled && wasEnabled) {
    stop();
    publish({ fake: false, fix: null, status: "checking" });
    void checkLocation();
  }
}
export function useForegroundLocation(enabled = true) {
  const [snapshot, setSnapshot] = useState(state);
  useEffect(() => {
    const update = () => setSnapshot(state);
    listeners.add(update);
    if (!appStateSubscription) appStateSubscription = AppState.addEventListener("change", (next) => {
      if (next === "active") void checkLocation();
    });
    if (enabled) void checkLocation();
    return () => {
      listeners.delete(update);
      if (listeners.size === 0) {
        generation++;
        stop();
        appStateSubscription?.remove();
        appStateSubscription = null;
      }
    };
  }, [enabled]);
  return { ...snapshot, request: requestLocation, check: checkLocation, openSettings: openLocationSettings };
}
export function usePlaceDistance(place?: { lat: number; lng: number } | null) {
  const { fix, status } = useForegroundLocation(!!place);
  return { meters: place && fix ? distanceMeters(fix.lat, fix.lng, place.lat, place.lng) : null, accuracy: fix?.accuracy ?? null, status, fix };
}
