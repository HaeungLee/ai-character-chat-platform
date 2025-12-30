-- PostgreSQL 초기화 스크립트
-- Docker 컨테이너 시작 시 자동 실행됨
-- 주의: 테이블 생성/샘플 데이터 삽입은 Prisma migrate로 관리한다.

\c ai_chat_platform;

-- UUID / crypto
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- pgvector 확장 활성화 (벡터 검색용)
CREATE EXTENSION IF NOT EXISTS "vector";

-- 메모리 임베딩 테이블 (pgvector)
-- Prisma 모델에 포함되지 않으며 Raw SQL로만 관리한다.
CREATE TABLE IF NOT EXISTS memory_embeddings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  memory_id TEXT NOT NULL,
  memory_type TEXT NOT NULL CHECK (memory_type IN ('episodic', 'semantic', 'emotional')),
  embedding vector(1536) NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_memory_embedding UNIQUE (memory_id, memory_type)
);

-- 벡터 검색 인덱스 (IVFFlat)
CREATE INDEX IF NOT EXISTS memory_embeddings_vector_idx
ON memory_embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 기본 인덱스
CREATE INDEX IF NOT EXISTS memory_embeddings_memory_id_idx ON memory_embeddings(memory_id);
CREATE INDEX IF NOT EXISTS memory_embeddings_memory_type_idx ON memory_embeddings(memory_type);

DO $$
BEGIN
   RAISE NOTICE 'PostgreSQL init.sql 완료: extensions + memory_embeddings만 생성';
END
$$;
