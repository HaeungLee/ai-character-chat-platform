# 🧠 AI 캐릭터 장기 기억 시스템 설계서
> 작성일: 2024-12-13
> 버전: 1.0

---

## 📋 목차
1. [개요](#1-개요)
2. [핵심 원칙](#2-핵심-원칙)
3. [메모리 아키텍처](#3-메모리-아키텍처)
4. [요약 시스템](#4-요약-시스템)
5. [RAG 검색 시스템](#5-rag-검색-시스템)
6. [이벤트 감지 시스템](#6-이벤트-감지-시스템)
7. [비즈니스 모델](#7-비즈니스-모델)
8. [데이터베이스 스키마](#8-데이터베이스-스키마)
9. [API 설계](#9-api-설계)
10. [구현 로드맵](#10-구현-로드맵)

---

## 1. 개요

### 1.1 목적
AI 캐릭터가 사용자와의 과거 대화를 기억하고, 자연스럽게 대화에 반영할 수 있는 장기 기억 시스템 구축

### 1.2 핵심 기능
- **장기 기억 저장**: 오래된 대화를 요약하여 Vector DB에 저장
- **RAG 검색**: 관련 기억을 검색하여 대화에 반영
- **이벤트 감지**: 중요한 순간(생일, 감정 변화 등)을 자동 추출
- **사용자 제어**: 기억 열람/수정/삭제 기능

### 1.3 핵심 원칙
```
"오래된 기억은 요약해서 저장한다 → RAG로 참고한다"
```

---

## 2. 핵심 원칙

### 2.1 설계 원칙

| 원칙 | 설명 |
|------|------|
| **캐릭터별 독립** | 각 캐릭터는 독립된 기억 공간을 가짐 (기억 공유 없음) |
| **원본 보존** | 원본 대화는 삭제하지 않고 텍스트로 유지 (열람 가능) |
| **비용 최적화** | 요약은 필요 시에만 (Context 70% 도달 시) |
| **사용자 제어** | 기억 열람/수정/삭제 가능 |
| **UX 동일** | 무료/유료 기능 차이 없음, 포인트 기반 |

### 2.2 데이터 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│                      데이터 흐름 개요                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   [사용자 메시지]                                                │
│         │                                                       │
│         ▼                                                       │
│   ┌─────────────────┐                                          │
│   │  이벤트 감지    │ ──→ 중요 사실 추출 → Semantic Memory     │
│   └─────────────────┘                                          │
│         │                                                       │
│         ▼                                                       │
│   ┌─────────────────┐                                          │
│   │  RAG 검색      │ ←── Vector DB 쿼리                        │
│   └─────────────────┘                                          │
│         │                                                       │
│         ▼                                                       │
│   ┌─────────────────┐                                          │
│   │  AI 응답 생성   │ ←── 기억 + 현재 대화 컨텍스트            │
│   └─────────────────┘                                          │
│         │                                                       │
│         ▼                                                       │
│   ┌─────────────────┐                                          │
│   │  Context 체크   │ ──→ 70% 초과 시 → 비동기 요약            │
│   └─────────────────┘                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. 메모리 아키텍처

### 3.1 메모리 계층 구조

```
┌─────────────────────────────────────────────────────────────────┐
│                     메모리 계층 아키텍처                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────┐               │
│  │  Layer 1: Working Memory (작업 기억)         │               │
│  │  ─────────────────────────────────────       │               │
│  │  • 현재 대화 Context Window 내 메시지        │               │
│  │  • 저장: Redis (캐시)                        │               │
│  │  • 유지: 대화 세션 동안                       │               │
│  │  • 용량: 모델 Context Window 크기             │               │
│  └──────────────────────────────────────────────┘               │
│                          ▼ (70% 도달 시 요약)                   │
│  ┌──────────────────────────────────────────────┐               │
│  │  Layer 2: Episodic Memory (일화 기억)        │               │
│  │  ─────────────────────────────────────       │               │
│  │  • 대화 요약본                               │               │
│  │  • 저장: PostgreSQL + pgvector              │               │
│  │  • 검색: 유사도 + 시간 가중치                │               │
│  │  • 용량: 기본 30개, 포인트로 확장 가능        │               │
│  └──────────────────────────────────────────────┘               │
│                          │                                      │
│  ┌──────────────────────────────────────────────┐               │
│  │  Layer 3: Semantic Memory (의미 기억)        │               │
│  │  ─────────────────────────────────────       │               │
│  │  • 사실 정보: 생일, 이름, 선호도             │               │
│  │  • 저장: PostgreSQL (구조화)                │               │
│  │  • 이벤트 감지로 자동 추출                   │               │
│  │  • 만료: 없음 (영구 보존)                    │               │
│  └──────────────────────────────────────────────┘               │
│                          │                                      │
│  ┌──────────────────────────────────────────────┐               │
│  │  Layer 4: Emotional Memory (감정 기억)       │               │
│  │  ─────────────────────────────────────       │               │
│  │  • 감정적으로 중요한 순간                    │               │
│  │  • 저장: PostgreSQL + pgvector              │               │
│  │  • 예: 첫 고백, 큰 싸움, 화해               │               │
│  │  • 만료: 없음 (영구 보존)                    │               │
│  └──────────────────────────────────────────────┘               │
│                                                                 │
│  ┌──────────────────────────────────────────────┐               │
│  │  Raw Storage: 원본 대화 (MongoDB)            │               │
│  │  ─────────────────────────────────────       │               │
│  │  • 전체 대화 기록 텍스트                     │               │
│  │  • AI 참조 불가, 사용자 열람용               │               │
│  │  • 만료: 없음 (영구 보존)                    │               │
│  └──────────────────────────────────────────────┘               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 저장소별 역할

| 저장소 | 용도 | 데이터 |
|--------|------|--------|
| **Redis** | 작업 기억 캐시 | 현재 Context Window |
| **PostgreSQL + pgvector** | 기억 저장 + 벡터 검색 | 요약, 사실, 감정 |
| **MongoDB** | 원본 대화 저장 | 전체 대화 텍스트 |

---

## 4. 요약 시스템

### 4.1 요약 트리거

```
┌─────────────────────────────────────────────────────────────────┐
│                     요약 트리거 조건                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  트리거: Context Window 70% 도달 시                             │
│                                                                 │
│  [토큰 계산 예시 - GPT-4 기준]                                  │
│  ─────────────────────────────                                  │
│  • Context Window: 8,192 토큰                                  │
│  • 시스템 프롬프트: ~500 토큰                                   │
│  • 기억 주입: ~500 토큰                                        │
│  • 가용 공간: ~7,000 토큰                                      │
│  • 70% 도달: ~4,900 토큰                                       │
│                                                                 │
│  [요약 대상]                                                    │
│  ─────────                                                      │
│  • 가장 오래된 대화 50% 선택                                   │
│  • 예: 20개 대화 중 앞 10개 요약                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 요약 프로세스 플로우

```
┌─────────────────────────────────────────────────────────────────┐
│                     비동기 요약 프로세스                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 토큰 70% 도달 감지                                         │
│     │                                                           │
│     ▼                                                           │
│  2. 현재 message_id 기록 (동시성 처리용)                        │
│     │                                                           │
│     ▼                                                           │
│  3. 백그라운드 Job 생성 (비동기)                                │
│     │                                                           │
│     ├──→ 사용자는 계속 대화 가능                               │
│     │                                                           │
│     ▼                                                           │
│  4. 앞부분 50% 대화 추출                                       │
│     │                                                           │
│     ▼                                                           │
│  5. LLM으로 요약 생성 (캐릭터 관점)                            │
│     │                                                           │
│     ▼                                                           │
│  6. 임베딩 생성 (OpenAI Embeddings)                            │
│     │                                                           │
│     ▼                                                           │
│  7. Vector DB 저장 (pgvector)                                  │
│     │                                                           │
│     ▼                                                           │
│  8. Working Memory에서 요약된 부분 제거                         │
│     (기록된 message_id까지만)                                   │
│     │                                                           │
│     ▼                                                           │
│  9. 완료 (사용자에게 알림 없음, 자연스럽게 처리)                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 요약 프롬프트

```
[시스템 프롬프트 - 요약 생성용]

당신은 "{캐릭터명}"입니다. 
아래 대화 내용을 당신의 시점에서 기억으로 요약해주세요.

[요약 가이드라인]
- 1인칭 시점으로 작성 ("우리가 ~했다", "그/그녀가 ~라고 말했다")
- 200자 이내로 요약
- 감정과 뉘앙스를 보존
- 캐릭터의 말투와 성격을 반영

[포함할 내용]
- 주요 화제 (무엇에 대해 대화했는지)
- 사용자의 감정 상태
- 기억해야 할 특별한 순간
- 다음에 이어갈 수 있는 주제

[대화 내용]
{conversation}

[출력 형식]
하나의 자연스러운 문단으로 작성
```

### 4.4 비용 정책

| 항목 | 포인트 차감 |
|------|------------|
| **AI 응답 생성** | 1포인트 |
| **대화 요약** | 무료 (시스템 부담) |
| **이벤트 감지** | 무료 (시스템 부담) |

---

## 5. RAG 검색 시스템

### 5.1 검색 파이프라인

```
┌─────────────────────────────────────────────────────────────────┐
│                     RAG 검색 파이프라인                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [입력] 사용자 메시지: "우리 지난번에 뭐 했었지?"               │
│                          │                                      │
│                          ▼                                      │
│  ┌───────────────────────────────────────┐                     │
│  │  Step 1: 쿼리 임베딩 생성             │                     │
│  │  OpenAI text-embedding-3-small        │                     │
│  └───────────────────────────────────────┘                     │
│                          │                                      │
│                          ▼                                      │
│  ┌───────────────────────────────────────┐                     │
│  │  Step 2: 다중 검색 (병렬)             │                     │
│  │  ├─ Episodic Memory (유사도 검색)     │                     │
│  │  ├─ Semantic Memory (사실 정보)       │                     │
│  │  └─ Emotional Memory (감정 기억)      │                     │
│  └───────────────────────────────────────┘                     │
│                          │                                      │
│                          ▼                                      │
│  ┌───────────────────────────────────────┐                     │
│  │  Step 3: 점수 계산 및 재순위화         │                     │
│  │  score = similarity * 0.5             │                     │
│  │        + recency * 0.3                │                     │
│  │        + importance * 0.2             │                     │
│  └───────────────────────────────────────┘                     │
│                          │                                      │
│                          ▼                                      │
│  ┌───────────────────────────────────────┐                     │
│  │  Step 4: 상위 5개 기억 선택           │                     │
│  └───────────────────────────────────────┘                     │
│                          │                                      │
│                          ▼                                      │
│  ┌───────────────────────────────────────┐                     │
│  │  Step 5: 캐릭터 내러티브로 변환       │                     │
│  └───────────────────────────────────────┘                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 프롬프트 주입 방식 (캐릭터 관점 내러티브)

```
[최종 프롬프트 구조]

System: 당신은 "{캐릭터명}"입니다. {캐릭터 성격 설명}

{캐릭터명}이(가) 기억하는 것들:
"저번에 유저랑 영화 얘기했었지. 액션 영화 좋아한다고 했었어.
아, 그리고 3월 15일이 생일이래. 기억해둬야지.
지난번에 좀 기분이 안 좋아 보였는데, 오늘은 괜찮아 보여서 다행이야."

[대화 기록]
User: ...
Assistant: ...
User: 우리 지난번에 뭐 했었지?
```

### 5.3 시간 가중치 계산

```javascript
// 시간 기반 점수 감쇠 (최근일수록 높은 점수)
function calculateRecencyScore(createdAt) {
  const daysSince = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
  
  if (daysSince < 1) return 1.0;      // 오늘
  if (daysSince < 7) return 0.8;      // 이번 주
  if (daysSince < 30) return 0.5;     // 이번 달
  if (daysSince < 90) return 0.3;     // 최근 3개월
  return 0.1;                          // 오래된 기억
}
```

---

## 6. 이벤트 감지 시스템

### 6.1 감지 대상 이벤트

```
┌─────────────────────────────────────────────────────────────────┐
│                     이벤트 감지 대상                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [사실 정보 (Semantic Memory)]                                  │
│  ────────────────────────────                                   │
│  • 개인정보: 이름, 나이, 생일, 직업                            │
│  • 선호도: 좋아하는 것, 싫어하는 것                            │
│  • 관계: 가족, 친구, 반려동물                                  │
│  • 습관: 일상 루틴, 취미                                       │
│                                                                 │
│  [감정 이벤트 (Emotional Memory)]                               │
│  ────────────────────────────                                   │
│  • 감정 변화: 화남 → 기쁨, 슬픔 → 위로받음                    │
│  • 관계 변화: 호칭 변경, 친밀도 변화                           │
│  • 중요 순간: 고백, 화해, 약속                                 │
│  • 갈등: 싸움, 오해, 실망                                      │
│  • 마일스톤: 100일, 첫 대화 기념 등                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 사실 정보 추출 프롬프트

```
[시스템 프롬프트 - 사실 추출용]

다음 대화에서 사용자에 대한 사실 정보를 추출해주세요.
확실한 정보만 추출하고, 추측하지 마세요.

[추출 대상]
- personal: 이름, 나이, 생일, 직업, 성별
- preference: 좋아하는 것, 싫어하는 것
- relationship: 가족, 친구, 연인 관계
- habit: 일상 루틴, 취미
- plan: 약속, 미래 계획

[대화 내용]
{recent_messages}

[출력 형식 - JSON]
{
  "facts": [
    {
      "type": "personal.birthday",
      "value": "3월 15일",
      "confidence": 0.95,
      "source_text": "내 생일은 3월 15일이야"
    }
  ],
  "emotional_events": [
    {
      "type": "confession",
      "description": "사용자가 캐릭터를 좋아한다고 고백함",
      "user_emotion": "긴장",
      "intensity": 0.9
    }
  ]
}
```

### 6.3 이벤트 감지 타이밍

| 타이밍 | 처리 방식 | 비용 |
|--------|----------|------|
| **매 5턴마다** | 경량 분류 (빠른 감지) | 낮음 |
| **요약 시점** | 정밀 추출 (요약과 함께) | 무료 (요약에 포함) |
| **사용자 명시** | 즉시 처리 ("내 생일은~") | 낮음 |

---

## 7. 비즈니스 모델

### 7.1 포인트 시스템

```
┌─────────────────────────────────────────────────────────────────┐
│                     포인트 시스템                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [UX 원칙]                                                      │
│  • 무료/유료 기능 차이 없음                                     │
│  • 동일한 사용자 경험 제공                                      │
│  • 포인트로 사용량만 관리                                       │
│                                                                 │
│  [포인트 획득]                                                   │
│  ─────────────                                                  │
│  • 출석체크: 매일 10포인트 (누적 가능)                          │
│  • 결제: 추가 포인트 구매                                       │
│                                                                 │
│  [포인트 소비]                                                   │
│  ─────────────                                                  │
│  • AI 응답 1회 = 1포인트                                       │
│  • 요약/이벤트 감지 = 무료 (시스템 부담)                        │
│                                                                 │
│  [기억 슬롯]                                                    │
│  ──────────                                                     │
│  • 기본: 30개 / 캐릭터                                         │
│  • 확장: 포인트로 추가 구매 가능                               │
│                                                                 │
│  [가격 기준]                                                    │
│  ──────────                                                     │
│  • 약 100원 = 1포인트 (1회 대화)                               │
│  • 만원 ≈ 100회 대화                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 기억 용량 정책

| 항목 | 기본 제공 | 확장 옵션 |
|------|----------|----------|
| 기억 슬롯 (캐릭터당) | 30개 | 포인트로 추가 구매 |
| 캐릭터 수 | 무제한 | - |
| 원본 대화 보존 | 영구 | - |

### 7.3 계정 비활성 정책

```
┌─────────────────────────────────────────────────────────────────┐
│                     비활성 계정 정책                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [90일 비활성 시]                                               │
│  ─────────────────                                              │
│  • 삭제: Episodic Memory (요약된 기억)                         │
│  • 삭제: 임베딩 벡터                                           │
│  • 유지: 원본 대화 텍스트 (열람 가능)                          │
│  • 유지: Semantic Memory (사실 정보)                           │
│  • 유지: Emotional Memory (감정 기억)                          │
│                                                                 │
│  [재활성화 시]                                                  │
│  ─────────────                                                  │
│  • 원본 대화부터 새로 기억 형성                                │
│  • 사실/감정 정보는 유지되어 있음                              │
│                                                                 │
│  [사전 알림]                                                    │
│  ──────────                                                     │
│  • 60일 경과: 이메일 알림                                      │
│  • 80일 경과: 최종 경고                                        │
│  • 90일 경과: 기억 삭제 처리                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. 데이터베이스 스키마

### 8.1 PostgreSQL + pgvector

```sql
-- pgvector 확장 설치
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- 일화 기억 (Episodic Memory) - 대화 요약
-- ============================================
CREATE TABLE episodic_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    
    -- 요약 내용
    summary TEXT NOT NULL,
    topics TEXT[],                         -- 주요 화제 태그
    user_emotion VARCHAR(50),              -- 사용자 감정
    key_moments TEXT[],                    -- 중요 순간들
    
    -- 원본 참조
    start_message_id UUID,                 -- 요약 시작 메시지
    end_message_id UUID,                   -- 요약 끝 메시지
    message_count INT,                     -- 요약된 메시지 수
    
    -- 벡터 임베딩
    embedding VECTOR(1536),                -- text-embedding-3-small
    
    -- 메타데이터
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- 인덱스용
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_character FOREIGN KEY (character_id) REFERENCES characters(id)
);

-- 벡터 검색 인덱스
CREATE INDEX idx_episodic_embedding ON episodic_memories 
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- 복합 인덱스
CREATE INDEX idx_episodic_user_character ON episodic_memories(user_id, character_id);
CREATE INDEX idx_episodic_created ON episodic_memories(created_at DESC);


-- ============================================
-- 의미 기억 (Semantic Memory) - 사실 정보
-- ============================================
CREATE TABLE semantic_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    
    -- 사실 정보 (Triple 구조)
    fact_type VARCHAR(50) NOT NULL,        -- personal, preference, relationship, habit, plan
    fact_subtype VARCHAR(50),              -- birthday, name, likes, etc.
    subject VARCHAR(255),                  -- 주어 (유저, 유저의 엄마 등)
    predicate VARCHAR(255),                -- 관계 (좋아하다, 싫어하다, ~이다)
    object TEXT NOT NULL,                  -- 목적어 (강아지, 3월 15일 등)
    
    -- 신뢰도
    confidence FLOAT DEFAULT 0.8,          -- 0-1
    source_text TEXT,                      -- 원본 발화
    mention_count INT DEFAULT 1,           -- 언급 횟수
    
    -- 벡터 임베딩 (검색용)
    embedding VECTOR(1536),
    
    -- 메타데이터
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- 중복 방지
    UNIQUE(user_id, character_id, fact_type, fact_subtype, object)
);

CREATE INDEX idx_semantic_user_character ON semantic_memories(user_id, character_id);
CREATE INDEX idx_semantic_type ON semantic_memories(fact_type);


-- ============================================
-- 감정 기억 (Emotional Memory) - 중요한 순간
-- ============================================
CREATE TABLE emotional_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    
    -- 이벤트 정보
    event_type VARCHAR(50) NOT NULL,       -- confession, fight, reconcile, milestone, etc.
    description TEXT NOT NULL,             -- 상황 설명
    
    -- 감정 정보
    user_emotion VARCHAR(50),
    character_emotion VARCHAR(50),
    intensity FLOAT,                       -- 감정 강도 0-1
    
    -- 벡터 임베딩
    embedding VECTOR(1536),
    
    -- 메타데이터
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_emotional_embedding ON emotional_memories 
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
CREATE INDEX idx_emotional_user_character ON emotional_memories(user_id, character_id);
CREATE INDEX idx_emotional_type ON emotional_memories(event_type);


-- ============================================
-- 기억 슬롯 관리
-- ============================================
CREATE TABLE memory_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    
    base_slots INT DEFAULT 30,             -- 기본 슬롯
    bonus_slots INT DEFAULT 0,             -- 추가 구매 슬롯
    used_slots INT DEFAULT 0,              -- 사용 중인 슬롯
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(user_id, character_id)
);


-- ============================================
-- 포인트 시스템
-- ============================================
CREATE TABLE user_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    balance INT DEFAULT 0,                 -- 현재 포인트
    total_earned INT DEFAULT 0,            -- 총 획득 포인트
    total_spent INT DEFAULT 0,             -- 총 사용 포인트
    
    last_check_in DATE,                    -- 마지막 출석체크
    check_in_streak INT DEFAULT 0,         -- 연속 출석 일수
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(user_id)
);

CREATE TABLE point_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    amount INT NOT NULL,                   -- 변동량 (+/-)
    balance_after INT NOT NULL,            -- 변동 후 잔액
    
    transaction_type VARCHAR(50) NOT NULL, -- check_in, purchase, chat, slot_purchase
    description TEXT,
    reference_id UUID,                     -- 관련 ID (메시지, 결제 등)
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_point_tx_user ON point_transactions(user_id);
CREATE INDEX idx_point_tx_type ON point_transactions(transaction_type);
```

### 8.2 MongoDB - 원본 대화 저장

```javascript
// conversations 컬렉션
{
  _id: ObjectId,
  
  userId: UUID,
  characterId: UUID,
  
  // 메시지 배열 (전체 대화 기록)
  messages: [
    {
      id: UUID,
      role: "user" | "assistant" | "system",
      content: String,
      timestamp: Date,
      
      // 메타데이터
      tokens: Number,
      isSummarized: Boolean,      // 요약 완료 여부
      summarizedAt: Date,
      summaryId: UUID             // 연결된 요약 ID
    }
  ],
  
  // 통계
  messageCount: Number,
  totalTokens: Number,
  
  // 타임스탬프
  createdAt: Date,
  updatedAt: Date,
  lastActivity: Date
}

// 인덱스
db.conversations.createIndex({ userId: 1, characterId: 1 });
db.conversations.createIndex({ lastActivity: -1 });
```

---

## 9. API 설계

### 9.1 기억 관리 API

```yaml
# 기억 조회
GET /api/memories/:characterId
Query:
  - type: episodic | semantic | emotional (선택)
  - page: number
  - limit: number
Response:
  - memories: Memory[]
  - pagination: { total, page, limit }

# 기억 상세 조회
GET /api/memories/:characterId/:memoryId
Response:
  - memory: Memory
  - relatedMessages: Message[] (원본 대화 연결)

# 기억 수정
PUT /api/memories/:characterId/:memoryId
Body:
  - summary?: string
  - topics?: string[]
  - isImportant?: boolean
Response:
  - memory: Memory

# 기억 삭제
DELETE /api/memories/:characterId/:memoryId
Response:
  - success: boolean

# 기억 검색 (RAG)
POST /api/memories/:characterId/search
Body:
  - query: string
  - limit: number (default: 5)
Response:
  - memories: Memory[]
  - scores: number[]
```

### 9.2 포인트 API

```yaml
# 포인트 조회
GET /api/points
Response:
  - balance: number
  - todayCheckIn: boolean
  - checkInStreak: number

# 출석체크
POST /api/points/check-in
Response:
  - pointsEarned: number
  - newBalance: number
  - streak: number

# 포인트 거래 내역
GET /api/points/transactions
Query:
  - page: number
  - limit: number
Response:
  - transactions: Transaction[]
  - pagination: { total, page, limit }

# 기억 슬롯 구매
POST /api/points/purchase/memory-slots
Body:
  - characterId: string
  - quantity: number
Response:
  - success: boolean
  - newSlotCount: number
  - pointsSpent: number
```

---

## 10. 구현 로드맵

### Phase 1: 기본 인프라 (1주)

```
□ pgvector 확장 설치 및 설정
□ 데이터베이스 스키마 생성
□ 임베딩 서비스 구현 (OpenAI text-embedding-3-small)
□ 기본 CRUD API 구현
```

### Phase 2: 요약 시스템 (1주)

```
□ 토큰 카운터 구현
□ 요약 트리거 로직 (70% 감지)
□ 비동기 요약 Job 구현 (Bull Queue 또는 유사)
□ 요약 프롬프트 최적화
□ 동시성 처리 (message_id 기반)
```

### Phase 3: RAG 검색 (1주)

```
□ 벡터 검색 쿼리 구현
□ 다중 메모리 검색 (병렬)
□ 점수 계산 및 재순위화
□ 캐릭터 내러티브 변환
□ 프롬프트 주입 통합
```

### Phase 4: 이벤트 감지 (1주)

```
□ 사실 정보 추출 로직
□ 감정 이벤트 감지 로직
□ 중복 처리 및 업데이트 로직
□ 신뢰도 계산
```

### Phase 5: 사용자 인터페이스 (1주)

```
□ 기억 열람 UI (Detail 페이지)
□ 기억 수정/삭제 UI
□ 포인트 시스템 UI
□ 출석체크 기능
```

### Phase 6: 최적화 및 테스트 (1주)

```
□ 성능 최적화 (캐싱, 인덱싱)
□ 비용 최적화 (배치 처리)
□ 통합 테스트
□ 부하 테스트
```

---

## 부록: 예상 비용 분석

### 임베딩 비용 (OpenAI text-embedding-3-small)

```
• 가격: $0.00002 / 1K 토큰
• 1개 요약 (200자): ~100 토큰
• 1개 요약 임베딩 비용: $0.000002

• 월 1,000명 × 30개 요약 = 30,000개
• 월 임베딩 비용: $0.06 (약 80원)
```

### 요약 생성 비용 (GPT-4o-mini 가정)

```
• 입력: $0.00015 / 1K 토큰
• 출력: $0.0006 / 1K 토큰
• 1회 요약 (2K 입력, 300 출력): ~$0.0005

• 월 30,000회 요약
• 월 요약 비용: $15 (약 20,000원)
```

### 스토리지 비용 (pgvector)

```
• 1개 임베딩 (1536차원): 6KB
• 30,000개 임베딩: 180MB
• PostgreSQL 스토리지 비용: 거의 무료
```

---

> 📝 **문서 버전**: 1.0
> 📅 **최종 수정**: 2024-12-13
> ✅ **상태**: 설계 완료, 구현 대기

