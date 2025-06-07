-- 사용자 테이블
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_banned BOOLEAN DEFAULT FALSE
);

-- 채팅방 테이블
CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_address VARCHAR(42) NOT NULL,
  user2_address VARCHAR(42) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'active'
);

-- 메시지 테이블 (선택사항 - 로그 저장용)
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  room_id UUID REFERENCES chat_rooms(id),
  sender_address VARCHAR(42) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_deleted BOOLEAN DEFAULT FALSE
);

-- 신고 테이블
CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  reporter_address VARCHAR(42) NOT NULL,
  room_id UUID REFERENCES chat_rooms(id),
  reason VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) DEFAULT 'pending'
);

-- 블록체인 트랜잭션 로그 (선택사항)
CREATE TABLE IF NOT EXISTS blockchain_logs (
  id SERIAL PRIMARY KEY,
  room_id UUID REFERENCES chat_rooms(id),
  transaction_hash VARCHAR(66),
  block_number BIGINT,
  user1_address VARCHAR(42) NOT NULL,
  user2_address VARCHAR(42) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_users ON chat_rooms(user1_address, user2_address);
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages(room_id);
CREATE INDEX IF NOT EXISTS idx_reports_room_id ON reports(room_id);
