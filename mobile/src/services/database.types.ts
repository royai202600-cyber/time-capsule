export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      capsule_contents: {
        Row: {
          capsule_id: string;
          drawing: string | null;
          message: string | null;
          photo: string | null;
          prediction: string | null;
          voice_ms: number | null;
          voice_path: string | null;
        };
        ComputedFields: never;
        Insert: {
          capsule_id: string;
          drawing?: string | null;
          message?: string | null;
          photo?: string | null;
          prediction?: string | null;
          voice_ms?: number | null;
          voice_path?: string | null;
        };
        Update: {
          capsule_id?: string;
          drawing?: string | null;
          message?: string | null;
          photo?: string | null;
          prediction?: string | null;
          voice_ms?: number | null;
          voice_path?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "capsule_contents_capsule_id_fkey";
            columns: ["capsule_id"];
            isOneToOne: true;
            referencedRelation: "capsules";
            referencedColumns: ["id"];
          },
        ];
      };
      capsules: {
        Row: {
          edition_no: number | null;
          gift_code: string | null;
          handwritten: boolean;
          has_voice: boolean;
          hint: string;
          id: string;
          is_public: boolean;
          kind: string;
          open_at: string;
          opened_at: string | null;
          opened_distance_m: number | null;
          opened_lat: number | null;
          opened_lng: number | null;
          place: string | null;
          place_lat: number | null;
          place_lng: number | null;
          place_name: string | null;
          public_capsule_returns: number;
          public_capsule_spot: string | null;
          recipient: string | null;
          sea: boolean | null;
          sea_returns: number | null;
          sealed_at: string;
          seen_at: string | null;
          sender: string;
          shore: string | null;
          verdict: boolean | null;
          verdict_at: string | null;
          vessel: string;
        };
        ComputedFields: never;
        Insert: {
          edition_no?: number | null;
          gift_code?: string | null;
          handwritten?: boolean;
          has_voice?: boolean;
          hint?: string;
          id?: string;
          is_public?: boolean;
          kind?: string;
          open_at: string;
          opened_at?: string | null;
          opened_distance_m?: number | null;
          opened_lat?: number | null;
          opened_lng?: number | null;
          place?: string | null;
          place_lat?: number | null;
          place_lng?: number | null;
          place_name?: string | null;
          public_capsule_returns?: number;
          public_capsule_spot?: string | null;
          recipient?: string | null;
          sea?: never;
          sea_returns?: never;
          sealed_at?: string;
          seen_at?: string | null;
          sender: string;
          shore?: never;
          verdict?: boolean | null;
          verdict_at?: string | null;
          vessel: string;
        };
        Update: {
          edition_no?: number | null;
          gift_code?: string | null;
          handwritten?: boolean;
          has_voice?: boolean;
          hint?: string;
          id?: string;
          is_public?: boolean;
          kind?: string;
          open_at?: string;
          opened_at?: string | null;
          opened_distance_m?: number | null;
          opened_lat?: number | null;
          opened_lng?: number | null;
          place?: string | null;
          place_lat?: number | null;
          place_lng?: number | null;
          place_name?: string | null;
          public_capsule_returns?: number;
          public_capsule_spot?: string | null;
          recipient?: string | null;
          sea?: never;
          sea_returns?: never;
          sealed_at?: string;
          seen_at?: string | null;
          sender?: string;
          shore?: never;
          verdict?: boolean | null;
          verdict_at?: string | null;
          vessel?: string;
        };
        Relationships: [
          {
            foreignKeyName: "capsules_place_fkey";
            columns: ["place"];
            isOneToOne: false;
            referencedRelation: "places";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "capsules_recipient_fkey";
            columns: ["recipient"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "capsules_sender_fkey";
            columns: ["sender"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "capsules_shore_fkey";
            columns: ["public_capsule_spot"];
            isOneToOne: false;
            referencedRelation: "public_capsule_spots";
            referencedColumns: ["id"];
          },
        ];
      };
      city_hunt_passport_stamps: {
        Row: {
          first_at: string;
          hunt_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          first_at: string;
          hunt_id: string;
          user_id: string;
        };
        Update: {
          first_at?: string;
          hunt_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "hunt_passport_stamps_hunt_id_fkey";
            columns: ["hunt_id"];
            isOneToOne: false;
            referencedRelation: "hunts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "hunt_passport_stamps_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      city_hunt_quest_progress: {
        Row: {
          checked_in_at: string | null;
          finished_at: string | null;
          hunt_id: string;
          joined_at: string;
          landmark_count: number;
          restore_count: number;
          spin_count: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          checked_in_at?: string | null;
          finished_at?: string | null;
          hunt_id: string;
          joined_at?: string;
          landmark_count?: number;
          restore_count?: number;
          spin_count?: number;
          user_id: string;
        };
        Update: {
          checked_in_at?: string | null;
          finished_at?: string | null;
          hunt_id?: string;
          joined_at?: string;
          landmark_count?: number;
          restore_count?: number;
          spin_count?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "hunt_progress_hunt_id_fkey";
            columns: ["hunt_id"];
            isOneToOne: false;
            referencedRelation: "hunts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "hunt_progress_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      city_hunt_quests: {
        Row: {
          goal: number;
          hunt_id: string;
          ordinal: number;
          quest_type: string;
        };
        ComputedFields: never;
        Insert: {
          goal: number;
          hunt_id: string;
          ordinal: number;
          quest_type: string;
        };
        Update: {
          goal?: number;
          hunt_id?: string;
          ordinal?: number;
          quest_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "hunt_steps_hunt_id_fkey";
            columns: ["hunt_id"];
            isOneToOne: false;
            referencedRelation: "hunts";
            referencedColumns: ["id"];
          },
        ];
      };
      city_hunt_runs: {
        Row: {
          day: string;
          duration_s: number;
          finished_at: string;
          hunt_id: string;
          started_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          day: string;
          duration_s: number;
          finished_at: string;
          hunt_id: string;
          started_at: string;
          user_id: string;
        };
        Update: {
          day?: string;
          duration_s?: number;
          finished_at?: string;
          hunt_id?: string;
          started_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "hunt_runs_hunt_id_user_id_fkey";
            columns: ["hunt_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "city_hunt_quest_progress";
            referencedColumns: ["hunt_id", "user_id"];
          },
        ];
      };
      city_hunt_spin_credits: {
        Row: {
          hunt_id: string;
          user_id: string;
          waypost_id: string;
        };
        ComputedFields: never;
        Insert: {
          hunt_id: string;
          user_id: string;
          waypost_id: string;
        };
        Update: {
          hunt_id?: string;
          user_id?: string;
          waypost_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "hunt_spin_credits_hunt_id_user_id_fkey";
            columns: ["hunt_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "city_hunt_quest_progress";
            referencedColumns: ["hunt_id", "user_id"];
          },
          {
            foreignKeyName: "hunt_spin_credits_waypost_id_fkey";
            columns: ["waypost_id"];
            isOneToOne: false;
            referencedRelation: "public_capsule_spots";
            referencedColumns: ["id"];
          },
        ];
      };
      corrupted_catches: {
        Row: {
          attempts: number;
          caught_at: string | null;
          result: string;
          spawn_id: string;
          user_id: string;
          vessel: string;
        };
        ComputedFields: never;
        Insert: {
          attempts?: number;
          caught_at?: string | null;
          result?: string;
          spawn_id: string;
          user_id: string;
          vessel: string;
        };
        Update: {
          attempts?: number;
          caught_at?: string | null;
          result?: string;
          spawn_id?: string;
          user_id?: string;
          vessel?: string;
        };
        Relationships: [
          {
            foreignKeyName: "corrupted_catches_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "corrupted_catches_vessel_fkey";
            columns: ["vessel"];
            isOneToOne: false;
            referencedRelation: "vessels";
            referencedColumns: ["id"];
          },
        ];
      };
      corrupted_spots: {
        Row: {
          city: string;
          habitat: string;
          id: string;
          lat: number;
          lng: number;
          source_ref: string;
          timezone: string;
        };
        ComputedFields: never;
        Insert: {
          city: string;
          habitat: string;
          id?: string;
          lat: number;
          lng: number;
          source_ref: string;
          timezone: string;
        };
        Update: {
          city?: string;
          habitat?: string;
          id?: string;
          lat?: number;
          lng?: number;
          source_ref?: string;
          timezone?: string;
        };
        Relationships: [];
      };
      friendships: {
        Row: {
          created_at: string;
          friend_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          friend_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          friend_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "friendships_friend_id_fkey";
            columns: ["friend_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "friendships_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      hunts: {
        Row: {
          area_lat: number | null;
          area_lng: number | null;
          area_radius_m: number | null;
          city_en: string | null;
          city_zh: string | null;
          cover: string | null;
          description: string;
          ends_at: string;
          first_joined_at: string | null;
          guide_lat: number | null;
          guide_lng: number | null;
          guide_mode: string;
          hidden_at: string | null;
          id: string;
          join_code: string | null;
          keeper_lat: number | null;
          keeper_lng: number | null;
          keeper_spot_en: string | null;
          keeper_spot_zh: string | null;
          kind: string;
          landmark: string | null;
          leaderboard_visible: boolean;
          name_en: string;
          name_zh: string;
          owner: string | null;
          repeat_xp: number;
          reset_timezone: string | null;
          reward_gold: number | null;
          reward_xp: number | null;
          route_mode: string;
          starts_at: string;
          status: string;
          time_limit_min: number | null;
        };
        ComputedFields: never;
        Insert: {
          area_lat?: number | null;
          area_lng?: number | null;
          area_radius_m?: number | null;
          city_en?: string | null;
          city_zh?: string | null;
          cover?: string | null;
          description?: string;
          ends_at: string;
          first_joined_at?: string | null;
          guide_lat?: number | null;
          guide_lng?: number | null;
          guide_mode?: string;
          hidden_at?: string | null;
          id: string;
          join_code?: string | null;
          keeper_lat?: number | null;
          keeper_lng?: number | null;
          keeper_spot_en?: string | null;
          keeper_spot_zh?: string | null;
          kind?: string;
          landmark?: string | null;
          leaderboard_visible?: boolean;
          name_en: string;
          name_zh: string;
          owner?: string | null;
          repeat_xp?: number;
          reset_timezone?: string | null;
          reward_gold?: number | null;
          reward_xp?: number | null;
          route_mode?: string;
          starts_at: string;
          status?: string;
          time_limit_min?: number | null;
        };
        Update: {
          area_lat?: number | null;
          area_lng?: number | null;
          area_radius_m?: number | null;
          city_en?: string | null;
          city_zh?: string | null;
          cover?: string | null;
          description?: string;
          ends_at?: string;
          first_joined_at?: string | null;
          guide_lat?: number | null;
          guide_lng?: number | null;
          guide_mode?: string;
          hidden_at?: string | null;
          id?: string;
          join_code?: string | null;
          keeper_lat?: number | null;
          keeper_lng?: number | null;
          keeper_spot_en?: string | null;
          keeper_spot_zh?: string | null;
          kind?: string;
          landmark?: string | null;
          leaderboard_visible?: boolean;
          name_en?: string;
          name_zh?: string;
          owner?: string | null;
          repeat_xp?: number;
          reset_timezone?: string | null;
          reward_gold?: number | null;
          reward_xp?: number | null;
          route_mode?: string;
          starts_at?: string;
          status?: string;
          time_limit_min?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "hunts_landmark_fkey";
            columns: ["landmark"];
            isOneToOne: false;
            referencedRelation: "public_capsule_spots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "hunts_owner_fkey";
            columns: ["owner"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      invites: {
        Row: {
          code: string;
          created_at: string;
          inviter: string;
        };
        ComputedFields: never;
        Insert: {
          code?: string;
          created_at?: string;
          inviter: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          inviter?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invites_inviter_fkey";
            columns: ["inviter"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      landmark_attempts: {
        Row: {
          cracks_left: number;
          expires_at: string;
          id: string;
          started_at: string;
          user_id: string;
          waypost_id: string;
          won_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          cracks_left: number;
          expires_at: string;
          id?: string;
          started_at?: string;
          user_id: string;
          waypost_id: string;
          won_at?: string | null;
        };
        Update: {
          cracks_left?: number;
          expires_at?: string;
          id?: string;
          started_at?: string;
          user_id?: string;
          waypost_id?: string;
          won_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "landmark_attempts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "landmark_attempts_waypost_id_fkey";
            columns: ["waypost_id"];
            isOneToOne: false;
            referencedRelation: "public_capsule_spots";
            referencedColumns: ["id"];
          },
        ];
      };
      owned_vessels: {
        Row: {
          acquired_at: string;
          copies: number;
          edition_no: number | null;
          user_id: string;
          vessel: string;
        };
        ComputedFields: never;
        Insert: {
          acquired_at?: string;
          copies?: number;
          edition_no?: number | null;
          user_id: string;
          vessel: string;
        };
        Update: {
          acquired_at?: string;
          copies?: number;
          edition_no?: number | null;
          user_id?: string;
          vessel?: string;
        };
        Relationships: [
          {
            foreignKeyName: "owned_vessels_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "owned_vessels_vessel_fkey";
            columns: ["vessel"];
            isOneToOne: false;
            referencedRelation: "vessels";
            referencedColumns: ["id"];
          },
        ];
      };
      passport_stamps: {
        Row: {
          first_at: string;
          how_earned: string;
          place: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          first_at: string;
          how_earned: string;
          place: string;
          user_id: string;
        };
        Update: {
          first_at?: string;
          how_earned?: string;
          place?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "passport_stamps_place_fkey";
            columns: ["place"];
            isOneToOne: false;
            referencedRelation: "places";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "passport_stamps_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      places: {
        Row: {
          brand_vessel: string | null;
          city_en: string;
          city_zh: string;
          id: string;
          lat: number;
          lng: number;
          name_en: string;
          name_zh: string;
          radius_m: number;
          sort: number;
          why_en: string;
          why_zh: string;
        };
        ComputedFields: never;
        Insert: {
          brand_vessel?: string | null;
          city_en: string;
          city_zh: string;
          id: string;
          lat: number;
          lng: number;
          name_en: string;
          name_zh: string;
          radius_m?: number;
          sort?: number;
          why_en?: string;
          why_zh?: string;
        };
        Update: {
          brand_vessel?: string | null;
          city_en?: string;
          city_zh?: string;
          id?: string;
          lat?: number;
          lng?: number;
          name_en?: string;
          name_zh?: string;
          radius_m?: number;
          sort?: number;
          why_en?: string;
          why_zh?: string;
        };
        Relationships: [
          {
            foreignKeyName: "places_brand_vessel_fkey";
            columns: ["brand_vessel"];
            isOneToOne: false;
            referencedRelation: "vessels";
            referencedColumns: ["id"];
          },
        ];
      };
      player_game: {
        Row: {
          gold_balls: number;
          last_lat: number | null;
          last_lng: number | null;
          last_position_at: string | null;
          user_id: string;
          wax_balls: number;
          xp: number;
        };
        ComputedFields: never;
        Insert: {
          gold_balls: number;
          last_lat?: number | null;
          last_lng?: number | null;
          last_position_at?: string | null;
          user_id: string;
          wax_balls: number;
          xp?: number;
        };
        Update: {
          gold_balls?: number;
          last_lat?: number | null;
          last_lng?: number | null;
          last_position_at?: string | null;
          user_id?: string;
          wax_balls?: number;
          xp?: number;
        };
        Relationships: [
          {
            foreignKeyName: "player_game_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      private_hunt_members: {
        Row: {
          finished_at: string | null;
          hunt_id: string;
          joined_at: string;
          points: number;
          reward_collected_at: string | null;
          started_at: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          finished_at?: string | null;
          hunt_id: string;
          joined_at?: string;
          points?: number;
          reward_collected_at?: string | null;
          started_at?: string | null;
          user_id: string;
        };
        Update: {
          finished_at?: string | null;
          hunt_id?: string;
          joined_at?: string;
          points?: number;
          reward_collected_at?: string | null;
          started_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "hunt_members_hunt_id_fkey";
            columns: ["hunt_id"];
            isOneToOne: false;
            referencedRelation: "hunts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "hunt_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      private_hunt_quest_progress: {
        Row: {
          catch_count: number;
          completed_at: string | null;
          hunt_id: string;
          quest_id: string;
          tries: number;
          user_id: string;
          wait_until: string | null;
        };
        ComputedFields: never;
        Insert: {
          catch_count?: number;
          completed_at?: string | null;
          hunt_id: string;
          quest_id: string;
          tries?: number;
          user_id: string;
          wait_until?: string | null;
        };
        Update: {
          catch_count?: number;
          completed_at?: string | null;
          hunt_id?: string;
          quest_id?: string;
          tries?: number;
          user_id?: string;
          wait_until?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "hunt_completions_hunt_id_user_id_fkey";
            columns: ["hunt_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "private_hunt_members";
            referencedColumns: ["hunt_id", "user_id"];
          },
          {
            foreignKeyName: "hunt_completions_hunt_id_waypoint_id_fkey";
            columns: ["hunt_id", "quest_id"];
            isOneToOne: false;
            referencedRelation: "private_hunt_quests";
            referencedColumns: ["hunt_id", "id"];
          },
        ];
      };
      private_hunt_quests: {
        Row: {
          arrive_check: string;
          catch_count: number | null;
          choices: Json | null;
          description: string;
          hunt_id: string;
          id: string;
          image: string;
          location_lat: number | null;
          location_lng: number | null;
          name: string;
          ordinal: number;
          points: number;
          puzzle_kind: string | null;
          quest_type: string;
        };
        ComputedFields: never;
        Insert: {
          arrive_check?: string;
          catch_count?: number | null;
          choices?: Json | null;
          description?: string;
          hunt_id: string;
          id?: string;
          image?: string;
          location_lat?: number | null;
          location_lng?: number | null;
          name: string;
          ordinal: number;
          points: number;
          puzzle_kind?: string | null;
          quest_type: string;
        };
        Update: {
          arrive_check?: string;
          catch_count?: number | null;
          choices?: Json | null;
          description?: string;
          hunt_id?: string;
          id?: string;
          image?: string;
          location_lat?: number | null;
          location_lng?: number | null;
          name?: string;
          ordinal?: number;
          points?: number;
          puzzle_kind?: string | null;
          quest_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "hunt_waypoints_hunt_id_fkey";
            columns: ["hunt_id"];
            isOneToOne: false;
            referencedRelation: "hunts";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar: NonNullable<Json>;
          can_create_hunts: boolean;
          city: string | null;
          created_at: string;
          id: string;
          name: string;
          remind_nearby: boolean;
          remind_open: boolean;
        };
        ComputedFields: never;
        Insert: {
          avatar?: NonNullable<Json>;
          can_create_hunts?: boolean;
          city?: string | null;
          created_at?: string;
          id: string;
          name: string;
          remind_nearby?: boolean;
          remind_open?: boolean;
        };
        Update: {
          avatar?: NonNullable<Json>;
          can_create_hunts?: boolean;
          city?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          remind_nearby?: boolean;
          remind_open?: boolean;
        };
        Relationships: [];
      };
      public_capsule_pickups: {
        Row: {
          capsule_id: string;
          finder: string;
          picked_at: string;
        };
        ComputedFields: never;
        Insert: {
          capsule_id: string;
          finder: string;
          picked_at?: string;
        };
        Update: {
          capsule_id?: string;
          finder?: string;
          picked_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sea_pickups_capsule_id_fkey";
            columns: ["capsule_id"];
            isOneToOne: false;
            referencedRelation: "capsules";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sea_pickups_finder_fkey";
            columns: ["finder"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      public_capsule_reports: {
        Row: {
          capsule_id: string;
          reason: string;
          reported_at: string;
          reporter: string;
        };
        ComputedFields: never;
        Insert: {
          capsule_id: string;
          reason: string;
          reported_at?: string;
          reporter: string;
        };
        Update: {
          capsule_id?: string;
          reason?: string;
          reported_at?: string;
          reporter?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sea_reports_capsule_id_fkey";
            columns: ["capsule_id"];
            isOneToOne: false;
            referencedRelation: "capsules";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sea_reports_reporter_fkey";
            columns: ["reporter"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      public_capsule_spots: {
        Row: {
          city_en: string;
          city_zh: string;
          game_enabled: boolean;
          id: string;
          kind: string;
          lat: number;
          lng: number;
          name_en: string;
          name_zh: string;
          place: string | null;
          scene: string | null;
          source_ref: string | null;
        };
        ComputedFields: never;
        Insert: {
          city_en: string;
          city_zh: string;
          game_enabled?: boolean;
          id?: string;
          kind?: string;
          lat: number;
          lng: number;
          name_en: string;
          name_zh: string;
          place?: string | null;
          scene?: string | null;
          source_ref?: string | null;
        };
        Update: {
          city_en?: string;
          city_zh?: string;
          game_enabled?: boolean;
          id?: string;
          kind?: string;
          lat?: number;
          lng?: number;
          name_en?: string;
          name_zh?: string;
          place?: string | null;
          scene?: string | null;
          source_ref?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sea_shores_place_fkey";
            columns: ["place"];
            isOneToOne: false;
            referencedRelation: "places";
            referencedColumns: ["id"];
          },
        ];
      };
      vessels: {
        Row: {
          brand: string | null;
          earned_place: string | null;
          edition_total: number | null;
          id: string;
          price_mop: number;
          sort: number;
        };
        ComputedFields: never;
        Insert: {
          brand?: string | null;
          earned_place?: string | null;
          edition_total?: number | null;
          id: string;
          price_mop?: number;
          sort?: number;
        };
        Update: {
          brand?: string | null;
          earned_place?: string | null;
          edition_total?: number | null;
          id?: string;
          price_mop?: number;
          sort?: number;
        };
        Relationships: [
          {
            foreignKeyName: "vessels_earned_place_fkey";
            columns: ["earned_place"];
            isOneToOne: false;
            referencedRelation: "places";
            referencedColumns: ["id"];
          },
        ];
      };
      waypost_spins: {
        Row: {
          gold_awarded: number;
          id: string;
          spun_at: string;
          user_id: string;
          wax_awarded: number;
          waypost_id: string;
        };
        ComputedFields: never;
        Insert: {
          gold_awarded: number;
          id?: string;
          spun_at?: string;
          user_id: string;
          wax_awarded: number;
          waypost_id: string;
        };
        Update: {
          gold_awarded?: number;
          id?: string;
          spun_at?: string;
          user_id?: string;
          wax_awarded?: number;
          waypost_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "waypost_spins_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "waypost_spins_waypost_id_fkey";
            columns: ["waypost_id"];
            isOneToOne: false;
            referencedRelation: "public_capsule_spots";
            referencedColumns: ["id"];
          },
        ];
      };
      xp_events: {
        Row: {
          amount: number;
          awarded_at: string;
          reference: string;
          source: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          awarded_at?: string;
          reference: string;
          source: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          awarded_at?: string;
          reference?: string;
          source?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "xp_events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_invite: { Args: { p_code: string }; Returns: string };
      acquire_vessel: { Args: { p_vessel: string }; Returns: number };
      city_hunt_check_in: {
        Args: {
          p_accuracy: number;
          p_hunt: string;
          p_lat: number;
          p_lng: number;
        };
        Returns: Json;
      };
      city_hunt_finish: {
        Args: {
          p_accuracy: number;
          p_hunt: string;
          p_lat: number;
          p_lng: number;
        };
        Returns: Json;
      };
      city_hunt_join: { Args: { p_hunt: string }; Returns: Json };
      city_hunt_list: { Args: { p_lat: number; p_lng: number }; Returns: Json };
      corrupted_capsule_throw: {
        Args: {
          p_accuracy: number;
          p_ball: string;
          p_hit: boolean;
          p_lat: number;
          p_lng: number;
          p_ring: number;
          p_spawn: string;
        };
        Returns: {
          attempts_left: number;
          copies: number;
          gold_balls: number;
          is_new: boolean;
          result: string;
          stars: number;
          vessel: string;
          wax_balls: number;
          xp_gained: number;
        }[];
      };
      corrupted_nearby: {
        Args: { p_accuracy: number; p_lat: number; p_lng: number };
        Returns: Json;
      };
      corrupted_throw: {
        Args: {
          p_accuracy: number;
          p_ball: string;
          p_hit: boolean;
          p_lat: number;
          p_lng: number;
          p_ring: number;
          p_spawn: string;
        };
        Returns: {
          attempts_left: number;
          copies: number;
          gold_balls: number;
          is_new: boolean;
          result: string;
          stars: number;
          vessel: string;
          wax_balls: number;
          xp_gained: number;
        }[];
      };
      distance_m: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number };
        Returns: number;
      };
      game_nearby: {
        Args: { p_accuracy: number; p_lat: number; p_lng: number };
        Returns: Json;
      };
      game_state: {
        Args: Record<PropertyKey, never>;
        Returns: {
          first_catch_bonus_available: boolean;
          gold_balls: number;
          level: number;
          wax_balls: number;
          xp: number;
          xp_to_next: number;
        }[];
      };
      hunt_check_in: {
        Args: {
          p_accuracy: number;
          p_hunt: string;
          p_lat: number;
          p_lng: number;
        };
        Returns: Json;
      };
      hunt_close: { Args: { p_hunt: string }; Returns: undefined };
      hunt_create: { Args: { p_draft: Json }; Returns: Json };
      hunt_edit_state: { Args: { p_hunt: string }; Returns: Json };
      hunt_finish: {
        Args: {
          p_accuracy: number;
          p_hunt: string;
          p_lat: number;
          p_lng: number;
        };
        Returns: Json;
      };
      hunt_join: { Args: { p_hunt: string }; Returns: Json };
      hunt_join_code: { Args: { p_code: string }; Returns: Json };
      hunt_leaderboard: { Args: { p_hunt: string }; Returns: Json };
      hunt_list: { Args: { p_lat: number; p_lng: number }; Returns: Json };
      hunt_mission_complete: {
        Args: {
          p_accuracy: number;
          p_answer: string;
          p_lat: number;
          p_lng: number;
          p_qr: string;
          p_waypoint: string;
        };
        Returns: Json;
      };
      hunt_preview: { Args: { p_code: string }; Returns: Json };
      hunt_private_mine: { Args: Record<PropertyKey, never>; Returns: Json };
      hunt_publish: { Args: { p_hunt: string }; Returns: Json };
      hunt_report: { Args: { p_hunt: string }; Returns: undefined };
      hunt_review: { Args: { p_hunt: string }; Returns: Json };
      hunt_update: {
        Args: { p_draft: Json; p_hunt: string };
        Returns: undefined;
      };
      hunt_waypoint_delete: {
        Args: { p_waypoint: string };
        Returns: undefined;
      };
      hunt_waypoint_save: {
        Args: { p_hunt: string; p_waypoint: Json };
        Returns: undefined;
      };
      invite_info: {
        Args: { p_code: string };
        Returns: {
          avatar: Json;
          name: string;
        }[];
      };
      landmark_hit: {
        Args: {
          p_accuracy: number;
          p_attempt: string;
          p_ball: string;
          p_lat: number;
          p_lng: number;
          p_ring: number;
        };
        Returns: {
          copies: number;
          cracks: number;
          expires_at: string;
          gold_balls: number;
          is_new: boolean;
          result: string;
          stars: number;
          vessel: string;
          wax_balls: number;
          xp_gained: number;
        }[];
      };
      landmark_start: {
        Args: {
          p_accuracy: number;
          p_lat: number;
          p_lng: number;
          p_waypost: string;
        };
        Returns: {
          attempt_id: string;
          cracks: number;
          expires_at: string;
        }[];
      };
      mark_seen: { Args: { p_id: string }; Returns: undefined };
      my_collection: {
        Args: Record<PropertyKey, never>;
        Returns: {
          acquired_at: string;
          copies: number;
          edition_no: number;
          stars: number;
          vessel: string;
        }[];
      };
      my_hunts: { Args: Record<PropertyKey, never>; Returns: Json };
      my_passport: {
        Args: Record<PropertyKey, never>;
        Returns: {
          city_en: string;
          city_zh: string;
          first_at: string;
          how_earned: string;
          name_en: string;
          name_zh: string;
          place: string;
        }[];
      };
      open_capsule: {
        Args: {
          p_accuracy?: number;
          p_id: string;
          p_lat?: number;
          p_lng?: number;
        };
        Returns: {
          drawing: string;
          gift_code: string;
          message: string;
          opened_at: string;
          photo: string;
          prediction: string;
          verdict: boolean;
          voice_ms: number;
          voice_path: string;
        }[];
      };
      prediction_for_sender: {
        Args: { p_id: string };
        Returns: {
          prediction: string;
          verdict: boolean;
          verdict_at: string;
        }[];
      };
      prediction_record: {
        Args: Record<PropertyKey, never>;
        Returns: {
          capsule_id: string;
          opened_at: string;
          other: string;
          prediction: string;
          role: string;
          sealed_at: string;
          verdict: boolean;
        }[];
      };
      private_hunt_close: { Args: { p_hunt: string }; Returns: undefined };
      private_hunt_collect_reward: {
        Args: {
          p_accuracy?: number;
          p_hunt: string;
          p_lat?: number;
          p_lng?: number;
        };
        Returns: Json;
      };
      private_hunt_create: { Args: { p_draft: Json }; Returns: Json };
      private_hunt_edit_state: { Args: { p_hunt: string }; Returns: Json };
      private_hunt_join_code: { Args: { p_code: string }; Returns: Json };
      private_hunt_joined: { Args: Record<PropertyKey, never>; Returns: Json };
      private_hunt_leaderboard: { Args: { p_hunt: string }; Returns: Json };
      private_hunt_organized: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      private_hunt_preview: { Args: { p_code: string }; Returns: Json };
      private_hunt_publish: { Args: { p_hunt: string }; Returns: Json };
      private_hunt_quest_complete: {
        Args: {
          p_accuracy: number;
          p_answer: string;
          p_lat: number;
          p_lng: number;
          p_qr: string;
          p_quest: string;
        };
        Returns: Json;
      };
      private_hunt_quest_delete: {
        Args: { p_quest: string };
        Returns: undefined;
      };
      private_hunt_quest_save: {
        Args: { p_hunt: string; p_quest: Json };
        Returns: undefined;
      };
      private_hunt_report: { Args: { p_hunt: string }; Returns: undefined };
      private_hunt_review: { Args: { p_hunt: string }; Returns: Json };
      private_hunt_start: {
        Args: {
          p_accuracy: number;
          p_hunt: string;
          p_lat: number;
          p_lng: number;
        };
        Returns: Json;
      };
      private_hunt_update: {
        Args: { p_draft: Json; p_hunt: string };
        Returns: undefined;
      };
      public_capsule_drop: {
        Args: {
          p_accuracy: number;
          p_drift_days: number;
          p_hint: string;
          p_lat: number;
          p_lng: number;
          p_message: string;
          p_vessel: string;
        };
        Returns: {
          available_at: string;
          id: string;
          spot_en: string;
          spot_zh: string;
        }[];
      };
      public_capsule_nearby: {
        Args: { p_accuracy: number; p_lat: number; p_lng: number };
        Returns: {
          available_at: string;
          hint: string;
          id: string;
          lat: number;
          lng: number;
          returns: number;
          sealed_at: string;
          sender: Json;
          spot_en: string;
          spot_zh: string;
          vessel: string;
        }[];
      };
      public_capsule_pick_up: {
        Args: {
          p_accuracy: number;
          p_id: string;
          p_lat: number;
          p_lng: number;
        };
        Returns: undefined;
      };
      public_capsule_report: {
        Args: { p_id: string; p_reason: string };
        Returns: undefined;
      };
      public_capsule_return: { Args: { p_id: string }; Returns: undefined };
      sea_nearby: {
        Args: { p_accuracy: number; p_lat: number; p_lng: number };
        Returns: {
          hint: string;
          id: string;
          lat: number;
          lng: number;
          returns: number;
          sealed_at: string;
          sender: Json;
          shore_en: string;
          shore_zh: string;
          vessel: string;
          washed_up_at: string;
        }[];
      };
      sea_pick_up: {
        Args: {
          p_accuracy: number;
          p_id: string;
          p_lat: number;
          p_lng: number;
        };
        Returns: undefined;
      };
      sea_report: {
        Args: { p_id: string; p_reason: string };
        Returns: undefined;
      };
      sea_return: { Args: { p_id: string }; Returns: undefined };
      sea_throw: {
        Args: {
          p_accuracy: number;
          p_drift_days: number;
          p_hint: string;
          p_lat: number;
          p_lng: number;
          p_message: string;
          p_vessel: string;
        };
        Returns: {
          id: string;
          shore_en: string;
          shore_zh: string;
          washes_up_at: string;
        }[];
      };
      send_capsule:
        | {
            Args: {
              p_drawing?: string;
              p_hint: string;
              p_kind?: string;
              p_message: string;
              p_open_at: string;
              p_photo?: string;
              p_place?: string;
              p_prediction?: string;
              p_recipient: string;
              p_vessel: string;
              p_voice?: string;
              p_voice_ms?: number;
            };
            Returns: string;
          }
        | {
            Args: {
              p_drawing?: string;
              p_hint: string;
              p_kind?: string;
              p_message: string;
              p_open_at: string;
              p_photo?: string;
              p_place_lat: number;
              p_place_lng: number;
              p_place_name: string;
              p_prediction?: string;
              p_recipient: string;
              p_vessel: string;
              p_voice?: string;
              p_voice_ms?: number;
            };
            Returns: string;
          };
      set_prediction_verdict: {
        Args: { p_id: string; p_verdict: boolean };
        Returns: undefined;
      };
      vessel_stock: {
        Args: Record<PropertyKey, never>;
        Returns: {
          remaining: number;
          vessel: string;
        }[];
      };
      waypost_spin: {
        Args: {
          p_accuracy: number;
          p_id: string;
          p_lat: number;
          p_lng: number;
        };
        Returns: {
          cooldown_end: string;
          gold_awarded: number;
          gold_balls: number;
          wax_awarded: number;
          wax_balls: number;
          xp_gained: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
