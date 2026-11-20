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

describe("DF1 dodge fight RPCs", () => {
  const at = { lat: 25, lng: 121, accuracy: 10 };
  const gps = { p_lat: 25, p_lng: 121, p_accuracy: 10 };
  const capsule = { id: "spawn", vessel: "bubble-tea", rarity: "common" as const, ...at, expires_at: "2026-11-09T03:30:00Z", attempts_left: 3 };

  it("opens a corrupted session, sends just the selected ball, and reports authoritative reward and loss", async () => {
    const { dodgeFights, game, onGameEvent } = await import("./game");
    const { expires_at } = capsule;
    mocks.rpc
      .mockResolvedValueOnce({ error: null, data: [{ fight_id: "fight", health: 2, max_health: 3, expires_at, attempts_left: 3 }] })
      .mockResolvedValueOnce({ error: null, data: [{ result: "restored", health: 0, wax_balls: 10, gold_balls: 1, vessel: capsule.vessel }] })
      .mockResolvedValueOnce({ error: null, data: [{ fight_id: "retry", health: 3, max_health: 3, expires_at, attempts_left: 3 }] })
      .mockResolvedValueOnce({ error: null, data: [{ result: "lost", attempts_left: 2 }] });
    game.setPosition(at);
    const event = vi.fn();
    const unsub = onGameEvent(event);

    const target = { capsule };
    const session = await dodgeFights.start(target);
    expect(session).toEqual({ id: "fight", health: 2, maxHealth: 3, expiresAt: Date.parse(expires_at), attemptsLeft: 3 });
    expect(mocks.rpc).toHaveBeenCalledWith("corrupted_fight_start", { p_spawn: "spawn", ...gps });
    expect(await dodgeFights.hit(target, session, "gold")).toMatchObject({ health: 0, gold_balls: 1, result: "restored" });
    expect(mocks.rpc).toHaveBeenCalledWith("corrupted_fight_throw", { p_fight: "fight", p_ball: "gold", ...gps });
    expect(event).toHaveBeenCalledWith({ kind: "restore", lat: at.lat, lng: at.lng });
    const retry = await dodgeFights.start({ capsule: { ...capsule, id: "another-spawn" } });
    expect(await dodgeFights.loss(target, retry)).toBe(2);
    expect(mocks.rpc).toHaveBeenCalledWith("corrupted_fight_loss", { p_fight: "retry", ...gps });
    unsub();
  });

  it("uses the Landmark attempt, omits the legacy ring, and ends the attempt on loss", async () => {
    const { dodgeFights, game } = await import("./game");
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: "test" } } } });
    mocks.rpc
      .mockResolvedValueOnce({ error: null, data: [{ attempt_id: "attempt", cracks: 20, expires_at: capsule.expires_at }] })
      .mockResolvedValueOnce({ error: null, data: [{ result: "hit", cracks: 18 }] })
      .mockResolvedValueOnce({ error: null, data: [{ result: "lost" }] });
    game.setPosition(at);
    const landmark = { id: "waypost", kind: "landmark" as const, name_zh: "台北101", name_en: "Taipei 101", ...at, cooldown_until: null, place: "taipei101" };
    const target = { capsule, landmark };

    const session = await dodgeFights.start(target);
    expect(session).toMatchObject({ id: "attempt", health: 20, maxHealth: 20 });
    expect(mocks.rpc).toHaveBeenCalledWith("landmark_start", { p_waypost: "waypost", ...gps });
    expect(await dodgeFights.hit(target, session, "gold")).toMatchObject({ health: 18 });
    expect(mocks.rpc).toHaveBeenCalledWith("landmark_hit", { p_attempt: "attempt", p_ball: "gold", ...gps });
    expect(await dodgeFights.loss(target, session)).toBe(0);
    expect(mocks.rpc).toHaveBeenCalledWith("landmark_loss", { p_attempt: "attempt", ...gps });
  });
});
