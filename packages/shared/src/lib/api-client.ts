import type {
  AdminReportAction,
  AdminStats,
  AdminUserAction,
  ApiResponse,
  BlockUserRequest,
  ChatLogParams,
  ChatMessage,
  ChatRoom,
  ExportLogsRequest,
  GetMessagesParams,
  MatchRequest,
  MatchResponse,
  MatchStatus,
  PaginatedResponse,
  ReportWithDetails,
  RoomListParams,
  SendMessageRequest,
  StatusUpdateRequest,
  UserWithDetails,
} from "./api-types";

// API 기본 설정
export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl = "") {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const defaultHeaders = {
      "Content-Type": "application/json",
    };

    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // 채팅 API 클라이언트
  chat = {
    // 매칭 관련
    findMatch: (data: MatchRequest): Promise<MatchResponse> =>
      this.request("/api/chat/match", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    getMatchStatus: (wallet: string): Promise<MatchStatus> =>
      this.request(`/api/chat/match?wallet=${wallet}`),

    // 메시지 관련
    sendMessage: (data: SendMessageRequest): Promise<ApiResponse> =>
      this.request("/api/chat/messages", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    getMessages: (
      params: GetMessagesParams
    ): Promise<{ messages: ChatMessage[] }> => {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
      return this.request(`/api/chat/messages?${searchParams}`);
    },

    // 차단 관련
    blockUser: (data: BlockUserRequest): Promise<ApiResponse> =>
      this.request("/api/chat/block", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    getBlockedUsers: (wallet: string): Promise<{ blockedUsers: string[] }> =>
      this.request(`/api/chat/block?wallet=${wallet}`),

    unblockUser: (blocker: string, blocked: string): Promise<ApiResponse> =>
      this.request(`/api/chat/block?blocker=${blocker}&blocked=${blocked}`, {
        method: "DELETE",
      }),

    // 상태 관련
    updateStatus: (data: StatusUpdateRequest): Promise<ApiResponse> =>
      this.request("/api/chat/status", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    heartbeat: (walletAddress: string): Promise<ApiResponse> =>
      this.request("/api/chat/status", {
        method: "PUT",
        body: JSON.stringify({ walletAddress }),
      }),

    getOnlineCount: (wallet?: string): Promise<{ onlineCount: number }> => {
      const url = wallet
        ? `/api/chat/status?wallet=${wallet}`
        : "/api/chat/status";
      return this.request(url);
    },

    // 채팅방 관련
    getRooms: (params: RoomListParams): Promise<{ rooms: ChatRoom[] }> => {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
      return this.request(`/api/chat/rooms?${searchParams}`);
    },

    getRoomInfo: (
      roomId: string,
      walletAddress: string
    ): Promise<{ room: ChatRoom }> =>
      this.request("/api/chat/rooms", {
        method: "POST",
        body: JSON.stringify({ roomId, walletAddress }),
      }),

    leaveRoom: (roomId: string, wallet: string): Promise<ApiResponse> =>
      this.request(`/api/chat/rooms?roomId=${roomId}&wallet=${wallet}`, {
        method: "DELETE",
      }),
  };

  // 관리자 API 클라이언트
  admin = {
    // 통계 관련
    getStats: (): Promise<{ stats: AdminStats; timestamp: string }> =>
      this.request("/api/admin/stats"),

    getRealtimeStats: (): Promise<{
      realtime: {
        onlineUsers: number;
        activeChatRooms: number;
        pendingReports: number;
      };
    }> =>
      this.request("/api/admin/stats", {
        method: "POST",
        body: JSON.stringify({ action: "realtime_stats" }),
      }),

    // 사용자 관리
    getUsers: (
      params: {
        page?: number;
        limit?: number;
        status?: string;
        search?: string;
      } = {}
    ): Promise<PaginatedResponse<UserWithDetails>> => {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
      return this.request(`/api/admin/users?${searchParams}`);
    },

    userAction: (data: AdminUserAction): Promise<ApiResponse> =>
      this.request("/api/admin/users", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    // 신고 관리
    getReports: (
      params: {
        page?: number;
        limit?: number;
        status?: string;
        type?: string;
      } = {}
    ): Promise<PaginatedResponse<ReportWithDetails>> => {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
      return this.request(`/api/admin/reports?${searchParams}`);
    },

    reportAction: (data: AdminReportAction): Promise<ApiResponse> =>
      this.request("/api/admin/reports", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    // 채팅 로그
    getChatLogs: (params: ChatLogParams): Promise<any> => {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
      return this.request(`/api/admin/chatlogs?${searchParams}`);
    },

    exportLogs: (data: ExportLogsRequest): Promise<any> =>
      this.request("/api/admin/chatlogs", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  };
}

// 기본 인스턴스
export const apiClient = new ApiClient();

// 편의 함수들
export const chatApi = apiClient.chat;
export const adminApi = apiClient.admin;
