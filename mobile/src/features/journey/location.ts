import { useEffect, useState } from "react";
import { AppState, Linking } from "react-native";
import * as Location from "expo-location";
import { distanceMeters } from "../../services/data";

export type Fix = { lat: number; lng: number; accuracy: number; at: number };
export type LocationStatus = "checking" | "explain" | "granted" | "denied" | "unavailable";
type State = { status: LocationStatus; fix: Fix | null; fake: boolean; error: string | null };
let state: State = { status: "checking", fix: null, fake: false, error: null };
const listeners = new Set<() => void>();
let subscription: Location.LocationSubscription | null = null;
let starting: Promise<void> | null = null;
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
const publish = (next: Partial<State>) => {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
};
const receive = (position: Location.LocationObject) => {
  if (state.fake) return;
  const { latitude, longitude, accuracy } = position.coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
  publish({
    status: "granted",
    fix: { lat: latitude, lng: longitude, accuracy: accuracy ?? 9999, at: position.timestamp },
    error: null,
  });
};
async function watch() {
  if (subscription || starting) return starting;
  starting = (async () => {
    try {
      const available = await Location.hasServicesEnabledAsync();
      if (!available) return publish({ status: "unavailable", error: null });
      const current = await Location.getLastKnownPositionAsync({ maxAge: 60000, requiredAccuracy: 200 });
      if (current) receive(current);
      const opened = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 3000, distanceInterval: 2 },
        receive,
        (error) => publish({ error }),
      );
      if (listeners.size === 0) opened.remove();
      else subscription = opened;
    } catch (error) {
      publish({ status: "unavailable", error: String(error) });
    } finally {
      starting = null;
    }
  })();
  return starting;
}

/** Checks a prior grant; never triggers the system permission dialog. */
export async function checkLocation() {
  if (__DEV__ && state.fake) return;
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    if (permission.granted) {
      publish({ status: "granted" });
      await watch();
    } else {
      publish({ status: permission.canAskAgain ? "explain" : "denied", fix: null });
    }
  } catch (error) {
    publish({ status: "unavailable", error: String(error) });
  }
}

/** Call only after the user taps the explainer card's action. */
export async function requestLocation() {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      publish({ status: "denied", fix: null });
      return;
    }
    publish({ status: "granted" });
    await watch();
  } catch (error) {
    publish({ status: "unavailable", error: String(error) });
  }
}
export const openLocationSettings = () => Linking.openSettings();
export const currentFix = () => state.fix;
/** F1 can pass this directly to capsules.open(id, lat, lng, accuracy). */
export function openingCoordinates() {
  const fix = state.fix;
  return fix && (state.fake || Date.now() - fix.at <= 60000)
    ? { lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy }
    : null;
}
/** Development only; never expose a fake fix in a store build. */
export function setFakeLocation(fix: Pick<Fix, "lat" | "lng"> | null) {
  if (!__DEV__) return;
  publish({
    fake: !!fix,
    fix: fix ? { ...fix, accuracy: 10, at: Date.now() } : null,
    status: fix ? "granted" : state.status,
  });
  if (!fix) void checkLocation();
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
        subscription?.remove();
        subscription = null;
        appStateSubscription?.remove();
        appStateSubscription = null;
      }
    };
  }, [enabled]);
  return { ...snapshot, request: requestLocation, check: checkLocation, openSettings: openLocationSettings };
}
export function usePlaceDistance(place?: { lat: number; lng: number } | null) {
  const { fix, status } = useForegroundLocation(!!place);
  return {
    meters: place && fix ? distanceMeters(fix.lat, fix.lng, place.lat, place.lng) : null,
    accuracy: fix?.accuracy ?? null,
    status,
    fix,
  };
}
