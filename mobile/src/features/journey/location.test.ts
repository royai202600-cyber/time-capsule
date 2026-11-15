import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  platform: { OS: "web" }, settings: vi.fn(),
  storage: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() },
  getPermission: vi.fn(), requestPermission: vi.fn(), services: vi.fn(), cached: vi.fn(), current: vi.fn(), watch: vi.fn(),
}));
// Read the location hook's current snapshot without mounting a React tree.
vi.mock("react", () => ({ useEffect: vi.fn(), useState: (value: unknown) => [value] }));
vi.mock("react-native", () => ({ Platform: mocks.platform, Linking: { openSettings: mocks.settings }, AppState: { addEventListener: vi.fn() } }));
vi.mock("expo-location", () => ({
  Accuracy: { Balanced: 3, High: 5 }, getForegroundPermissionsAsync: mocks.getPermission,
  requestForegroundPermissionsAsync: mocks.requestPermission, hasServicesEnabledAsync: mocks.services,
  getLastKnownPositionAsync: mocks.cached, getCurrentPositionAsync: mocks.current, watchPositionAsync: mocks.watch,
}));
vi.mock("../../services/data", () => ({ distanceMeters: vi.fn() }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal("__DEV__", true);
  mocks.platform.OS = "web";
  mocks.storage.getItem.mockReturnValue(null);
  vi.stubGlobal("localStorage", mocks.storage);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function mockBrowserWatch() {
  let nextId = 0;
  const watchPosition = vi.fn((_receive: PositionCallback, _fail: PositionErrorCallback) => nextId++);
  const clearWatch = vi.fn();
  vi.stubGlobal("navigator", {
    geolocation: { watchPosition, clearWatch },
    permissions: { query: vi.fn(async () => ({ state: "granted" })) },
  });
  return { watchPosition, clearWatch };
}

function browserFix(latitude: number) {
  return { coords: { latitude, longitude: 114, accuracy: 20 }, timestamp: Date.now() } as GeolocationPosition;
}

function browserError(code: number) {
  return { code, message: "Location error" } as GeolocationPositionError;
}

describe("foreground location", () => {
  it("restores a known browser grant on startup", async () => {
    const watchPosition = vi.fn(() => 1);
    vi.stubGlobal("navigator", { geolocation: { watchPosition }, permissions: { query: vi.fn(async () => ({ state: "granted" })) } });
    const location = await import("./location");
    await location.checkLocation();
    expect(watchPosition).toHaveBeenCalledOnce();
  });
  it("resumes Safari after a reload when its permissions API is unavailable and the user already opted in", async () => {
    mocks.storage.getItem.mockReturnValue("1");
    const watchPosition = vi.fn(() => 1);
    vi.stubGlobal("navigator", { geolocation: { watchPosition }, permissions: { query: vi.fn(async () => { throw new Error("not supported"); }) } });
    const location = await import("./location");
    await location.checkLocation();
    expect(watchPosition).toHaveBeenCalledOnce();
  });
  it("respects an explicit browser prompt state even after a previous in-app choice", async () => {
    mocks.storage.getItem.mockReturnValue("1");
    const watchPosition = vi.fn(() => 1);
    vi.stubGlobal("navigator", { geolocation: { watchPosition }, permissions: { query: vi.fn(async () => ({ state: "prompt" })) } });
    const location = await import("./location");
    await location.checkLocation();
    expect(watchPosition).not.toHaveBeenCalled();
  });
  it("checks browser permission without calling the native settings API", async () => {
    vi.stubGlobal("navigator", { geolocation: {}, permissions: { query: vi.fn(async () => ({ state: "denied" })) } });
    const location = await import("./location");
    await location.openLocationSettings();
    expect(mocks.settings).not.toHaveBeenCalled();
  });
  it("keeps the native settings action on phones", async () => {
    mocks.platform.OS = "ios";
    const location = await import("./location");
    await location.openLocationSettings();
    expect(mocks.settings).toHaveBeenCalledOnce();
  });
  it("requests a browser watch without requiring the Safari permissions API and receives a fix", async () => {
    let receive!: PositionCallback;
    const watchPosition = vi.fn((success: PositionCallback) => { receive = success; return 7; });
    vi.stubGlobal("navigator", { geolocation: { watchPosition, clearWatch: vi.fn() } });
    const location = await import("./location");
    await location.checkLocation();
    expect(watchPosition).not.toHaveBeenCalled();
    await location.requestLocation();
    expect(mocks.storage.setItem).toHaveBeenCalledWith("time-capsule.location-approved.v1", "1");
    receive({ coords: { latitude: 22, longitude: 114, accuracy: 20 }, timestamp: Date.now() } as GeolocationPosition);
    expect(location.currentFix()).toMatchObject({ lat: 22, lng: 114, accuracy: 20 });
  });

  it("keeps the browser watch running through timeouts before and after a fix", async () => {
    const { watchPosition, clearWatch } = mockBrowserWatch();
    const location = await import("./location");
    await location.requestLocation();
    const [receive, fail] = watchPosition.mock.calls[0];
    fail(browserError(3));
    expect(location.useForegroundLocation()).toMatchObject({ status: "granted", fix: null });

    receive(browserFix(22));
    fail(browserError(3));
    expect(location.useForegroundLocation()).toMatchObject({ status: "granted", fix: { lat: 22 } });
    await location.checkLocation(); // Same permission recheck that runs on tab activation.
    expect(clearWatch).not.toHaveBeenCalled();
    expect(watchPosition).toHaveBeenCalledOnce();
    receive(browserFix(23));
    expect(location.currentFix()?.lat).toBe(23);
  });

  it("restarts once after an unavailable error and keeps the last fix", async () => {
    vi.useFakeTimers();
    const { watchPosition, clearWatch } = mockBrowserWatch();
    const location = await import("./location");
    await location.requestLocation();
    const [receive, fail] = watchPosition.mock.calls[0];
    receive(browserFix(22));
    fail(browserError(2));
    fail(browserError(2)); // A callback queued by the retired watch.
    receive(browserFix(23));
    expect(clearWatch).toHaveBeenCalledExactlyOnceWith(0);
    expect(location.useForegroundLocation()).toMatchObject({ status: "granted", fix: { lat: 22 } });
    vi.advanceTimersByTime(2999);
    expect(watchPosition).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(1);
    expect(watchPosition).toHaveBeenCalledTimes(2);
    watchPosition.mock.calls[1][0](browserFix(24));
    expect(location.currentFix()?.lat).toBe(24);
  });

  it("shows unavailable before the first fix and lets a tab recheck restart the stopped watch", async () => {
    vi.useFakeTimers();
    const { watchPosition } = mockBrowserWatch();
    const location = await import("./location");
    await location.requestLocation();
    watchPosition.mock.calls[0][1](browserError(2));
    expect(location.useForegroundLocation()).toMatchObject({ status: "unavailable", fix: null });
    await Promise.all([location.checkLocation(), location.checkLocation()]);
    vi.advanceTimersByTime(3000);
    expect(watchPosition).toHaveBeenCalledTimes(2);
    watchPosition.mock.calls[1][0](browserFix(22));
    expect(location.useForegroundLocation()).toMatchObject({ status: "granted", fix: { lat: 22 } });
  });

  it("stops the browser watch and clears the fix and saved choice on denial", async () => {
    vi.useFakeTimers();
    const { watchPosition, clearWatch } = mockBrowserWatch();
    const location = await import("./location");
    await location.requestLocation();
    const [receive, fail] = watchPosition.mock.calls[0];
    receive(browserFix(22));
    fail(browserError(1));
    vi.advanceTimersByTime(3000);
    expect(clearWatch).toHaveBeenCalledExactlyOnceWith(0);
    expect(watchPosition).toHaveBeenCalledOnce();
    expect(mocks.storage.removeItem).toHaveBeenCalledWith("time-capsule.location-approved.v1");
    expect(location.useForegroundLocation()).toMatchObject({ status: "denied", fix: null });
  });

  it("clears a previously granted fix if the browser permission is revoked", async () => {
    let receive!: PositionCallback;
    const clearWatch = vi.fn();
    vi.stubGlobal("navigator", {
      geolocation: { watchPosition: (success: PositionCallback) => { receive = success; return 4; }, clearWatch },
      permissions: { query: vi.fn().mockResolvedValue({ state: "denied" }) },
    });
    const location = await import("./location");
    await location.requestLocation();
    receive({ coords: { latitude: 22, longitude: 114, accuracy: 20 }, timestamp: Date.now() } as GeolocationPosition);
    await location.checkLocation();
    expect(clearWatch).toHaveBeenCalledWith(4);
    expect(location.currentFix()).toBeNull();
  });

  it("starts the iOS watch even if the cached lookup fails", async () => {
    mocks.platform.OS = "ios";
    mocks.requestPermission.mockResolvedValue({ granted: true });
    mocks.services.mockResolvedValue(true);
    mocks.cached.mockRejectedValue(new Error("no cache"));
    mocks.current.mockResolvedValue({ coords: { latitude: 22, longitude: 114, accuracy: 80 }, timestamp: Date.now() });
    mocks.watch.mockResolvedValue({ remove: vi.fn() });
    const location = await import("./location");
    await location.requestLocation();
    expect(mocks.watch).toHaveBeenCalledOnce();
    expect(location.currentFix()).toMatchObject({ lat: 22, lng: 114, accuracy: 80 });
  });

  it("limits the production Taipei test fix to Roy's dedicated account", async () => {
    vi.stubGlobal("__DEV__", false);
    vi.stubGlobal("navigator", {});
    const location = await import("./location");
    location.setFakeLocation({ lat: 25, lng: 121 });
    expect(location.currentFix()).toBeNull();
    location.setTestLocationForUser("1ca3f9b3-c405-4daa-a05a-22cbc3689774");
    expect(location.openingCoordinates()).toMatchObject({ lat: 25.037546, lng: 121.562754, accuracy: 10 });
    location.setTestLocationForUser("another-user");
    expect(location.currentFix()).toBeNull();
    location.setFakeLocation({ lat: 25, lng: 121 });
    expect(location.currentFix()).toBeNull();
  });
});
