# Product Pipeline v1 (2025-12-30)

목표
- DB/Prompt/SSE/Memory가 늘어나도 "한 눈에" 구조가 보이게 만든다.
- 초기 단계(한국어 테스트)에서 품질 안정화를 위해 prompt rules를 강하게 고정한다.

참조 문서
- DB: [db_contract_v1.md](db_contract_v1.md)
- Prompt Assembly: [prompt_assembly_v1.md](prompt_assembly_v1.md)
- SSE: [sse_pipeline_v1.md](sse_pipeline_v1.md)
- Memory/State: [memory_context_strategy.md](memory_context_strategy.md)

---

## 1) Storage Contract (SoT)

- 제품 채팅 SoT: Postgres (Prisma) `Chat`, `Message`
- 메모리 파이프라인 로그: Mongo `chat_messages`
- 검색 가능한 장기기억: Postgres `episodic_memories`, `semantic_memories`, `emotional_memories` + pgvector `memory_embeddings`

---

## 2) Request → Prompt → Stream (SSE)

### Step A: Auth
- 토큰 검증 → `userId`

### Step B: Chat Session
- 프론트가 `ChatController.ensureChatForCharacter`로 `chatId` 확보

### Step C: Character Load
- 캐릭터 + 활성 lorebook + exampleDialogues 로드

### Step D: Prompt Assembly (강한 규칙)
- Base Persona + Hard Rules + Lorebook(trigger) + Examples
- 결과: `assembledSystemPrompt`

### Step E: State + RAG Injection
- `memoryIntegration.beforeMessageProcess(...)` → 내부에서 `ragService.buildSystemPromptWithMemory(...)`
  - (1) 현재 상태(캐논) 블록 주입(semantic memories 기반)
  - (2) RAG 기억 블록 주입(episodic/semantic/emotional 검색)
- 결과: `finalSystemPrompt`

### Step F: Memory Save (optional)
- `chatId` 있을 때만
  - user 메시지 → `afterMessageProcess(role='user')`
  - done 시 assistant 최종 응답 → `afterMessageProcess(role='assistant')`

### Step G: Streaming
- LLM provider(OpenRouter/OpenAI) 스트리밍
- SSE: start → chunk* → done → [DONE]

---

## 3) Background Pipeline

- 컨텍스트 체크(주기): `MemoryIntegration`의 message counter
- 70% 도달 시 요약 job 생성: `SummarizationJob`
- 요약 결과 저장:
  - Episodic summary → `episodic_memories` (+ embedding)
  - Important facts → `semantic_memories` (+ embedding)
  - Emotional moments → `emotional_memories` (+ embedding)

---

## 4) MVP Guardrails (초기 단계)

- 출력 언어: 한국어 고정(테스트 정책)
- 메타 금지: 프롬프트/정책/메모리 블록 언급 금지
- 상태 우선: "현재 상태(캐논)"은 최신 사실로 취급(리셋 방지)
- RAG는 참고: 기억 블록은 직접 언급하지 않음
