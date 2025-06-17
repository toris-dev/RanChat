import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://placeholder.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 채팅방 나가기
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");
    const walletAddress = searchParams.get("wallet");

    if (!roomId || !walletAddress) {
      return NextResponse.json(
        {
          error: "Room ID and wallet address are required",
        },
        { status: 400 }
      );
    }

    // 채팅방 존재 및 권한 확인
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

    // 사용자가 이 방에 속하는지 확인
    if (
      room.user1_wallet !== walletAddress &&
      room.user2_wallet !== walletAddress
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // 채팅방 비활성화
    const { error: updateError } = await supabase
      .from("chat_rooms")
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq("room_id", roomId);

    if (updateError) {
      console.error("Room deactivation error:", updateError);
      return NextResponse.json(
        { error: "Failed to leave room" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "채팅방을 나갔습니다.",
    });
  } catch (error) {
    console.error("Leave room API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// 사용자의 채팅방 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get("wallet");
    const includeInactive = searchParams.get("includeInactive") === "true";

    if (!walletAddress) {
      return NextResponse.json(
        {
          error: "Wallet address is required",
        },
        { status: 400 }
      );
    }

    let query = supabase
      .from("chat_rooms")
      .select("*")
      .or(`user1_wallet.eq.${walletAddress},user2_wallet.eq.${walletAddress}`)
      .order("created_at", { ascending: false });

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    const { data: rooms, error } = await query;

    if (error) {
      console.error("Get rooms error:", error);
      return NextResponse.json(
        { error: "Failed to get chat rooms" },
        { status: 500 }
      );
    }

    // 각 방의 파트너 정보와 마지막 메시지 추가
    const roomsWithDetails = await Promise.all(
      (rooms || []).map(async (room: any) => {
        const partnerId =
          room.user1_wallet === walletAddress
            ? room.user2_wallet
            : room.user1_wallet;

        // 마지막 메시지 조회
        const { data: lastMessage } = await supabase
          .from("messages")
          .select("content, created_at, sender_wallet")
          .eq("room_id", room.room_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        return {
          roomId: room.room_id,
          partnerId,
          isActive: room.is_active,
          createdAt: room.created_at,
          endedAt: room.ended_at,
          lastMessage: lastMessage
            ? {
                content: lastMessage.content,
                timestamp: lastMessage.created_at,
                isFromMe: lastMessage.sender_wallet === walletAddress,
              }
            : null,
        };
      })
    );

    return NextResponse.json({
      rooms: roomsWithDetails,
    });
  } catch (error) {
    console.error("Get rooms API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// 특정 채팅방 정보 조회
export async function POST(request: NextRequest) {
  try {
    const { roomId, walletAddress } = await request.json();

    if (!roomId || !walletAddress) {
      return NextResponse.json(
        {
          error: "Room ID and wallet address are required",
        },
        { status: 400 }
      );
    }

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

    // 사용자가 이 방에 속하는지 확인
    if (
      room.user1_wallet !== walletAddress &&
      room.user2_wallet !== walletAddress
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const partnerId =
      room.user1_wallet === walletAddress
        ? room.user2_wallet
        : room.user1_wallet;

    // 파트너의 온라인 상태 확인 (users 테이블에서)
    const { data: partnerStatus } = await supabase
      .from("users")
      .select("is_online, last_seen")
      .eq("wallet_address", partnerId)
      .single();

    // 메시지 수 조회
    const { count: messageCount } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("room_id", roomId);

    return NextResponse.json({
      roomInfo: {
        roomId: room.room_id,
        partnerId,
        isActive: room.is_active,
        createdAt: room.created_at,
        endedAt: room.ended_at,
        messageCount: messageCount || 0,
        partnerStatus: {
          isOnline: partnerStatus?.is_online || false,
          lastSeen: partnerStatus?.last_seen || null,
        },
      },
    });
  } catch (error) {
    console.error("Get room info API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
