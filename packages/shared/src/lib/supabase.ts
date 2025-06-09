import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// 환경변수는 각 앱에서 주입받도록 함
let supabaseUrl: string | undefined;
let supabaseAnonKey: string | undefined;

export function initializeSupabase(url: string, key: string) {
  supabaseUrl = url;
  supabaseAnonKey = key;
}

export function getSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase is not initialized. Call initializeSupabase() first."
    );
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey);
}

// 싱글톤 클라이언트 인스턴스
let supabaseInstance: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabase() {
  if (!supabaseInstance) {
    supabaseInstance = getSupabaseClient();
  }
  return supabaseInstance;
}
