// Export utilities
export * from "./lib/utils";

// Export database types
export * from "./lib/database.types";

// Export Supabase service and initialization
export { initializeSupabase, supabaseService } from "./lib/supabase";

// Export API handlers and types
export {
  apiUtils,
  chatHandlers,
  createApiHandler,
  getPaginationParams,
  memoryStore,
  validateChatRoom,
  validateRequiredFields,
  validateUser,
  type ApiHandler,
  type ApiResponse,
} from "./lib/api-handlers";

// Export API types
export type {
  AdminReportAction,
  AdminStats,
  AdminUserAction,
  ChatLogParams,
  ChatMessage,
  ChatRoom,
  ExportLogsRequest,
  GetMessagesParams,
  MatchRequest,
  MatchResponse,
  MatchStatus,
  ReportWithDetails,
  RoomListParams,
  SendMessageRequest,
  StatusUpdateRequest,
  UserStats,
  UserWithDetails,
} from "./lib/api-types";

// Export domain-specific modules
export * from "./lib/admin";
export * from "./lib/auth";
export * from "./lib/chat";
