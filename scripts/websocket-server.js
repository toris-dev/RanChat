// WebSocket 서버 (별도 배포 필요)
const WebSocket = require("ws")
const jwt = require("jsonwebtoken")
const { v4: uuidv4 } = require("uuid")

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key"
const PORT = process.env.PORT || 3001

// 사용자 및 방 관리
const connectedUsers = new Map() // userId -> WebSocket
const waitingUsers = new Set() // 매칭 대기 중인 사용자들
const chatRooms = new Map() // roomId -> { user1, user2 }

const wss = new WebSocket.Server({
  port: PORT,
  verifyClient: (info) => {
    const url = new URL(info.req.url, "http://localhost")
    const token = url.searchParams.get("token")

    try {
      jwt.verify(token, JWT_SECRET)
      return true
    } catch (error) {
      return false
    }
  },
})

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, "http://localhost")
  const token = url.searchParams.get("token")
  const roomId = url.searchParams.get("roomId")

  let userId
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    userId = decoded.address
  } catch (error) {
    ws.close()
    return
  }

  connectedUsers.set(userId, ws)
  console.log(`사용자 연결: ${userId}`)

  // 온라인 사용자 수 브로드캐스트
  broadcastOnlineCount()

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString())
      handleMessage(ws, userId, message)
    } catch (error) {
      console.error("메시지 파싱 오류:", error)
    }
  })

  ws.on("close", () => {
    connectedUsers.delete(userId)
    waitingUsers.delete(userId)

    // 채팅방에서 사용자 제거
    for (const [roomId, room] of chatRooms.entries()) {
      if (room.user1 === userId || room.user2 === userId) {
        const partnerId = room.user1 === userId ? room.user2 : room.user1
        const partnerWs = connectedUsers.get(partnerId)

        if (partnerWs) {
          partnerWs.send(
            JSON.stringify({
              type: "partner_left",
            }),
          )
        }

        chatRooms.delete(roomId)
        break
      }
    }

    console.log(`사용자 연결 해제: ${userId}`)
    broadcastOnlineCount()
  })

  // 기존 채팅방 참여
  if (roomId) {
    joinChatRoom(userId, roomId)
  }
})

function handleMessage(ws, userId, message) {
  switch (message.type) {
    case "find_match":
      findMatch(userId)
      break

    case "cancel_match":
      waitingUsers.delete(userId)
      break

    case "send_message":
      sendChatMessage(userId, message.content, message.roomId)
      break

    case "leave_room":
      leaveChatRoom(userId, message.roomId)
      break
  }
}

function findMatch(userId) {
  waitingUsers.add(userId)

  // 대기 중인 다른 사용자 찾기
  const waitingArray = Array.from(waitingUsers)
  const otherUsers = waitingArray.filter((id) => id !== userId)

  if (otherUsers.length > 0) {
    const partnerId = otherUsers[Math.floor(Math.random() * otherUsers.length)]

    // 매칭 성공
    const roomId = uuidv4()
    chatRooms.set(roomId, { user1: userId, user2: partnerId })

    waitingUsers.delete(userId)
    waitingUsers.delete(partnerId)

    // 매칭 알림 전송
    const userWs = connectedUsers.get(userId)
    const partnerWs = connectedUsers.get(partnerId)

    if (userWs) {
      userWs.send(
        JSON.stringify({
          type: "match_found",
          roomId,
        }),
      )
    }

    if (partnerWs) {
      partnerWs.send(
        JSON.stringify({
          type: "match_found",
          roomId,
        }),
      )
    }
  }
}

function joinChatRoom(userId, roomId) {
  const room = chatRooms.get(roomId)
  if (!room) return

  const partnerId = room.user1 === userId ? room.user2 : room.user1
  const partnerWs = connectedUsers.get(partnerId)
  const userWs = connectedUsers.get(userId)

  // 상대방 연결 상태 알림
  if (userWs) {
    userWs.send(
      JSON.stringify({
        type: "partner_status",
        connected: !!partnerWs,
      }),
    )
  }

  if (partnerWs) {
    partnerWs.send(
      JSON.stringify({
        type: "partner_status",
        connected: true,
      }),
    )
  }
}

function sendChatMessage(userId, content, roomId) {
  const room = chatRooms.get(roomId)
  if (!room) return

  const partnerId = room.user1 === userId ? room.user2 : room.user1
  const partnerWs = connectedUsers.get(partnerId)

  const messageData = {
    type: "message",
    id: uuidv4(),
    content,
    sender: "other",
    timestamp: new Date().toISOString(),
  }

  if (partnerWs) {
    partnerWs.send(JSON.stringify(messageData))
  }
}

function leaveChatRoom(userId, roomId) {
  const room = chatRooms.get(roomId)
  if (!room) return

  const partnerId = room.user1 === userId ? room.user2 : room.user1
  const partnerWs = connectedUsers.get(partnerId)

  if (partnerWs) {
    partnerWs.send(
      JSON.stringify({
        type: "partner_left",
      }),
    )
  }

  chatRooms.delete(roomId)
}

function broadcastOnlineCount() {
  const count = connectedUsers.size
  const message = JSON.stringify({
    type: "online_count",
    count,
  })

  connectedUsers.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message)
    }
  })
}

console.log(`WebSocket 서버가 포트 ${PORT}에서 실행 중입니다.`)
