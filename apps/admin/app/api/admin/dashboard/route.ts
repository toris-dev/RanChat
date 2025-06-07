import { NextResponse } from "next/server"

export async function GET() {
  try {
    // 실제로는 데이터베이스에서 통계 데이터 조회
    const stats = {
      onlineUsers: Math.floor(Math.random() * 100) + 20,
      totalUsers: 1250,
      activeChats: Math.floor(Math.random() * 50) + 10,
      totalReports: 45,
      pendingReports: 8,
      blockedUsers: 12,
    }

    // 24시간 차트 데이터 생성
    const now = new Date()
    const chartData = Array.from({ length: 24 }, (_, i) => ({
      time: `${23 - i}:00`,
      users: Math.floor(Math.random() * 80) + 20,
      chats: Math.floor(Math.random() * 40) + 5,
    })).reverse()

    return NextResponse.json({
      stats,
      chartData,
    })
  } catch (error) {
    console.error("대시보드 데이터 조회 오류:", error)
    return NextResponse.json({ error: "서버 오류" }, { status: 500 })
  }
}
