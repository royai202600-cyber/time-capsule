import { supabase } from "./supabase";

/** Enable with the private player backend after both migrations are applied. */
export const HUNT_PRIVATE_BACKEND = false;

export type HuntStatus = "draft" | "published" | "closed";
export type HuntDraft = {
  name: string;
  description: string;
  cover: string | null;
  route_mode: "any" | "ordered";
  leaderboard_visible: boolean;
  starts_at: string;
  ends_at: string;
  time_limit_min: number | null;
};

export type WaypointDraft = {
  id?: string;
  ordinal: number;
  name: string;
  lat: number;
  lng: number;
  mission_type: "arrive" | "spin" | "puzzle";
  points: number;
  description: string;
  image?: string | null;
  arrive_check: "gps" | "gps_qr";
  qr_token?: string;
  puzzle_kind: "text" | "choice";
  choices: string[];
  answer: string;
};

type Waypoint = Omit<WaypointDraft, "id" | "qr_token" | "answer" | "puzzle_kind" | "choices"> & {
  id: string;
  image: string;
  puzzle_kind: WaypointDraft["puzzle_kind"] | null;
  choices: string[] | null;
};

export type OwnedHunt = HuntDraft & {
  id: string;
  status: HuntStatus;
  joined: number;
  join_code: string | null;
  area: { lat: number; lng: number; radius_m: number };
  joined_at: null;
  finished_at: null;
  points: 0;
  waypoints: Waypoint[];
  preview: false;
};

export type HuntEditState = {
  draft: HuntDraft;
  waypoints: (WaypointDraft & { id: string; image: string })[];
  status: HuntStatus;
  code: string | null;
  locked: boolean;
};

export type Review = {
  members: {
    user: string;
    name: string;
    avatar: Record<string, unknown>;
    points: number;
    finished_at: string | null;
    duration_s: number | null;
    you: boolean;
  }[];
  stats: { joined: number; finished: number; per_waypoint: { id: string; done: number }[] };
};

export const huntOrganizerRpc = {
  async create(draft: HuntDraft) {
    return (await supabase.rpc("hunt_create", { p_draft: draft }).throwOnError()).data as { id: string };
  },
  async update(id: string, draft: HuntDraft) {
    await supabase.rpc("hunt_update", { p_hunt: id, p_draft: draft }).throwOnError();
  },
  async saveWaypoint(id: string, waypoint: WaypointDraft) {
    await supabase.rpc("hunt_waypoint_save", { p_hunt: id, p_waypoint: waypoint }).throwOnError();
  },
  async deleteWaypoint(id: string) {
    await supabase.rpc("hunt_waypoint_delete", { p_waypoint: id }).throwOnError();
  },
  async publish(id: string) {
    return (await supabase.rpc("hunt_publish", { p_hunt: id }).throwOnError()).data as { join_code: string };
  },
  async close(id: string) {
    await supabase.rpc("hunt_close", { p_hunt: id }).throwOnError();
  },
  async editState(id: string) {
    return (await supabase.rpc("hunt_edit_state", { p_hunt: id }).throwOnError()).data as unknown as HuntEditState;
  },
  async mine() {
    return (await supabase.rpc("my_hunts").throwOnError()).data as unknown as OwnedHunt[];
  },
  async review(id: string) {
    return (await supabase.rpc("hunt_review", { p_hunt: id }).throwOnError()).data as unknown as Review;
  },
};
