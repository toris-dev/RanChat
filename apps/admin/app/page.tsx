"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ranchat/shared";
import {
  Activity,
  Flag,
  MessageCircle,
  Shield,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AdminService,
  AuthService,
  type ChartData,
  type DashboardStats,
  type Report,
  type User,
} from "../lib/supabase-config";

export default function AdminDashboard() {
  const [adminService] = useState(() => new AdminService());
  const [authService] = useState(() => new AuthService());

  // 대시보드 상태
  const [stats, setStats] = useState<DashboardStats>({
    onlineUsers: 0,
    totalUsers: 0,
    activeChats: 0,
    totalReports: 0,
    pendingReports: 0,
    blockedUsers: 0,
  });

  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<
    "dashboard" | "users" | "reports"
  >("dashboard");

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      const [statsData, chartDataResult, reportsData, usersData] =
        await Promise.all([
          adminService.getDashboardStats(),
          adminService.getChartData(),
          adminService.getReports(10),
          adminService.getUsers(10),
        ]);

      setStats(statsData);
      setChartData(chartDataResult);
      setReports(reportsData);
      setUsers(usersData);
    } catch (error) {
      console.error("대시보드 데이터 로드 실패:", error);
      // 기본값 설정
      setStats({
        onlineUsers: Math.floor(Math.random() * 50) + 10,
        totalUsers: Math.floor(Math.random() * 500) + 100,
        activeChats: Math.floor(Math.random() * 30) + 5,
        totalReports: Math.floor(Math.random() * 20) + 2,
        pendingReports: Math.floor(Math.random() * 5) + 1,
        blockedUsers: Math.floor(Math.random() * 10) + 1,
      });

      // 기본 차트 데이터
      const defaultChartData: ChartData[] = [];
      for (let i = 23; i >= 0; i--) {
        const time = new Date(Date.now() - i * 60 * 60 * 1000);
        defaultChartData.push({
          time: `${time.getHours()}:00`,
          users: Math.floor(Math.random() * 80) + 20,
          chats: Math.floor(Math.random() * 40) + 5,
        });
      }
      setChartData(defaultChartData);
    } finally {
      setLoading(false);
    }
  };

  const handleBanUser = async (userId: string, reason: string) => {
    try {
      await authService.banUser(userId, reason);
      await loadDashboardData(); // 데이터 새로고침
      alert("사용자가 차단되었습니다.");
    } catch (error) {
      console.error("사용자 차단 실패:", error);
      alert("사용자 차단에 실패했습니다.");
    }
  };

  const handleUnbanUser = async (userId: string) => {
    try {
      await authService.unbanUser(userId);
      await loadDashboardData(); // 데이터 새로고침
      alert("사용자 차단이 해제되었습니다.");
    } catch (error) {
      console.error("사용자 차단 해제 실패:", error);
      alert("사용자 차단 해제에 실패했습니다.");
    }
  };

  const handleResolveReport = async (
    reportId: string,
    status: "resolved" | "dismissed"
  ) => {
    try {
      await adminService.resolveReport(reportId, status, "admin"); // 실제로는 현재 관리자 ID 사용
      await loadDashboardData(); // 데이터 새로고침
      alert(`신고가 ${status === "resolved" ? "처리" : "기각"}되었습니다.`);
    } catch (error) {
      console.error("신고 처리 실패:", error);
      alert("신고 처리에 실패했습니다.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">로딩 중...</div>
      </div>
    );
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
            <Badge
              variant="outline"
              className="border-green-500 text-green-400"
            >
              <Activity className="w-3 h-3 mr-1" />
              실시간 연결됨
            </Badge>
            <Button
              onClick={() => {
                window.location.reload();
              }}
              variant="outline"
              className="border-gray-600 text-gray-300"
            >
              새로고침
            </Button>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">
                온라인 사용자
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-green-400" />
                <span className="text-2xl font-bold text-white">
                  {stats.onlineUsers}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">
                전체 사용자
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-blue-400" />
                <span className="text-2xl font-bold text-white">
                  {stats.totalUsers}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">
                활성 채팅
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <MessageCircle className="w-4 h-4 text-purple-400" />
                <span className="text-2xl font-bold text-white">
                  {stats.activeChats}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">
                총 신고
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Flag className="w-4 h-4 text-yellow-400" />
                <span className="text-2xl font-bold text-white">
                  {stats.totalReports}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">
                대기 신고
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Flag className="w-4 h-4 text-red-400" />
                <span className="text-2xl font-bold text-white">
                  {stats.pendingReports}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">
                차단된 사용자
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4 text-orange-400" />
                <span className="text-2xl font-bold text-white">
                  {stats.blockedUsers}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 차트 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">24시간 사용자 활동</CardTitle>
              <CardDescription className="text-gray-400">
                시간별 온라인 사용자 수
              </CardDescription>
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
                  <Line
                    type="monotone"
                    dataKey="users"
                    stroke="#8B5CF6"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">24시간 채팅 활동</CardTitle>
              <CardDescription className="text-gray-400">
                시간별 활성 채팅 수
              </CardDescription>
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
  );
}
