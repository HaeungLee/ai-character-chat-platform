# 1230 Summary v2 — 중복 없이 정리 (2025-12-30)

이 문서는 [1230_summary.md](1230_summary.md) 내용을 **그대로 반복하지 않고**, “현재 코드 상태 기준으로 무엇이 확정/검증됐는지”와 “오늘 추가된 변화(특히 SSE chatId SoT, LoRA 문서)”만 중심으로 재정리한 버전이다.

---

## 0) 오늘 기준 핵심 결론
- **캐릭터 채팅(REST/SSE)은 동일한 Prompt Assembly + RAG(옵션) + 메모리 후처리 단계**를 공유한다.
- **SSE는 done 이후에만** 메모리 후처리를 실행한다(스트리밍 중간 저장/후처리 금지).
- **SSE chatId는 서버가 SoT**가 되도록 보강했다: 유효하지 않거나 없으면 서버가 생성하고, `start` 이벤트로 `chatId`를 내려준다.
- **LoRA/파인튜닝 파이프라인 문서**를 `1230_LoRA.md`로 새로 정리했다.

---

## 1) 확정된 구현(SoT/일관성 관점)

### 1.1 Prompt Assembly (품질 고정)
- 역할: 캐릭터 프롬프트를 “항상 같은 규칙으로” 조립
- 포함 요소:
  - 로어북: 키 트리거 매칭 → 우선순위 정렬 → 상한(max) 적용
  - 예시대화: JSON 파싱 → `[EXAMPLES]` 블록 주입(길이 clamp)
  - 하드룰: 메타/OOC 억제 + 출력 언어 정책

관련: packages/backend/src/services/prompt/PromptAssembly.ts

### 1.2 캐릭터 프롬프트 + RAG 주입 단일 경로
- 역할: Prompt Assembly 결과에 대해, 로그인 유저일 때만 RAG/메모리 컨텍스트를 주입
- 실패 시에도 프롬프트만으로 정상 응답 진행(fail-safe)

관련: packages/backend/src/services/chat/CharacterChatPipeline.ts

### 1.3 캐릭터 채팅 턴 파이프라인 (REST/SSE 통합)
- 역할: “프롬프트+RAG → LLM 호출 → 메모리 후처리”를 REST/SSE 모두 같은 흐름으로 실행
- SSE 원칙: **스트리밍 중엔 절대 저장/메모리 후처리 금지**, `done`에서만 후처리

관련: packages/backend/src/services/chat/CharacterChatTurnPipeline.ts

---

## 2) 오늘 추가/보강된 구현(가장 큰 변화)

### 2.1 SSE chatId SoT 확정(UX/정합성)
목표: 클라이언트가 chatId를 안 주거나/틀리게 줘도 서버가 “세션 단위 저장/메모리 후처리”를 안정적으로 수행할 수 있게 함.

동작 요약:
- 요청에 `chatId`가 있더라도, 서버는 **(userId 소유 + characterId 일치)**를 확인한다.
- 조건이 맞지 않거나 `chatId`가 없으면, 서버가 새 `Chat`을 만들고 그 id를 사용한다.
- SSE `start` 이벤트에 `chatId`를 포함해서 내려준다.
- 이후 unified turn pipeline은 resolve된 `chatId`로 메모리 후처리를 수행한다.

관련:
- packages/backend/src/controllers/AIController.ts
- packages/backend/src/services/chat/ChatSessionService.ts
- packages/frontend/src/app/chat/[characterId]/page.tsx

프론트 반영:
- SSE 파서가 `type: 'start'`를 처리하며 `chatId`가 오면 `setChatId`로 상태를 갱신한다.

### 2.2 LoRA/파인튜닝 문서 추가
- LoRA의 목적/전제(RAG vs LoRA 역할 분리)
- 데이터 수집→정제→학습(LoRA/QLoRA)→평가 게이트→서빙/롤백까지 end-to-end 체크리스트

관련: 1230_LoRA.md

---

## 3) 검증 상태(테스트가 ‘끝났는지’에 대한 답)

### 3.1 이미 통과한 AC (실행 완료)
아래 2개는 이 작업 흐름에서 반복 실행했고, 현재도 PASS다.
- `node scripts/verify_prompt_assembly_ac.js`
  - 로어북 트리거/우선순위/limit
  - 예시대화 JSON 파싱/주입/clamp
  - 하드룰 + 언어 정책
- `node scripts/verify_character_chat_turn_ac.js`
  - REST: 최종 응답 후 메모리 후처리
  - SSE: chunk 중에는 후처리 0회, done 이후에만 후처리

### 3.2 SSE chatId SoT 검증(현재 상태)
- **SoT 전용 AC 스크립트는 추가했지만**, 현재 터미널 환경에 `DATABASE_URL`이 설정되어 있지 않아 자동 실행이 **SKIP** 됐다.
  - 추가된 스크립트: packages/backend/scripts/verify_chatid_sot_ac.js
  - 이 스크립트는 Prisma로 실제 DB에 테스트 유저/캐릭터/채팅을 만들고, SoT 로직이 기대대로 동작하는지 검사한다.

실제로 SoT AC까지 “완료(PASS)”로 만들려면:
1) backend가 접근 가능한 Postgres `DATABASE_URL`을 설정
2) `cd packages/backend`
3) `npm run build`
4) `node scripts/verify_chatid_sot_ac.js`

(참고) 만약 docker-compose 기반으로 DB를 띄우는 방식이면, DB 컨테이너/환경 변수 로딩이 된 쉘에서 위 명령을 실행해야 한다.

---

## 4) 현재 남은 리스크/갭(중복 없이 핵심만)
- **SoT 검증의 자동화는 스크립트는 준비됐지만 DB 연결이 없으면 SKIP**된다 → 환경만 잡히면 바로 PASS/FAIL로 확정 가능
- “SSE start 이벤트에 chatId가 반드시 포함되는지”는 현재 구현상 포함되지만, 이는 **E2E(실제 서버 구동 + 인증 토큰) 기반 테스트**로 한 번 더 확인하는 게 가장 확실하다

---

## 5) 다음 액션(권장)
- `DATABASE_URL`을 터미널에 설정한 뒤 `verify_chatid_sot_ac.js`를 실행해서 SoT를 PASS로 확정
- 그 다음 단계로는 저장 SoT(서버 vs 프론트) 정책을 확정하고, 중복 저장/ID 충돌 가능성을 제거
