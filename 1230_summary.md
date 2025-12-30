# 1230 Summary — 구현 정리 (2025-12-30)

목표(요약): 기존 코드베이스의 강점(SSE 스트리밍, 채팅 저장/복구, 메모리 시스템)을 **하나의 일관된 “프롬프트/컨텍스트 파이프라인”**으로 묶어, 무료/저비용에서도 텍스트 답변 품질을 안정화할 기반을 만든다.

---

## 무엇을 정리했는지

### 1) Prompt Assembly 공통 모듈화(품질 고정 장치)
- 캐릭터 프롬프트 조립을 `assembleSystemPrompt()`로 통합.
- 로어북은 **키 트리거 매칭 기반으로 관련 항목만 주입**하도록 구현.
- 예시대화(Few-shot)는 JSON을 파싱해 `[EXAMPLES]` 블록으로 주입.
- 초기 품질 안정화를 위해 `[HARD_RULES]` 블록(메타/OOC 방지 + 출력 언어 정책)을 옵션으로 포함.

관련 파일
- packages/backend/src/services/prompt/PromptAssembly.ts

### 2) “프롬프트+RAG 주입”을 단일 헬퍼로 통합
- 캐릭터 채팅용 시스템 프롬프트 생성(기본 프롬프트 + 로어북 + 예시대화 + 하드룰)과, 유저가 있을 때 RAG/State 주입을 한 함수로 묶음.
- 실패 시(메모리/RAG 에러)에도 **프롬프트만으로 정상 채팅 진행**되는 fail-safe 유지.

관련 파일
- packages/backend/src/services/chat/CharacterChatPipeline.ts

### 3) SSE/REST 캐릭터 채팅의 “턴 처리” 최소 파이프라인 도입
- SSE/REST의 캐릭터 채팅 처리 흐름(프롬프트+RAG → LLM 호출 → 메모리 후처리)을 **단일 파이프라인 함수**로 통합.
- 특히 SSE의 특성(토큰이 먼저 흘러나감)을 반영해서,
  - **placeholder/partial 저장을 하지 않고**
  - **최종 응답이 확정된 뒤에만** 메모리 후처리(`afterMessageProcess`)가 실행되도록 고정.
- 메모리 후처리는 fire-and-forget로 실행해서 UX/스트리밍 지연을 만들지 않도록 함.

관련 파일
- packages/backend/src/services/chat/CharacterChatTurnPipeline.ts
- packages/backend/src/controllers/AIController.ts

### 4) DB 안정성 최소 수정(중복 방지) + 실제 DB 반영/검증
- Semantic Memory 중복을 막기 위해 `(configId, key)` 복합 유니크 제약을 도입.
- Prisma migrate drift 이슈 때문에 **비파괴적 방식(db push)** 으로 반영.
- 실제 DB에서 중복 insert가 실패(P2002)하는 것을 스크립트로 검증.

관련 파일(요약)
- packages/backend/prisma/schema.prisma
- packages/backend/src/services/memory/MemoryService.ts
- packages/backend/scripts/verify_semantic_unique.js

---

## 구현 결과

### API 동작(핵심)
- REST 캐릭터 채팅(`/api/ai/character/chat` 계열):
  - 동일한 Prompt Assembly 정책 + 동일한 RAG 주입을 거쳐 응답 생성
  - 최종 응답 생성 후 메모리 후처리 실행(옵션: userId+chatId 있을 때)
- SSE 캐릭터 채팅(`/api/ai/chat/stream`):
  - 동일한 Prompt Assembly 정책 + 동일한 RAG 주입을 거쳐 스트리밍
  - 스트리밍 중간에는 저장/메모리 처리를 하지 않음
  - 스트리밍 종료(최종 fullResponse 확정) 후에만 메모리 후처리 실행

### 빌드/안정성
- 백엔드 `tsc` 빌드 성공.
- 메모리/RAG 주입이 실패해도 채팅이 깨지지 않는 fail-safe 유지.

### AC 자동 검증(추가)
- Prompt Assembly AC 스크립트로 Lorebook 트리거/예시대화/하드룰을 자동 검증.
  - packages/backend/scripts/verify_prompt_assembly_ac.js
- Character Chat Turn(REST/SSE) AC 스크립트로 “SSE는 done 이후에만 메모리 후처리”를 자동 검증.
  - packages/backend/scripts/verify_character_chat_turn_ac.js

실행 방법
- `cd packages/backend`
- `npm run build`
- `node scripts/verify_prompt_assembly_ac.js`
- `node scripts/verify_character_chat_turn_ac.js`

---

## 왜 이렇게 구현했는지 (최소 복잡성 원칙)

### 1) “완전 통합”을 하되, 책임 경계를 안 흔들기
- 현재 프론트는 Prisma 메시지 저장을 `ChatController.upsertMessage`로 수행한다.
- 서버가 갑자기 “메시지 저장까지” 통합해버리면, **중복 저장/ID 충돌/정합성 문제**가 즉시 발생할 수 있음.
- 그래서 이번 통합은 **서버가 책임져야 일관성이 생기는 영역(프롬프트+RAG+메모리 후처리)** 만 통합하고, 메시지 저장 정책(프론트 주도)은 유지했다.

### 2) SSE의 본질(토큰 선출력)을 반영
- 스트리밍 중간에는 결과가 확정되지 않으므로, 메모리/요약에 넣으면 품질/정합성/비용이 흔들릴 수 있음.
- 따라서 “partial 저장 금지, done 시점 확정 저장”을 코드로 강제했다.

### 3) 오케스트레이션(agents) 이전 단계에 맞는 구조
- 아직은 agent 검증/재작성 같은 오케스트레이션을 넣기엔 비용/복잡성이 큼.
- 대신 파이프라인 내부를 steps로 분리 가능한 형태로 만들고(현재는 함수 분리/단계 로그), 나중에 조건부 검증(샘플링/유료/장문 등)만 추가할 수 있게 기반을 마련했다.

---

## 남은 갭(현실 점검)
- 로어북 키 트리거/예시대화 주입은 Prompt Assembly에 구현되어 있으나,
  - 실제 콘텐츠/키 품질(키 설계, 우선순위 정책, 충돌 시 처리)은 아직 AC 관점에서 충분히 검증되지 않음.
- SSE/REST는 턴 파이프라인으로 통합했지만,
  - Socket.IO 경로까지 동일 파이프라인(또는 동일 steps)으로 완전 통합은 아직 단계적으로 진행 필요.
- “메시지 저장(Prisma) 주도권”은 현재 프론트/서버 혼재 가능성이 있어, 장기적으로 SoT를 확정해야 함.

---

## 다음 계획(AC 2~3개로 쪼개서)

### Next Step A — Lorebook/Examples AC 검증 + 최소 보강
- AC-1: 특정 키워드 포함 유저 입력에서 로어북 항목이 실제로 주입되고, 응답에 반영된다.
- AC-2: 예시대화가 있는 캐릭터에서 말투/어조가 안정적으로 유지된다.
- AC-3: 트리거가 없을 때 로어북이 주입되지 않아 토큰이 과증가하지 않는다.

### Next Step B — Socket 경로 파이프라인 정렬
- SSE/REST와 동일한 Prompt Assembly + RAG/State 주입 + 메모리 후처리가 Socket 경로에서도 동일 규칙으로 동작하도록 정리.

### Next Step C — 저장 정책(SoT) 확정
- 서버 저장 vs 프론트 저장을 한쪽으로 수렴(중복/충돌 제거).
- (권장) 최종적으로는 서버가 턴 단위로 저장/후처리를 일괄 처리하고, 프론트는 표시/편집/재생성 요청만 수행.
