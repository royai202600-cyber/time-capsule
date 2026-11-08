import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  platform: { OS: "web" },
  getPermission: vi.fn(), requestPermission: vi.fn(), services: vi.fn(), cached: vi.fn(), current: vi.fn(), watch: vi.fn(),
}));
vi.mock("react-native", () => ({ Platform: mocks.platform, Linking: { openSettings: vi.fn() }, AppState: { addEventListener: vi.fn() } }));
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
});

describe("foreground location", () => {
  it("requests a browser watch without requiring the Safari permissions API and receives a fix", async () => {
    let receive!: PositionCallback;
    const watchPosition = vi.fn((success: PositionCallback) => { receive = success; return 7; });
    vi.stubGlobal("navigator", { geolocation: { watchPosition, clearWatch: vi.fn() } });
    const location = await import("./location");
    await location.checkLocation();
    expect(watchPosition).not.toHaveBeenCalled();
    await location.requestLocation();
    receive({ coords: { latitude: 22, longitude: 114, accuracy: 20 }, timestamp: Date.now() } as GeolocationPosition);
    expect(location.currentFix()).toMatchObject({ lat: 22, lng: 114, accuracy: 20 });
  });

  it("clears a denied browser watch and discards its old fix", async () => {
    let fail!: PositionErrorCallback;
    const clearWatch = vi.fn();
    vi.stubGlobal("navigator", { geolocation: { watchPosition: (_: PositionCallback, error: PositionErrorCallback) => { fail = error; return 8; }, clearWatch } });
    const location = await import("./location");
    await location.requestLocation();
    fail({ code: 1, message: "denied" } as GeolocationPositionError);
    expect(clearWatch).toHaveBeenCalledWith(8);
    expect(location.currentFix()).toBeNull();
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
