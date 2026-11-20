import {beforeEach,afterEach,describe,it,expect,vi} from "vitest";
const mocks=vi.hoisted(()=>({getSession:vi.fn(),rpc:vi.fn()}));
vi.mock("./supabase",()=>({supabase:{auth:{getSession:mocks.getSession},rpc:mocks.rpc}}));
beforeEach(()=>{vi.resetModules();mocks.rpc.mockReset();mocks.getSession.mockResolvedValue({data:{session:null}});vi.stubGlobal("__DEV__",true);vi.useFakeTimers();vi.setSystemTime(new Date("2026-11-09T03:21:00Z"));});
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
describe("development capsule waves",()=>{
 it("uses the server's finite list for signed-in development without adding mock capsules",async()=>{
  mocks.getSession.mockResolvedValue({data:{session:{user:{id:"test"}}}});
  mocks.rpc.mockResolvedValue({error:null,data:{spawns:[{spawn_id:"server-wave",vessel:"bubble-tea",rarity:"common",lat:25,lng:121,expires_at:"2026-11-09T03:30:00Z",attempts_left:3,already_caught:false}],wayposts:[]}});
  const {game}=await import("./game");
  expect((await game.nearby({lat:25,lng:121,accuracy:10})).corrupted.map(c=>c.id)).toEqual(["server-wave"]);
 });
 it("has six in a fresh wave and does not refill after restoration",async()=>{
  const {game}=await import("./game");const at={lat:25.037546,lng:121.562754,accuracy:10};
  const first=await game.nearby(at);expect(first.corrupted).toHaveLength(6);
  const random=vi.spyOn(Math,"random").mockReturnValue(0);
  expect((await game.throwBall({id:first.corrupted[0].id,ball:"gold",ring:1,hit:true})).result).toBe("restored");random.mockRestore();
  const after=await game.nearby(at);expect(after.corrupted).toHaveLength(5);
  expect(after.corrupted.every(c=>first.corrupted.some(p=>p.id===c.id))).toBe(true);
 });
 it("replaces the entire old batch at the next ten-minute boundary",async()=>{
  const {game}=await import("./game");const at={lat:25.037546,lng:121.562754,accuracy:10};
  const first=await game.nearby(at);vi.setSystemTime(new Date("2026-11-09T03:30:00Z"));
  const next=await game.nearby(at);expect(next.corrupted).toHaveLength(6);
  expect(next.corrupted.every(c=>!first.corrupted.some(p=>p.id===c.id))).toBe(true);
  expect(next.corrupted.every(c=>c.expires_at==="2026-11-09T03:40:00.000Z")).toBe(true);
 });
});

describe("DF1 start and finish RPCs", () => {
  const at = { lat: 25, lng: 121, accuracy: 10 };
  const gps = { p_lat: 25, p_lng: 121, p_accuracy: 10 };
  const capsule = { id: "spawn", vessel: "bubble-tea", rarity: "common" as const,
    ...at, expires_at: "2026-11-09T03:30:00Z", attempts_left: 3 };
  const response = { result: "won", vessel: capsule.vessel, wax_balls: 10, gold_balls: 1 };

  it("sends the Corrupted Capsule result and both ball totals once", async () => {
    const { dodgeFights, game, onGameEvent } = await import("./game");
    const event = vi.fn();
    const unsub = onGameEvent(event);
    game.setPosition(at);
    mocks.rpc
      .mockResolvedValueOnce({ error: null, data: [{ fight_id: "fight", health: 3, max_health: 3,
        expires_at: capsule.expires_at, attempts_left: 3 }] })
      .mockResolvedValueOnce({ error: null, data: response });
    const session = await dodgeFights.start({ capsule });
    expect(session).toMatchObject({ id: "fight", health: 3, attemptsLeft: 3 });
    expect(mocks.rpc).toHaveBeenCalledWith("corrupted_fight_start", { p_spawn: "spawn", ...gps });
    expect(await dodgeFights.finish({ capsule }, session, "won", { wax: 1, gold: 1 })).toEqual(response);
    expect(mocks.rpc).toHaveBeenCalledWith("corrupted_fight_finish", {
      p_fight: "fight", p_result: "won", p_wax_used: 1, p_gold_used: 1, ...gps,
    });
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(event).toHaveBeenCalledWith({ kind: "restore", lat: at.lat, lng: at.lng });
    unsub();
  });

  it("allows an explicit retry of the same finish after a transport failure", async () => {
    const { dodgeFights, game } = await import("./game");
    game.setPosition(at);
    const session = { id: "fight", health: 3, maxHealth: 3, expiresAt: Date.parse(capsule.expires_at), attemptsLeft: 3 };
    mocks.rpc
      .mockResolvedValueOnce({ status: 0, data: null, error: { message: "TypeError: Failed to fetch" } })
      .mockResolvedValueOnce({ error: null, data: response });
    const submit = () => dodgeFights.finish({ capsule }, session, "won", { wax: 3, gold: 0 });
    await expect(submit()).rejects.toMatchObject({ code: "network" });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    await expect(submit()).resolves.toEqual(response);
    expect(mocks.rpc.mock.calls[0]).toEqual(mocks.rpc.mock.calls[1]);
  });

  it("reports a Landmark loss and its spend using the original attempt id", async () => {
    const { dodgeFights, game } = await import("./game");
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: "test" } } } });
    mocks.rpc
      .mockResolvedValueOnce({ error: null, data: [{ attempt_id: "attempt", cracks: 20, expires_at: capsule.expires_at }] })
      .mockResolvedValueOnce({ error: null, data: { result: "lost", attempts_left: 0 } });
    game.setPosition(at);
    const landmark = { id: "waypost", kind: "landmark" as const, name_zh: "台北101",
      name_en: "Taipei 101", ...at, cooldown_until: null, place: "taipei101" };
    const target = { capsule, landmark };
    const session = await dodgeFights.start(target);
    expect(session).toMatchObject({ id: "attempt", health: 20, maxHealth: 20 });
    expect(mocks.rpc).toHaveBeenCalledWith("landmark_start", { p_waypost: "waypost", ...gps });
    expect(await dodgeFights.finish(target, session, "lost", { wax: 2, gold: 3 })).toMatchObject({ attempts_left: 0 });
    expect(mocks.rpc).toHaveBeenCalledWith("landmark_finish", {
      p_fight: "attempt", p_result: "lost", p_wax_used: 2, p_gold_used: 3, ...gps,
    });
  });
});
