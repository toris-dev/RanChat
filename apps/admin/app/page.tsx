"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@blockchat/shared/components/ui/card"
import { Badge } from "@blockchat/shared/components/ui/badge"
import { Button } from "@blockchat/shared/components/ui/button"
import { Input } from "@blockchat/shared/components/ui/input"
import { Users, MessageCircle, Flag, Shield, Activity, TrendingUp } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts"

interface DashboardStats {
  onlineUsers: number
  totalUsers: number
  activeChats: number
  totalReports: number
  pendingReports: number
  blockedUsers: number
}

interface ChartData {
  time: string
  users: number
  chats: number
}

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [adminPassword, setAdminPassword] = useState("")
  const [stats, setStats] = useState<DashboardStats>({
    onlineUsers: 0,
    totalUsers: 0,
    activeChats: 0,
    totalReports: 0,
    pendingReports: 0,
    blockedUsers: 0,
  })
  const [chartData, setChartData] = useState<ChartData[]>([])

  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboardData()
      const interval = setInterval(fetchDashboardData, 30000) // 30초마다 업데이트
      return () => clearInterval(interval)
    }
  }, [isAuthenticated])

  const handleLogin = async () => {
    if (adminPassword === "admin123") {
      // 실제로는 서버에서 검증
      setIsAuthenticated(true)
      localStorage.setItem("admin_auth", "true")
    } else {
      alert("잘못된 비밀번호입니다.")
    }
  }

  const fetchDashboardData = async () => {
    try {
      // 실제 API 호출
      const response = await fetch("/api/admin/dashboard")
      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
        setChartData(data.chartData)
      } else {
        // 임시 데이터
        setStats({
          onlineUsers: Math.floor(Math.random() * 100) + 20,
          totalUsers: 1250,
          activeChats: Math.floor(Math.random() * 50) + 10,
          totalReports: 45,
          pendingReports: 8,
          blockedUsers: 12,
        })

        // 임시 차트 데이터
        const now = new Date()
        const tempData = Array.from({ length: 24 }, (_, i) => ({
          time: `${23 - i}:00`,
          users: Math.floor(Math.random() * 80) + 20,
          chats: Math.floor(Math.random() * 40) + 5,
        })).reverse()
        setChartData(tempData)
      }
    } catch (error) {
      console.error("대시보드 데이터 로드 실패:", error)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-gray-800 border-gray-700">
          <CardHeader className="text-center">
            <CardTitle className="text-white">관리자 로그인</CardTitle>
            <CardDescription className="text-gray-400">BlockChat 관리자 대시보드</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="password"
              placeholder="관리자 비밀번호"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleLogin()}
              className="bg-gray-700 border-gray-600 text-white"
            />
            <Button onClick={handleLogin} className="w-full bg-blue-600 hover:bg-blue-700">
              로그인
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">BlockChat 관리자</h1>
            <p className="text-gray-400">실시간 모니터링 대시보드</p>
          </div>
          <div className="flex items-center space-x-4">
            <Badge variant="outline" className="border-green-500 text-green-400">
              <Activity className="w-3 h-3 mr-1" />
              실시간 연결됨
            </Badge>
            <Button
              onClick={() => {
                setIsAuthenticated(false)
                localStorage.removeItem("admin_auth")
              }}
              variant="outline"
              className="border-gray-600 text-gray-300"
            >
              로그아웃
            </Button>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">온라인 사용자</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-green-400" />
                <span className="text-2xl font-bold text-white">{stats.onlineUsers}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">전체 사용자</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-blue-400" />
                <span className="text-2xl font-bold text-white">{stats.totalUsers}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">활성 채팅</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <MessageCircle className="w-4 h-4 text-purple-400" />
                <span className="text-2xl font-bold text-white">{stats.activeChats}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">총 신고</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Flag className="w-4 h-4 text-yellow-400" />
                <span className="text-2xl font-bold text-white">{stats.totalReports}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">대기 신고</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Flag className="w-4 h-4 text-red-400" />
                <span className="text-2xl font-bold text-white">{stats.pendingReports}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">차단된 사용자</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4 text-orange-400" />
                <span className="text-2xl font-bold text-white">{stats.blockedUsers}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 차트 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">24시간 사용자 활동</CardTitle>
              <CardDescription className="text-gray-400">시간별 온라인 사용자 수</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="time" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1F2937",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                    }}
                  />
                  <Line type="monotone" dataKey="users" stroke="#8B5CF6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">24시간 채팅 활동</CardTitle>
              <CardDescription className="text-gray-400">시간별 활성 채팅 수</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="time" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1F2937",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="chats" fill="#EC4899" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* 빠른 액션 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Button className="h-20 bg-blue-600 hover:bg-blue-700 flex flex-col items-center justify-center">
            <Users className="w-6 h-6 mb-2" />
            사용자 관리
          </Button>
          <Button className="h-20 bg-purple-600 hover:bg-purple-700 flex flex-col items-center justify-center">
            <MessageCircle className="w-6 h-6 mb-2" />
            채팅방 모니터링
          </Button>
          <Button className="h-20 bg-red-600 hover:bg-red-700 flex flex-col items-center justify-center">
            <Flag className="w-6 h-6 mb-2" />
            신고 관리
          </Button>
          <Button className="h-20 bg-green-600 hover:bg-green-700 flex flex-col items-center justify-center">
            <TrendingUp className="w-6 h-6 mb-2" />
            통계 보고서
          </Button>
        </div>
      </div>
    </div>
  )
}
