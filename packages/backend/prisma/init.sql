-- PostgreSQL 초기화 스크립트
-- Docker 컨테이너 시작 시 자동 실행됨

-- 데이터베이스 생성 (필요한 경우)
-- CREATE DATABASE IF NOT EXISTS ai_chat_platform;

-- 데이터베이스 선택
\c ai_chat_platform;

-- UUID 확장 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- pgvector 확장 활성화 (벡터 검색용)
CREATE EXTENSION IF NOT EXISTS "vector";

-- 메모리 임베딩 테이블 (pgvector)
CREATE TABLE IF NOT EXISTS memory_embeddings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  memory_id TEXT NOT NULL,
  memory_type TEXT NOT NULL CHECK (memory_type IN ('episodic', 'semantic', 'emotional')),
  embedding vector(1536) NOT NULL,  -- OpenAI ada-002 dimensions
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_memory_embedding UNIQUE (memory_id, memory_type)
);

-- 벡터 검색 인덱스 (IVFFlat - 대규모 데이터용)
CREATE INDEX IF NOT EXISTS memory_embeddings_vector_idx 
ON memory_embeddings 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 기본 인덱스
CREATE INDEX IF NOT EXISTS memory_embeddings_memory_id_idx ON memory_embeddings(memory_id);
CREATE INDEX IF NOT EXISTS memory_embeddings_memory_type_idx ON memory_embeddings(memory_type);

-- 기본 사용자 생성 (개발 환경용)
-- 실제 운영에서는 별도 관리 권장
DO $$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'ai_chat_user') THEN
      CREATE ROLE ai_chat_user LOGIN PASSWORD 'ai_chat_pass';
   END IF;
END
$$;

-- 권한 부여
GRANT ALL PRIVILEGES ON DATABASE ai_chat_platform TO ai_chat_user;
GRANT ALL ON SCHEMA public TO ai_chat_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ai_chat_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ai_chat_user;

-- 기본 스키마 권한 설정
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ai_chat_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ai_chat_user;

-- 샘플 데이터 삽입 (개발 환경용)
-- 실제 운영에서는 마이그레이션으로 관리 권장

-- 기본 사용자 역할 생성
INSERT INTO "UserRole" (name) VALUES ('user'), ('premium'), ('creator'), ('admin')
ON CONFLICT (name) DO NOTHING;

-- 기본 구독 플랜 생성
INSERT INTO "SubscriptionPlan" (id, name, description, price, currency, interval, credits, maxChats, maxImages, priority, features, isActive, createdAt, updatedAt)
VALUES
  ('basic', 'Basic Plan', '기본 플랜', 9900, 'KRW', 'MONTHLY', 100, 50, 10, false, ARRAY['기본 채팅', '기본 이미지 생성'], true, NOW(), NOW()),
  ('premium', 'Premium Plan', '프리미엄 플랜', 19900, 'KRW', 'MONTHLY', 500, NULL, NULL, true, ARRAY['무제한 채팅', '무제한 이미지', '우선 처리'], true, NOW(), NOW()),
  ('creator', 'Creator Plan', '크리에이터 플랜', 39900, 'KRW', 'MONTHLY', 1000, NULL, NULL, true, ARRAY['모든 프리미엄 기능', '수익화 기능', '전담 지원'], true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 샘플 캐릭터 생성
INSERT INTO "Character" (id, name, avatar, description, personality, systemPrompt, temperature, maxTokens, category, tags, usageCount, rating, reviewCount, createdAt, updatedAt, isActive)
VALUES
  ('sample_char_1', '친절한 AI 어시스턴트', 'https://example.com/avatar1.jpg', '항상 친절하고 도움이 되는 AI 어시스턴트입니다.', '친절하고, 도움이 되고, 전문적임', '당신은 친절하고 도움이 되는 AI 어시스턴트입니다. 사용자의 질문에 최대한 도움이 되는 답변을 제공하세요.', 0.7, 1000, 'assistant', ARRAY['친절', '도움', '전문성'], 150, 4.8, 25, NOW(), NOW(), true),
  ('sample_char_2', '창의적인 작가', 'https://example.com/avatar2.jpg', '다양한 주제로 창의적인 글을 쓰는 AI 작가입니다.', '창의적이고, 영감을 주는, 글쓰기 전문가', '당신은 창의적인 작가입니다. 사용자의 요청에 따라 다양한 스타일의 글을 작성하세요.', 0.8, 1500, 'writer', ARRAY['창의성', '글쓰기', '영감'], 89, 4.6, 18, NOW(), NOW(), true)
ON CONFLICT (id) DO NOTHING;

-- 기본 메시지 역할 생성
INSERT INTO "MessageRole" (name) VALUES ('user'), ('assistant'), ('system')
ON CONFLICT (name) DO NOTHING;

-- 기본 사용자 상태 생성
INSERT INTO "UserStatus" (name) VALUES ('active'), ('inactive'), ('banned'), ('suspended')
ON CONFLICT (name) DO NOTHING;

-- 기본 결제 상태 생성
INSERT INTO "PaymentStatus" (name) VALUES ('pending'), ('completed'), ('failed'), ('cancelled'), ('refunded')
ON CONFLICT (name) DO NOTHING;

-- 기본 이미지 생성 상태 생성
INSERT INTO "GenerationStatus" (name) VALUES ('pending'), ('processing'), ('completed'), ('failed')
ON CONFLICT (name) DO NOTHING;

-- 기본 구독 간격 생성
INSERT INTO "SubscriptionInterval" (name) VALUES ('monthly'), ('yearly')
ON CONFLICT (name) DO NOTHING;

COMMIT;

-- 초기화 완료 메시지
DO $$
BEGIN
   RAISE NOTICE 'PostgreSQL 초기화 완료!';
   RAISE NOTICE '데이터베이스: ai_chat_platform';
   RAISE NOTICE '생성된 테이블: User, Character, Chat, Message 등';
   RAISE NOTICE '샘플 데이터 삽입 완료';
END
$$;
