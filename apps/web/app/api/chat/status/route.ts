import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://placeholder.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 임시 메모리 저장소 (실제로는 Redis나 데이터베이스 사용 권장)
const onlineUsers = new Set<string>();

// 온라인 상태 업데이트
export async function POST(request: NextRequest) {
  try {
    const { walletAddress, isOnline } = await request.json();

    if (!walletAddress) {
      return NextResponse.json(
        {
          error: "Wallet address is required",
        },
        { status: 400 }
      );
    }

    if (isOnline) {
      onlineUsers.add(walletAddress);
    } else {
      onlineUsers.delete(walletAddress);
    }

    // 데이터베이스에 상태 업데이트
    const { error } = await supabase.from("users").upsert(
      {
        wallet_address: walletAddress,
        is_online: isOnline,
        last_seen: new Date().toISOString(),
      },
      {
        onConflict: "wallet_address",
      }
    );

    if (error) {
      console.error("User status update error:", error);
      return NextResponse.json(
        { error: "Failed to update status" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      onlineCount: onlineUsers.size,
    });
  } catch (error) {
    console.error("Status update API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// 온라인 사용자 수 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get("wallet");

    // 현재 온라인 사용자 수
    const onlineCount = onlineUsers.size;

    // 특정 사용자의 상태 조회
    let userStatus = null;
    if (walletAddress) {
      const isOnline = onlineUsers.has(walletAddress);

      // 데이터베이스에서 마지막 접속 시간 조회
      const { data: user } = await supabase
        .from("users")
        .select("last_seen, is_online")
        .eq("wallet_address", walletAddress)
        .single();

      userStatus = {
        walletAddress,
        isOnline,
        lastSeen: user?.last_seen || null,
      };
    }

    return NextResponse.json({
      onlineCount,
      userStatus,
    });
  } catch (error) {
    console.error("Get status API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// 사용자 활동 알림 (하트비트)
export async function PUT(request: NextRequest) {
  try {
    const { walletAddress } = await request.json();

    if (!walletAddress) {
      return NextResponse.json(
        {
          error: "Wallet address is required",
        },
        { status: 400 }
      );
    }

    // 메모리에서 온라인 상태 유지
    onlineUsers.add(walletAddress);

    // 데이터베이스에 마지막 활동 시간 업데이트
    const { error } = await supabase.from("users").upsert(
      {
        wallet_address: walletAddress,
        is_online: true,
        last_seen: new Date().toISOString(),
      },
      {
        onConflict: "wallet_address",
      }
    );

    if (error) {
      console.error("Heartbeat update error:", error);
      return NextResponse.json(
        { error: "Failed to update activity" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Heartbeat API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// 비활성 사용자 정리 (주기적으로 호출되어야 함)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const timeoutMinutes = parseInt(searchParams.get("timeout") || "10");

    const timeoutMs = timeoutMinutes * 60 * 1000;
    const cutoffTime = new Date(Date.now() - timeoutMs);

    // 데이터베이스에서 비활성 사용자 조회
    const { data: inactiveUsers } = await supabase
      .from("users")
      .select("wallet_address")
      .eq("is_online", true)
      .lt("last_seen", cutoffTime.toISOString());

    // 메모리와 데이터베이스에서 비활성 사용자 제거
    if (inactiveUsers && inactiveUsers.length > 0) {
      const inactiveWallets = inactiveUsers.map(
        (user: any) => user.wallet_address
      );

      // 메모리에서 제거
      inactiveWallets.forEach((wallet: string) => {
        onlineUsers.delete(wallet);
      });

      // 데이터베이스 상태 업데이트
      await supabase
        .from("users")
        .update({ is_online: false })
        .in("wallet_address", inactiveWallets);
    }

    return NextResponse.json({
      success: true,
      removedCount: inactiveUsers?.length || 0,
      currentOnlineCount: onlineUsers.size,
    });
  } catch (error) {
    console.error("Cleanup inactive users API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
