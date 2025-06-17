import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "./database.types";
import { supabaseService } from "./supabase";

// Supabase 클라이언트 설정
const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://placeholder.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

// 메모리 저장소 (프로덕션에서는 Redis 사용 권장)
export const memoryStore = {
  // 매칭 대기열
  waitingQueue: new Set<string>(),

  // 온라인 사용자
  onlineUsers: new Set<string>(),

  // 차단된 사용자 쌍
  blockedPairs: new Set<string>(),

  // 관리자가 차단한 사용자
  bannedUsers: new Map<
    string,
    {
      bannedUntil: string;
      reason: string;
      bannedAt: string;
    }
  >(),

  // 활성 매칭
  activeMatches: new Map<
    string,
    {
      roomId: string;
      partnerId: string;
      createdAt: string;
    }
  >(),
};

// 공통 유틸리티 함수들
export const apiUtils = {
  // 차단 관계 확인
  isBlocked: (user1: string, user2: string): boolean => {
    const pair1 = `${user1}:${user2}`;
    const pair2 = `${user2}:${user1}`;
    return (
      memoryStore.blockedPairs.has(pair1) || memoryStore.blockedPairs.has(pair2)
    );
  },

  // 차단 관계 추가
  addBlockedPair: (blocker: string, blocked: string): void => {
    const pair = `${blocker}:${blocked}`;
    memoryStore.blockedPairs.add(pair);
  },

  // 차단 관계 제거
  removeBlockedPair: (blocker: string, blocked: string): void => {
    const pair = `${blocker}:${blocked}`;
    memoryStore.blockedPairs.delete(pair);
  },

  // 사용자 차단 여부 확인
  isBanned: (walletAddress: string): boolean => {
    const banInfo = memoryStore.bannedUsers.get(walletAddress);
    if (!banInfo) return false;
    return new Date() < new Date(banInfo.bannedUntil);
  },

  // UUID 생성
  generateUUID: (): string => {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  },

  // 응답 형식 표준화
  createResponse: (data: any, status = 200) => {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  },

  // 에러 응답 생성
  createErrorResponse: (error: string, status = 500) => {
    return new Response(JSON.stringify({ error }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  },

  // 페이지네이션 계산
  calculatePagination: (page: number, limit: number, total: number) => {
    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      offset: (page - 1) * limit,
    };
  },

  // 파라미터 검증
  validateRequiredParams: (
    params: Record<string, any>,
    required: string[]
  ): string | null => {
    for (const param of required) {
      if (!params[param]) {
        return `${param} is required`;
      }
    }
    return null;
  },
};

// 채팅 관련 핸들러
export const chatHandlers = {
  // 매칭 로직
  findMatch: async (walletAddress: string) => {
    // 이미 대기 중인지 확인
    if (memoryStore.waitingQueue.has(walletAddress)) {
      return { status: "already_waiting", message: "이미 매칭 대기 중입니다." };
    }

    // 차단된 사용자인지 확인
    if (apiUtils.isBanned(walletAddress)) {
      return { status: "banned", message: "차단된 사용자입니다." };
    }

    // 대기 중인 다른 사용자 찾기
    const availableUsers = Array.from(memoryStore.waitingQueue).filter(
      (user) => !apiUtils.isBlocked(walletAddress, user)
    );

    if (availableUsers.length > 0) {
      const partnerId = availableUsers[0];
      memoryStore.waitingQueue.delete(partnerId);

      // 채팅방 생성
      const roomId = apiUtils.generateUUID();

      try {
        await supabase.from("chat_rooms").insert({
          id: roomId,
          user1_id: partnerId,
          user2_id: walletAddress,
        });

        // 활성 매칭 저장
        memoryStore.activeMatches.set(walletAddress, {
          roomId,
          partnerId,
          createdAt: new Date().toISOString(),
        });
        memoryStore.activeMatches.set(partnerId, {
          roomId,
          partnerId: walletAddress,
          createdAt: new Date().toISOString(),
        });

        return {
          status: "match_found",
          roomId,
          partnerId,
          message: "매칭이 성공했습니다!",
        };
      } catch (error) {
        console.error("Failed to create chat room:", error);
        throw new Error("채팅방 생성에 실패했습니다.");
      }
    } else {
      // 대기열에 추가
      memoryStore.waitingQueue.add(walletAddress);
      return { status: "waiting", message: "매칭 상대를 찾고 있습니다..." };
    }
  },

  // 매칭 취소
  cancelMatch: (walletAddress: string) => {
    memoryStore.waitingQueue.delete(walletAddress);
    return { status: "cancelled", message: "매칭이 취소되었습니다." };
  },

  // 채팅방 권한 확인
  checkRoomAccess: async (
    roomId: string,
    walletAddress: string
  ): Promise<boolean> => {
    try {
      const { data: room } = await supabase
        .from("chat_rooms")
        .select("user1_id, user2_id")
        .eq("id", roomId)
        .single();

      return room
        ? room.user1_id === walletAddress || room.user2_id === walletAddress
        : false;
    } catch {
      return false;
    }
  },

  // 메시지 전송
  sendMessage: async (
    roomId: string,
    senderWallet: string,
    content: string
  ) => {
    const messageId = apiUtils.generateUUID();

    const { error } = await supabase.from("messages").insert({
      id: messageId,
      chat_room_id: roomId,
      sender_id: senderWallet,
      content: content,
      message_type: "text",
      created_at: new Date().toISOString(),
    });

    if (error) {
      throw new Error(`Failed to send message: ${error.message}`);
    }

    return { messageId, success: true };
  },

  // 채팅방 상태 확인
  checkRoomStatus: async (roomId: string, userId: string): Promise<boolean> => {
    try {
      const { data: room, error } = await supabase
        .from("chat_rooms")
        .select("*")
        .eq("id", roomId)
        .single();

      if (error || !room) {
        return false;
      }

      return Boolean(room.user1_id === userId || room.user2_id === userId);
    } catch {
      return false;
    }
  },

  // 메시지 삭제
  deleteMessage: async (messageId: string) => {
    const { error } = await supabase
      .from("messages")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq("id", messageId);

    if (error) {
      throw new Error(`Failed to delete message: ${error.message}`);
    }

    return {
      success: true,
      message: "Message deleted successfully",
    };
  },
};

// 관리자 관련 핸들러
export const adminHandlers = {
  // 사용자 차단
  banUser: (walletAddress: string, durationMinutes: number, reason: string) => {
    const bannedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);

    memoryStore.bannedUsers.set(walletAddress, {
      bannedUntil: bannedUntil.toISOString(),
      reason,
      bannedAt: new Date().toISOString(),
    });

    // 온라인 상태에서 제거
    memoryStore.onlineUsers.delete(walletAddress);
    memoryStore.waitingQueue.delete(walletAddress);

    return {
      success: true,
      message: `사용자 ${walletAddress}가 ${durationMinutes}분간 차단되었습니다.`,
      bannedUntil: bannedUntil.toISOString(),
    };
  },

  // 차단 해제
  unbanUser: (walletAddress: string) => {
    memoryStore.bannedUsers.delete(walletAddress);
    return {
      success: true,
      message: `사용자 ${walletAddress}의 차단이 해제되었습니다.`,
    };
  },

  // 통계 조회
  getStats: async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // 병렬로 모든 통계 조회
    const [
      totalUsersResult,
      onlineUsersResult,
      activeUsersLast24hResult,
      totalChatRoomsResult,
      activeChatRoomsResult,
      todayRoomsResult,
      totalMessagesResult,
      todayMessagesResult,
      totalReportsResult,
      pendingReportsResult,
      totalBlocksResult,
    ] = await Promise.all([
      supabase.from("users").select("*", { count: "exact", head: true }),
      supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("is_online", true),
      supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .gte("last_seen", yesterday.toISOString()),
      supabase.from("chat_rooms").select("*", { count: "exact", head: true }),
      supabase
        .from("chat_rooms")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true),
      supabase
        .from("chat_rooms")
        .select("*", { count: "exact", head: true })
        .gte("created_at", today.toISOString()),
      supabase.from("messages").select("*", { count: "exact", head: true }),
      supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .gte("created_at", today.toISOString()),
      supabase.from("reports").select("*", { count: "exact", head: true }),
      supabase
        .from("reports")
        .select("*", { count: "exact", head: true })
        .is("resolved_at", null),
      supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("is_banned", true),
    ]);

    return {
      users: {
        total: totalUsersResult.count || 0,
        online: onlineUsersResult.count || 0,
        activeLast24h: activeUsersLast24hResult.count || 0,
      },
      chatRooms: {
        total: totalChatRoomsResult.count || 0,
        active: activeChatRoomsResult.count || 0,
        createdToday: todayRoomsResult.count || 0,
      },
      messages: {
        total: totalMessagesResult.count || 0,
        sentToday: todayMessagesResult.count || 0,
      },
      reports: {
        total: totalReportsResult.count || 0,
        pending: pendingReportsResult.count || 0,
      },
      blocks: {
        total: totalBlocksResult.count || 0,
      },
    };
  },
};

export type ApiResponse<T = any> = {
  data?: T;
  error?: string;
  statusCode: number;
};

export type ApiHandler = (req: NextRequest) => Promise<ApiResponse>;

export function createApiHandler(
  handler: (req: NextRequest) => Promise<ApiResponse>
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest) => {
    try {
      const response = await handler(req);
      return NextResponse.json(
        {
          data: response.data,
          error: response.error,
        },
        { status: response.statusCode }
      );
    } catch (error) {
      console.error("API Error:", error);
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Internal server error",
        },
        { status: 500 }
      );
    }
  };
}

export function validateRequiredFields(
  data: Record<string, any>,
  requiredFields: string[]
): ApiResponse | null {
  const missingFields = requiredFields.filter((field) => !data[field]);
  if (missingFields.length > 0) {
    return {
      error: `Missing required fields: ${missingFields.join(", ")}`,
      statusCode: 400,
    };
  }
  return null;
}

export async function validateUser(
  walletAddress: string
): Promise<Database["public"]["Tables"]["users"]["Row"]> {
  const client = supabaseService.getClient();
  const { data: user, error } = await client
    .from("users")
    .select("*")
    .eq("wallet_address", walletAddress)
    .single();

  if (error || !user) {
    throw new Error("User not found");
  }

  if (user.is_banned) {
    throw new Error(
      `User is banned${user.ban_reason ? `: ${user.ban_reason}` : ""}`
    );
  }

  return user;
}

export async function validateChatRoom(
  roomId: string,
  userId: string
): Promise<Database["public"]["Tables"]["chat_rooms"]["Row"]> {
  const client = supabaseService.getClient();
  const { data: room, error } = await client
    .from("chat_rooms")
    .select("*")
    .eq("id", roomId)
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .single();

  if (error || !room) {
    throw new Error("Chat room not found or access denied");
  }

  return room;
}

export function getPaginationParams(req: NextRequest): {
  limit: number;
  offset: number;
} {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const offset = (page - 1) * limit;

  return {
    limit: Math.min(limit, 100), // Cap at 100 items per page
    offset: Math.max(0, offset), // Ensure non-negative offset
  };
}
