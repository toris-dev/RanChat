import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://placeholder.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 임시 메모리 저장소 (실제로는 Redis나 데이터베이스 사용 권장)
const waitingUsers = new Set<string>();
const activeMatches = new Map<
  string,
  { user1: string; user2: string; roomId: string; createdAt: number }
>();

export async function POST(request: NextRequest) {
  try {
    const { walletAddress, action } = await request.json();

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Wallet address is required" },
        { status: 400 }
      );
    }

    switch (action) {
      case "find_match":
        return await findMatch(walletAddress);

      case "cancel_match":
        return await cancelMatch(walletAddress);

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Match API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function findMatch(walletAddress: string) {
  try {
    // 이미 대기 중인지 확인
    if (waitingUsers.has(walletAddress)) {
      return NextResponse.json({
        status: "already_waiting",
        message: "이미 매칭 대기 중입니다.",
      });
    }

    // 차단된 사용자들 조회
    const { data: blockedUsers } = await supabase
      .from("blocked_users")
      .select("blocked_wallet")
      .eq("blocker_wallet", walletAddress);

    const blockedWallets =
      blockedUsers?.map((b: any) => b.blocked_wallet) || [];

    // 대기 중인 다른 사용자 찾기
    for (const waitingUser of waitingUsers) {
      if (
        waitingUser !== walletAddress &&
        !blockedWallets.includes(waitingUser)
      ) {
        // 매칭 성공
        const roomId = uuidv4();

        // 대기열에서 제거
        waitingUsers.delete(waitingUser);

        // 매칭 정보 저장
        const match = {
          user1: walletAddress,
          user2: waitingUser,
          roomId,
          createdAt: Date.now(),
        };

        activeMatches.set(roomId, match);

        // 데이터베이스에 채팅방 저장
        await supabase.from("chat_rooms").insert({
          room_id: roomId,
          user1_wallet: walletAddress,
          user2_wallet: waitingUser,
          created_at: new Date().toISOString(),
        });

        return NextResponse.json({
          status: "match_found",
          roomId,
          partnerId: waitingUser,
        });
      }
    }

    // 매칭 상대가 없으면 대기열에 추가
    waitingUsers.add(walletAddress);

    return NextResponse.json({
      status: "waiting",
      message: "매칭 상대를 찾고 있습니다...",
    });
  } catch (error) {
    console.error("Find match error:", error);
    return NextResponse.json(
      { error: "Failed to find match" },
      { status: 500 }
    );
  }
}

async function cancelMatch(walletAddress: string) {
  try {
    waitingUsers.delete(walletAddress);

    return NextResponse.json({
      status: "cancelled",
      message: "매칭이 취소되었습니다.",
    });
  } catch (error) {
    console.error("Cancel match error:", error);
    return NextResponse.json(
      { error: "Failed to cancel match" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get("wallet");

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Wallet address is required" },
        { status: 400 }
      );
    }

    // 사용자의 현재 매칭 상태 확인
    const isWaiting = waitingUsers.has(walletAddress);

    // 활성 채팅방 확인
    const activeRoom = Array.from(activeMatches.values()).find(
      (match) => match.user1 === walletAddress || match.user2 === walletAddress
    );

    return NextResponse.json({
      isWaiting,
      activeRoom: activeRoom
        ? {
            roomId: activeRoom.roomId,
            partnerId:
              activeRoom.user1 === walletAddress
                ? activeRoom.user2
                : activeRoom.user1,
          }
        : null,
    });
  } catch (error) {
    console.error("Get match status error:", error);
    return NextResponse.json(
      { error: "Failed to get match status" },
      { status: 500 }
    );
  }
}
