const WebSocket = require("ws");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const Redis = require("redis");

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const PORT = process.env.PORT || 3002;
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Redis 클라이언트 (선택사항)
let redisClient = null;

async function initializeRedis() {
  try {
    redisClient = Redis.createClient({
      url: REDIS_URL,
      socket: {
        connectTimeout: 5000,
        lazyConnect: true,
      },
    });

    redisClient.on("error", (err) => {
      console.log("Redis 연결 오류:", err.message);
      console.log("메모리 모드로 계속 실행됩니다.");
      redisClient = null;
    });

    await redisClient.connect();
    console.log("Redis 연결됨");
  } catch (error) {
    console.log("Redis 연결 실패, 메모리 모드로 실행:", error.message);
    redisClient = null;
  }
}

// Redis 초기화 (비동기로 처리하되 서버 시작은 차단하지 않음)
initializeRedis().catch(() => {
  console.log("Redis 없이 메모리 모드로 실행");
});

// 사용자 및 방 관리
const connectedUsers = new Map(); // userId -> { ws, roomId, lastActivity }
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
      jwt.verify(token, JWT_SECRET);
      return true;
    } catch (error) {
      return false;
    }
  },
});

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, "http://localhost");
  const token = url.searchParams.get("token");
  const roomId = url.searchParams.get("roomId");
  const isAdmin = url.searchParams.get("admin") === "true";

  let userId;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    userId = decoded.address;
  } catch (error) {
    ws.close();
    return;
  }

  if (isAdmin) {
    adminConnections.add(ws);
    console.log("관리자 연결됨");
    sendAdminUpdate();
  } else {
    connectedUsers.set(userId, {
      ws,
      roomId: roomId || null,
      lastActivity: Date.now(),
    });
    stats.totalConnections++;
    console.log(`사용자 연결: ${userId}`);
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

  ws.on("close", () => {
    if (isAdmin) {
      adminConnections.delete(ws);
      console.log("관리자 연결 해제");
    } else {
      const userInfo = connectedUsers.get(userId);
      if (userInfo) {
        connectedUsers.delete(userId);
        waitingUsers.delete(userId);

        // 채팅방에서 사용자 제거
        if (userInfo.roomId) {
          handleUserLeave(userId, userInfo.roomId);
        }

        console.log(`사용자 연결 해제: ${userId}`);
      }
    }

    broadcastOnlineCount();
    sendAdminUpdate();
  });

  // 기존 채팅방 참여
  if (roomId && !isAdmin) {
    joinChatRoom(userId, roomId);
  }
});

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

function findMatch(userId) {
  waitingUsers.add(userId);

  // 차단된 사용자들 제외하고 매칭
  const waitingArray = Array.from(waitingUsers);
  const availableUsers = waitingArray.filter((id) => {
    if (id === userId) return false;

    // 차단 관계 확인
    const pair1 = `${userId}-${id}`;
    const pair2 = `${id}-${userId}`;
    return !blockedPairs.has(pair1) && !blockedPairs.has(pair2);
  });

  if (availableUsers.length > 0) {
    const partnerId =
      availableUsers[Math.floor(Math.random() * availableUsers.length)];

    // 매칭 성공
    const roomId = uuidv4();
    const room = {
      user1: userId,
      user2: partnerId,
      messages: [],
      createdAt: new Date(),
    };

    chatRooms.set(roomId, room);
    stats.totalMatches++;

    waitingUsers.delete(userId);
    waitingUsers.delete(partnerId);

    // 사용자 정보 업데이트
    const userInfo1 = connectedUsers.get(userId);
    const userInfo2 = connectedUsers.get(partnerId);

    if (userInfo1) userInfo1.roomId = roomId;
    if (userInfo2) userInfo2.roomId = roomId;

    // 매칭 알림 전송
    if (userInfo1?.ws) {
      userInfo1.ws.send(
        JSON.stringify({
          type: "match_found",
          roomId,
        })
      );
    }

    if (userInfo2?.ws) {
      userInfo2.ws.send(
        JSON.stringify({
          type: "match_found",
          roomId,
        })
      );
    }

    sendAdminUpdate();
  }
}

function joinChatRoom(userId, roomId) {
  const room = chatRooms.get(roomId);
  if (!room) return;

  const partnerId = room.user1 === userId ? room.user2 : room.user1;
  const partnerInfo = connectedUsers.get(partnerId);
  const userInfo = connectedUsers.get(userId);

  // 상대방 연결 상태 알림
  if (userInfo?.ws) {
    userInfo.ws.send(
      JSON.stringify({
        type: "partner_status",
        connected: !!partnerInfo?.ws,
      })
    );
  }

  if (partnerInfo?.ws) {
    partnerInfo.ws.send(
      JSON.stringify({
        type: "partner_status",
        connected: true,
      })
    );
  }
}

function sendChatMessage(userId, content, roomId) {
  const room = chatRooms.get(roomId);
  if (!room) return;

  const partnerId = room.user1 === userId ? room.user2 : room.user1;
  const partnerInfo = connectedUsers.get(partnerId);

  const messageData = {
    id: uuidv4(),
    content,
    sender: userId,
    timestamp: new Date().toISOString(),
  };

  // 메시지 저장
  room.messages.push(messageData);
  stats.totalMessages++;

  // 상대방에게 전송
  if (partnerInfo?.ws) {
    partnerInfo.ws.send(
      JSON.stringify({
        type: "message",
        id: messageData.id,
        content: messageData.content,
        sender: "other",
        timestamp: messageData.timestamp,
      })
    );
  }

  // 관리자에게 실시간 메시지 알림
  broadcastToAdmins({
    type: "new_message",
    roomId,
    message: messageData,
  });
}

function handleUserLeave(userId, roomId) {
  const room = chatRooms.get(roomId);
  if (!room) return;

  const partnerId = room.user1 === userId ? room.user2 : room.user1;
  const partnerInfo = connectedUsers.get(partnerId);

  if (partnerInfo?.ws) {
    partnerInfo.ws.send(
      JSON.stringify({
        type: "partner_left",
      })
    );
    partnerInfo.roomId = null;
  }

  const userInfo = connectedUsers.get(userId);
  if (userInfo) {
    userInfo.roomId = null;
  }

  chatRooms.delete(roomId);
  sendAdminUpdate();
}

function blockUser(userId, roomId) {
  const room = chatRooms.get(roomId);
  if (!room) return;

  const partnerId = room.user1 === userId ? room.user2 : room.user1;

  // 차단 관계 추가
  blockedPairs.add(`${userId}-${partnerId}`);
  blockedPairs.add(`${partnerId}-${userId}`);

  const partnerInfo = connectedUsers.get(partnerId);
  if (partnerInfo?.ws) {
    partnerInfo.ws.send(
      JSON.stringify({
        type: "blocked_by_partner",
      })
    );
  }

  handleUserLeave(userId, roomId);
}

function disconnectUser(userId) {
  const userInfo = connectedUsers.get(userId);
  if (userInfo?.ws) {
    userInfo.ws.close();
  }
}

function banUser(userId, duration) {
  // 사용자 차단 로직 (Redis나 DB에 저장)
  console.log(`사용자 ${userId} 차단됨 (기간: ${duration})`);
  disconnectUser(userId);
}

function broadcastOnlineCount() {
  const count = connectedUsers.size;
  const message = JSON.stringify({
    type: "online_count",
    count,
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
      onlineUsers: connectedUsers.size,
      activeChats: chatRooms.size,
      waitingUsers: waitingUsers.size,
      totalConnections: stats.totalConnections,
      totalMatches: stats.totalMatches,
      totalMessages: stats.totalMessages,
    },
    rooms: Array.from(chatRooms.entries()).map(([id, room]) => ({
      id,
      users: [room.user1, room.user2],
      messageCount: room.messages.length,
      createdAt: room.createdAt,
    })),
  };

  broadcastToAdmins(adminData);
}

function sendAdminStats(ws) {
  const statsData = {
    type: "stats_response",
    data: {
      onlineUsers: connectedUsers.size,
      activeChats: chatRooms.size,
      totalReports: stats.reports.length,
      pendingReports: stats.reports.filter((r) => r.status === "pending")
        .length,
      blockedUsers: blockedPairs.size / 2, // 양방향이므로 2로 나눔
    },
  };

  ws.send(JSON.stringify(statsData));
}

function sendChatLogs(ws, roomId) {
  const room = chatRooms.get(roomId);
  if (!room) return;

  ws.send(
    JSON.stringify({
      type: "chat_logs",
      roomId,
      messages: room.messages,
    })
  );
}

function broadcastToAdmins(data) {
  adminConnections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  });
}

// 정리 작업 (비활성 연결 제거)
setInterval(() => {
  const now = Date.now();
  const timeout = 5 * 60 * 1000; // 5분

  connectedUsers.forEach((userInfo, userId) => {
    if (now - userInfo.lastActivity > timeout) {
      console.log(`비활성 사용자 제거: ${userId}`);
      if (userInfo.ws.readyState === WebSocket.OPEN) {
        userInfo.ws.close();
      }
      connectedUsers.delete(userId);
      waitingUsers.delete(userId);
    }
  });
}, 60000); // 1분마다 실행

console.log(`WebSocket 서버가 포트 ${PORT}에서 실행 중입니다.`);
