// MongoDB 초기화 스크립트
// Docker 컨테이너 시작 시 자동 실행됨

// 데이터베이스 생성 및 초기 설정
db = db.getSiblingDB('ai_chat_platform')

// 사용자 생성 (개발 환경용)
db.createUser({
  user: 'ai_chat_user',
  pwd: 'ai_chat_pass',
  roles: [
    {
      role: 'readWrite',
      db: 'ai_chat_platform'
    }
  ]
})

// 인덱스 생성
db.chat_messages.createIndex({ chatId: 1, createdAt: -1 })
db.chat_messages.createIndex({ userId: 1, createdAt: -1 })
db.chat_messages.createIndex({ characterId: 1, createdAt: -1 })
db.chat_messages.createIndex({ userId: 1, characterId: 1, createdAt: -1 })
db.chat_messages.createIndex({ 'summarization.isSummarized': 1, createdAt: 1 })

// 메모리 요약 아카이브 컬렉션
db.createCollection('memory_summary_archives')
db.memory_summary_archives.createIndex({ userId: 1, characterId: 1, createdAt: -1 })
db.memory_summary_archives.createIndex({ isDeleted: 1 })

// 임베딩 캐시 컬렉션
db.createCollection('embedding_cache')
db.embedding_cache.createIndex({ memoryId: 1 }, { unique: true })
db.embedding_cache.createIndex({ textHash: 1 })

// 요약 작업 로그 컬렉션
db.createCollection('summarization_logs')
db.summarization_logs.createIndex({ jobId: 1 }, { unique: true })
db.summarization_logs.createIndex({ userId: 1, characterId: 1 })
db.summarization_logs.createIndex({ createdAt: -1 })

// 아카이브된 메모리 컬렉션 (비활성 계정용)
db.createCollection('archived_memories')
db.archived_memories.createIndex({ userId: 1, characterId: 1 })
db.archived_memories.createIndex({ archivedAt: -1 })

db.user_activities.createIndex({ userId: 1, createdAt: -1 })
db.user_activities.createIndex({ action: 1, createdAt: -1 })
db.user_activities.createIndex({ sessionId: 1, createdAt: -1 })

db.image_cache.createIndex({ promptHash: 1 }, { unique: true })
db.image_cache.createIndex({ model: 1, lastAccessed: -1 })

// TTL 인덱스 (24시간 후 자동 삭제)
db.image_cache.createIndex(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
)

// 샘플 데이터 삽입 (개발 환경용)
db.chat_messages.insertMany([
  {
    chatId: "sample_chat_1",
    userId: "sample_user_1",
    characterId: "sample_character_1",
    content: "안녕하세요! 만나서 반가워요.",
    role: "user",
    tokens: 8,
    metadata: { language: "ko" },
    createdAt: new Date()
  },
  {
    chatId: "sample_chat_1",
    userId: "sample_user_1",
    characterId: "sample_character_1",
    content: "안녕하세요! 저도 만나서 반가워요. 무엇을 도와드릴까요?",
    role: "assistant",
    tokens: 15,
    metadata: { model: "gpt-4", temperature: 0.7 },
    createdAt: new Date(Date.now() + 1000)
  }
])

db.user_activities.insertOne({
  userId: "sample_user_1",
  action: "login",
  details: { method: "email", success: true },
  ipAddress: "127.0.0.1",
  userAgent: "Mozilla/5.0 (compatible; Docker)",
  sessionId: "sample_session_1",
  createdAt: new Date()
})

print("MongoDB 초기화 완료!")
print("데이터베이스: ai_chat_platform")
print("생성된 컬렉션: chat_messages, user_activities, image_cache")
