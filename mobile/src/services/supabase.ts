import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
// Postgres accepts NULL arguments, but generated RPC argument types omit that
// nullability. Clearing a prediction stamp is explicitly part of this RPC.
type PublicSchema = Database["public"];
type VerdictRpc = PublicSchema["Functions"]["set_prediction_verdict"];
type ClientDatabase = Omit<Database, "public"> & {
  public: Omit<PublicSchema, "Functions"> & {
    Functions: Omit<PublicSchema["Functions"], "set_prediction_verdict"> & {
      set_prediction_verdict: Omit<VerdictRpc, "Args"> & {
        Args: { p_id: string; p_verdict: boolean | null };
      };
    };
  };
};
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const isConfigured = !!(url && key);
export const supabase = createClient<ClientDatabase>(
  url || "https://invalid.local",
  key || "unconfigured",
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  },
);
