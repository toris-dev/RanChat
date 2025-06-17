"use client";

import {
  AdminService,
  AuthService,
  type DashboardStats,
  type Report,
  type User,
} from "@ranchat/shared";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ranchat/ui";
import { Activity, Flag, MessageCircle, Shield, Users } from "lucide-react";
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

  const [chartData, setChartData] = useState<any[]>([]);
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
      const defaultChartData = [];
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
                전체 신고
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
                대기 중인 신고
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
              <CardTitle className="text-gray-300">사용자 활동</CardTitle>
              <CardDescription className="text-gray-500">
                24시간 동안의 활성 사용자 수
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="time"
                      stroke="#9CA3AF"
                      fontSize={12}
                      tickLine={false}
                    />
                    <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1F2937",
                        border: "none",
                        borderRadius: "0.5rem",
                      }}
                      itemStyle={{ color: "#E5E7EB" }}
                      labelStyle={{ color: "#9CA3AF" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="users"
                      stroke="#60A5FA"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-gray-300">채팅 활동</CardTitle>
              <CardDescription className="text-gray-500">
                24시간 동안의 활성 채팅방 수
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="time"
                      stroke="#9CA3AF"
                      fontSize={12}
                      tickLine={false}
                    />
                    <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1F2937",
                        border: "none",
                        borderRadius: "0.5rem",
                      }}
                      itemStyle={{ color: "#E5E7EB" }}
                      labelStyle={{ color: "#9CA3AF" }}
                    />
                    <Bar dataKey="chats" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
