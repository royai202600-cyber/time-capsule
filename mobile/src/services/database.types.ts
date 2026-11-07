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
          voice_ms: number | null
          voice_path: string | null
        }
        Insert: {
          capsule_id: string
          drawing?: string | null
          message?: string | null
          photo?: string | null
          voice_ms?: number | null
          voice_path?: string | null
        }
        Update: {
          capsule_id?: string
          drawing?: string | null
          message?: string | null
          photo?: string | null
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
          open_at: string
          opened_at: string | null
          opened_distance_m: number | null
          opened_lat: number | null
          opened_lng: number | null
          place: string | null
          recipient: string
          sealed_at: string
          seen_at: string | null
          sender: string
          vessel: string
        }
        Insert: {
          edition_no?: number | null
          gift_code?: string | null
          handwritten?: boolean
          has_voice?: boolean
          hint?: string
          id?: string
          open_at: string
          opened_at?: string | null
          opened_distance_m?: number | null
          opened_lat?: number | null
          opened_lng?: number | null
          place?: string | null
          recipient: string
          sealed_at?: string
          seen_at?: string | null
          sender: string
          vessel: string
        }
        Update: {
          edition_no?: number | null
          gift_code?: string | null
          handwritten?: boolean
          has_voice?: boolean
          hint?: string
          id?: string
          open_at?: string
          opened_at?: string | null
          opened_distance_m?: number | null
          opened_lat?: number | null
          opened_lng?: number | null
          place?: string | null
          recipient?: string
          sealed_at?: string
          seen_at?: string | null
          sender?: string
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
        ]
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
      owned_vessels: {
        Row: {
          acquired_at: string
          edition_no: number | null
          user_id: string
          vessel: string
        }
        Insert: {
          acquired_at?: string
          edition_no?: number | null
          user_id: string
          vessel: string
        }
        Update: {
          acquired_at?: string
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
      vessels: {
        Row: {
          brand: string | null
          edition_total: number | null
          id: string
          price_mop: number
          sort: number
        }
        Insert: {
          brand?: string | null
          edition_total?: number | null
          id: string
          price_mop?: number
          sort?: number
        }
        Update: {
          brand?: string | null
          edition_total?: number | null
          id?: string
          price_mop?: number
          sort?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite: { Args: { p_code: string }; Returns: string }
      acquire_vessel: { Args: { p_vessel: string }; Returns: number }
      distance_m: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      invite_info: {
        Args: { p_code: string }
        Returns: {
          avatar: Json
          name: string
        }[]
      }
      mark_seen: { Args: { p_id: string }; Returns: undefined }
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
          voice_ms: number
          voice_path: string
        }[]
      }
      send_capsule: {
        Args: {
          p_drawing?: string
          p_hint: string
          p_message: string
          p_open_at: string
          p_photo?: string
          p_place?: string
          p_recipient: string
          p_vessel: string
          p_voice?: string
          p_voice_ms?: number
        }
        Returns: string
      }
      vessel_stock: {
        Args: never
        Returns: {
          remaining: number
          vessel: string
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
