# RanChat Admin API Documentation

관리자 기능을 위한 API 엔드포인트들입니다. 기존의 WebSocket 기반 관리자 기능이 REST API로 마이그레이션되었습니다.

## 인증

모든 Admin API는 관리자 권한이 필요합니다. 실제 구현에서는 JWT 토큰이나 API 키 기반 인증을 추가해야 합니다.

## API 엔드포인트

### 1. 통계 API (`/api/admin/stats`)

#### 전체 통계 조회

```http
GET /api/admin/stats
```

**응답:**

```json
{
  "stats": {
    "users": {
      "total": 1000,
      "online": 50,
      "activeLast24h": 200
    },
    "chatRooms": {
      "total": 500,
      "active": 20,
      "createdToday": 5
    },
    "messages": {
      "total": 10000,
      "sentToday": 100
    },
    "reports": {
      "total": 10,
      "pending": 3
    },
    "blocks": {
      "total": 25
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### 실시간 통계 조회 (폴링용)

```http
POST /api/admin/stats
Content-Type: application/json

{
  "action": "realtime_stats"
}
```

### 2. 사용자 관리 API (`/api/admin/users`)

#### 사용자 목록 조회

```http
GET /api/admin/users?page=1&limit=20&status=online&search=0x...
```

**쿼리 파라미터:**

- `page`: 페이지 번호 (기본값: 1)
- `limit`: 페이지당 항목 수 (기본값: 20)
- `status`: 상태 필터 (`online`, `offline`, `banned`, `all`)
- `search`: 지갑 주소 검색

#### 사용자 관리 액션

```http
POST /api/admin/users
Content-Type: application/json

{
  "action": "ban_user",
  "walletAddress": "0x...",
  "duration": 60,
  "reason": "부적절한 행동"
}
```

**지원 액션:**

- `ban_user`: 사용자 차단
- `unban_user`: 차단 해제
- `force_disconnect`: 강제 연결 해제
- `get_user_detail`: 사용자 상세 정보 조회

### 3. 신고 관리 API (`/api/admin/reports`)

#### 신고 목록 조회

```http
GET /api/admin/reports?page=1&limit=20&status=pending&type=spam
```

**쿼리 파라미터:**

- `page`: 페이지 번호
- `limit`: 페이지당 항목 수
- `status`: 상태 필터 (`pending`, `resolved`, `all`)
- `type`: 신고 유형 필터

#### 신고 처리

```http
POST /api/admin/reports
Content-Type: application/json

{
  "action": "resolve_report",
  "reportId": "uuid",
  "resolution": "경고 조치",
  "adminNotes": "추가 메모"
}
```

### 4. 채팅 로그 API (`/api/admin/chatlogs`)

#### 전체 채팅방 목록 조회

```http
GET /api/admin/chatlogs?page=1&limit=20&startDate=2024-01-01&endDate=2024-01-31
```

#### 특정 채팅방 로그 조회

```http
GET /api/admin/chatlogs?roomId=uuid&page=1&limit=50
```

#### 특정 사용자 채팅 로그 조회

```http
GET /api/admin/chatlogs?wallet=0x...&page=1&limit=50&startDate=2024-01-01
```

#### 채팅 로그 내보내기

```http
POST /api/admin/chatlogs
Content-Type: application/json

{
  "action": "export_logs",
  "roomId": "uuid",
  "format": "csv"
}
```

## 사용 예시

### React/Next.js에서 Admin API 사용

```typescript
// 통계 조회
const getStats = async () => {
  const response = await fetch("/api/admin/stats");
  const data = await response.json();
  return data.stats;
};

// 실시간 통계 업데이트 (폴링)
const pollRealtimeStats = async () => {
  const response = await fetch("/api/admin/stats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "realtime_stats" }),
  });
  const data = await response.json();
  return data.realtime;
};

// 사용자 목록 조회
const getUsers = async (page = 1, status = "all") => {
  const response = await fetch(
    `/api/admin/users?page=${page}&status=${status}&limit=20`
  );
  const data = await response.json();
  return data;
};

// 사용자 차단
const banUser = async (
  walletAddress: string,
  duration: number,
  reason: string
) => {
  const response = await fetch("/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "ban_user",
      walletAddress,
      duration,
      reason,
    }),
  });
  return response.json();
};

// 신고 목록 조회
const getReports = async (page = 1, status = "pending") => {
  const response = await fetch(
    `/api/admin/reports?page=${page}&status=${status}&limit=20`
  );
  const data = await response.json();
  return data;
};

// 신고 처리
const resolveReport = async (
  reportId: string,
  resolution: string,
  adminNotes?: string
) => {
  const response = await fetch("/api/admin/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "resolve_report",
      reportId,
      resolution,
      adminNotes,
    }),
  });
  return response.json();
};

// 채팅방 로그 조회
const getChatRoomLogs = async (roomId: string, page = 1) => {
  const response = await fetch(
    `/api/admin/chatlogs?roomId=${roomId}&page=${page}&limit=50`
  );
  const data = await response.json();
  return data;
};

// 채팅 로그 내보내기
const exportChatLogs = async (roomId: string, format = "json") => {
  const response = await fetch("/api/admin/chatlogs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "export_logs",
      roomId,
      format,
    }),
  });

  if (format === "csv") {
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chatroom_${roomId}_${Date.now()}.csv`;
    a.click();
  } else {
    return response.json();
  }
};
```

### Admin Dashboard 컴포넌트 예시

```typescript
'use client';

import { useState, useEffect } from 'react';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);

  // 통계 데이터 폴링
  useEffect(() => {
    const fetchRealtimeStats = async () => {
      try {
        const realtimeData = await pollRealtimeStats();
        setStats(prev => ({ ...prev, ...realtimeData }));
      } catch (error) {
        console.error('Failed to fetch realtime stats:', error);
      }
    };

    // 5초마다 실시간 통계 업데이트
    const interval = setInterval(fetchRealtimeStats, 5000);
    return () => clearInterval(interval);
  }, []);

  // 초기 데이터 로드
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [statsData, usersData, reportsData] = await Promise.all([
          getStats(),
          getUsers(1, 'online'),
          getReports(1, 'pending')
        ]);

        setStats(statsData);
        setUsers(usersData.users);
        setReports(reportsData.reports);
      } catch (error) {
        console.error('Failed to load initial data:', error);
      }
    };

    loadInitialData();
  }, []);

  const handleBanUser = async (walletAddress: string) => {
    if (confirm(`사용자 ${walletAddress}를 차단하시겠습니까?`)) {
      try {
        await banUser(walletAddress, 60, '관리자 판단');
        // 사용자 목록 새로고침
        const usersData = await getUsers();
        setUsers(usersData.users);
      } catch (error) {
        console.error('Failed to ban user:', error);
      }
    }
  };

  const handleResolveReport = async (reportId: string) => {
    try {
      await resolveReport(reportId, '처리 완료', '관리자 검토 완료');
      // 신고 목록 새로고침
      const reportsData = await getReports();
      setReports(reportsData.reports);
    } catch (error) {
      console.error('Failed to resolve report:', error);
    }
  };

  return (
    <div className="admin-dashboard">
      {/* 통계 섹션 */}
      <div className="stats-section">
        <h2>실시간 통계</h2>
        {stats && (
          <div className="stats-grid">
            <div>온라인 사용자: {stats.onlineUsers}</div>
            <div>활성 채팅방: {stats.activeChatRooms}</div>
            <div>미처리 신고: {stats.pendingReports}</div>
          </div>
        )}
      </div>

      {/* 사용자 관리 섹션 */}
      <div className="users-section">
        <h2>사용자 관리</h2>
        {users.map(user => (
          <div key={user.walletAddress} className="user-item">
            <span>{user.walletAddress}</span>
            <span>{user.isOnline ? '온라인' : '오프라인'}</span>
            <button onClick={() => handleBanUser(user.walletAddress)}>
              차단
            </button>
          </div>
        ))}
      </div>

      {/* 신고 관리 섹션 */}
      <div className="reports-section">
        <h2>신고 관리</h2>
        {reports.map(report => (
          <div key={report.report_id} className="report-item">
            <span>{report.reason}</span>
            <span>{report.reported_wallet}</span>
            <button onClick={() => handleResolveReport(report.report_id)}>
              처리
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## 기존 WebSocket Admin 기능과의 차이점

| 기존 WebSocket     | 새로운 REST API    |
| ------------------ | ------------------ |
| 실시간 이벤트 푸시 | 폴링 기반 업데이트 |
| 단일 연결 관리     | HTTP 요청/응답     |
| 메모리 기반 상태   | 데이터베이스 기반  |
| 복잡한 연결 관리   | 간단한 API 호출    |

## 주의사항

1. **인증**: 현재 인증 로직이 없습니다. 프로덕션에서는 JWT나 API 키 기반 인증을 구현해야 합니다.

2. **권한**: 관리자 권한 확인 로직을 추가해야 합니다.

3. **메모리 저장소**: 차단된 사용자 정보 등이 메모리에 저장됩니다. Redis나 데이터베이스 사용을 권장합니다.

4. **실시간성**: WebSocket 대신 폴링을 사용하므로 약간의 지연이 있을 수 있습니다.

5. **에러 처리**: 각 API 호출에 대한 적절한 에러 처리를 구현해야 합니다.

6. **로깅**: 관리자 액션에 대한 감사 로그 시스템을 구축하는 것이 좋습니다.
