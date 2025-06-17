/**
 * @deprecated This WebSocket server has been migrated to Next.js API routes.
 * Please use the API endpoints in apps/web/app/api/chat/ instead.
 * See apps/web/app/api/chat/README.md for migration guide.
 */

const WebSocket = require("ws");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { createClient } = require("@supabase/supabase-js");

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const PORT = process.env.PORT || 3003;
const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://placeholder.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder";

// Supabase 클라이언트 초기화
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 사용자 및 방 관리
const connectedUsers = new Map(); // userId -> { ws, roomId, lastActivity, walletAddress }
const waitingUsers = new Set(); // 매칭 대기 중인 사용자들
const chatRooms = new Map(); // roomId -> { user1, user2, messages, createdAt }
const blockedPairs = new Set(); // 차단된 사용자 쌍
const adminConnections = new Set(); // 관리자 연결들

// 통계 데이터
const stats = {
  totalConnections: 0,
  totalMatches: 0,
  totalMessages: 0,
  reports: [],
};

const wss = new WebSocket.Server({
  port: PORT,
  verifyClient: (info) => {
    const url = new URL(info.req.url, "http://localhost");
    const token = url.searchParams.get("token");

    if (!token) return false;

    try {
      // 간단한 토큰 검증 (실제로는 더 강화된 검증 필요)
      return true;
    } catch (error) {
      return false;
    }
  },
});

console.log(`WebSocket 서버 시작: 포트 ${PORT}`);

wss.on("connection", async (ws, req) => {
  const url = new URL(req.url, "http://localhost");
  const token = url.searchParams.get("token");
  const roomId = url.searchParams.get("roomId");
  const isAdmin = url.searchParams.get("admin") === "true";
  const walletAddress = url.searchParams.get("wallet");

  let userId = walletAddress || `user_${Date.now()}`;

  if (isAdmin) {
    adminConnections.add(ws);
    console.log("관리자 연결됨");
    sendAdminUpdate();
  } else {
    // 사용자 온라인 상태 업데이트
    try {
      await updateUserOnlineStatus(userId, true);
    } catch (error) {
      console.error("사용자 온라인 상태 업데이트 실패:", error);
    }

    connectedUsers.set(userId, {
      ws,
      roomId: roomId || null,
      lastActivity: Date.now(),
      walletAddress: walletAddress,
    });
    stats.totalConnections++;
    console.log(`사용자 연결: ${userId}`);
  }

  // 새 연결에게 즉시 온라인 사용자 수 전송
  if (!isAdmin && ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: "online_count",
        count: connectedUsers.size,
      })
    );
  }

  // 온라인 사용자 수 브로드캐스트
  broadcastOnlineCount();

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());
      if (isAdmin) {
        handleAdminMessage(ws, message);
      } else {
        handleUserMessage(ws, userId, message);
      }
    } catch (error) {
      console.error("메시지 파싱 오류:", error);
    }
  });

  ws.on("close", async () => {
    if (isAdmin) {
      adminConnections.delete(ws);
      console.log("관리자 연결 해제");
    } else {
      const userInfo = connectedUsers.get(userId);
      if (userInfo) {
        // 사용자 오프라인 상태 업데이트
        try {
          await updateUserOnlineStatus(userId, false);
        } catch (error) {
          console.error("사용자 오프라인 상태 업데이트 실패:", error);
        }

        connectedUsers.delete(userId);
        waitingUsers.delete(userId);

        // 채팅방에서 사용자 제거
        if (userInfo.roomId) {
          await handleUserLeave(userId, userInfo.roomId);
        }

        console.log(`사용자 연결 해제: ${userId}`);
      }
    }

    broadcastOnlineCount();
    sendAdminUpdate();
  });

  // 기존 채팅방 참여
  if (roomId && !isAdmin) {
    await joinChatRoom(userId, roomId);
  }
});

async function updateUserOnlineStatus(userId, isOnline) {
  try {
    const { error } = await supabase.from("users").upsert(
      {
        wallet_address: userId,
        is_online: isOnline,
        last_seen: new Date().toISOString(),
      },
      {
        onConflict: "wallet_address",
      }
    );

    if (error) {
      console.error("사용자 상태 업데이트 오류:", error);
    }
  } catch (error) {
    console.error("Supabase 연결 오류:", error);
  }
}

function handleUserMessage(ws, userId, message) {
  const userInfo = connectedUsers.get(userId);
  if (!userInfo) return;

  userInfo.lastActivity = Date.now();

  switch (message.type) {
    case "find_match":
      findMatch(userId);
      break;

    case "cancel_match":
      waitingUsers.delete(userId);
      ws.send(
        JSON.stringify({
          type: "match_cancelled",
        })
      );
      break;

    case "send_message":
      sendChatMessage(userId, message.content, message.roomId);
      break;

    case "leave_room":
      handleUserLeave(userId, message.roomId);
      break;

    case "block_user":
      blockUser(userId, message.roomId);
      break;

    case "report_user":
      handleReport(userId, message);
      break;
  }
}

function handleAdminMessage(ws, message) {
  switch (message.type) {
    case "get_stats":
      sendAdminStats(ws);
      break;

    case "disconnect_user":
      disconnectUser(message.userId);
      break;

    case "ban_user":
      banUser(message.userId, message.duration);
      break;

    case "get_chat_logs":
      sendChatLogs(ws, message.roomId);
      break;
  }
}

async function findMatch(userId) {
  waitingUsers.add(userId);

  const userWs = connectedUsers.get(userId)?.ws;
  if (!userWs) return;

  // 매칭 시작 알림
  userWs.send(
    JSON.stringify({
      type: "matching_started",
    })
  );

  // 다른 대기 중인 사용자 찾기
  for (const waitingUserId of waitingUsers) {
    if (waitingUserId !== userId) {
      // 차단된 사용자인지 확인
      const blockedKey1 = `${userId}-${waitingUserId}`;
      const blockedKey2 = `${waitingUserId}-${userId}`;

      if (!blockedPairs.has(blockedKey1) && !blockedPairs.has(blockedKey2)) {
        // 매칭 성공!
        await createMatch(userId, waitingUserId);
        return;
      }
    }
  }

  // 매칭 대상이 없는 경우 대기
  console.log(`사용자 ${userId} 매칭 대기 중...`);
}

async function createMatch(user1Id, user2Id) {
  try {
    // 대기 목록에서 제거
    waitingUsers.delete(user1Id);
    waitingUsers.delete(user2Id);

    // 채팅방 생성
    const roomId = uuidv4();
    const { data: chatRoom, error } = await supabase
      .from("chat_rooms")
      .insert({
        id: roomId,
        user1_id: user1Id,
        user2_id: user2Id,
        status: "active",
        created_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("채팅방 생성 오류:", error);
      return;
    }

    // 사용자들 WebSocket 연결
    const user1Ws = connectedUsers.get(user1Id)?.ws;
    const user2Ws = connectedUsers.get(user2Id)?.ws;

    if (user1Ws && user2Ws) {
      // 매칭 성공 알림
      const matchData = {
        type: "match_found",
        roomId: roomId,
        partnerId: user2Id,
      };

      user1Ws.send(
        JSON.stringify({
          ...matchData,
          partnerId: user2Id,
        })
      );

      user2Ws.send(
        JSON.stringify({
          ...matchData,
          partnerId: user1Id,
        })
      );

      // 채팅방 정보 업데이트
      connectedUsers.get(user1Id).roomId = roomId;
      connectedUsers.get(user2Id).roomId = roomId;

      stats.totalMatches++;
      console.log(`매칭 성공: ${user1Id} - ${user2Id}, 방 ID: ${roomId}`);
    }
  } catch (error) {
    console.error("매칭 생성 오류:", error);
  }
}

async function joinChatRoom(userId, roomId) {
  try {
    // 채팅방 정보 조회
    const { data: chatRoom, error } = await supabase
      .from("chat_rooms")
      .select("*")
      .eq("id", roomId)
      .single();

    if (error || !chatRoom) {
      console.error("채팅방 조회 오류:", error);
      return;
    }

    // 사용자가 해당 채팅방의 참여자인지 확인
    if (chatRoom.user1_id !== userId && chatRoom.user2_id !== userId) {
      console.error("권한이 없는 채팅방 접근 시도:", userId, roomId);
      return;
    }

    // 상대방에게 입장 알림
    const partnerId =
      chatRoom.user1_id === userId ? chatRoom.user2_id : chatRoom.user1_id;
    const partnerWs = connectedUsers.get(partnerId)?.ws;

    if (partnerWs) {
      partnerWs.send(
        JSON.stringify({
          type: "partner_joined",
          userId: userId,
        })
      );
    }

    // 기존 메시지 전송
    const { data: messages } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_room_id", roomId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: true })
      .limit(50);

    const userWs = connectedUsers.get(userId)?.ws;
    if (userWs && messages) {
      userWs.send(
        JSON.stringify({
          type: "chat_history",
          messages: messages.map((msg) => ({
            id: msg.id,
            content: msg.content,
            sender: msg.sender_id === userId ? "me" : "other",
            timestamp: msg.created_at,
            type: msg.message_type,
          })),
        })
      );
    }

    console.log(`사용자 ${userId}가 채팅방 ${roomId}에 입장`);
  } catch (error) {
    console.error("채팅방 입장 오류:", error);
  }
}

async function sendChatMessage(userId, content, roomId) {
  try {
    if (!content?.trim() || !roomId) return;

    // 메시지 저장
    const { data: message, error } = await supabase
      .from("messages")
      .insert({
        chat_room_id: roomId,
        sender_id: userId,
        content: content.trim(),
        message_type: "text",
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("메시지 저장 오류:", error);
      return;
    }

    // 채팅방 last_message_at 업데이트
    await supabase
      .from("chat_rooms")
      .update({
        last_message_at: new Date().toISOString(),
      })
      .eq("id", roomId);

    // 채팅방 참여자들에게 메시지 전송
    const { data: chatRoom } = await supabase
      .from("chat_rooms")
      .select("user1_id, user2_id")
      .eq("id", roomId)
      .single();

    if (chatRoom) {
      const users = [chatRoom.user1_id, chatRoom.user2_id];

      users.forEach((recipientId) => {
        const userWs = connectedUsers.get(recipientId)?.ws;
        if (userWs) {
          userWs.send(
            JSON.stringify({
              type: "message",
              id: message.id,
              content: content.trim(),
              sender: recipientId === userId ? "me" : "other",
              timestamp: message.created_at,
              roomId: roomId,
            })
          );
        }
      });
    }

    stats.totalMessages++;
    console.log(`메시지 전송: ${userId} -> ${roomId}`);
  } catch (error) {
    console.error("메시지 전송 오류:", error);
  }
}

async function handleUserLeave(userId, roomId) {
  try {
    // 채팅방 상태 업데이트
    await supabase
      .from("chat_rooms")
      .update({
        status: "ended",
        ended_at: new Date().toISOString(),
      })
      .eq("id", roomId);

    // 상대방에게 알림
    const { data: chatRoom } = await supabase
      .from("chat_rooms")
      .select("user1_id, user2_id")
      .eq("id", roomId)
      .single();

    if (chatRoom) {
      const partnerId =
        chatRoom.user1_id === userId ? chatRoom.user2_id : chatRoom.user1_id;
      const partnerWs = connectedUsers.get(partnerId)?.ws;

      if (partnerWs) {
        partnerWs.send(
          JSON.stringify({
            type: "partner_left",
            userId: userId,
          })
        );
      }
    }

    // 사용자 정보에서 roomId 제거
    const userInfo = connectedUsers.get(userId);
    if (userInfo) {
      userInfo.roomId = null;
    }

    console.log(`사용자 ${userId}가 채팅방 ${roomId}를 떠남`);
  } catch (error) {
    console.error("사용자 퇴장 처리 오류:", error);
  }
}

async function blockUser(userId, roomId) {
  try {
    // 채팅방 정보 조회
    const { data: chatRoom } = await supabase
      .from("chat_rooms")
      .select("user1_id, user2_id")
      .eq("id", roomId)
      .single();

    if (chatRoom) {
      const partnerId =
        chatRoom.user1_id === userId ? chatRoom.user2_id : chatRoom.user1_id;

      // 차단 목록에 추가
      blockedPairs.add(`${userId}-${partnerId}`);
      blockedPairs.add(`${partnerId}-${userId}`);

      // 상대방에게 차단 알림
      const partnerWs = connectedUsers.get(partnerId)?.ws;
      if (partnerWs) {
        partnerWs.send(
          JSON.stringify({
            type: "blocked_by_partner",
            userId: userId,
          })
        );
      }

      // 채팅방 종료
      await handleUserLeave(userId, roomId);

      console.log(`사용자 차단: ${userId} -> ${partnerId}`);
    }
  } catch (error) {
    console.error("사용자 차단 오류:", error);
  }
}

async function handleReport(reporterId, reportData) {
  try {
    const { data: report, error } = await supabase.from("reports").insert({
      reporter_id: reporterId,
      reported_user_id: reportData.reportedUserId,
      chat_room_id: reportData.roomId,
      reason: reportData.reason,
      description: reportData.description,
      status: "pending",
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("신고 저장 오류:", error);
      return;
    }

    // 관리자들에게 알림
    broadcastToAdmins({
      type: "new_report",
      report: {
        id: report.id,
        reporter_id: reporterId,
        reported_user_id: reportData.reportedUserId,
        reason: reportData.reason,
        description: reportData.description,
        created_at: new Date().toISOString(),
      },
    });

    stats.reports.push({
      id: report.id,
      timestamp: Date.now(),
      reason: reportData.reason,
    });

    console.log(`신고 접수: ${reporterId} -> ${reportData.reportedUserId}`);
  } catch (error) {
    console.error("신고 처리 오류:", error);
  }
}

function disconnectUser(userId) {
  const userWs = connectedUsers.get(userId)?.ws;
  if (userWs) {
    userWs.close();
  }
}

function banUser(userId, duration) {
  // 사용자 차단 처리
  disconnectUser(userId);
  console.log(`사용자 밴: ${userId}, 기간: ${duration}`);
}

function broadcastOnlineCount() {
  const onlineCount = connectedUsers.size;
  const message = JSON.stringify({
    type: "online_count",
    count: onlineCount,
  });

  connectedUsers.forEach(({ ws }) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

function sendAdminUpdate() {
  const adminData = {
    type: "admin_update",
    stats: {
      ...stats,
      onlineUsers: connectedUsers.size,
      waitingUsers: waitingUsers.size,
    },
  };

  broadcastToAdmins(adminData);
}

function sendAdminStats(ws) {
  ws.send(
    JSON.stringify({
      type: "stats",
      data: {
        ...stats,
        onlineUsers: connectedUsers.size,
        waitingUsers: waitingUsers.size,
      },
    })
  );
}

function sendChatLogs(ws, roomId) {
  // 채팅 로그 조회 및 전송 (관리자용)
  supabase
    .from("messages")
    .select("*")
    .eq("chat_room_id", roomId)
    .order("created_at", { ascending: true })
    .then(({ data, error }) => {
      if (error) {
        console.error("채팅 로그 조회 오류:", error);
        return;
      }

      ws.send(
        JSON.stringify({
          type: "chat_logs",
          roomId: roomId,
          messages: data,
        })
      );
    });
}

function broadcastToAdmins(data) {
  const message = JSON.stringify(data);
  adminConnections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

// 주기적으로 비활성 사용자 정리
setInterval(() => {
  const now = Date.now();
  const TIMEOUT = 5 * 60 * 1000; // 5분

  connectedUsers.forEach((userInfo, userId) => {
    if (now - userInfo.lastActivity > TIMEOUT) {
      console.log(`비활성 사용자 연결 해제: ${userId}`);
      userInfo.ws.close();
    }
  });
}, 60000); // 1분마다 체크

// 서버 시작 메시지
console.log(`✅ WebSocket 서버가 포트 ${PORT}에서 실행 중입니다.`);
console.log(`📊 Supabase 연결: ${SUPABASE_URL}`);
console.log(`🚀 실제 매칭 시스템이 활성화되었습니다.`);

module.exports = { wss, connectedUsers, waitingUsers, stats };
