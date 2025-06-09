import { initializeSupabase } from "@ranchat/shared";

// 환경변수에서 Supabase 설정 읽기
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "your-supabase-url";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "your-supabase-anon-key";

// Supabase 초기화
initializeSupabase(supabaseUrl, supabaseAnonKey);

// 관리자용 서비스들을 export
export {
  AdminService,
  AuthService,
  ChatService,
  type ChartData,
  type ChatRoom,
  type DashboardStats,
  type Message,
  type Report,
  type User,
} from "@ranchat/shared";
