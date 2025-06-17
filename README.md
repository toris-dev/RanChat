# RanChat - 실시간 랜덤 채팅 서비스

블록체인 기반의 익명 랜덤 채팅 플랫폼입니다.

## 🚀 실제 서비스 실행하기

### 1. 환경 설정

Supabase 프로젝트를 먼저 생성하고 환경변수를 설정하세요:

```bash
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_ANON_KEY=your-anon-key
```

### 2. 데이터베이스 설정

Supabase SQL Editor에서 다음 SQL을 실행하세요:

```sql
-- users 테이블
CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL UNIQUE,
  username text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_online boolean NOT NULL DEFAULT false,
  last_seen timestamptz,
  is_banned boolean NOT NULL DEFAULT false,
  ban_reason text,
  ban_expires_at timestamptz
);

-- chat_rooms 테이블
CREATE TABLE public.chat_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id text NOT NULL,
  user2_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

-- messages 테이블
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_room_id uuid NOT NULL REFERENCES public.chat_rooms(id),
  sender_id text NOT NULL,
  content text NOT NULL,
  message_type text NOT NULL DEFAULT 'text',
  created_at timestamptz NOT NULL DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false
);

-- reports 테이블
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id text NOT NULL,
  reported_user_id text NOT NULL,
  chat_room_id uuid REFERENCES public.chat_rooms(id),
  reason text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by text
);

-- 인덱스 생성
CREATE INDEX idx_chat_rooms_user1 ON public.chat_rooms(user1_id);
CREATE INDEX idx_chat_rooms_user2 ON public.chat_rooms(user2_id);
CREATE INDEX idx_messages_room ON public.messages(chat_room_id);
CREATE INDEX idx_messages_sender ON public.messages(sender_id);
CREATE INDEX idx_reports_reporter ON public.reports(reporter_id);
CREATE INDEX idx_reports_reported ON public.reports(reported_user_id);
```

### 3. 서비스 시작

```bash
# 모든 서비스를 한번에 시작
./start-services.sh
```

또는 개별적으로 시작:

```bash
# WebSocket 서버
cd packages/websocket && pnpm dev

# Web 앱
cd apps/web && pnpm dev

# Admin 앱
cd apps/admin && pnpm dev
```

### 4. 서비스 접속

- **Web App**: http://localhost:3000
- **Admin App**: http://localhost:3001
- **WebSocket Server**: ws://localhost:3002

## 📁 프로젝트 구조

```
RanChat/
├── apps/
│   ├── web/          # 사용자 웹 앱
│   └── admin/        # 관리자 앱
├── packages/
│   ├── shared/       # 공유 컴포넌트 및 타입
│   └── websocket/    # WebSocket 서버
└── start-services.sh # 서비스 시작 스크립트
```

## 🔧 주요 기능

### 사용자 기능

- **랜덤 매칭**: 실시간으로 다른 사용자와 매칭
- **실시간 채팅**: WebSocket 기반 즉시 메시지 전송
- **사용자 차단**: 원하지 않는 사용자 차단
- **신고 시스템**: 부적절한 사용자 신고
- **온라인 상태**: 실시간 온라인 사용자 수 표시

### 관리자 기능

- **실시간 모니터링**: 접속자 수, 채팅방 현황
- **사용자 관리**: 사용자 차단, 강제 연결 해제
- **신고 관리**: 신고 내역 조회 및 처리
- **채팅 로그**: 채팅 내역 조회

## 🛠 기술 스택

### Frontend

- **Next.js 14**: App Router, TypeScript
- **Tailwind CSS**: 스타일링
- **Lucide React**: 아이콘

### Backend

- **WebSocket**: 실시간 통신
- **Supabase**: 데이터베이스 및 실시간 기능
- **Node.js**: WebSocket 서버

### 개발 도구

- **Turbo**: 모노레포 관리
- **pnpm**: 패키지 매니저
- **TypeScript**: 타입 안전성

## 🔒 보안 기능

- **사용자 인증**: JWT 기반 토큰 인증
- **차단 시스템**: 사용자 간 차단 기능
- **신고 시스템**: 부적절한 행위 신고
- **관리자 모니터링**: 실시간 채팅 모니터링

## 📊 모니터링

WebSocket 서버는 다음 정보를 실시간으로 추적합니다:

- 온라인 사용자 수
- 활성 채팅방 수
- 매칭 대기 사용자 수
- 총 연결/매칭/메시지 통계

## 🚀 배포

### 환경변수

```bash
# 필수 환경변수
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# 선택적 환경변수
JWT_SECRET=your-secret-key
PORT=3002
```

### Docker (선택사항)

```bash
# Docker로 실행
docker-compose up -d
```

## 🤝 기여하기

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 라이선스

MIT License

---

**실시간 익명 채팅의 새로운 경험을 제공합니다! 🎉**
