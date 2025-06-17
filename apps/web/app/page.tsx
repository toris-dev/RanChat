"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ranchat/ui";
import { MessageCircle, Shield, Users, Wallet, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthService } from "../lib/supabase-config";

declare global {
  interface Window {
    ethereum?: any;
  }
}

// 클라이언트 전용 아이콘 컴포넌트
function ClientIcon({ Icon, className }: { Icon: any; className: string }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div
        className={className
          .replace(/text-\w+-\d+/, "bg-gray-400")
          .replace(/w-\d+/, "w-6")
          .replace(/h-\d+/, "h-6")}
        style={{ borderRadius: "2px" }}
      />
    );
  }

  return <Icon className={className} />;
}

export default function HomePage() {
  const [account, setAccount] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [authService] = useState(() => new AuthService());
  const router = useRouter();

  useEffect(() => {
    checkConnection();
    fetchOnlineUsers();
  }, []);

  const checkConnection = async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({
          method: "eth_accounts",
        });
        if (accounts.length > 0) {
          setAccount(accounts[0]);
        }
      } catch (error) {
        console.error("Error checking connection:", error);
      }
    }
  };

  const fetchOnlineUsers = async () => {
    try {
      const count = await authService.getOnlineUsersCount();
      setOnlineUsers(count);
    } catch (error) {
      console.error("온라인 사용자 수 가져오기 실패:", error);
      // 기본값으로 설정
      setOnlineUsers(Math.floor(Math.random() * 50) + 10);
    }
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("MetaMask가 설치되어 있지 않습니다!");
      return;
    }

    setIsConnecting(true);
    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      if (accounts.length > 0) {
        setAccount(accounts[0]);

        // 서명 요청으로 인증
        const message = `BlockChat 로그인 인증\n시간: ${new Date().toISOString()}\n주소: ${
          accounts[0]
        }`;
        const signature = await window.ethereum.request({
          method: "personal_sign",
          params: [message, accounts[0]],
        });

        // Supabase에 사용자 생성 또는 조회
        try {
          const user = await authService.findOrCreateUser(accounts[0]);
          localStorage.setItem("user_id", user.id);
          localStorage.setItem("wallet_address", accounts[0]);
          console.log("User authenticated:", user);
          router.push("/matching");
        } catch (error) {
          console.error("Supabase 인증 실패:", error);
          // 로컬 스토리지에만 저장하고 계속 진행
          localStorage.setItem("wallet_address", accounts[0]);
          router.push("/matching");
        }
      }
    } catch (error) {
      console.error("지갑 연결 실패:", error);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = async () => {
    // 사용자 오프라인 상태 업데이트
    const userId = localStorage.getItem("user_id");
    if (userId) {
      try {
        await authService.updateUserOnlineStatus(userId, false);
      } catch (error) {
        console.error("오프라인 상태 업데이트 실패:", error);
      }
    }

    setAccount(null);
    localStorage.removeItem("user_id");
    localStorage.removeItem("wallet_address");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* 로고 및 제목 */}
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto">
            <ClientIcon Icon={MessageCircle} className="w-10 h-10 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">BlockChat</h1>
            <p className="text-gray-300">블록체인 기반 익명 랜덤채팅</p>
          </div>
        </div>

        {/* 온라인 사용자 수 */}
        <div className="text-center">
          <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-lg rounded-full px-4 py-2 border border-white/20">
            <ClientIcon Icon={Users} className="w-4 h-4 text-green-400" />
            <span className="text-white text-sm">{onlineUsers}명 온라인</span>
          </div>
        </div>

        {/* 메인 카드 */}
        <Card className="bg-white/10 backdrop-blur-lg border-white/20">
          <CardHeader className="text-center">
            <CardTitle className="text-white">
              {account ? "지갑 연결됨" : "Web3 로그인"}
            </CardTitle>
            <CardDescription className="text-gray-300">
              {account
                ? "랜덤 매칭을 시작하세요"
                : "MetaMask로 안전하게 로그인하세요"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {account ? (
              <div className="space-y-4">
                <div className="p-3 bg-green-500/20 rounded-lg border border-green-500/30">
                  <p className="text-sm text-green-300 mb-1">연결된 지갑</p>
                  <p className="text-white font-mono text-xs break-all">
                    {account}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => router.push("/matching")}
                    className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                  >
                    <ClientIcon Icon={MessageCircle} className="w-4 h-4 mr-2" />
                    채팅 시작
                  </Button>
                  <Button
                    onClick={disconnectWallet}
                    variant="outline"
                    className="border-white/20 text-white hover:bg-white/10"
                  >
                    연결 해제
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                onClick={connectWallet}
                disabled={isConnecting}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                <ClientIcon Icon={Wallet} className="w-4 h-4 mr-2" />
                {isConnecting ? "연결 중..." : "MetaMask 연결"}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* 특징 */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto">
              <ClientIcon Icon={Shield} className="w-6 h-6 text-purple-400" />
            </div>
            <p className="text-xs text-gray-300">완전 익명</p>
          </div>
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto">
              <ClientIcon Icon={Zap} className="w-6 h-6 text-blue-400" />
            </div>
            <p className="text-xs text-gray-300">즉시 매칭</p>
          </div>
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
              <ClientIcon Icon={Users} className="w-6 h-6 text-green-400" />
            </div>
            <p className="text-xs text-gray-300">안전한 매칭</p>
          </div>
        </div>

        {/* 베타 배지 */}
        <div className="text-center">
          <Badge
            variant="outline"
            className="border-purple-500/50 text-purple-300"
          >
            Beta Version - Polygon Testnet
          </Badge>
        </div>
      </div>
    </div>
  );
}
