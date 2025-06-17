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
  apiUtils,
  chatHandlers as ChatService,
  type AdminReportAction,
  type AdminUserAction,
  type ApiResponse,
  type ChatLogParams,
  type ChatMessage,
  type ChatRoom,
  type AdminStats as DashboardStats,
  type GetMessagesParams,
  type MatchRequest,
  type MatchResponse,
  type MatchStatus,
  type ReportWithDetails as Report,
  type RoomListParams,
  type SendMessageRequest,
  type StatusUpdateRequest,
  type UserWithDetails as User,
  type UserStats,
} from "@ranchat/shared";
