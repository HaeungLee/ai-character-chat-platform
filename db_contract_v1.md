# DB Contract v1 (2025-12-30)

목표
- 프로젝트가 커지기 전에 **데이터의 소유권(SoT: Source of Truth)** 을 확정해, 구현이 늘어도 난잡해지지 않게 한다.
- "매우 critical한 이슈"만 스키마/제약을 최소 수정하고, 나머지는 확장으로 흡수한다.

---

## 0) 결론(SoT 요약)

- **채팅 UX/제품 데이터의 SoT = PostgreSQL (Prisma)**
  - `Chat`, `Message`, `Character`, `LorebookEntry`, `User`
- **메모리 파이프라인(원본 로그/요약 아카이브/작업용 메타) = MongoDB**
  - 원본 로그(`chat_messages`)는 메모리/요약 트리거와 관측용
- **검색/회상 가능한 장기기억의 SoT = PostgreSQL + pgvector**
  - `episodic_memories`, `semantic_memories`, `emotional_memories`
  - 벡터는 `memory_embeddings`(Raw SQL 테이블) + 해당 memory row의 `embeddingId`로 연결
- **Redis = 캐시/레이트리밋/working-memory 용도(선택)**
  - MVP에서 필수 아님(있으면 성능/비용 최적화에만 사용)

---

## 1) 왜 이렇게 나누는가

- 제품 기능(채팅 목록/메시지 조회/삭제/권한 등)은 **정합성·권한·쿼리**가 중요 → Postgres가 적합
- 요약/추출/RAG는 **비동기 파이프라인 + 로그성 데이터**가 많음 → Mongo가 운영 편의성이 높음
- 장기기억 검색은 **벡터 검색 + 구조화 사실**이 필요 → Postgres + pgvector가 단순하고 일관됨

---

## 2) 데이터 흐름(실제 구현 기준)

### 2.1 채팅 저장(제품)
- 프론트/서버가 `ChatController`를 통해 Postgres에 `Message`를 저장/조회
- 이 데이터는 사용자 UX의 정답(SoT)

### 2.2 메모리 저장(파이프라인)
- 서버가 `MemoryIntegration.afterMessageProcess()`로 Mongo `chat_messages`에 메시지를 별도 기록
- 컨텍스트 체크/요약 트리거 및 중요정보 추출에 사용

### 2.3 장기기억 저장(검색)
- 요약 작업 또는 실시간 추출 결과를 Postgres memory tables에 저장
- 임베딩은 `memory_embeddings`에 저장하고 `embeddingId`로 연결

---

## 3) 최소한의 스키마/제약 원칙

### 3.1 지금 당장 "치명적인" 후보

- `semantic_memories`의 동일 key 중복 방지
  - 현재 로직은 `configId + key` 기준으로 update를 기대하지만, DB 레벨 제약이 없으면 중복이 생길 수 있음
  - 권장(치명도: 중간~높음): `@@unique([configId, key])`

### 3.2 지금은 확장으로 두는 항목

- server-owned message persistence(프론트 임의 upsert 방지)
  - 제품 단계에서 중요하지만, MVP 초기에는 빠른 반복이 우선
  - 추후: 백엔드가 메시지 생성/저장을 전담하고, 프론트는 append-only로 전환

---

## 4) 운영/확장 가이드

- 새 기능이 데이터를 추가할 때 먼저 결정할 것
  1) **SoT가 어디인가?** (Postgres vs Mongo vs Redis)
  2) **조회 패턴이 무엇인가?** (리스트/필터/권한/검색)
  3) **삭제/수정 권한이 필요한가?** (필요하면 Postgres 우선)

---

## 5) AC

- 어떤 데이터가 어디에 저장되는지 팀 내에서 논쟁 없이 결정된다.
- 메모리 파이프라인이 늘어나도 채팅 제품 데이터(SoT)가 흔들리지 않는다.
- 최소 제약(유니크 등)으로 중복/비정합 리스크를 낮춘다.
