-- 기존 테이블들 확장

-- 사용자 테이블 (확장)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_banned BOOLEAN DEFAULT FALSE,
  ban_expires_at TIMESTAMP,
  ban_reason TEXT,
  total_chats INTEGER DEFAULT 0,
  total_reports_made INTEGER DEFAULT 0,
  total_reports_received INTEGER DEFAULT 0
);

-- 채팅방 테이블 (확장)
CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_address VARCHAR(42) NOT NULL,
  user2_address VARCHAR(42) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'active',
  message_count INTEGER DEFAULT 0,
  duration_seconds INTEGER DEFAULT 0
);

-- 메시지 테이블 (확장)
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  room_id UUID REFERENCES chat_rooms(id),
  sender_address VARCHAR(42) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_deleted BOOLEAN DEFAULT FALSE,
  message_type VARCHAR(20) DEFAULT 'text'
);

-- 신고 테이블 (확장)
CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  reporter_address VARCHAR(42) NOT NULL,
  reported_user_address VARCHAR(42),
  room_id UUID REFERENCES chat_rooms(id),
  reason VARCHAR(100) NOT NULL,
  description TEXT,
  evidence_messages JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) DEFAULT 'pending',
  reviewed_by VARCHAR(42),
  reviewed_at TIMESTAMP,
  action_taken VARCHAR(100)
);

-- 차단 관계 테이블
CREATE TABLE IF NOT EXISTS user_blocks (
  id SERIAL PRIMARY KEY,
  blocker_address VARCHAR(42) NOT NULL,
  blocked_address VARCHAR(42) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reason VARCHAR(100),
  UNIQUE(blocker_address, blocked_address)
);

-- 관리자 액션 로그
CREATE TABLE IF NOT EXISTS admin_actions (
  id SERIAL PRIMARY KEY,
  admin_address VARCHAR(42) NOT NULL,
  action_type VARCHAR(50) NOT NULL,
  target_user VARCHAR(42),
  target_room UUID,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 시스템 통계 (일별)
CREATE TABLE IF NOT EXISTS daily_stats (
  id SERIAL PRIMARY KEY,
  date DATE UNIQUE NOT NULL,
  total_users INTEGER DEFAULT 0,
  new_users INTEGER DEFAULT 0,
  total_matches INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  total_reports INTEGER DEFAULT 0,
  avg_chat_duration DECIMAL(10,2) DEFAULT 0,
  peak_concurrent_users INTEGER DEFAULT 0
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_users ON chat_rooms(user1_address, user2_address);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_created_at ON chat_rooms(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks(blocker_address);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created_at ON admin_actions(created_at);

-- 트리거 함수들
CREATE OR REPLACE FUNCTION update_chat_room_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE chat_rooms 
    SET message_count = message_count + 1 
    WHERE id = NEW.room_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 메시지 삽입 시 채팅방 통계 업데이트
CREATE TRIGGER trigger_update_chat_room_stats
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_room_stats();

-- 샘플 데이터 삽입
INSERT INTO daily_stats (date, total_users, new_users, total_matches, total_messages, total_reports, avg_chat_duration, peak_concurrent_users)
VALUES 
  (CURRENT_DATE - INTERVAL '7 days', 1200, 50, 300, 1500, 5, 180.5, 85),
  (CURRENT_DATE - INTERVAL '6 days', 1220, 45, 320, 1600, 3, 175.2, 90),
  (CURRENT_DATE - INTERVAL '5 days', 1235, 38, 310, 1550, 7, 185.8, 88),
  (CURRENT_DATE - INTERVAL '4 days', 1250, 42, 330, 1650, 4, 190.3, 95),
  (CURRENT_DATE - INTERVAL '3 days', 1270, 55, 340, 1700, 6, 188.7, 100),
  (CURRENT_DATE - INTERVAL '2 days', 1290, 48, 350, 1750, 2, 192.1, 105),
  (CURRENT_DATE - INTERVAL '1 day', 1310, 52, 360, 1800, 8, 195.5, 110);
