import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://placeholder.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 임시 메모리 저장소 - 실제로는 Redis나 데이터베이스 사용 권장
const bannedUsers = new Map(); // userId -> { bannedUntil, reason }
const onlineUsers = new Set<string>(); // 온라인 사용자 목록

// 사용자 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status"); // 'online', 'offline', 'banned', 'all'
    const search = searchParams.get("search");

    const offset = (page - 1) * limit;

    let query = supabase
      .from("users")
      .select("wallet_address, is_online, last_seen, created_at", {
        count: "exact",
      })
      .range(offset, offset + limit - 1)
      .order("last_seen", { ascending: false });

    // 상태 필터링
    if (status === "online") {
      query = query.eq("is_online", true);
    } else if (status === "offline") {
      query = query.eq("is_online", false);
    }

    // 검색 필터링
    if (search) {
      query = query.ilike("wallet_address", `%${search}%`);
    }

    const { data: users, error, count } = await query;

    if (error) {
      console.error("Get users error:", error);
      return NextResponse.json(
        { error: "Failed to get users" },
        { status: 500 }
      );
    }

    // 각 사용자의 추가 정보 조회
    const usersWithDetails = await Promise.all(
      (users || []).map(async (user: any) => {
        // 활성 채팅방 수
        const { count: activeChatRooms } = await supabase
          .from("chat_rooms")
          .select("*", { count: "exact", head: true })
          .or(
            `user1_wallet.eq.${user.wallet_address},user2_wallet.eq.${user.wallet_address}`
          )
          .eq("is_active", true);

        // 전송한 메시지 수
        const { count: messageCount } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("sender_wallet", user.wallet_address);

        // 신고당한 횟수
        const { count: reportedCount } = await supabase
          .from("reports")
          .select("*", { count: "exact", head: true })
          .eq("reported_wallet", user.wallet_address);

        // 신고한 횟수
        const { count: reporterCount } = await supabase
          .from("reports")
          .select("*", { count: "exact", head: true })
          .eq("reporter_wallet", user.wallet_address);

        // 차단한 사용자 수
        const { count: blockedCount } = await supabase
          .from("blocked_users")
          .select("*", { count: "exact", head: true })
          .eq("blocker_wallet", user.wallet_address);

        // 차단당한 횟수
        const { count: blockedByCount } = await supabase
          .from("blocked_users")
          .select("*", { count: "exact", head: true })
          .eq("blocked_wallet", user.wallet_address);

        const banInfo = bannedUsers.get(user.wallet_address);
        const isBanned = banInfo && new Date() < new Date(banInfo.bannedUntil);

        return {
          walletAddress: user.wallet_address,
          isOnline: user.is_online,
          lastSeen: user.last_seen,
          createdAt: user.created_at,
          stats: {
            activeChatRooms: activeChatRooms || 0,
            messageCount: messageCount || 0,
            reportedCount: reportedCount || 0,
            reporterCount: reporterCount || 0,
            blockedCount: blockedCount || 0,
            blockedByCount: blockedByCount || 0,
          },
          ban: isBanned
            ? {
                isBanned: true,
                bannedUntil: banInfo.bannedUntil,
                reason: banInfo.reason,
              }
            : { isBanned: false },
        };
      })
    );

    return NextResponse.json({
      users: usersWithDetails,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Admin get users API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// 사용자 관리 액션
export async function POST(request: NextRequest) {
  try {
    const { action, walletAddress, duration, reason } = await request.json();

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Wallet address is required" },
        { status: 400 }
      );
    }

    switch (action) {
      case "ban_user":
        return await banUser(walletAddress, duration, reason);

      case "unban_user":
        return await unbanUser(walletAddress);

      case "force_disconnect":
        return await forceDisconnect(walletAddress);

      case "get_user_detail":
        return await getUserDetail(walletAddress);

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Admin user action API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function banUser(
  walletAddress: string,
  durationMinutes: number = 60,
  reason: string = "관리자에 의한 차단"
) {
  try {
    const bannedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);

    // 메모리에 차단 정보 저장
    bannedUsers.set(walletAddress, {
      bannedUntil: bannedUntil.toISOString(),
      reason,
      bannedAt: new Date().toISOString(),
    });

    // 사용자를 오프라인으로 변경
    await supabase
      .from("users")
      .update({ is_online: false })
      .eq("wallet_address", walletAddress);

    // 활성 채팅방 종료
    await supabase
      .from("chat_rooms")
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .or(`user1_wallet.eq.${walletAddress},user2_wallet.eq.${walletAddress}`)
      .eq("is_active", true);

    // 차단 로그 저장 (관리자 액션 테이블이 있다면)
    await supabase
      .from("admin_actions")
      .insert({
        action_type: "ban_user",
        target_wallet: walletAddress,
        duration_minutes: durationMinutes,
        reason,
        created_at: new Date().toISOString(),
      })
      .then(
        () => {},
        () => {}
      ); // 테이블이 없어도 무시

    return NextResponse.json({
      success: true,
      message: `사용자 ${walletAddress}가 ${durationMinutes}분간 차단되었습니다.`,
      bannedUntil: bannedUntil.toISOString(),
    });
  } catch (error) {
    console.error("Ban user error:", error);
    return NextResponse.json({ error: "Failed to ban user" }, { status: 500 });
  }
}

async function unbanUser(walletAddress: string) {
  try {
    bannedUsers.delete(walletAddress);

    // 차단 해제 로그 저장
    await supabase
      .from("admin_actions")
      .insert({
        action_type: "unban_user",
        target_wallet: walletAddress,
        created_at: new Date().toISOString(),
      })
      .then(
        () => {},
        () => {}
      );

    return NextResponse.json({
      success: true,
      message: `사용자 ${walletAddress}의 차단이 해제되었습니다.`,
    });
  } catch (error) {
    console.error("Unban user error:", error);
    return NextResponse.json(
      { error: "Failed to unban user" },
      { status: 500 }
    );
  }
}

async function forceDisconnect(walletAddress: string) {
  try {
    // 사용자를 오프라인으로 변경
    await supabase
      .from("users")
      .update({ is_online: false })
      .eq("wallet_address", walletAddress);

    onlineUsers.delete(walletAddress);

    // 강제 연결 해제 로그 저장
    await supabase
      .from("admin_actions")
      .insert({
        action_type: "force_disconnect",
        target_wallet: walletAddress,
        created_at: new Date().toISOString(),
      })
      .then(
        () => {},
        () => {}
      );

    return NextResponse.json({
      success: true,
      message: `사용자 ${walletAddress}의 연결이 강제로 해제되었습니다.`,
    });
  } catch (error) {
    console.error("Force disconnect error:", error);
    return NextResponse.json(
      { error: "Failed to disconnect user" },
      { status: 500 }
    );
  }
}

async function getUserDetail(walletAddress: string) {
  try {
    // 사용자 기본 정보
    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("wallet_address", walletAddress)
      .single();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 채팅방 목록
    const { data: chatRooms } = await supabase
      .from("chat_rooms")
      .select("*")
      .or(`user1_wallet.eq.${walletAddress},user2_wallet.eq.${walletAddress}`)
      .order("created_at", { ascending: false })
      .limit(10);

    // 최근 메시지
    const { data: recentMessages } = await supabase
      .from("messages")
      .select("*")
      .eq("sender_wallet", walletAddress)
      .order("created_at", { ascending: false })
      .limit(10);

    // 신고 내역 (신고당한 것)
    const { data: reports } = await supabase
      .from("reports")
      .select("*")
      .eq("reported_wallet", walletAddress)
      .order("created_at", { ascending: false })
      .limit(10);

    // 차단 내역
    const { data: blockedUsers } = await supabase
      .from("blocked_users")
      .select("*")
      .eq("blocker_wallet", walletAddress)
      .order("created_at", { ascending: false })
      .limit(10);

    const banInfo = bannedUsers.get(walletAddress);
    const isBanned = banInfo && new Date() < new Date(banInfo.bannedUntil);

    return NextResponse.json({
      user: {
        ...user,
        ban: isBanned ? banInfo : null,
      },
      chatRooms: chatRooms || [],
      recentMessages: recentMessages || [],
      reports: reports || [],
      blockedUsers: blockedUsers || [],
    });
  } catch (error) {
    console.error("Get user detail error:", error);
    return NextResponse.json(
      { error: "Failed to get user detail" },
      { status: 500 }
    );
  }
}
