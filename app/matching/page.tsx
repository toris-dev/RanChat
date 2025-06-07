"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Users, Search, ArrowLeft, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

export default function MatchingPage() {
  const [isMatching, setIsMatching] = useState(false)
  const [matchingProgress, setMatchingProgress] = useState(0)
  const [onlineUsers, setOnlineUsers] = useState(0)
  const [ws, setWs] = useState<WebSocket | null>(null)
  const router = useRouter()

  useEffect(() => {
    // 인증 확인
    const token = localStorage.getItem("auth_token")
    if (!token) {
      router.push("/")
      return
    }

    // 온라인 사용자 수 가져오기
    fetchOnlineUsers()

    // WebSocket 연결 준비
    initializeWebSocket()

    return () => {
      if (ws) {
        ws.close()
      }
    }
  }, [])

  const fetchOnlineUsers = async () => {
    try {
      const response = await fetch("/api/users/online")
      const data = await response.json()
      setOnlineUsers(data.count)
    } catch (error) {
      console.error("온라인 사용자 수 가져오기 실패:", error)
    }
  }

  const initializeWebSocket = () => {
    const token = localStorage.getItem("auth_token")
    const wsUrl = process.env.NODE_ENV === "production" ? "wss://your-websocket-server.com" : "ws://localhost:3001"

    const websocket = new WebSocket(`${wsUrl}?token=${token}`)

    websocket.onopen = () => {
      console.log("WebSocket 연결됨")
      setWs(websocket)
    }

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data)

      if (data.type === "match_found") {
        router.push(`/chat/${data.roomId}`)
      } else if (data.type === "online_count") {
        setOnlineUsers(data.count)
      }
    }

    websocket.onclose = () => {
      console.log("WebSocket 연결 종료")
      setWs(null)
    }
  }

  const startMatching = () => {
    if (!ws) {
      alert("서버 연결이 필요합니다.")
      return
    }

    setIsMatching(true)
    setMatchingProgress(0)

    // 매칭 요청 전송
    ws.send(
      JSON.stringify({
        type: "find_match",
      }),
    )

    // 진행률 애니메이션
    const interval = setInterval(() => {
      setMatchingProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval)
          return 90
        }
        return prev + Math.random() * 10
      })
    }, 500)
  }

  const cancelMatching = () => {
    if (ws) {
      ws.send(
        JSON.stringify({
          type: "cancel_match",
        }),
      )
    }
    setIsMatching(false)
    setMatchingProgress(0)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <Button onClick={() => router.push("/")} variant="ghost" size="sm" className="text-white hover:bg-white/10">
            <ArrowLeft className="w-4 h-4 mr-2" />
            뒤로가기
          </Button>
          <div className="flex items-center space-x-2 text-white">
            <Users className="w-4 h-4" />
            <span className="text-sm">{onlineUsers}명 온라인</span>
          </div>
        </div>

        {/* 매칭 카드 */}
        <Card className="bg-white/10 backdrop-blur-lg border-white/20">
          <CardHeader className="text-center">
            <CardTitle className="text-white">{isMatching ? "매칭 중..." : "랜덤 매칭"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 매칭 상태 */}
            <div className="text-center space-y-4">
              {isMatching ? (
                <div className="space-y-4">
                  <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto animate-pulse">
                    <Loader2 className="w-10 h-10 text-white animate-spin" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-white">상대방을 찾고 있습니다...</p>
                    <Progress value={matchingProgress} className="w-full" />
                    <p className="text-sm text-gray-300">{Math.round(matchingProgress)}%</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto">
                    <Search className="w-10 h-10 text-white" />
                  </div>
                  <p className="text-white">새로운 사람과 대화해보세요!</p>
                </div>
              )}
            </div>

            {/* 액션 버튼 */}
            <div className="space-y-3">
              {isMatching ? (
                <Button
                  onClick={cancelMatching}
                  variant="outline"
                  className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10"
                >
                  매칭 취소
                </Button>
              ) : (
                <Button
                  onClick={startMatching}
                  disabled={!ws}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                >
                  <Search className="w-4 h-4 mr-2" />
                  매칭 시작
                </Button>
              )}
            </div>

            {/* 안내 메시지 */}
            <div className="text-center space-y-2">
              <p className="text-xs text-gray-400">• 완전 익명으로 대화합니다</p>
              <p className="text-xs text-gray-400">• 부적절한 내용 시 신고 가능</p>
              <p className="text-xs text-gray-400">• 언제든지 대화를 종료할 수 있습니다</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
