import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://placeholder.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 채팅 로그 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");
    const walletAddress = searchParams.get("wallet");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const offset = (page - 1) * limit;

    if (roomId) {
      // 특정 채팅방의 메시지 조회
      return await getChatRoomLogs(roomId, page, limit);
    } else if (walletAddress) {
      // 특정 사용자의 메시지 조회
      return await getUserChatLogs(
        walletAddress,
        page,
        limit,
        startDate,
        endDate
      );
    } else {
      // 전체 채팅방 목록 조회
      return await getAllChatRooms(page, limit, startDate, endDate);
    }
  } catch (error) {
    console.error("Admin chat logs API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function getChatRoomLogs(roomId: string, page: number, limit: number) {
  try {
    const offset = (page - 1) * limit;

    // 채팅방 정보 조회
    const { data: room, error: roomError } = await supabase
      .from("chat_rooms")
      .select("*")
      .eq("room_id", roomId)
      .single();

    if (roomError || !room) {
      return NextResponse.json(
        { error: "Chat room not found" },
        { status: 404 }
      );
    }

    // 메시지 조회
    const {
      data: messages,
      error: messagesError,
      count,
    } = await supabase
      .from("messages")
      .select("*", { count: "exact" })
      .eq("room_id", roomId)
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);

    if (messagesError) {
      console.error("Get messages error:", messagesError);
      return NextResponse.json(
        { error: "Failed to get messages" },
        { status: 500 }
      );
    }

    // 참가자 정보 조회
    const { data: user1Info } = await supabase
      .from("users")
      .select("wallet_address, is_online, last_seen")
      .eq("wallet_address", room.user1_wallet)
      .single();

    const { data: user2Info } = await supabase
      .from("users")
      .select("wallet_address, is_online, last_seen")
      .eq("wallet_address", room.user2_wallet)
      .single();

    return NextResponse.json({
      room: {
        ...room,
        participants: [user1Info, user2Info].filter(Boolean),
      },
      messages: messages || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Get chat room logs error:", error);
    return NextResponse.json(
      { error: "Failed to get chat room logs" },
      { status: 500 }
    );
  }
}

async function getUserChatLogs(
  walletAddress: string,
  page: number,
  limit: number,
  startDate?: string | null,
  endDate?: string | null
) {
  try {
    const offset = (page - 1) * limit;

    // 사용자 정보 확인
    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("wallet_address", walletAddress)
      .single();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let query = supabase
      .from("messages")
      .select("*, chat_rooms!inner(*)", { count: "exact" })
      .eq("sender_wallet", walletAddress)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // 날짜 필터링
    if (startDate) {
      query = query.gte("created_at", startDate);
    }
    if (endDate) {
      query = query.lte("created_at", endDate);
    }

    const { data: messages, error, count } = await query;

    if (error) {
      console.error("Get user messages error:", error);
      return NextResponse.json(
        { error: "Failed to get user messages" },
        { status: 500 }
      );
    }

    // 사용자의 채팅방 목록도 함께 조회
    const { data: userRooms } = await supabase
      .from("chat_rooms")
      .select("*")
      .or(`user1_wallet.eq.${walletAddress},user2_wallet.eq.${walletAddress}`)
      .order("created_at", { ascending: false })
      .limit(10);

    return NextResponse.json({
      user,
      messages: messages || [],
      userRooms: userRooms || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Get user chat logs error:", error);
    return NextResponse.json(
      { error: "Failed to get user chat logs" },
      { status: 500 }
    );
  }
}

async function getAllChatRooms(
  page: number,
  limit: number,
  startDate?: string | null,
  endDate?: string | null
) {
  try {
    const offset = (page - 1) * limit;

    let query = supabase
      .from("chat_rooms")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // 날짜 필터링
    if (startDate) {
      query = query.gte("created_at", startDate);
    }
    if (endDate) {
      query = query.lte("created_at", endDate);
    }

    const { data: rooms, error, count } = await query;

    if (error) {
      console.error("Get all rooms error:", error);
      return NextResponse.json(
        { error: "Failed to get chat rooms" },
        { status: 500 }
      );
    }

    // 각 채팅방의 추가 정보 조회
    const roomsWithDetails = await Promise.all(
      (rooms || []).map(async (room: any) => {
        // 메시지 수 조회
        const { count: messageCount } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("room_id", room.room_id);

        // 마지막 메시지 조회
        const { data: lastMessage } = await supabase
          .from("messages")
          .select("content, created_at, sender_wallet")
          .eq("room_id", room.room_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        // 참가자 온라인 상태 조회
        const { data: user1Status } = await supabase
          .from("users")
          .select("is_online, last_seen")
          .eq("wallet_address", room.user1_wallet)
          .single();

        const { data: user2Status } = await supabase
          .from("users")
          .select("is_online, last_seen")
          .eq("wallet_address", room.user2_wallet)
          .single();

        // 신고 수 조회
        const { count: reportCount } = await supabase
          .from("reports")
          .select("*", { count: "exact", head: true })
          .eq("room_id", room.room_id);

        return {
          ...room,
          messageCount: messageCount || 0,
          lastMessage: lastMessage || null,
          reportCount: reportCount || 0,
          participants: {
            user1: {
              wallet: room.user1_wallet,
              ...user1Status,
            },
            user2: {
              wallet: room.user2_wallet,
              ...user2Status,
            },
          },
        };
      })
    );

    return NextResponse.json({
      rooms: roomsWithDetails,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Get all chat rooms error:", error);
    return NextResponse.json(
      { error: "Failed to get all chat rooms" },
      { status: 500 }
    );
  }
}

// 채팅 로그 내보내기
export async function POST(request: NextRequest) {
  try {
    const { action, roomId, walletAddress, format } = await request.json();

    if (action === "export_logs") {
      if (roomId) {
        return await exportRoomLogs(roomId, format);
      } else if (walletAddress) {
        return await exportUserLogs(walletAddress, format);
      } else {
        return NextResponse.json(
          { error: "Room ID or wallet address is required for export" },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Export logs API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function exportRoomLogs(roomId: string, format: string = "json") {
  try {
    // 채팅방 정보와 모든 메시지 조회
    const { data: room } = await supabase
      .from("chat_rooms")
      .select("*")
      .eq("room_id", roomId)
      .single();

    if (!room) {
      return NextResponse.json(
        { error: "Chat room not found" },
        { status: 404 }
      );
    }

    const { data: messages } = await supabase
      .from("messages")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true });

    const exportData = {
      room,
      messages: messages || [],
      exportedAt: new Date().toISOString(),
    };

    if (format === "csv") {
      // CSV 형태로 변환
      const csvContent = convertToCsv(messages || []);
      return new Response(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="chatroom_${roomId}_${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json(exportData);
  } catch (error) {
    console.error("Export room logs error:", error);
    return NextResponse.json(
      { error: "Failed to export room logs" },
      { status: 500 }
    );
  }
}

async function exportUserLogs(walletAddress: string, format: string = "json") {
  try {
    // 사용자의 모든 메시지와 채팅방 조회
    const { data: messages } = await supabase
      .from("messages")
      .select("*, chat_rooms!inner(*)")
      .eq("sender_wallet", walletAddress)
      .order("created_at", { ascending: true });

    const exportData = {
      walletAddress,
      messages: messages || [],
      exportedAt: new Date().toISOString(),
    };

    if (format === "csv") {
      const csvContent = convertToCsv(messages || []);
      return new Response(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="user_${walletAddress}_${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json(exportData);
  } catch (error) {
    console.error("Export user logs error:", error);
    return NextResponse.json(
      { error: "Failed to export user logs" },
      { status: 500 }
    );
  }
}

function convertToCsv(messages: any[]): string {
  if (messages.length === 0) return "No messages found";

  const headers = ["timestamp", "sender", "content", "room_id"];
  const csvRows = [headers.join(",")];

  messages.forEach((message) => {
    const row = [
      message.created_at,
      message.sender_wallet,
      `"${message.content.replace(/"/g, '""')}"`, // CSV 이스케이프
      message.room_id,
    ];
    csvRows.push(row.join(","));
  });

  return csvRows.join("\n");
}
