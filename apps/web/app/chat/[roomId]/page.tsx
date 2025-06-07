"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@blockchat/shared/components/ui/button"
import { Input } from "@blockchat/shared/components/ui/input"
import { Badge } from "@blockchat/shared/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@blockchat/shared/components/ui/dialog"
import { Textarea } from "@blockchat/shared/components/ui/textarea"
import { Send, ArrowLeft, Flag, User, Shield, Ban } from "lucide-react"
import { useRouter, useParams } from "next/navigation"

interface Message {
  id: string
  content: string
  sender: "me" | "other"
  timestamp: Date
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isConnected, setIsConnected] = useState(false)
  const [partnerConnected, setPartnerConnected] = useState(false)
  const [ws, setWs] = useState<WebSocket | null>(null)
  const [reportReason, setReportReason] = useState("")
  const [reportDescription, setReportDescription] = useState("")
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false)
  const [blockedUsers, setBlockedUsers] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const params = useParams()
  const roomId = params.roomId as string

  useEffect(() => {
    const token = localStorage.getItem("auth_token")
    if (!token) {
      router.push("/")
      return
    }

    // 차단된 사용자 목록 로드
    const blocked = JSON.parse(localStorage.getItem("blocked_users") || "[]")
    setBlockedUsers(blocked)

    initializeWebSocket()

    return () => {
      if (ws) {
        ws.close()
      }
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const initializeWebSocket = () => {
    const token = localStorage.getItem("auth_token")
    const wsUrl = process.env.NODE_ENV === "production" ? "wss://your-websocket-server.com" : "ws://localhost:3002"

    const websocket = new WebSocket(`${wsUrl}?token=${token}&roomId=${roomId}`)

    websocket.onopen = () => {
      console.log("채팅 WebSocket 연결됨")
      setWs(websocket)
      setIsConnected(true)
    }

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data)

      if (data.type === "message") {
        const newMsg: Message = {
          id: data.id,
          content: data.content,
          sender: data.sender === "self" ? "me" : "other",
          timestamp: new Date(data.timestamp),
        }
        setMessages((prev) => [...prev, newMsg])
      } else if (data.type === "partner_status") {
        setPartnerConnected(data.connected)
      } else if (data.type === "partner_left") {
        alert("상대방이 채팅을 종료했습니다.")
        router.push("/matching")
      } else if (data.type === "blocked_by_partner") {
        alert("상대방이 당신을 차단했습니다.")
        router.push("/matching")
      }
    }

    websocket.onclose = () => {
      console.log("채팅 WebSocket 연결 종료")
      setWs(null)
      setIsConnected(false)
    }
  }

  const sendMessage = () => {
    if (!newMessage.trim() || !ws || !isConnected) return

    const message = {
      type: "send_message",
      content: newMessage.trim(),
      roomId,
    }

    ws.send(JSON.stringify(message))
    setNewMessage("")
  }

  const leaveChat = () => {
    if (ws) {
      ws.send(
        JSON.stringify({
          type: "leave_room",
          roomId,
        }),
      )
    }
    router.push("/matching")
  }

  const blockUser = () => {
    if (confirm("이 사용자를 차단하시겠습니까? 다시 매칭되지 않습니다.")) {
      if (ws) {
        ws.send(
          JSON.stringify({
            type: "block_user",
            roomId,
          }),
        )
      }

      // 로컬 차단 목록에 추가 (실제로는 서버에서 상대방 주소를 받아야 함)
      const newBlocked = [...blockedUsers, `user_${roomId}`]
      setBlockedUsers(newBlocked)
      localStorage.setItem("blocked_users", JSON.stringify(newBlocked))

      alert("사용자가 차단되었습니다.")
      router.push("/matching")
    }
  }

  const submitReport = async () => {
    if (!reportReason.trim()) {
      alert("신고 사유를 선택해주세요.")
      return
    }

    try {
      const token = localStorage.getItem("auth_token")
      const response = await fetch("/api/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          roomId,
          reason: reportReason,
          description: reportDescription,
          messages: messages.slice(-10), // 최근 10개 메시지 포함
        }),
      })

      if (response.ok) {
        alert("신고가 접수되었습니다. 검토 후 조치하겠습니다.")
        setIsReportDialogOpen(false)
        setReportReason("")
        setReportDescription("")
      } else {
        alert("신고 접수 중 오류가 발생했습니다.")
      }
    } catch (error) {
      console.error("신고 오류:", error)
      alert("신고 접수 중 오류가 발생했습니다.")
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col">
      {/* 헤더 */}
      <div className="bg-white/10 backdrop-blur-lg border-b border-white/20 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button onClick={leaveChat} variant="ghost" size="sm" className="text-white hover:bg-white/10">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-white font-medium">익명 사용자</p>
                <div className="flex items-center space-x-2">
                  <Badge
                    variant={partnerConnected ? "default" : "secondary"}
                    className={partnerConnected ? "bg-green-500" : "bg-gray-500"}
                  >
                    {partnerConnected ? "온라인" : "오프라인"}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
          <div className="flex space-x-2">
            <Button onClick={blockUser} variant="ghost" size="sm" className="text-orange-400 hover:bg-orange-500/10">
              <Ban className="w-4 h-4" />
            </Button>
            <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-red-400 hover:bg-red-500/10">
                  <Flag className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-gray-900 border-gray-700">
                <DialogHeader>
                  <DialogTitle className="text-white">사용자 신고</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-300 mb-2 block">신고 사유</label>
                    <select
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                      className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white"
                    >
                      <option value="">선택해주세요</option>
                      <option value="inappropriate_content">부적절한 내용</option>
                      <option value="harassment">괴롭힘</option>
                      <option value="spam">스팸</option>
                      <option value="hate_speech">혐오 발언</option>
                      <option value="other">기타</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-gray-300 mb-2 block">상세 설명 (선택사항)</label>
                    <Textarea
                      value={reportDescription}
                      onChange={(e) => setReportDescription(e.target.value)}
                      placeholder="신고 사유에 대한 자세한 설명을 입력해주세요..."
                      className="bg-gray-800 border-gray-600 text-white"
                    />
                  </div>
                  <div className="flex space-x-2">
                    <Button onClick={submitReport} className="flex-1 bg-red-600 hover:bg-red-700">
                      신고하기
                    </Button>
                    <Button
                      onClick={() => setIsReportDialogOpen(false)}
                      variant="outline"
                      className="flex-1 border-gray-600 text-gray-300"
                    >
                      취소
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 mt-20">
            <Shield className="w-12 h-12 mx-auto mb-4 text-gray-500" />
            <p>대화를 시작해보세요!</p>
            <p className="text-sm mt-2">서로 익명으로 대화합니다</p>
            <p className="text-xs mt-4 text-gray-500">부적절한 내용 시 신고 또는 차단할 수 있습니다</p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`flex ${message.sender === "me" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                  message.sender === "me"
                    ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                    : "bg-white/10 backdrop-blur-lg text-white border border-white/20"
                }`}
              >
                <p className="break-words">{message.content}</p>
                <p className={`text-xs mt-1 ${message.sender === "me" ? "text-purple-100" : "text-gray-400"}`}>
                  {message.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 입력 영역 */}
      <div className="bg-white/10 backdrop-blur-lg border-t border-white/20 p-4">
        <div className="flex space-x-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isConnected ? "메시지를 입력하세요..." : "연결 중..."}
            disabled={!isConnected}
            className="flex-1 bg-white/10 border-white/20 text-white placeholder-gray-400"
            maxLength={500}
          />
          <Button
            onClick={sendMessage}
            disabled={!newMessage.trim() || !isConnected}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        {!isConnected && <p className="text-xs text-gray-400 mt-2">서버에 연결 중...</p>}
        <p className="text-xs text-gray-500 mt-1">{newMessage.length}/500</p>
      </div>
    </div>
  )
}
