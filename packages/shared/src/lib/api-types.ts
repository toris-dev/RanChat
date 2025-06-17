// API 공통 응답 타입
export interface ApiResponse<T = any> {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 페이지네이션 타입
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// 채팅 관련 타입
export interface ChatMessage {
  message_id: string;
  room_id: string;
  sender_wallet: string;
  content: string;
  created_at: string;
}

export interface ChatRoom {
  room_id: string;
  user1_wallet: string;
  user2_wallet: string;
  is_active: boolean;
  created_at: string;
  ended_at?: string;
}

export interface MatchRequest {
  walletAddress: string;
  action: "find_match" | "cancel_match";
}

export interface MatchResponse {
  status: "match_found" | "waiting" | "already_waiting" | "cancelled";
  roomId?: string;
  partnerId?: string;
  message: string;
}

export interface MatchStatus {
  isWaiting: boolean;
  activeRoom?: {
    roomId: string;
    partnerId: string;
  };
}

export interface SendMessageRequest {
  roomId: string;
  senderWallet: string;
  content: string;
}

export interface GetMessagesParams {
  roomId: string;
  wallet: string;
  limit?: number;
  offset?: number;
}

export interface BlockUserRequest {
  blockerWallet: string;
  blockedWallet: string;
  roomId: string;
}

export interface StatusUpdateRequest {
  walletAddress: string;
  isOnline?: boolean;
}

export interface RoomListParams {
  wallet: string;
  includeInactive?: boolean;
}

// 관리자 관련 타입
export interface AdminStats {
  users: {
    total: number;
    online: number;
    activeLast24h: number;
  };
  chatRooms: {
    total: number;
    active: number;
    createdToday: number;
  };
  messages: {
    total: number;
    sentToday: number;
  };
  reports: {
    total: number;
    pending: number;
  };
  blocks: {
    total: number;
  };
}

export interface UserStats {
  activeChatRooms: number;
  messageCount: number;
  reportedCount: number;
  reporterCount: number;
  blockedCount: number;
  blockedByCount: number;
}

export interface UserWithDetails {
  walletAddress: string;
  isOnline: boolean;
  lastSeen: string;
  createdAt: string;
  stats: UserStats;
  ban: {
    isBanned: boolean;
    bannedUntil?: string;
    reason?: string;
  };
}

export interface AdminUserAction {
  action: "ban_user" | "unban_user" | "force_disconnect" | "get_user_detail";
  walletAddress: string;
  duration?: number;
  reason?: string;
}

export interface ReportWithDetails {
  report_id: string;
  reporter_wallet: string;
  reported_wallet: string;
  reason: string;
  room_id?: string;
  content?: string;
  created_at: string;
  resolved_at?: string;
  resolution?: string;
  admin_notes?: string;
  reporterInfo?: any;
  reportedInfo?: any;
  chatMessages: ChatMessage[];
  previousReportCount: number;
  isPending: boolean;
}

export interface AdminReportAction {
  action: "resolve_report" | "get_report_detail";
  reportId: string;
  resolution?: string;
  adminNotes?: string;
}

export interface ChatLogParams {
  roomId?: string;
  walletAddress?: string;
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}

export interface ExportLogsRequest {
  action: "export_logs";
  roomId?: string;
  walletAddress?: string;
  format?: "json" | "csv";
}
