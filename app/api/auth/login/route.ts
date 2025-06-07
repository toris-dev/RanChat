import { type NextRequest, NextResponse } from "next/server"
import { ethers } from "ethers"
import jwt from "jsonwebtoken"

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key"

export async function POST(request: NextRequest) {
  try {
    const { address, message, signature } = await request.json()

    // 서명 검증
    const recoveredAddress = ethers.verifyMessage(message, signature)

    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return NextResponse.json({ error: "서명 검증 실패" }, { status: 401 })
    }

    // JWT 토큰 생성
    const token = jwt.sign(
      {
        address: address.toLowerCase(),
        timestamp: Date.now(),
      },
      JWT_SECRET,
      { expiresIn: "24h" },
    )

    // 사용자 정보 저장 (Supabase 연동 시)
    // await supabase.from('users').upsert({
    //   wallet_address: address.toLowerCase(),
    //   last_login: new Date().toISOString()
    // })

    return NextResponse.json({
      token,
      address: address.toLowerCase(),
    })
  } catch (error) {
    console.error("로그인 오류:", error)
    return NextResponse.json({ error: "로그인 처리 중 오류가 발생했습니다" }, { status: 500 })
  }
}
