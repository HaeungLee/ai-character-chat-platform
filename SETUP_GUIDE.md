# 🚀 AI 캐릭터 채팅 플랫폼 - 설치 가이드

## 📋 목차
1. [사전 요구사항](#사전-요구사항)
2. [환경 변수 설정](#환경-변수-설정)
3. [데이터베이스 설정](#데이터베이스-설정)
4. [백엔드 설정](#백엔드-설정)
5. [프론트엔드 설정](#프론트엔드-설정)
6. [AI 서비스 설정](#ai-서비스-설정)
7. [테스트 실행](#테스트-실행)

---

## 사전 요구사항

### 필수 소프트웨어
- **Node.js**: 18.x 이상 ([다운로드](https://nodejs.org/))
- **npm**: 9.x 이상 (Node.js와 함께 설치됨)
- **PostgreSQL**: 15.x 이상 ([다운로드](https://www.postgresql.org/download/))
- **MongoDB**: 7.x 이상 ([다운로드](https://www.mongodb.com/try/download/community))
- **Redis**: 7.x 이상 (선택사항) ([다운로드](https://redis.io/download))

### 선택 도구
- **Docker**: 데이터베이스를 컨테이너로 실행할 경우
- **Postman/Thunder Client**: API 테스트용

---

## 환경 변수 설정

### 1. 백엔드 환경 변수

```bash
# 백엔드 디렉토리로 이동
cd packages/backend

# .env.example 파일을 .env로 복사
cp .env.example .env
```

`.env` 파일을 열어서 다음 필수 항목을 수정하세요:

```bash
# JWT 시크릿 키 (랜덤 문자열로 변경)
JWT_SECRET=your-very-secure-secret-key-here
JWT_REFRESH_SECRET=your-very-secure-refresh-key-here

# 데이터베이스 연결 (실제 값으로 변경)
DATABASE_URL="postgresql://postgres:password@localhost:5432/ai_chat_platform"
MONGODB_URI="mongodb://localhost:27017/ai_chat_platform"

# AI API 키 (최소 하나는 필요)
OPENAI_API_KEY=sk-...                              # OpenAI 계정에서 발급
OPENROUTER_API_KEY=sk-or-v1-...                   # OpenRouter 계정에서 발급 (추천!)
```

### 2. 프론트엔드 환경 변수

```bash
# 프론트엔드 디렉토리로 이동
cd packages/frontend

# .env.example 파일을 .env.local로 복사
cp .env.example .env.local
```

`.env.local` 파일을 열어서 다음 항목을 확인하세요:

```bash
# 백엔드 API URL (기본값 사용 가능)
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SOCKET_URL=http://localhost:8000
```

---

## 데이터베이스 설정

### 옵션 1: Docker로 간단하게 시작 (추천!)

```bash
# PostgreSQL + MongoDB + Redis 한 번에 실행
docker-compose up -d
```

**docker-compose.yml** 파일 내용:
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    container_name: ai-chat-postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: ai_chat_platform
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  mongodb:
    image: mongo:7
    container_name: ai-chat-mongodb
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db

  redis:
    image: redis:7-alpine
    container_name: ai-chat-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  mongodb_data:
  redis_data:
```

### 옵션 2: 직접 설치

#### PostgreSQL
```bash
# PostgreSQL 데이터베이스 생성
createdb -U postgres ai_chat_platform

# pgvector 확장 설치 (메모리 시스템용)
psql -U postgres -d ai_chat_platform -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

#### MongoDB
```bash
# MongoDB 서비스 시작
sudo systemctl start mongod

# 또는 macOS
brew services start mongodb-community
```

#### Redis (선택사항)
```bash
# Redis 서비스 시작
sudo systemctl start redis

# 또는 macOS
brew services start redis
```

---

## 백엔드 설정

### 1. 의존성 설치

```bash
cd packages/backend
npm install
```

### 2. Prisma 마이그레이션

```bash
# Prisma 클라이언트 생성
npx prisma generate

# 데이터베이스 스키마 푸시
npx prisma db push

# (선택사항) Prisma Studio로 데이터 확인
npx prisma studio
```

### 3. 백엔드 서버 시작

```bash
# 개발 모드로 시작 (핫 리로드)
npm run dev

# 또는 프로덕션 빌드
npm run build
npm start
```

**서버가 정상적으로 시작되면:**
```
🚀 Server running on port 8000
📊 Health check: http://localhost:8000/health
📚 API docs: http://localhost:8000/api/docs
🧠 Memory cleanup job scheduled
```

### 4. 헬스체크 확인

브라우저나 curl로 확인:
```bash
curl http://localhost:8000/health
```

정상 응답:
```json
{
  "status": "healthy",
  "timestamp": "2025-12-18T...",
  "uptime": 123.45,
  "services": {
    "ai": { "openai": true, "openrouter": true },
    "database": "connected",
    "socket": "active"
  }
}
```

---

## 프론트엔드 설정

### 1. 의존성 설치

```bash
cd packages/frontend
npm install
```

### 2. 프론트엔드 서버 시작

```bash
# 개발 모드로 시작 (Turbopack 사용)
npm run dev

# 또는 프로덕션 빌드
npm run build
npm start
```

**서버가 정상적으로 시작되면:**
```
▲ Next.js 15.5.2
- Local:        http://localhost:3000
- Turbopack:    enabled
```

### 3. 브라우저 확인

`http://localhost:3000`에 접속하여 홈페이지를 확인하세요.

---

## AI 서비스 설정

### OpenRouter (추천!) 🌟

**장점:**
- 가입 시 $1 무료 크레딧
- 70B 파라미터 무료 모델 (Llama 3.3)
- 검열 해제 모델 지원
- OpenAI보다 저렴

**설정 방법:**
1. [OpenRouter 가입](https://openrouter.ai/)
2. [API 키 발급](https://openrouter.ai/keys)
3. `.env` 파일에 추가:
   ```bash
   OPENROUTER_API_KEY=sk-or-v1-your-key-here
   OPENROUTER_DEFAULT_MODEL=meta-llama/llama-3.3-70b-instruct:free
   ```

**추천 무료 모델:**
- `meta-llama/llama-3.3-70b-instruct:free` - 70B, 무료, 강력!
- `google/gemini-flash-1.5-8b:free` - 빠르고 무료
- `nousresearch/hermes-3-llama-3.1-405b:free` - 405B, 무료!

### OpenAI

**설정 방법:**
1. [OpenAI 가입](https://platform.openai.com/signup)
2. [API 키 발급](https://platform.openai.com/api-keys)
3. 결제 정보 등록 ($5 이상 충전 권장)
4. `.env` 파일에 추가:
   ```bash
   OPENAI_API_KEY=sk-your-key-here
   OPENAI_DEFAULT_MODEL=gpt-4o
   ```

### Replicate (이미지 생성)

**설정 방법:**
1. [Replicate 가입](https://replicate.com/)
2. [API 토큰 발급](https://replicate.com/account/api-tokens)
3. `.env` 파일에 추가:
   ```bash
   REPLICATE_API_TOKEN=r8_your-token-here
   ```

---

## 테스트 실행

### 1. API 테스트 (Postman/Thunder Client)

#### 회원가입
```http
POST http://localhost:8000/api/auth/register
Content-Type: application/json

{
  "email": "test@example.com",
  "username": "testuser",
  "password": "password123"
}
```

#### 로그인
```http
POST http://localhost:8000/api/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "password123"
}
```

#### AI 채팅 (토큰 필요)
```http
POST http://localhost:8000/api/ai/chat
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "message": "안녕하세요!",
  "characterId": "char_123"
}
```

### 2. Socket.IO 테스트

프론트엔드에서 `/chat` 페이지로 이동하여:
1. 연결 상태 확인 (우측 상단 표시)
2. 메시지 전송
3. 타이핑 인디케이터 확인

### 3. 메모리 시스템 테스트

```http
# 메모리 검색 (RAG)
POST http://localhost:8000/api/memory/char_123/search
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "query": "사용자가 좋아하는 음식",
  "limit": 5,
  "threshold": 0.7
}
```

---

## 🎯 빠른 시작 요약

### 최소 설정 (5분)

```bash
# 1. 저장소 클론 (이미 완료)
# cd ai-character-chat-platform

# 2. 백엔드 설정
cd packages/backend
cp .env.example .env
# .env에서 JWT_SECRET 설정
npm install

# 3. Docker로 데이터베이스 시작
docker-compose up -d

# 4. Prisma 마이그레이션
npx prisma db push
npx prisma generate

# 5. 백엔드 시작
npm run dev

# 6. 새 터미널에서 프론트엔드 시작
cd ../frontend
npm install
npm run dev
```

### OpenRouter로 AI 기능 테스트 (추가 10분)

1. [OpenRouter 가입](https://openrouter.ai/) (무료 $1 크레딧)
2. [API 키 발급](https://openrouter.ai/keys)
3. `.env`에 추가:
   ```bash
   OPENROUTER_API_KEY=sk-or-v1-...
   ```
4. 백엔드 재시작
5. 프론트엔드에서 채팅 테스트!

---

## 🆘 문제 해결

### "Port 8000 already in use"
```bash
# 포트 사용 중인 프로세스 종료
lsof -ti:8000 | xargs kill -9
# 또는 .env에서 PORT 변경
PORT=8001
```

### "Database connection failed"
```bash
# PostgreSQL 서비스 확인
docker ps  # Docker 사용 시
sudo systemctl status postgresql  # 직접 설치 시

# 연결 테스트
psql -U postgres -d ai_chat_platform
```

### "OpenAI API Error"
- API 키가 올바른지 확인
- OpenAI 대시보드에서 결제 정보 확인
- 사용량 한도 확인

### "Prisma Client 에러"
```bash
# Prisma 재생성
npx prisma generate
npx prisma db push --force-reset  # ⚠️ 데이터 삭제됨
```

---

## 📚 추가 리소스

- **프로젝트 문서**: [PROJECT_COMPLETION_PLAN.md](./PROJECT_COMPLETION_PLAN.md)
- **API 문서**: http://localhost:8000/api/docs (서버 실행 후)
- **Prisma Studio**: `npx prisma studio` (데이터베이스 GUI)
- **OpenRouter 문서**: https://openrouter.ai/docs
- **OpenAI 문서**: https://platform.openai.com/docs

---

## 🤝 도움이 필요하신가요?

이슈가 발생하면:
1. 에러 메시지 확인
2. 로그 파일 확인 (`packages/backend/logs/app.log`)
3. 환경 변수 재확인
4. GitHub Issues에 질문 등록

즐거운 개발 되세요! 🚀
