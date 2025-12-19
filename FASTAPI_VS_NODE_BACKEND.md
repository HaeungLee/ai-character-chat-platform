# FastAPI vs 현재 Node(Express+TS) 백엔드 비교 (AI Character Chat Platform)

작성일: 2025-12-20

이 문서는 현재 백엔드( Node.js + TypeScript + Express + Socket.IO + Prisma/Mongo/Redis ) 구조를 기준으로, FastAPI(Python)로 구현했을 때 무엇이 어떻게 달라지는지, 그리고 향후 LoRA 같은 Python 워크로드를 마이크로서비스로 붙이는 전략을 정리합니다.

---

## 1) 현재 백엔드(요약)

현재 백엔드는 다음 특징을 가집니다.

- **런타임/언어**: Node.js + TypeScript
- **HTTP API**: Express에서 라우트/미들웨어를 직접 등록
- **실시간**: Socket.IO 기반(인증/룸/ACK/재연결 등 로직을 서비스 레이어에서 구현)
- **AI**: `AIService`가 여러 프로바이더(OpenAI/OpenRouter/Replicate/Stability 등) 추상화
- **스토리지**: 
  - **Prisma**(주로 RDB 계열)
  - **MongoDB**(메모리/대화/스키마)
  - **Redis**(캐시/세션/레이트리밋 보조 등)
- **스트리밍**: SSE 라우트가 존재(서버→클라이언트 토큰 스트리밍)

장점:
- Socket.IO 중심 “실시간 채팅 UX” 구현에 친화적
- JS/TS 생태계(웹소켓/스트리밍/프런트와 타입 공유)에 강점

주의:
- 런타임 검증(validator/joi 등)과 TS 타입이 분리되어, **스키마/검증/문서(OpenAPI)**를 일관되게 유지하려면 규율이 필요

---

## 2) FastAPI로 했을 때 달라지는 점(핵심 비교)

### 2.1 라우팅/핸들러 스타일

**Express(현재)**
- `req/res` 객체를 직접 다루고
- 미들웨어 체인에서 인증/검증/로깅을 수행하며
- 핸들러 내부에서 `res.status(...).json(...)`처럼 응답을 직접 완성

**FastAPI**
- 핸들러는 보통 `async def endpoint(...) -> ResponseModel:`처럼 “함수 시그니처” 중심
- 입력은 **Pydantic 모델**로 자동 파싱/검증
- 반환값은 `return {...}` 형태로 선언적

결과:
- FastAPI는 “입출력 스키마가 코드에 박혀” OpenAPI가 자동 생성되므로, **API 문서와 실제 구현이 어긋날 가능성이 낮음**

### 2.2 타입/검증/문서(OpenAPI)

- **현재**: TS 타입(컴파일타임) + validator/joi(런타임)이 따로 놀기 쉬움
- **FastAPI**: Pydantic 모델이 런타임 검증 + 스키마 + 문서 생성까지 한 번에 커버

특히 “프런트/백 간 API 계약” 관점에서:
- FastAPI는 OpenAPI 기반으로 프런트 타입을 생성하기 쉬움
- Express도 가능하지만 별도 Swagger 설정/데코레이터/스키마 관리가 필요

### 2.3 비동기/성능 모델

**Node**
- 이벤트 루프 기반 I/O에 강함
- Socket.IO 같은 실시간 라이브러리 성숙

**FastAPI**
- ASGI + `async/await` 기반으로 I/O에 강함
- 단, DB/HTTP 클라이언트까지 **async 친화 라이브러리**를 선택해야 장점이 온전히 나옴
  - 예: httpx, async SQLAlchemy, Motor(MongoDB) 등

CPU/ML 같은 “무거운 연산”
- Node든 FastAPI든 결국 **별도 워커/프로세스/큐**로 빼는 설계가 안정적
- FastAPI는 Python ML 스택과 같은 언어에서 자연스럽게 연결 가능

### 2.4 실시간: Socket.IO vs WebSocket

이 프로젝트는 Socket.IO 의존도가 높은 편입니다(ACK, 재연결, 룸, 이벤트 등).

- **Node(Socket.IO)**: 가장 자연스럽고 운영 레퍼런스도 많음
- **FastAPI(WebSocket)**: 기본 WebSocket은 깔끔하지만 Socket.IO “프로토콜/기능”을 그대로 쓰려면 `python-socketio` 같은 별도 구성이 필요

결론:
- “Socket.IO 이벤트/ACK/재연결 UX”가 핵심이면 **실시간 서버는 Node 유지**가 마이그레이션 리스크가 낮습니다.

### 2.5 배포/운영 방식

**현재(Node)**
- 단일 프로세스(또는 PM2/클러스터) + Nginx/도커 구성

**FastAPI**
- 보통 `uvicorn`/`gunicorn`(uvicorn worker) + Nginx/도커 구성
- 워커 수/스레드/이벤트루프/타임아웃 튜닝이 관건

---

## 3) 이 프로젝트에서의 현실적 선택지

### 선택지 A: 현재(Node) 유지 + 점진 개선
추천 상황:
- Socket.IO 기반 실시간이 “코어 UX”
- 팀이 TS에 익숙

개선 포인트(언어 그대로)
- OpenAPI/스키마를 명확히(예: Zod + OpenAPI 생성, tsoa, nest 같은 프레임워크 도입 등)
- SSE/Socket.IO 스트리밍 경로를 표준화

### 선택지 B: FastAPI로 HTTP API를 대체(전체/부분)
추천 상황:
- API 계약/문서화/검증을 강하게 가져가고 싶음
- Python 기반 RAG/벡터DB/ML 파이프라인이 커질 예정

주의:
- Socket.IO까지 동일하게 옮기면 구현/운영 난이도가 상승할 수 있음

### 선택지 C(권장): **실시간(Node) + ML(FastAPI) 분리 마이크로서비스**
추천 상황:
- 실시간은 Socket.IO로 유지하고
- LoRA/임베딩/RAG/이미지 파이프라인 같은 Python 워크로드를 분리

장점:
- 마이그레이션 리스크가 가장 낮고, 언어 장점도 취할 수 있음

---

## 4) LoRA는 Python 마이크로서비스로 붙이면 되나?

요약: **네, 현실적으로 가장 흔하고 좋은 접근입니다.** 다만 “어떻게 붙이느냐(인터페이스/스트리밍/큐/GPU)”가 중요합니다.

### 4.1 권장 아키텍처(최소 구성)

- **Node 백엔드(기존)**
  - 인증/권한, 결제/사용량, Socket.IO 세션/룸, 채팅 히스토리, SSE 프록시
- **Python 서비스(FastAPI)**
  - LoRA 추론(LLM 또는 이미지), 임베딩/RAG, 모델 로딩/캐시, GPU 스케줄링
- **통신**
  - (간단/범용) HTTP/JSON + (선택) SSE/WebSocket 스트리밍
  - (성능/계약 강함) gRPC
- **비동기 작업(권장)**
  - “즉시 응답이 필요 없는” 작업(학습/대용량 전처리/긴 생성)은 큐(Redis/RabbitMQ/Kafka) 기반

### 4.2 API 계약(Contract) 설계 포인트

- **요청/응답 스키마를 고정**하세요.
  - 예: `POST /v1/lora/generate`
  - 입력: prompt, negative_prompt, seed, steps, lora_id, strength, safety_mode 등
  - 출력: result(text or image_url), metrics(latency, tokens, gpu)

- **스트리밍이 필요하면**
  - Node가 클라이언트와 SSE/Socket.IO를 유지하고
  - Python은 내부적으로 스트리밍(SSE/WebSocket)을 제공
  - Node가 이를 **프록시**(forward)하는 방식이 운영/보안이 단순해짐

### 4.3 인증/권한

- 외부 클라이언트 → Python 서비스 직접 호출은 피하는 편이 안전합니다.
- Node가 JWT를 검증하고, 내부 호출에는 다음 중 하나를 사용:
  - 서비스 간 **내부 API 키**
  - mTLS
  - 짧은 TTL의 내부용 JWT(서비스 어카운트)

### 4.4 GPU/모델 로딩/동시성

- LoRA는 “모델 로딩/VRAM”이 병목이 되기 쉬움
- 권장:
  - Python 서비스는 **모델/LoRA 캐시 전략**(LRU, preload) 필요
  - 동시 요청 제한(큐잉)과 타임아웃 정책 필요
  - 모델별/LoRA별 워커 분리(프로세스/컨테이너)도 고려

### 4.5 데이터 저장 위치

- 결과(생성 텍스트/이미지)와 사용량 로그는 **Node(메인 백엔드)에서 단일화**하는 편이 운영이 단순
- Python은 가능한 “stateless”에 가깝게 두고, 필요 시 Redis/DB를 공유 또는 전용 저장소 사용

---

## 5) 마이그레이션/확장 로드맵(추천)

1. **현 상태 유지** + Python(FastAPI) LoRA 서비스 1개를 “옆에” 세움
2. Node에서 내부 호출용 클라이언트(재시도/타임아웃/서킷브레이커)를 추가
3. LoRA 생성/임베딩/RAG 등 Python이 유리한 기능부터 순차적으로 분리
4. 필요해지면 OpenAPI 기반 타입 생성/공유로 계약을 강하게

---

## 6) 결론

- FastAPI는 **검증/스키마/문서화/ML 생태계** 측면에서 강점이 크고,
- 현재 프로젝트는 **Socket.IO 기반 실시간** 비중이 커서, 전면 교체보다
- **Node(실시간/인증/플랫폼) + FastAPI(LoRA/ML/RAG)** 마이크로서비스 분리가 비용 대비 효과가 좋은 편입니다.

