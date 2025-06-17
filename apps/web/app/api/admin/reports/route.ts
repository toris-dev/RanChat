import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://placeholder.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 신고 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status"); // 'pending', 'resolved', 'all'
    const reportType = searchParams.get("type"); // reason 필터링

    const offset = (page - 1) * limit;

    let query = supabase
      .from("reports")
      .select("*", { count: "exact" })
      .range(offset, offset + limit - 1)
      .order("created_at", { ascending: false });

    // 상태 필터링
    if (status === "pending") {
      query = query.is("resolved_at", null);
    } else if (status === "resolved") {
      query = query.not("resolved_at", "is", null);
    }

    // 신고 유형 필터링
    if (reportType) {
      query = query.eq("reason", reportType);
    }

    const { data: reports, error, count } = await query;

    if (error) {
      console.error("Get reports error:", error);
      return NextResponse.json(
        { error: "Failed to get reports" },
        { status: 500 }
      );
    }

    // 각 신고의 추가 정보 조회
    const reportsWithDetails = await Promise.all(
      (reports || []).map(async (report: any) => {
        // 신고자와 피신고자의 기본 정보
        const { data: reporterInfo } = await supabase
          .from("users")
          .select("is_online, last_seen")
          .eq("wallet_address", report.reporter_wallet)
          .single();

        const { data: reportedInfo } = await supabase
          .from("users")
          .select("is_online, last_seen")
          .eq("wallet_address", report.reported_wallet)
          .single();

        // 해당 채팅방의 메시지들 (최근 10개)
        let chatMessages = [];
        if (report.room_id) {
          const { data: messages } = await supabase
            .from("messages")
            .select("*")
            .eq("room_id", report.room_id)
            .order("created_at", { ascending: false })
            .limit(10);

          chatMessages = messages || [];
        }

        // 피신고자의 이전 신고 횟수
        const { count: previousReports } = await supabase
          .from("reports")
          .select("*", { count: "exact", head: true })
          .eq("reported_wallet", report.reported_wallet)
          .lt("created_at", report.created_at);

        return {
          ...report,
          reporterInfo: reporterInfo || null,
          reportedInfo: reportedInfo || null,
          chatMessages,
          previousReportCount: previousReports || 0,
          isPending: !report.resolved_at,
        };
      })
    );

    return NextResponse.json({
      reports: reportsWithDetails,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Admin get reports API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// 신고 처리
export async function POST(request: NextRequest) {
  try {
    const { action, reportId, resolution, adminNotes } = await request.json();

    if (!reportId) {
      return NextResponse.json(
        { error: "Report ID is required" },
        { status: 400 }
      );
    }

    switch (action) {
      case "resolve_report":
        return await resolveReport(reportId, resolution, adminNotes);

      case "get_report_detail":
        return await getReportDetail(reportId);

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Admin report action API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function resolveReport(
  reportId: string,
  resolution: string,
  adminNotes?: string
) {
  try {
    // 신고 해결 처리
    const { error } = await supabase
      .from("reports")
      .update({
        resolved_at: new Date().toISOString(),
        resolution,
        admin_notes: adminNotes || null,
      })
      .eq("report_id", reportId);

    if (error) {
      console.error("Resolve report error:", error);
      return NextResponse.json(
        { error: "Failed to resolve report" },
        { status: 500 }
      );
    }

    // 관리자 액션 로그 저장
    await supabase
      .from("admin_actions")
      .insert({
        action_type: "resolve_report",
        target_id: reportId,
        resolution,
        admin_notes: adminNotes,
        created_at: new Date().toISOString(),
      })
      .then(
        () => {},
        () => {}
      );

    return NextResponse.json({
      success: true,
      message: "신고가 처리되었습니다.",
    });
  } catch (error) {
    console.error("Resolve report error:", error);
    return NextResponse.json(
      { error: "Failed to resolve report" },
      { status: 500 }
    );
  }
}

async function getReportDetail(reportId: string) {
  try {
    // 신고 상세 정보
    const { data: report, error } = await supabase
      .from("reports")
      .select("*")
      .eq("report_id", reportId)
      .single();

    if (error || !report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // 채팅방 전체 메시지 조회
    let allMessages = [];
    if (report.room_id) {
      const { data: messages } = await supabase
        .from("messages")
        .select("*")
        .eq("room_id", report.room_id)
        .order("created_at", { ascending: true });

      allMessages = messages || [];
    }

    // 신고자와 피신고자의 상세 정보
    const { data: reporterDetail } = await supabase
      .from("users")
      .select("*")
      .eq("wallet_address", report.reporter_wallet)
      .single();

    const { data: reportedDetail } = await supabase
      .from("users")
      .select("*")
      .eq("wallet_address", report.reported_wallet)
      .single();

    // 피신고자의 모든 신고 내역
    const { data: reportHistory } = await supabase
      .from("reports")
      .select("*")
      .eq("reported_wallet", report.reported_wallet)
      .order("created_at", { ascending: false });

    // 채팅방 정보
    let roomInfo = null;
    if (report.room_id) {
      const { data: room } = await supabase
        .from("chat_rooms")
        .select("*")
        .eq("room_id", report.room_id)
        .single();

      roomInfo = room;
    }

    return NextResponse.json({
      report,
      allMessages,
      reporterDetail: reporterDetail || null,
      reportedDetail: reportedDetail || null,
      reportHistory: reportHistory || [],
      roomInfo,
    });
  } catch (error) {
    console.error("Get report detail error:", error);
    return NextResponse.json(
      { error: "Failed to get report detail" },
      { status: 500 }
    );
  }
}
