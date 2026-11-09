import {beforeEach,afterEach,describe,it,expect,vi} from "vitest";
const mocks=vi.hoisted(()=>({getSession:vi.fn(),rpc:vi.fn()}));
vi.mock("./supabase",()=>({supabase:{auth:{getSession:mocks.getSession},rpc:mocks.rpc}}));
beforeEach(()=>{vi.resetModules();mocks.getSession.mockResolvedValue({data:{session:null}});vi.stubGlobal("__DEV__",true);vi.useFakeTimers();vi.setSystemTime(new Date("2026-11-09T03:21:00Z"));});
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
