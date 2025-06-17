import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://placeholder.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 사용자 차단
export async function POST(request: NextRequest) {
  try {
    const { blockerWallet, blockedWallet, roomId } = await request.json();

    if (!blockerWallet || !blockedWallet) {
      return NextResponse.json(
        {
          error: "Blocker and blocked wallet addresses are required",
        },
        { status: 400 }
      );
    }

    // 이미 차단되어 있는지 확인
    const { data: existingBlock } = await supabase
      .from("blocked_users")
      .select("*")
      .eq("blocker_wallet", blockerWallet)
      .eq("blocked_wallet", blockedWallet)
      .single();

    if (existingBlock) {
      return NextResponse.json({
        message: "이미 차단된 사용자입니다.",
      });
    }

    // 차단 정보 저장
    const { error } = await supabase.from("blocked_users").insert({
      blocker_wallet: blockerWallet,
      blocked_wallet: blockedWallet,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Block user error:", error);
      return NextResponse.json(
        { error: "Failed to block user" },
        { status: 500 }
      );
    }

    // 채팅방이 있다면 종료 처리
    if (roomId) {
      // 채팅방 비활성화 또는 삭제
      await supabase
        .from("chat_rooms")
        .update({ is_active: false })
        .eq("room_id", roomId);
    }

    return NextResponse.json({
      success: true,
      message: "사용자를 차단했습니다.",
    });
  } catch (error) {
    console.error("Block user API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// 차단된 사용자 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get("wallet");

    if (!walletAddress) {
      return NextResponse.json(
        {
          error: "Wallet address is required",
        },
        { status: 400 }
      );
    }

    const { data: blockedUsers, error } = await supabase
      .from("blocked_users")
      .select("blocked_wallet, created_at")
      .eq("blocker_wallet", walletAddress)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Get blocked users error:", error);
      return NextResponse.json(
        { error: "Failed to get blocked users" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      blockedUsers: blockedUsers || [],
    });
  } catch (error) {
    console.error("Get blocked users API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// 차단 해제
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const blockerWallet = searchParams.get("blocker");
    const blockedWallet = searchParams.get("blocked");

    if (!blockerWallet || !blockedWallet) {
      return NextResponse.json(
        {
          error: "Blocker and blocked wallet addresses are required",
        },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("blocked_users")
      .delete()
      .eq("blocker_wallet", blockerWallet)
      .eq("blocked_wallet", blockedWallet);

    if (error) {
      console.error("Unblock user error:", error);
      return NextResponse.json(
        { error: "Failed to unblock user" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "차단을 해제했습니다.",
    });
  } catch (error) {
    console.error("Unblock user API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
