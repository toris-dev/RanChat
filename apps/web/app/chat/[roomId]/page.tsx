"use client";

import type React from "react";

import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Textarea,
} from "@ranchat/ui";
import { ArrowLeft, Flag, Send, Smile, User, UserX } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface Message {
  id: string;
  content: string;
  sender: "me" | "other";
  timestamp: Date;
  type?: "text" | "system";
}

interface ChatUser {
  id: string;
  username?: string;
  wallet_address: string;
  isOnline: boolean;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [partnerConnected, setPartnerConnected] = useState(false);
  const [partner, setPartner] = useState<ChatUser | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [roomStatus, setRoomStatus] = useState<
    "connecting" | "active" | "ended"
  >("connecting");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const params = useParams();
  const roomId = params.roomId as string;

  useEffect(() => {
    const walletAddress = localStorage.getItem("wallet_address");
    if (!walletAddress) {
      router.push("/");
      return;
    }

    // 채팅방 연결 시작
    connectToRoom();
    initializeWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const connectToRoom = async () => {
    try {
      // 가상의 상대방 정보 설정 (실제로는 API에서 가져옴)
      const virtualPartner: ChatUser = {
        id: `partner_${roomId}`,
        username: `User${Math.floor(Math.random() * 1000)}`,
        wallet_address: `0x${Math.random().toString(16).substr(2, 40)}`,
        isOnline: true,
      };

      setPartner(virtualPartner);
      setPartnerConnected(true);
      setRoomStatus("active");

      // 환영 메시지 추가
      const welcomeMessage: Message = {
        id: `welcome_${Date.now()}`,
        content: "새로운 채팅이 시작되었습니다. 서로 예의를 지켜주세요! 😊",
        sender: "other",
        timestamp: new Date(),
        type: "system",
      };
      setMessages([welcomeMessage]);
    } catch (error) {
      console.error("채팅방 연결 실패:", error);
      router.push("/matching");
    }
  };

  const initializeWebSocket = () => {
    const token = localStorage.getItem("auth_token") || "dummy_token";
    const wsUrl =
      process.env.NODE_ENV === "production"
        ? "wss://your-websocket-server.com"
        : "ws://localhost:3002";

    try {
      const websocket = new WebSocket(
        `${wsUrl}?token=${token}&roomId=${roomId}`
      );

      websocket.onopen = () => {
        console.log("채팅 WebSocket 연결됨");
        setWs(websocket);
        setIsConnected(true);
      };

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error("WebSocket 메시지 파싱 오류:", error);
        }
      };

      websocket.onclose = () => {
        console.log("채팅 WebSocket 연결 종료");
        setWs(null);
        setIsConnected(false);
      };

      websocket.onerror = (error) => {
        console.error("WebSocket 오류:", error);
        setIsConnected(false);
      };
    } catch (error) {
      console.error("WebSocket 연결 실패:", error);
      setIsConnected(false);
    }
  };

  const handleWebSocketMessage = (data: any) => {
    if (data.type === "message") {
      const newMsg: Message = {
        id: data.id || `msg_${Date.now()}`,
        content: data.content,
        sender: data.sender === "self" ? "me" : "other",
        timestamp: new Date(data.timestamp || Date.now()),
      };
      setMessages((prev) => [...prev, newMsg]);
    } else if (data.type === "partner_status") {
      setPartnerConnected(data.connected);
    } else if (data.type === "partner_left") {
      addSystemMessage("상대방이 채팅을 종료했습니다.");
      setRoomStatus("ended");
    } else if (data.type === "typing") {
      setIsTyping(data.isTyping);
      setTimeout(() => setIsTyping(false), 3000);
    }
  };

  const addSystemMessage = (content: string) => {
    const systemMessage: Message = {
      id: `system_${Date.now()}`,
      content,
      sender: "other",
      timestamp: new Date(),
      type: "system",
    };
    setMessages((prev) => [...prev, systemMessage]);
  };

  const sendMessage = () => {
    if (!newMessage.trim()) return;

    const message: Message = {
      id: `local_${Date.now()}`,
      content: newMessage.trim(),
      sender: "me",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, message]);

    if (ws && isConnected) {
      ws.send(
        JSON.stringify({
          type: "send_message",
          content: newMessage.trim(),
          roomId,
        })
      );
    }

    setNewMessage("");
  };

  const leaveChat = () => {
    if (confirm("정말 채팅을 종료하시겠습니까?")) {
      if (ws) {
        ws.send(
          JSON.stringify({
            type: "leave_room",
            roomId,
          })
        );
      }
      router.push("/matching");
    }
  };

  const blockUser = () => {
    if (confirm("이 사용자를 차단하시겠습니까? 다시 매칭되지 않습니다.")) {
      if (ws) {
        ws.send(
          JSON.stringify({
            type: "block_user",
            roomId,
          })
        );
      }

      // 로컬 차단 목록에 추가
      const blockedUsers = JSON.parse(
        localStorage.getItem("blocked_users") || "[]"
      );
      const newBlocked = [...blockedUsers, partner?.wallet_address];
      localStorage.setItem("blocked_users", JSON.stringify(newBlocked));

      addSystemMessage("사용자가 차단되었습니다.");
      setTimeout(() => router.push("/matching"), 2000);
    }
  };

  const submitReport = async () => {
    if (!reportReason.trim()) {
      alert("신고 사유를 선택해주세요.");
      return;
    }

    try {
      const token = localStorage.getItem("auth_token") || "dummy_token";
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
          messages: messages.slice(-10),
        }),
      });

      if (response.ok) {
        alert("신고가 접수되었습니다. 검토 후 조치하겠습니다.");
        setIsReportDialogOpen(false);
        setReportReason("");
        setReportDescription("");
      } else {
        alert("신고 접수 중 오류가 발생했습니다.");
      }
    } catch (error) {
      console.error("신고 오류:", error);
      alert("신고가 접수되었습니다."); // 개발 중에는 성공으로 처리
      setIsReportDialogOpen(false);
      setReportReason("");
      setReportDescription("");
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* 헤더 */}
      <div className="bg-white/10 backdrop-blur-lg border-b border-white/20 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button
              onClick={leaveChat}
              variant="outline"
              size="sm"
              className="border-white/20 text-white hover:bg-white/10"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-white font-medium">
                  {partner?.username || "익명 사용자"}
                </p>
                <div className="flex items-center space-x-1">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      partnerConnected ? "bg-green-400" : "bg-gray-400"
                    }`}
                  />
                  <span className="text-xs text-gray-300">
                    {partnerConnected ? "온라인" : "오프라인"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* 신고 버튼 */}
            <Dialog
              open={isReportDialogOpen}
              onOpenChange={setIsReportDialogOpen}
            >
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  <Flag className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-gray-900 border-white/20">
                <DialogHeader>
                  <DialogTitle className="text-white">사용자 신고</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-white text-sm mb-2 block">
                      신고 사유
                    </label>
                    <select
                      value={reportReason}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                        setReportReason(e.target.value)
                      }
                      className="w-full p-2 bg-gray-800 border border-white/20 rounded text-white"
                    >
                      <option value="">사유를 선택하세요</option>
                      <option value="spam">스팸/광고</option>
                      <option value="harassment">괴롭힘</option>
                      <option value="inappropriate">부적절한 내용</option>
                      <option value="other">기타</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-white text-sm mb-2 block">
                      상세 설명
                    </label>
                    <Textarea
                      value={reportDescription}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        setReportDescription(e.target.value)
                      }
                      placeholder="상세한 신고 내용을 입력하세요"
                      className="bg-gray-800 border-white/20 text-white"
                    />
                  </div>
                  <div className="flex space-x-2">
                    <Button onClick={submitReport} className="flex-1">
                      신고하기
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setIsReportDialogOpen(false)}
                      className="border-white/20"
                    >
                      취소
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* 차단 버튼 */}
            <Button
              onClick={blockUser}
              variant="outline"
              size="sm"
              className="border-red-500/20 text-red-400 hover:bg-red-500/10"
            >
              <UserX className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.sender === "me" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                message.type === "system"
                  ? "bg-gray-600/30 text-gray-300 text-center text-sm"
                  : message.sender === "me"
                    ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                    : "bg-white/10 text-white backdrop-blur-lg border border-white/20"
              }`}
            >
              <p className="break-words">{message.content}</p>
              {message.type !== "system" && (
                <p className="text-xs opacity-70 mt-1">
                  {formatTime(message.timestamp)}
                </p>
              )}
            </div>
          </div>
        ))}

        {/* 타이핑 인디케이터 */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl px-4 py-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0.1s" }}
                ></div>
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                ></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 메시지 입력 영역 */}
      <div className="bg-white/10 backdrop-blur-lg border-t border-white/20 p-4">
        <div className="flex items-center space-x-2">
          <div className="flex-1 relative">
            <Input
              value={newMessage}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNewMessage(e.target.value)
              }
              onKeyPress={handleKeyPress}
              placeholder="메시지를 입력하세요..."
              className="bg-white/10 border-white/20 text-white placeholder-gray-400 pr-12"
              disabled={roomStatus === "ended"}
            />
            <Button
              size="sm"
              variant="ghost"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
            >
              <Smile className="w-4 h-4" />
            </Button>
          </div>
          <Button
            onClick={sendMessage}
            disabled={!newMessage.trim() || roomStatus === "ended"}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>

        {roomStatus === "ended" && (
          <p className="text-center text-gray-400 text-sm mt-2">
            채팅이 종료되었습니다. 새로운 매칭을 시작하세요.
          </p>
        )}
      </div>
    </div>
  );
}
