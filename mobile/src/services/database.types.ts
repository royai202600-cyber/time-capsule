export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      capsule_contents: {
        Row: {
          capsule_id: string
          drawing: string | null
          message: string | null
          photo: string | null
          prediction: string | null
          voice_ms: number | null
          voice_path: string | null
        }
        Insert: {
          capsule_id: string
          drawing?: string | null
          message?: string | null
          photo?: string | null
          prediction?: string | null
          voice_ms?: number | null
          voice_path?: string | null
        }
        Update: {
          capsule_id?: string
          drawing?: string | null
          message?: string | null
          photo?: string | null
          prediction?: string | null
          voice_ms?: number | null
          voice_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "capsule_contents_capsule_id_fkey"
            columns: ["capsule_id"]
            isOneToOne: true
            referencedRelation: "capsules"
            referencedColumns: ["id"]
          },
        ]
      }
      capsules: {
        Row: {
          edition_no: number | null
          gift_code: string | null
          handwritten: boolean
          has_voice: boolean
          hint: string
          id: string
          kind: string
          open_at: string
          opened_at: string | null
          opened_distance_m: number | null
          opened_lat: number | null
          opened_lng: number | null
          place: string | null
          recipient: string | null
          sea: boolean
          sea_returns: number
          sealed_at: string
          seen_at: string | null
          sender: string
          shore: string | null
          verdict: boolean | null
          verdict_at: string | null
          vessel: string
        }
        Insert: {
          edition_no?: number | null
          gift_code?: string | null
          handwritten?: boolean
          has_voice?: boolean
          hint?: string
          id?: string
          kind?: string
          open_at: string
          opened_at?: string | null
          opened_distance_m?: number | null
          opened_lat?: number | null
          opened_lng?: number | null
          place?: string | null
          recipient?: string | null
          sea?: boolean
          sea_returns?: number
          sealed_at?: string
          seen_at?: string | null
          sender: string
          shore?: string | null
          verdict?: boolean | null
          verdict_at?: string | null
          vessel: string
        }
        Update: {
          edition_no?: number | null
          gift_code?: string | null
          handwritten?: boolean
          has_voice?: boolean
          hint?: string
          id?: string
          kind?: string
          open_at?: string
          opened_at?: string | null
          opened_distance_m?: number | null
          opened_lat?: number | null
          opened_lng?: number | null
          place?: string | null
          recipient?: string | null
          sea?: boolean
          sea_returns?: number
          sealed_at?: string
          seen_at?: string | null
          sender?: string
          shore?: string | null
          verdict?: boolean | null
          verdict_at?: string | null
          vessel?: string
        }
        Relationships: [
          {
            foreignKeyName: "capsules_place_fkey"
            columns: ["place"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capsules_recipient_fkey"
            columns: ["recipient"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capsules_sender_fkey"
            columns: ["sender"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capsules_shore_fkey"
            columns: ["shore"]
            isOneToOne: false
            referencedRelation: "sea_shores"
            referencedColumns: ["id"]
          },
        ]
      }
      corrupted_catches: {
        Row: {
          attempts: number
          caught_at: string | null
          result: string
          spawn_id: string
          user_id: string
          vessel: string
        }
        Insert: {
          attempts?: number
          caught_at?: string | null
          result?: string
          spawn_id: string
          user_id: string
          vessel: string
        }
        Update: {
          attempts?: number
          caught_at?: string | null
          result?: string
          spawn_id?: string
          user_id?: string
          vessel?: string
        }
        Relationships: [
          {
            foreignKeyName: "corrupted_catches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrupted_catches_vessel_fkey"
            columns: ["vessel"]
            isOneToOne: false
            referencedRelation: "vessels"
            referencedColumns: ["id"]
          },
        ]
      }
      corrupted_spots: {
        Row: {
          city: string
          habitat: string
          id: string
          lat: number
          lng: number
          source_ref: string
          timezone: string
        }
        Insert: {
          city: string
          habitat: string
          id?: string
          lat: number
          lng: number
          source_ref: string
          timezone: string
        }
        Update: {
          city?: string
          habitat?: string
          id?: string
          lat?: number
          lng?: number
          source_ref?: string
          timezone?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string
          friend_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hunt_passport_stamps: {
        Row: {
          first_at: string
          hunt_id: string
          user_id: string
        }
        Insert: {
          first_at: string
          hunt_id: string
          user_id: string
        }
        Update: {
          first_at?: string
          hunt_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hunt_passport_stamps_hunt_id_fkey"
            columns: ["hunt_id"]
            isOneToOne: false
            referencedRelation: "hunts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hunt_passport_stamps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hunt_progress: {
        Row: {
          checked_in_at: string | null
          finished_at: string | null
          hunt_id: string
          joined_at: string
          landmark_count: number
          restore_count: number
          spin_count: number
          user_id: string
        }
        Insert: {
          checked_in_at?: string | null
          finished_at?: string | null
          hunt_id: string
          joined_at?: string
          landmark_count?: number
          restore_count?: number
          spin_count?: number
          user_id: string
        }
        Update: {
          checked_in_at?: string | null
          finished_at?: string | null
          hunt_id?: string
          joined_at?: string
          landmark_count?: number
          restore_count?: number
          spin_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hunt_progress_hunt_id_fkey"
            columns: ["hunt_id"]
            isOneToOne: false
            referencedRelation: "hunts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hunt_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hunt_spin_credits: {
        Row: {
          hunt_id: string
          user_id: string
          waypost_id: string
        }
        Insert: {
          hunt_id: string
          user_id: string
          waypost_id: string
        }
        Update: {
          hunt_id?: string
          user_id?: string
          waypost_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hunt_spin_credits_hunt_id_user_id_fkey"
            columns: ["hunt_id", "user_id"]
            isOneToOne: false
            referencedRelation: "hunt_progress"
            referencedColumns: ["hunt_id", "user_id"]
          },
          {
            foreignKeyName: "hunt_spin_credits_waypost_id_fkey"
            columns: ["waypost_id"]
            isOneToOne: false
            referencedRelation: "sea_shores"
            referencedColumns: ["id"]
          },
        ]
      }
      hunt_steps: {
        Row: {
          goal: number
          hunt_id: string
          ordinal: number
          step_key: string
        }
        Insert: {
          goal: number
          hunt_id: string
          ordinal: number
          step_key: string
        }
        Update: {
          goal?: number
          hunt_id?: string
          ordinal?: number
          step_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "hunt_steps_hunt_id_fkey"
            columns: ["hunt_id"]
            isOneToOne: false
            referencedRelation: "hunts"
            referencedColumns: ["id"]
          },
        ]
      }
      hunts: {
        Row: {
          area_lat: number
          area_lng: number
          area_radius_m: number
          city_en: string
          city_zh: string
          ends_at: string
          id: string
          keeper_lat: number
          keeper_lng: number
          keeper_spot_en: string
          keeper_spot_zh: string
          landmark: string
          name_en: string
          name_zh: string
          reset_timezone: string | null
          reward_gold: number
          reward_xp: number
          starts_at: string
        }
        Insert: {
          area_lat: number
          area_lng: number
          area_radius_m: number
          city_en: string
          city_zh: string
          ends_at: string
          id: string
          keeper_lat: number
          keeper_lng: number
          keeper_spot_en: string
          keeper_spot_zh: string
          landmark: string
          name_en: string
          name_zh: string
          reset_timezone?: string | null
          reward_gold: number
          reward_xp: number
          starts_at: string
        }
        Update: {
          area_lat?: number
          area_lng?: number
          area_radius_m?: number
          city_en?: string
          city_zh?: string
          ends_at?: string
          id?: string
          keeper_lat?: number
          keeper_lng?: number
          keeper_spot_en?: string
          keeper_spot_zh?: string
          landmark?: string
          name_en?: string
          name_zh?: string
          reset_timezone?: string | null
          reward_gold?: number
          reward_xp?: number
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hunts_landmark_fkey"
            columns: ["landmark"]
            isOneToOne: false
            referencedRelation: "sea_shores"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          code: string
          created_at: string
          inviter: string
        }
        Insert: {
          code?: string
          created_at?: string
          inviter: string
        }
        Update: {
          code?: string
          created_at?: string
          inviter?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_inviter_fkey"
            columns: ["inviter"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      landmark_attempts: {
        Row: {
          cracks_left: number
          expires_at: string
          id: string
          started_at: string
          user_id: string
          waypost_id: string
          won_at: string | null
        }
        Insert: {
          cracks_left: number
          expires_at: string
          id?: string
          started_at?: string
          user_id: string
          waypost_id: string
          won_at?: string | null
        }
        Update: {
          cracks_left?: number
          expires_at?: string
          id?: string
          started_at?: string
          user_id?: string
          waypost_id?: string
          won_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "landmark_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landmark_attempts_waypost_id_fkey"
            columns: ["waypost_id"]
            isOneToOne: false
            referencedRelation: "sea_shores"
            referencedColumns: ["id"]
          },
        ]
      }
      owned_vessels: {
        Row: {
          acquired_at: string
          copies: number
          edition_no: number | null
          user_id: string
          vessel: string
        }
        Insert: {
          acquired_at?: string
          copies?: number
          edition_no?: number | null
          user_id: string
          vessel: string
        }
        Update: {
          acquired_at?: string
          copies?: number
          edition_no?: number | null
          user_id?: string
          vessel?: string
        }
        Relationships: [
          {
            foreignKeyName: "owned_vessels_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owned_vessels_vessel_fkey"
            columns: ["vessel"]
            isOneToOne: false
            referencedRelation: "vessels"
            referencedColumns: ["id"]
          },
        ]
      }
      passport_stamps: {
        Row: {
          first_at: string
          how_earned: string
          place: string
          user_id: string
        }
        Insert: {
          first_at: string
          how_earned: string
          place: string
          user_id: string
        }
        Update: {
          first_at?: string
          how_earned?: string
          place?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "passport_stamps_place_fkey"
            columns: ["place"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passport_stamps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          brand_vessel: string | null
          city_en: string
          city_zh: string
          id: string
          lat: number
          lng: number
          name_en: string
          name_zh: string
          radius_m: number
          sort: number
          why_en: string
          why_zh: string
        }
        Insert: {
          brand_vessel?: string | null
          city_en: string
          city_zh: string
          id: string
          lat: number
          lng: number
          name_en: string
          name_zh: string
          radius_m?: number
          sort?: number
          why_en?: string
          why_zh?: string
        }
        Update: {
          brand_vessel?: string | null
          city_en?: string
          city_zh?: string
          id?: string
          lat?: number
          lng?: number
          name_en?: string
          name_zh?: string
          radius_m?: number
          sort?: number
          why_en?: string
          why_zh?: string
        }
        Relationships: [
          {
            foreignKeyName: "places_brand_vessel_fkey"
            columns: ["brand_vessel"]
            isOneToOne: false
            referencedRelation: "vessels"
            referencedColumns: ["id"]
          },
        ]
      }
      player_game: {
        Row: {
          gold_balls: number
          last_lat: number | null
          last_lng: number | null
          last_position_at: string | null
          user_id: string
          wax_balls: number
          xp: number
        }
        Insert: {
          gold_balls: number
          last_lat?: number | null
          last_lng?: number | null
          last_position_at?: string | null
          user_id: string
          wax_balls: number
          xp?: number
        }
        Update: {
          gold_balls?: number
          last_lat?: number | null
          last_lng?: number | null
          last_position_at?: string | null
          user_id?: string
          wax_balls?: number
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_game_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar: Json
          city: string | null
          created_at: string
          id: string
          name: string
          remind_nearby: boolean
          remind_open: boolean
        }
        Insert: {
          avatar?: Json
          city?: string | null
          created_at?: string
          id: string
          name: string
          remind_nearby?: boolean
          remind_open?: boolean
        }
        Update: {
          avatar?: Json
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          remind_nearby?: boolean
          remind_open?: boolean
        }
        Relationships: []
      }
      sea_pickups: {
        Row: {
          capsule_id: string
          finder: string
          picked_at: string
        }
        Insert: {
          capsule_id: string
          finder: string
          picked_at?: string
        }
        Update: {
          capsule_id?: string
          finder?: string
          picked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sea_pickups_capsule_id_fkey"
            columns: ["capsule_id"]
            isOneToOne: false
            referencedRelation: "capsules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sea_pickups_finder_fkey"
            columns: ["finder"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sea_reports: {
        Row: {
          capsule_id: string
          reason: string
          reported_at: string
          reporter: string
        }
        Insert: {
          capsule_id: string
          reason: string
          reported_at?: string
          reporter: string
        }
        Update: {
          capsule_id?: string
          reason?: string
          reported_at?: string
          reporter?: string
        }
        Relationships: [
          {
            foreignKeyName: "sea_reports_capsule_id_fkey"
            columns: ["capsule_id"]
            isOneToOne: false
            referencedRelation: "capsules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sea_reports_reporter_fkey"
            columns: ["reporter"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sea_shores: {
        Row: {
          city_en: string
          city_zh: string
          game_enabled: boolean
          id: string
          kind: string
          lat: number
          lng: number
          name_en: string
          name_zh: string
          place: string | null
          scene: string | null
          source_ref: string | null
        }
        Insert: {
          city_en: string
          city_zh: string
          game_enabled?: boolean
          id?: string
          kind?: string
          lat: number
          lng: number
          name_en: string
          name_zh: string
          place?: string | null
          scene?: string | null
          source_ref?: string | null
        }
        Update: {
          city_en?: string
          city_zh?: string
          game_enabled?: boolean
          id?: string
          kind?: string
          lat?: number
          lng?: number
          name_en?: string
          name_zh?: string
          place?: string | null
          scene?: string | null
          source_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sea_shores_place_fkey"
            columns: ["place"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      vessels: {
        Row: {
          brand: string | null
          earned_place: string | null
          edition_total: number | null
          id: string
          price_mop: number
          sort: number
        }
        Insert: {
          brand?: string | null
          earned_place?: string | null
          edition_total?: number | null
          id: string
          price_mop?: number
          sort?: number
        }
        Update: {
          brand?: string | null
          earned_place?: string | null
          edition_total?: number | null
          id?: string
          price_mop?: number
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "vessels_earned_place_fkey"
            columns: ["earned_place"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      waypost_spins: {
        Row: {
          gold_awarded: number
          id: string
          spun_at: string
          user_id: string
          wax_awarded: number
          waypost_id: string
        }
        Insert: {
          gold_awarded: number
          id?: string
          spun_at?: string
          user_id: string
          wax_awarded: number
          waypost_id: string
        }
        Update: {
          gold_awarded?: number
          id?: string
          spun_at?: string
          user_id?: string
          wax_awarded?: number
          waypost_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waypost_spins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waypost_spins_waypost_id_fkey"
            columns: ["waypost_id"]
            isOneToOne: false
            referencedRelation: "sea_shores"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_events: {
        Row: {
          amount: number
          awarded_at: string
          reference: string
          source: string
          user_id: string
        }
        Insert: {
          amount: number
          awarded_at?: string
          reference: string
          source: string
          user_id: string
        }
        Update: {
          amount?: number
          awarded_at?: string
          reference?: string
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "xp_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite: { Args: { p_code: string }; Returns: string }
      acquire_vessel: { Args: { p_vessel: string }; Returns: number }
      corrupted_nearby: {
        Args: { p_accuracy: number; p_lat: number; p_lng: number }
        Returns: Json
      }
      corrupted_throw: {
        Args: {
          p_accuracy: number
          p_ball: string
          p_hit: boolean
          p_lat: number
          p_lng: number
          p_ring: number
          p_spawn: string
        }
        Returns: {
          attempts_left: number
          copies: number
          gold_balls: number
          is_new: boolean
          result: string
          stars: number
          vessel: string
          wax_balls: number
          xp_gained: number
        }[]
      }
      distance_m: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      game_state: {
        Args: never
        Returns: {
          first_catch_bonus_available: boolean
          gold_balls: number
          level: number
          wax_balls: number
          xp: number
          xp_to_next: number
        }[]
      }
      hunt_check_in: {
        Args: {
          p_accuracy: number
          p_hunt: string
          p_lat: number
          p_lng: number
        }
        Returns: Json
      }
      hunt_finish: {
        Args: {
          p_accuracy: number
          p_hunt: string
          p_lat: number
          p_lng: number
        }
        Returns: Json
      }
      hunt_join: { Args: { p_hunt: string }; Returns: Json }
      hunt_list: { Args: { p_lat: number; p_lng: number }; Returns: Json }
      invite_info: {
        Args: { p_code: string }
        Returns: {
          avatar: Json
          name: string
        }[]
      }
      landmark_hit: {
        Args: {
          p_accuracy: number
          p_attempt: string
          p_ball: string
          p_lat: number
          p_lng: number
          p_ring: number
        }
        Returns: {
          copies: number
          cracks: number
          expires_at: string
          gold_balls: number
          is_new: boolean
          result: string
          stars: number
          vessel: string
          wax_balls: number
          xp_gained: number
        }[]
      }
      landmark_start: {
        Args: {
          p_accuracy: number
          p_lat: number
          p_lng: number
          p_waypost: string
        }
        Returns: {
          attempt_id: string
          cracks: number
          expires_at: string
        }[]
      }
      mark_seen: { Args: { p_id: string }; Returns: undefined }
      my_collection: {
        Args: never
        Returns: {
          acquired_at: string
          copies: number
          edition_no: number
          stars: number
          vessel: string
        }[]
      }
      my_passport: {
        Args: never
        Returns: {
          city_en: string
          city_zh: string
          first_at: string
          how_earned: string
          name_en: string
          name_zh: string
          place: string
        }[]
      }
      open_capsule: {
        Args: {
          p_accuracy?: number
          p_id: string
          p_lat?: number
          p_lng?: number
        }
        Returns: {
          drawing: string
          gift_code: string
          message: string
          opened_at: string
          photo: string
          prediction: string
          verdict: boolean
          voice_ms: number
          voice_path: string
        }[]
      }
      prediction_for_sender: {
        Args: { p_id: string }
        Returns: {
          prediction: string
          verdict: boolean
          verdict_at: string
        }[]
      }
      prediction_record: {
        Args: never
        Returns: {
          capsule_id: string
          opened_at: string
          other: string
          prediction: string
          role: string
          sealed_at: string
          verdict: boolean
        }[]
      }
      sea_nearby: {
        Args: { p_accuracy: number; p_lat: number; p_lng: number }
        Returns: {
          hint: string
          id: string
          lat: number
          lng: number
          returns: number
          sealed_at: string
          sender: Json
          shore_en: string
          shore_zh: string
          vessel: string
          washed_up_at: string
        }[]
      }
      sea_pick_up: {
        Args: { p_accuracy: number; p_id: string; p_lat: number; p_lng: number }
        Returns: undefined
      }
      sea_pickups_left: { Args: never; Returns: number }
      sea_report: {
        Args: { p_id: string; p_reason: string }
        Returns: undefined
      }
      sea_return: { Args: { p_id: string }; Returns: undefined }
      sea_throw: {
        Args: {
          p_accuracy: number
          p_drift_days: number
          p_hint: string
          p_lat: number
          p_lng: number
          p_message: string
          p_vessel: string
        }
        Returns: {
          id: string
          shore_en: string
          shore_zh: string
          washes_up_at: string
        }[]
      }
      send_capsule: {
        Args: {
          p_drawing?: string
          p_hint: string
          p_kind?: string
          p_message: string
          p_open_at: string
          p_photo?: string
          p_place?: string
          p_prediction?: string
          p_recipient: string
          p_vessel: string
          p_voice?: string
          p_voice_ms?: number
        }
        Returns: string
      }
      set_prediction_verdict: {
        Args: { p_id: string; p_verdict: boolean }
        Returns: undefined
      }
      vessel_stock: {
        Args: never
        Returns: {
          remaining: number
          vessel: string
        }[]
      }
      waypost_spin: {
        Args: { p_accuracy: number; p_id: string; p_lat: number; p_lng: number }
        Returns: {
          cooldown_end: string
          gold_awarded: number
          gold_balls: number
          wax_awarded: number
          wax_balls: number
          xp_gained: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
