# SSE Pipeline v1 (2025-12-30)

목표
- 프론트가 사용하는 SSE 스트리밍 채팅 경로에서,
  - prompt assembly(로어북/예시)
  - RAG 주입
  - 메모리 저장(유저/AI)
을 “하나의 파이프라인”으로 연결한다.

적용 대상
- `POST /api/ai/chat/stream`

---

## 1) 요청/응답 계약(v1)

### Request body (권장)
- `characterId: string`
- `message: string`
- `conversationHistory?: { role: 'user'|'assistant'; content: string }[]`
- `provider?: 'openai'|'openrouter'`
- `model?: string`
- `nsfwMode?: boolean`
- `chatId?: string`  (중요: 메모리 저장/요약 단위)

### Response (SSE)
- start: `{ type: 'start', characterId, characterName }`
- chunk: `{ type: 'chunk', content }`
- done: `{ type: 'done', fullResponse, usage }`
- error: `{ type: 'error', error }`
- `[DONE]`로 종료

---

## 2) 서버 파이프라인 단계(v1)

### Step 0: 인증
- `authenticateToken`에서 `userId` 확보

### Step 1: 캐릭터 로드
- `characterId`로 캐릭터 조회
- 필요한 필드
  - `name/personality/systemPrompt/temperature`
  - `lorebookEntries(active)`
  - `exampleDialogues`

### Step 2: Prompt Assembly(로어북/예시)
- `baseSystemPrompt`를 확장해 `assembledSystemPrompt` 생성

### Step 3: RAG 주입(beforeMessageProcess)
- `memoryIntegration.beforeMessageProcess(userId, characterId, characterName, userMessage, assembledSystemPrompt)`
- 결과 `systemPrompt`를 최종 사용

추가(현재 구현)
- `RAGService.buildSystemPromptWithMemory()` 내부에서
  - semantic memories 기반 "현재 상태(캐논)" 블록
  - RAG 기억 블록
  순으로 system prompt에 주입된다.

### Step 4: (선택) 메모리 저장 - user
- `chatId`가 있으면 `afterMessageProcess(role='user')`

### Step 5: 스트리밍 생성
- `aiService.generateCharacterResponseStream(enhancedCharacter, message, conversationHistory, options)`
- chunk 단위로 SSE 전송

### Step 6: (선택) 메모리 저장 - assistant
- `chatId`가 있으면 `afterMessageProcess(role='assistant', content=fullResponse)`

---

## 3) 저장 정책(v1)

- partial 저장 금지: 스트리밍 중간 텍스트는 저장하지 않는다.
- done 시점에 최종 1회 저장(프론트는 이미 Postgres 저장을 수행 중)
- 백엔드는 v1에서 Memory(Mongo/Vector) 저장만 담당(확장 가능)

SoT(소스 오브 트루스)
- 채팅 제품 데이터(채팅/메시지) SoT: Postgres
- 메모리 파이프라인 로그 SoT: Mongo
- 검색 가능한 장기 기억 SoT: Postgres + pgvector

---

## 4) 에러/재시도(v1)

- 서버는 streaming 중 오류를 `type:error`로 내보내고 `[DONE]`로 종료한다.
- 프론트는 “아직 한 글자도 출력되지 않은 경우”에 한해 1회 자동 재시도(현 정책 유지)

---

## 5) AC(수용 기준)

- SSE 경로에서 lorebook/examples/memory가 실제 반영된다.
- `chatId`가 들어오면 user/assistant 메시지가 메모리 시스템(Mongo)에 저장된다.
- RAG 실패 시에도 스트리밍은 정상 동작하며 base prompt로 폴백한다.
