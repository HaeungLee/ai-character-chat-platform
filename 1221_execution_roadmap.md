# 1221 Execution Roadmap (Updated 2025-12-21)

이 문서는 루트의 계획서들( PROJECT_COMPLETION_PLAN.md, 1220_plan.md, 1213_* 분석 문서 )을 기반으로, **현재 코드베이스 상태를 반영해** “지금부터 무엇을 어떤 순서로 구현할지”를 실행 가능한 작업 단위로 구체화합니다.

## 0) 현재까지 확인된 구현 상태(요약)

이미 구현/정리된 것으로 확인되는 축:
- **캐릭터 CRUD**: 프론트/백엔드 연동 완료 (목록/생성/조회)
- **채팅 실제 LLM 연동**: OpenRouter provider 경로 연결 완료
- **SSE 스트리밍 채팅 UX**: `/api/ai/chat/stream` 사용, 커서 점멸 1개 + 타입라이터(글자 단위) 누적, Abort/cleanup/재시도(무출력 시 1회) 적용
- **타입/빌드**: backend `tsc`, frontend `next build` 통과 상태 유지

주의: 루트 문서 중 일부는 “과거 상태(미구현)”를 가정하고 작성되어 있어, **문서의 ‘미구현’ 표기와 실제 코드가 불일치**할 수 있습니다.

---

## 1) 다음에 할 일 (우선순위 Top 5)

### 1. 채팅 히스토리 영속화(대화 저장/불러오기)
**목표**: 새로고침/다른 기기에서도 대화가 유지되도록 저장.

- Backend
  - `POST /api/chats` (새 세션 생성) / `GET /api/chats?characterId=...` (세션 리스트)
  - `GET /api/chats/:chatId/messages` (메시지 로드) / `POST /api/chats/:chatId/messages` (메시지 저장)
  - 저장소 선택(권장):
    - **MongoDB**: raw 메시지 로그(append-only) + 빠른 쓰기
    - **Postgres(Prisma)**: chat/session 메타데이터(캐릭터/유저/모델/비용)
- Frontend
  - 채팅 진입 시: 최근 세션 자동 로드(없으면 생성)
  - 스트리밍 완료 시 assistant 메시지까지 저장

**수용 기준(AC)**
- 새로고침 후에도 직전 대화 1개가 복구된다.
- 스트리밍 중에도 “partial”은 저장하지 않고, done 시점에 최종 1회 저장한다.

### 2. Memory/RAG를 채팅 경로에 실제로 연결
문서(1213_VectorDB.md)와 서비스 레이어가 존재하더라도, 실제 `/api/ai/chat` / `/api/ai/chat/stream`에서 “기억 검색→프롬프트 주입→요약/임베딩 저장”이 안정적으로 연결되어야 함.

- Backend
  - `RAGService`를 **캐릭터 채팅 생성 직전**에 호출:
    - 최근 대화 + 사용자 메시지로 query 생성
    - 상위 K개의 기억을 system prompt 또는 별도 컨텍스트 블록으로 주입
  - `MemoryIntegration`로:
    - 메시지 저장(원문)
    - 일정 조건(토큰/메시지 수) 충족 시 요약 job 큐잉

**AC**
- 동일 캐릭터로 과거에 언급한 사실을 다음 대화에서 자연스럽게 반영한다.
- 기억 주입이 꺼져도(기능 플래그) 채팅은 정상 동작한다.

### 3. 캐릭터 생성 “위저드”를 실제 데이터 모델에 맞게 정리
1220_plan.md의 위저드 요구(Identity/Personality/Few-shot/Lorebook)를 지금 DB/프론트 구조에 맞춰 “실제로 저장되는 형태”로 확정.

- Few-shot examples: Prisma에 JSON 필드(간단) 또는 별도 테이블(확장성)
- Lorebook: `LorebookEntry` 모델(1220_plan.md 제안) 추가 후 CRUD

**AC**
- 예시 대화/로어북이 저장되고, 채팅 프롬프트에 반영된다.

### 4. Explore(탐색) 피드 + 태그/검색
캐릭터 사용을 늘리는 핵심 진입점.

- Backend: `GET /api/characters`에 `q`, `tags`, `sort`(trending/new) 파라미터
- Frontend: `/characters` 그리드 + 검색/태그 필터

**AC**
- 태그 1개 이상으로 필터링 가능
- 검색어로 name/description 부분일치

### 5. 이미지 생성(캐릭터 아바타) 플로우 고도화
- 캐릭터 생성 시 “텍스트→이미지 생성→선택→저장(avatar URL)”까지 UX 완성
- 저장소는 초기엔 URL만, 추후 S3/Cloudinary로 확장

---

## 2) 플랫폼 품질(운영 필수)

### A. 비용/사용량(UsageTracking) UI 노출
- 백엔드에 UsageTrackingService가 있다면, 프론트 설정/프로필에서 사용량 확인

### B. Rate limit / abuse 방지
- AI 엔드포인트에 사용자 단위 제한(초당/분당)

### C. 에러/관측성
- SSE/Socket/REST 요청별 requestId
- 스트리밍 오류(중단/재시도/최종 실패) 로그

---

## 3) Socket.IO는 언제 붙일까?

현재 SSE 기반으로도 “1:1 채팅” UX는 충분히 가능.
Socket.IO는 아래를 원할 때 우선순위를 올리는 것이 효율적:
- 동시 접속(다중 디바이스) 동기화
- typing indicator / read receipt
- 방(room) 기반 멀티유저

권장: **MVP는 SSE 유지**, 필요해지면 Socket.IO를 “옵션 경로”로 추가.

---

## 4) 2주 단위 실행 스프린트 예시

### Sprint 1 (핵심 완성)
1) 채팅 히스토리 저장/복구
2) RAG/Memory 실제 연결(기능 플래그 포함)

### Sprint 2 (제품성)
3) LorebookEntry + few-shot 저장/주입
4) Explore 피드(검색/태그)

---

## 5) 오픈 질문(결정하면 속도 빨라짐)
- 대화 저장: Mongo를 raw log로 쓸지, Postgres 중심으로 단순화할지
- Few-shot / Lorebook 스키마: JSON(빠름) vs 테이블(확장)
- 모델 설정: 캐릭터별 고정 vs 세션별 선택 UI 제공
