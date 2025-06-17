import type { Database } from "./database.types";
import { supabaseService } from "./supabase";

export type ChatRoom = Database["public"]["Tables"]["chat_rooms"]["Row"];
export type ChatRoomInsert =
  Database["public"]["Tables"]["chat_rooms"]["Insert"];
export type Message = Database["public"]["Tables"]["messages"]["Row"];
export type MessageInsert = Database["public"]["Tables"]["messages"]["Insert"];

export class ChatService {
  private supabase = supabaseService.getClient();

  // 새 채팅방 생성
  async createChatRoom(user1Id: string, user2Id: string): Promise<ChatRoom> {
    try {
      const newRoom: ChatRoomInsert = {
        user1_id: user1Id,
        user2_id: user2Id,
        status: "active",
      };

      const { data, error } = await this.supabase
        .from("chat_rooms")
        .insert(newRoom)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create chat room: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error("Error creating chat room:", error);
      throw error;
    }
  }

  // 채팅방 조회
  async getChatRoom(roomId: string): Promise<ChatRoom | null> {
    try {
      const { data, error } = await this.supabase
        .from("chat_rooms")
        .select("*")
        .eq("id", roomId)
        .single();

      if (error && error.code !== "PGRST116") {
        throw new Error(`Failed to get chat room: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error("Error getting chat room:", error);
      return null;
    }
  }

  // 사용자의 활성 채팅방 찾기
  async getActiveRoomForUser(userId: string): Promise<ChatRoom | null> {
    try {
      const { data, error } = await this.supabase
        .from("chat_rooms")
        .select("*")
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") {
        throw new Error(`Failed to get active room: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error("Error getting active room:", error);
      return null;
    }
  }

  // 메시지 전송
  async sendMessage(
    chatRoomId: string,
    senderId: string,
    content: string
  ): Promise<Message> {
    try {
      const newMessage: MessageInsert = {
        chat_room_id: chatRoomId,
        sender_id: senderId,
        content,
        message_type: "text",
      };

      const { data, error } = await this.supabase
        .from("messages")
        .insert(newMessage)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to send message: ${error.message}`);
      }

      // 채팅방 마지막 메시지 시간 업데이트
      await this.updateRoomLastMessage(chatRoomId);

      return data;
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  }

  // 채팅방의 메시지들 조회
  async getMessages(
    chatRoomId: string,
    limit: number = 50
  ): Promise<Message[]> {
    try {
      const { data, error } = await this.supabase
        .from("messages")
        .select("*")
        .eq("chat_room_id", chatRoomId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Failed to get messages: ${error.message}`);
      }

      return data.reverse(); // 오래된 순으로 정렬
    } catch (error) {
      console.error("Error getting messages:", error);
      return [];
    }
  }

  // 채팅방 종료
  async endChatRoom(roomId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from("chat_rooms")
        .update({
          status: "ended",
          ended_at: new Date().toISOString(),
        })
        .eq("id", roomId);

      if (error) {
        throw new Error(`Failed to end chat room: ${error.message}`);
      }
    } catch (error) {
      console.error("Error ending chat room:", error);
      throw error;
    }
  }

  // 채팅방 마지막 메시지 시간 업데이트
  private async updateRoomLastMessage(roomId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from("chat_rooms")
        .update({
          last_message_at: new Date().toISOString(),
        })
        .eq("id", roomId);

      if (error) {
        console.error("Failed to update room last message:", error);
      }
    } catch (error) {
      console.error("Error updating room last message:", error);
    }
  }

  // 활성 채팅방 수 조회
  async getActiveChatRoomsCount(): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from("chat_rooms")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      if (error) {
        throw new Error(
          `Failed to get active chat rooms count: ${error.message}`
        );
      }

      return count || 0;
    } catch (error) {
      console.error("Error getting active chat rooms count:", error);
      return 0;
    }
  }
}
