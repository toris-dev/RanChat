import { type NextRequest, NextResponse } from "next/server"
import jwt from "jsonwebtoken"

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key"

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "")

    if (!token) {
      return NextResponse.json({ error: "인증 토큰이 필요합니다" }, { status: 401 })
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any
    const { roomId, reason, description, messages } = await request.json()

    // 신고 내용 저장 (Supabase 연동 시)
    const reportData = {
      reporter_address: decoded.address,
      room_id: roomId,
      reason,
      description,
      evidence_messages: JSON.stringify(messages),
      created_at: new Date().toISOString(),
      status: "pending",
    }

    console.log("신고 접수:", reportData)

    // 실제 구현에서는 데이터베이스에 저장
    // await supabase.from('reports').insert(reportData)

    return NextResponse.json({
      success: true,
      message: "신고가 접수되었습니다",
    })
  } catch (error) {
    console.error("신고 처리 오류:", error)
    return NextResponse.json({ error: "신고 처리 중 오류가 발생했습니다" }, { status: 500 })
  }
}
