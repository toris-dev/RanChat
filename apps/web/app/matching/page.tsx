"use client";

import { Button, Card, CardContent, CardHeader, CardTitle } from "@ranchat/ui";
import { MessageCircle, Search, User, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MatchingStatus } from "../../components/MatchingStatus";
import { ChatService } from "../../lib/supabase-config";

// 매칭 상태 타입
type MatchingStatus = "idle" | "searching" | "found" | "connecting";

// 사용자 인터페이스
interface User {
  id: string;
  wallet_address: string;
  username?: string;
  avatar_url?: string;
}

export default function MatchingPage() {
  const [matchingStatus, setMatchingStatus] = useState<MatchingStatus>("idle");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [matchedUser, setMatchedUser] = useState<User | null>(null);
  const [searchTime, setSearchTime] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState(1); // 기본값을 1로 설정
  const [chatService] = useState(() => new ChatService());
  const [statusWs, setStatusWs] = useState<WebSocket | null>(null);
  const [isClient, setIsClient] = useState(false); // 클라이언트 렌더링 확인용
  const router = useRouter();

  useEffect(() => {
    // 클라이언트 사이드 렌더링 확인
    setIsClient(true);

    // 로그인 확인
    const walletAddress = localStorage.getItem("wallet_address");
    const userId = localStorage.getItem("user_id");

    if (!walletAddress) {
      router.push("/");
      return;
    }

    setCurrentUser({
      id: userId || "",
      wallet_address: walletAddress,
    });

    // 실시간 온라인 사용자 수 연결 (클라이언트에서만)
    connectToStatusWebSocket();
  }, [router]);

  // 컴포넌트 언마운트 시 WebSocket 정리
  useEffect(() => {
    return () => {
      if (statusWs) {
        statusWs.close();
      }
    };
  }, [statusWs]);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (matchingStatus === "searching") {
      timer = setInterval(() => {
        setSearchTime((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [matchingStatus]);

  const connectToStatusWebSocket = () => {
    // 브라우저 환경에서만 WebSocket 연결
    if (typeof window === "undefined") return;

    try {
      // 상태 모니터링용 WebSocket 연결
      const ws = new WebSocket("ws://localhost:3002?token=dummy_token");

      ws.onopen = () => {
        console.log("상태 모니터링 WebSocket 연결됨");
        setStatusWs(ws);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "online_count") {
          setOnlineUsers(data.count);
        }
      };

      ws.onerror = (error) => {
        console.error("상태 WebSocket 연결 오류:", error);
        // WebSocket 연결 실패 시 기본값 설정
        setOnlineUsers(1);
      };

      ws.onclose = () => {
        console.log("상태 WebSocket 연결 종료");
        setStatusWs(null);
      };
    } catch (error) {
      console.error("상태 WebSocket 연결 실패:", error);
      setOnlineUsers(1);
    }
  };

  const startMatching = async () => {
    if (typeof window === "undefined") return;

    if (!currentUser?.wallet_address) {
      alert("로그인이 필요합니다.");
      return;
    }

    setMatchingStatus("searching");
    setSearchTime(0);

    try {
      // WebSocket을 통한 실제 매칭 요청
      const ws = new WebSocket(
        `ws://localhost:3002?wallet=${currentUser.wallet_address}&token=dummy_token`
      );

      ws.onopen = () => {
        console.log("매칭 서버에 연결됨");
        ws.send(
          JSON.stringify({
            type: "find_match",
          })
        );
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "match_found") {
          setMatchedUser({
            id: data.partnerId,
            wallet_address: data.partnerId,
            username: `User${Math.floor(Math.random() * 1000)}`,
          });
          setMatchingStatus("found");

          // 3초 후 채팅방으로 이동
          setTimeout(() => {
            setMatchingStatus("connecting");
            router.push(`/chat/${data.roomId}`);
          }, 3000);

          ws.close();
        } else if (data.type === "matching_started") {
          console.log("매칭 검색 시작됨");
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket 연결 오류:", error);
        alert("매칭 서버 연결에 실패했습니다.");
        setMatchingStatus("idle");
      };

      ws.onclose = () => {
        console.log("매칭 서버 연결 종료");
      };

      // 매칭 취소 시 WebSocket 정리
      const originalCancel = cancelMatching;
      (window as any).cancelMatchingWs = () => {
        ws.send(JSON.stringify({ type: "cancel_match" }));
        ws.close();
        originalCancel();
      };
    } catch (error) {
      console.error("매칭 시작 실패:", error);
      setMatchingStatus("idle");
    }
  };

  const createOrFindChatRoom = async (user1Id: string, user2Id: string) => {
    try {
      // 실제로는 ChatService의 메소드를 사용
      // 지금은 가상의 채팅방 ID 생성
      return {
        id: `room_${Date.now()}`,
        user1_id: user1Id,
        user2_id: user2Id,
        status: "active" as const,
        created_at: new Date().toISOString(),
      };
    } catch (error) {
      throw error;
    }
  };

  const cancelMatching = () => {
    setMatchingStatus("idle");
    setSearchTime(0);
    setMatchedUser(null);
  };

  const goBack = () => {
    router.push("/");
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* 헤더 */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-between">
            <Button
              onClick={goBack}
              variant="outline"
              size="sm"
              className="border-white/20 text-white hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </Button>
            <h1 className="text-2xl font-bold text-white">랜덤 매칭</h1>
            <div className="w-8" /> {/* 공간 확보용 */}
          </div>

          {/* 온라인 사용자 수 */}
          {isClient ? (
            <MatchingStatus
              onlineUsers={onlineUsers}
              isConnected={statusWs !== null}
              status={statusWs ? "online" : "offline"}
            />
          ) : (
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-lg rounded-full px-4 py-2 border border-white/20">
              <span className="text-white text-sm">연결 중...</span>
            </div>
          )}
        </div>

        {/* 메인 매칭 카드 */}
        <Card className="bg-white/10 backdrop-blur-lg border-white/20">
          <CardHeader className="text-center">
            <CardTitle className="text-white">
              {matchingStatus === "idle" && "매칭 대기중"}
              {matchingStatus === "searching" && "상대방 찾는 중..."}
              {matchingStatus === "found" && "매칭 성공!"}
              {matchingStatus === "connecting" && "채팅방 입장 중..."}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 매칭 상태에 따른 UI */}
            {matchingStatus === "idle" && (
              <div className="space-y-4 text-center">
                <div className="w-24 h-24 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto">
                  <User className="w-12 h-12 text-white" />
                </div>
                <p className="text-gray-300 text-sm">
                  랜덤한 상대방과 익명으로 채팅을 시작하세요
                </p>
                <Button
                  onClick={startMatching}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                >
                  <Search className="w-4 h-4 mr-2" />
                  매칭 시작
                </Button>
              </div>
            )}

            {matchingStatus === "searching" && (
              <div className="space-y-4 text-center">
                <div className="w-24 h-24 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto animate-pulse">
                  <Search className="w-12 h-12 text-white animate-spin" />
                </div>
                <div className="space-y-2">
                  <p className="text-white font-medium">
                    상대방을 찾고 있습니다...
                  </p>
                  <p className="text-gray-300 text-sm">
                    검색 시간: {formatTime(searchTime)}
                  </p>
                </div>
                <Button
                  onClick={cancelMatching}
                  variant="outline"
                  className="w-full border-white/20 text-white hover:bg-white/10"
                >
                  매칭 취소
                </Button>
              </div>
            )}

            {matchingStatus === "found" && matchedUser && (
              <div className="space-y-4 text-center">
                <div className="w-24 h-24 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center mx-auto">
                  <MessageCircle className="w-12 h-12 text-white" />
                </div>
                <div className="space-y-2">
                  <p className="text-white font-medium">매칭 성공!</p>
                  <p className="text-gray-300 text-sm">
                    {matchedUser.username || "익명 사용자"}와 연결되었습니다
                  </p>
                  <p className="text-gray-400 text-xs">
                    곧 채팅방으로 이동합니다...
                  </p>
                </div>
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <div
                    className="w-2 h-2 bg-green-400 rounded-full animate-pulse"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-green-400 rounded-full animate-pulse"
                    style={{ animationDelay: "0.4s" }}
                  ></div>
                </div>
              </div>
            )}

            {matchingStatus === "connecting" && (
              <div className="space-y-4 text-center">
                <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto">
                  <MessageCircle className="w-12 h-12 text-white animate-bounce" />
                </div>
                <div className="space-y-2">
                  <p className="text-white font-medium">채팅방 입장 중...</p>
                  <p className="text-gray-300 text-sm">잠시만 기다려주세요</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 매칭 팁 */}
        {matchingStatus === "idle" && (
          <Card className="bg-white/5 backdrop-blur-lg border-white/10">
            <CardContent className="p-4">
              <h3 className="text-white font-medium mb-2">💡 매칭 팁</h3>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>• 서로 예의를 지켜주세요</li>
                <li>• 개인정보는 공유하지 마세요</li>
                <li>• 부적절한 내용은 신고해주세요</li>
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
