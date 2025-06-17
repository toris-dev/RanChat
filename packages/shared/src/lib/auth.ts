import type { Database } from "./database.types";
import { supabaseService } from "./supabase";

export type User = Database["public"]["Tables"]["users"]["Row"];
export type UserInsert = Database["public"]["Tables"]["users"]["Insert"];
export type UserUpdate = Database["public"]["Tables"]["users"]["Update"];

export class AuthService {
  private supabase = supabaseService.getClient();

  // 지갑 주소로 사용자 찾기 또는 생성
  async findOrCreateUser(walletAddress: string): Promise<User> {
    try {
      // 먼저 사용자 찾기
      const { data: existingUser, error: findError } = await this.supabase
        .from("users")
        .select("*")
        .eq("wallet_address", walletAddress)
        .single();

      if (existingUser && !findError) {
        // 마지막 접속 시간 업데이트
        await this.updateUserOnlineStatus(existingUser.id, true);
        return existingUser;
      }

      // 사용자가 없으면 새로 생성
      const newUser: UserInsert = {
        wallet_address: walletAddress,
        username: `User_${walletAddress.slice(-6)}`,
        is_online: true,
        last_seen: new Date().toISOString(),
      };

      const { data: createdUser, error: createError } = await this.supabase
        .from("users")
        .insert(newUser)
        .select()
        .single();

      if (createError) {
        throw new Error(`Failed to create user: ${createError.message}`);
      }

      return createdUser;
    } catch (error) {
      console.error("Error in findOrCreateUser:", error);
      throw error;
    }
  }

  // 사용자 온라인 상태 업데이트
  async updateUserOnlineStatus(
    userId: string,
    isOnline: boolean
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from("users")
        .update({
          is_online: isOnline,
          last_seen: new Date().toISOString(),
        })
        .eq("id", userId);

      if (error) {
        throw new Error(`Failed to update user status: ${error.message}`);
      }
    } catch (error) {
      console.error("Error updating user status:", error);
      throw error;
    }
  }

  // 사용자 정보 조회
  async getUser(userId: string): Promise<User | null> {
    try {
      const { data, error } = await this.supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      if (error && error.code !== "PGRST116") {
        throw new Error(`Failed to get user: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error("Error getting user:", error);
      return null;
    }
  }

  // 온라인 사용자 수 조회
  async getOnlineUsersCount(): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("is_online", true)
        .eq("is_banned", false);

      if (error) {
        throw new Error(`Failed to get online users count: ${error.message}`);
      }

      return count || 0;
    } catch (error) {
      console.error("Error getting online users count:", error);
      return 0;
    }
  }

  // 사용자 차단
  async banUser(
    userId: string,
    reason: string,
    expiresAt?: string
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from("users")
        .update({
          is_banned: true,
          ban_reason: reason,
          ban_expires_at: expiresAt || null,
        })
        .eq("id", userId);

      if (error) {
        throw new Error(`Failed to ban user: ${error.message}`);
      }
    } catch (error) {
      console.error("Error banning user:", error);
      throw error;
    }
  }

  // 사용자 차단 해제
  async unbanUser(userId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from("users")
        .update({
          is_banned: false,
          ban_reason: null,
          ban_expires_at: null,
        })
        .eq("id", userId);

      if (error) {
        throw new Error(`Failed to unban user: ${error.message}`);
      }
    } catch (error) {
      console.error("Error unbanning user:", error);
      throw error;
    }
  }
}
