import { AuthService } from "./auth";
import { ChatService } from "./chat";
import type { Database } from "./database.types";
import { supabaseService } from "./supabase";

export type Report = Database["public"]["Tables"]["reports"]["Row"];
export type ReportInsert = Database["public"]["Tables"]["reports"]["Insert"];

export interface DashboardStats {
  onlineUsers: number;
  totalUsers: number;
  activeChats: number;
  totalReports: number;
  pendingReports: number;
  blockedUsers: number;
}

export interface ChartData {
  time: string;
  users: number;
  chats: number;
}

export class AdminService {
  private supabase = supabaseService.getClient();
  private authService = new AuthService();
  private chatService = new ChatService();

  // 대시보드 통계 조회
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      const [
        onlineUsers,
        totalUsers,
        activeChats,
        { totalReports, pendingReports },
        blockedUsers,
      ] = await Promise.all([
        this.authService.getOnlineUsersCount(),
        this.getTotalUsersCount(),
        this.chatService.getActiveChatRoomsCount(),
        this.getReportsStats(),
        this.getBlockedUsersCount(),
      ]);

      return {
        onlineUsers,
        totalUsers,
        activeChats,
        totalReports,
        pendingReports,
        blockedUsers,
      };
    } catch (error) {
      console.error("Error getting dashboard stats:", error);
      throw error;
    }
  }

  // 전체 사용자 수
  async getTotalUsersCount(): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from("users")
        .select("*", { count: "exact", head: true });

      if (error) {
        throw new Error(`Failed to get total users count: ${error.message}`);
      }

      return count || 0;
    } catch (error) {
      console.error("Error getting total users count:", error);
      return 0;
    }
  }

  // 신고 통계
  async getReportsStats(): Promise<{
    totalReports: number;
    pendingReports: number;
  }> {
    try {
      const [totalResult, pendingResult] = await Promise.all([
        this.supabase
          .from("reports")
          .select("*", { count: "exact", head: true }),
        this.supabase
          .from("reports")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending"),
      ]);

      return {
        totalReports: totalResult.count || 0,
        pendingReports: pendingResult.count || 0,
      };
    } catch (error) {
      console.error("Error getting reports stats:", error);
      return { totalReports: 0, pendingReports: 0 };
    }
  }

  // 차단된 사용자 수
  async getBlockedUsersCount(): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("is_banned", true);

      if (error) {
        throw new Error(`Failed to get blocked users count: ${error.message}`);
      }

      return count || 0;
    } catch (error) {
      console.error("Error getting blocked users count:", error);
      return 0;
    }
  }

  // 시간별 활동 데이터 (24시간)
  async getChartData(): Promise<ChartData[]> {
    try {
      // 실제로는 시간별 로그 데이터를 조회해야 하지만,
      // 지금은 임시 데이터를 반환
      const data: ChartData[] = [];
      const now = new Date();

      for (let i = 23; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 60 * 60 * 1000);
        data.push({
          time: `${time.getHours()}:00`,
          users: Math.floor(Math.random() * 80) + 20,
          chats: Math.floor(Math.random() * 40) + 5,
        });
      }

      return data;
    } catch (error) {
      console.error("Error getting chart data:", error);
      return [];
    }
  }

  // 신고 생성
  async createReport(
    reporterId: string,
    reportedUserId: string,
    reason: string,
    description?: string,
    chatRoomId?: string
  ): Promise<Report> {
    try {
      const newReport: ReportInsert = {
        reporter_id: reporterId,
        reported_user_id: reportedUserId,
        reason,
        description,
        chat_room_id: chatRoomId || null,
        status: "pending",
      };

      const { data, error } = await this.supabase
        .from("reports")
        .insert(newReport)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create report: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error("Error creating report:", error);
      throw error;
    }
  }

  // 신고 목록 조회
  async getReports(limit: number = 50, offset: number = 0): Promise<Report[]> {
    try {
      const { data, error } = await this.supabase
        .from("reports")
        .select(
          `
          *,
          reporter:users!reports_reporter_id_fkey(username, wallet_address),
          reported_user:users!reports_reported_user_id_fkey(username, wallet_address)
        `
        )
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Failed to get reports: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error("Error getting reports:", error);
      return [];
    }
  }

  // 신고 처리
  async resolveReport(
    reportId: string,
    status: "resolved" | "dismissed",
    resolvedBy: string
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from("reports")
        .update({
          status,
          resolved_at: new Date().toISOString(),
          resolved_by: resolvedBy,
        })
        .eq("id", reportId);

      if (error) {
        throw new Error(`Failed to resolve report: ${error.message}`);
      }
    } catch (error) {
      console.error("Error resolving report:", error);
      throw error;
    }
  }

  // 사용자 목록 조회
  async getUsers(limit: number = 50, offset: number = 0) {
    try {
      const { data, error } = await this.supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Failed to get users: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error("Error getting users:", error);
      return [];
    }
  }
}
