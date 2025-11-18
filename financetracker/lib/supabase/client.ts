import Constants from "expo-constants";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  "https://wdfirowqsecwvvsylguj.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkZmlyb3dxc2Vjd3Z2c3lsZ3VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NDMwMDMsImV4cCI6MjA3OTAxOTAwM30.bau4BorDp_rcaalOQ56Ke9VuogOiNjP8w_nTbar4wuw";

let supabaseClient: SupabaseClient | null = null;

export const isSupabaseConfigured = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const getSupabaseClient = () => {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (supabaseClient) {
    return supabaseClient;
  }

  supabaseClient = createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return supabaseClient;
};
