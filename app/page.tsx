"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Wallet, MessageCircle, Shield, Zap } from "lucide-react"
import { useRouter } from "next/navigation"

declare global {
  interface Window {
    ethereum?: any
  }
}

export default function HomePage() {
  const [account, setAccount] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const router = useRouter()

  useEffect(() => {
    checkConnection()
  }, [])

  const checkConnection = async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: "eth_accounts" })
        if (accounts.length > 0) {
          setAccount(accounts[0])
        }
      } catch (error) {
        console.error("Error checking connection:", error)
      }
    }
  }

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("MetaMask가 설치되어 있지 않습니다!")
      return
    }

    setIsConnecting(true)
    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      })

      if (accounts.length > 0) {
        setAccount(accounts[0])

        // 서명 요청으로 인증
        const message = `BlockChat 로그인 인증\n시간: ${new Date().toISOString()}`
        const signature = await window.ethereum.request({
          method: "personal_sign",
          params: [message, accounts[0]],
        })

        // 서버에 인증 정보 전송
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address: accounts[0],
            message,
            signature,
          }),
        })

        if (response.ok) {
          const { token } = await response.json()
          localStorage.setItem("auth_token", token)
          router.push("/matching")
        }
      }
    } catch (error) {
      console.error("지갑 연결 실패:", error)
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnectWallet = () => {
    setAccount(null)
    localStorage.removeItem("auth_token")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* 로고 및 제목 */}
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto">
            <MessageCircle className="w-10 h-10 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">BlockChat</h1>
            <p className="text-gray-300">블록체인 기반 익명 랜덤채팅</p>
          </div>
        </div>

        {/* 메인 카드 */}
        <Card className="bg-white/10 backdrop-blur-lg border-white/20">
          <CardHeader className="text-center">
            <CardTitle className="text-white">{account ? "지갑 연결됨" : "Web3 로그인"}</CardTitle>
            <CardDescription className="text-gray-300">
              {account ? "랜덤 매칭을 시작하세요" : "MetaMask로 안전하게 로그인하세요"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {account ? (
              <div className="space-y-4">
                <div className="p-3 bg-green-500/20 rounded-lg border border-green-500/30">
                  <p className="text-sm text-green-300 mb-1">연결된 지갑</p>
                  <p className="text-white font-mono text-xs break-all">{account}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => router.push("/matching")}
                    className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
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
                <Wallet className="w-4 h-4 mr-2" />
                {isConnecting ? "연결 중..." : "MetaMask 연결"}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* 특징 */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto">
              <Shield className="w-6 h-6 text-purple-400" />
            </div>
            <p className="text-xs text-gray-300">완전 익명</p>
          </div>
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto">
              <Zap className="w-6 h-6 text-blue-400" />
            </div>
            <p className="text-xs text-gray-300">즉시 매칭</p>
          </div>
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
              <MessageCircle className="w-6 h-6 text-green-400" />
            </div>
            <p className="text-xs text-gray-300">실시간 채팅</p>
          </div>
        </div>

        {/* 베타 배지 */}
        <div className="text-center">
          <Badge variant="outline" className="border-purple-500/50 text-purple-300">
            Beta Version - Polygon Testnet
          </Badge>
        </div>
      </div>
    </div>
  )
}
