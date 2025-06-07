import { NextResponse } from "next/server"

// 실제로는 Redis나 데이터베이스에서 관리
const onlineUsers = new Set<string>()

export async function GET() {
  try {
    // WebSocket 서버에서 온라인 사용자 수 가져오기
    // 실제 구현에서는 WebSocket 서버 API 호출
    const count = Math.floor(Math.random() * 50) + 10 // 임시 데이터

    return NextResponse.json({ count })
  } catch (error) {
    console.error("온라인 사용자 수 조회 오류:", error)
    return NextResponse.json({ error: "서버 오류" }, { status: 500 })
  }
}
