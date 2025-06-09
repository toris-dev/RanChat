# RanChat Supabase 설정 가이드

## 1. Supabase 프로젝트 생성

1. [Supabase 콘솔](https://supabase.com/dashboard)에 로그인
2. "New Project" 클릭
3. 프로젝트 이름, 조직, 비밀번호 설정
4. 지역 선택 (서울: ap-northeast-2 권장)

## 2. 데이터베이스 테이블 생성

Supabase 콘솔의 SQL Editor에서 다음 SQL을 실행하세요:

```sql
-- users 테이블
CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
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
  user1_id uuid NOT NULL REFERENCES public.users(id),
  user2_id uuid NOT NULL REFERENCES public.users(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'abandoned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  last_message_at timestamptz
);

-- messages 테이블
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_room_id uuid NOT NULL REFERENCES public.chat_rooms(id),
  sender_id uuid NOT NULL REFERENCES public.users(id),
  content text NOT NULL,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file')),
  created_at timestamptz NOT NULL DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz
);

-- reports 테이블
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.users(id),
  reported_user_id uuid NOT NULL REFERENCES public.users(id),
  chat_room_id uuid REFERENCES public.chat_rooms(id),
  reason text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.users(id)
);
```

## 3. 환경변수 설정

### API 키 확인

1. Supabase 콘솔 → 프로젝트 → Settings → API
2. `Project URL`과 `anon public` 키 복사

### 환경변수 파일 생성

각 앱 디렉토리에 `.env.local` 파일을 생성하세요:

**apps/web/.env.local:**

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
JWT_SECRET=your-random-secret-key-here
```

**apps/admin/.env.local:**

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
JWT_SECRET=your-random-secret-key-here
```

## 4. 앱 실행

```bash
pnpm dev
```

## 참고사항

- 현재 코드는 임시 플레이스홀더 값으로 설정되어 있어, 실제 Supabase 연결 없이도 오류 없이 실행됩니다.
- 실제 기능을 사용하려면 위의 환경변수 설정이 필요합니다.
- `.env.local` 파일은 gitignore에 포함되어 있어 커밋되지 않습니다.
