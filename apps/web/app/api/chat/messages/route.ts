import {
  createApiHandler,
  getPaginationParams,
  supabaseService,
  validateChatRoom,
  validateRequiredFields,
  validateUser,
  type ApiResponse,
} from "@ranchat/shared";
import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";

// Initialize Supabase with environment variables
supabaseService.initialize(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_ANON_KEY || ""
);

// Send message
export const POST = createApiHandler(
  async (req: NextRequest): Promise<ApiResponse> => {
    const { roomId, walletAddress, content } = await req.json();

    // Validate required fields
    const validationError = validateRequiredFields(
      { roomId, walletAddress, content },
      ["roomId", "walletAddress", "content"]
    );
    if (validationError) return validationError;

    // Validate user and chat room
    const user = await validateUser(walletAddress);
    const room = await validateChatRoom(roomId, user.id);

    const client = supabaseService.getClient();
    const messageId = uuidv4();

    // Save message
    const { error: insertError } = await client.from("messages").insert({
      id: messageId,
      chat_room_id: room.id,
      content,
      sender_id: user.id,
      message_type: "text",
      is_deleted: false,
    });

    if (insertError) {
      return {
        error: "Failed to save message",
        statusCode: 500,
      };
    }

    // Update room's last message time
    await client
      .from("chat_rooms")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", room.id);

    // Get saved message
    const { data: savedMessage } = await client
      .from("messages")
      .select("*")
      .eq("id", messageId)
      .single();

    return {
      data: { message: savedMessage },
      statusCode: 200,
    };
  }
);

// Get messages
export const GET = createApiHandler(
  async (req: NextRequest): Promise<ApiResponse> => {
    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get("roomId");
    const walletAddress = searchParams.get("wallet");

    if (!roomId || !walletAddress) {
      return {
        error: "Missing required parameters: roomId and wallet",
        statusCode: 400,
      };
    }

    const { limit, offset } = getPaginationParams(req);

    // Validate user and chat room
    const user = await validateUser(walletAddress);
    const room = await validateChatRoom(roomId, user.id);

    const client = supabaseService.getClient();

    // Get messages
    const { data: messages, error: messagesError } = await client
      .from("messages")
      .select("*")
      .eq("chat_room_id", room.id)
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);

    if (messagesError) {
      return {
        error: "Failed to fetch messages",
        statusCode: 500,
      };
    }

    // Get partner info
    const partnerId = room.user1_id === user.id ? room.user2_id : room.user1_id;
    const { data: partner } = await client
      .from("users")
      .select("id, username, wallet_address")
      .eq("id", partnerId)
      .single();

    return {
      data: {
        messages: messages || [],
        roomInfo: {
          id: room.id,
          partner: partner || null,
          createdAt: room.created_at,
        },
      },
      statusCode: 200,
    };
  }
);
