# Socket.IO 실시간 채팅 구현 문서

> **작성일:** 2024-12-13  
> **목적:** 재연결 로직, 메시지 ACK, 중복 연결 방지 구현 내용 정리

---

## 📋 구현 개요

| 기능 | 설명 | 상태 |
|------|------|------|
| ACK 시스템 | 메시지 전송 확인 (5초 타임아웃, 2회 재시도) | ✅ |
| 동일 사용자 중복 연결 방지 | 새 연결 시 기존 연결 강제 종료 | ✅ |
| 세션 저장/복구 | 연결 해제 시 세션 정보 5분 보관 | ✅ |
| 방 재참여 | 재연결 시 이전 채팅방 자동 복구 | ✅ |
| 하트비트 | 30초 간격 연결 상태 확인 | ✅ |
| 메시지 DB 저장 | MongoDB ChatMessageModel에 저장 | ✅ |
| 프론트엔드 훅 | useSocket, useSocketChat | ✅ |
| 연결 상태 UI | ConnectionStatus 컴포넌트 | ✅ |

---

## 🔧 백엔드 변경 사항

### 파일: `packages/backend/src/services/SocketService.ts`

#### 1. 타입 정의 추가

```typescript
// 메시지 ACK 응답
interface MessageAck {
  success: boolean
  messageId?: string
  timestamp?: string
  error?: string
}

// 재연결 시 클라이언트가 보내는 데이터
interface ReconnectionData {
  lastMessageId?: string
  roomId?: string
  characterId?: string
}

// 설정 상수
const SESSION_TIMEOUT_MS = 5 * 60 * 1000  // 5분
const ACK_TIMEOUT_MS = 5000               // ACK 대기 5초
const MAX_RETRY_COUNT = 2                 // 최대 재시도 2회
```

#### 2. ConnectedUser 인터페이스 확장

```typescript
interface ConnectedUser {
  id: string
  socketId: string
  roomId?: string
  characterId?: string      // 🆕 추가
  lastActivity: Date
  connectedAt: Date         // 🆕 추가
}
```

#### 3. 세션 관리 Map 추가

```typescript
// 사용자별 이전 세션 정보 (재연결용)
private userSessions: Map<string, {
  roomId?: string
  characterId?: string
  disconnectedAt: Date
}> = new Map()
```

#### 4. 세션 타임아웃 정리 작업

```typescript
private startSessionCleanup() {
  setInterval(() => {
    const now = Date.now()
    for (const [userId, session] of this.userSessions.entries()) {
      if (now - session.disconnectedAt.getTime() > SESSION_TIMEOUT_MS) {
        this.userSessions.delete(userId)
      }
    }
  }, 60000) // 1분마다 체크
}
```

#### 5. 동일 사용자 중복 연결 방지

```typescript
// handleConnection 내부
const existingConnection = this.connectedUsers.get(userId)
if (existingConnection) {
  const existingSocket = this.io.sockets.sockets.get(existingConnection.socketId)
  if (existingSocket) {
    existingSocket.emit('connection:replaced', {
      message: '다른 기기에서 로그인하여 연결이 종료되었습니다.',
      timestamp: new Date().toISOString()
    })
    existingSocket.disconnect(true)
  }
}
```

#### 6. 재연결 시 세션 복구 정보 전송

```typescript
const previousSession = this.userSessions.get(userId)
if (previousSession) {
  socket.emit('session:restored', {
    previousRoomId: previousSession.roomId,
    previousCharacterId: previousSession.characterId,
    disconnectedAt: previousSession.disconnectedAt.toISOString(),
    canReconnect: Date.now() - previousSession.disconnectedAt.getTime() < SESSION_TIMEOUT_MS
  })
  this.userSessions.delete(userId)
}
```

#### 7. 새로운 이벤트 핸들러

| 이벤트 | 핸들러 | 설명 |
|--------|--------|------|
| `message:send` | `handleMessageSendWithAck` | ACK 콜백 지원 메시지 전송 |
| `message:send:stream` | `handleMessageSendStreamWithAck` | ACK 콜백 지원 스트리밍 |
| `room:rejoin` | `handleRoomRejoin` | 재연결 시 방 재참여 |
| `heartbeat` | `handleHeartbeat` | 연결 상태 확인 |
| `messages:history` | `handleMessagesHistory` | 메시지 히스토리 로드 |

#### 8. ACK 콜백 패턴

```typescript
private async handleMessageSendWithAck(
  socket: Socket, 
  userId: string, 
  data: any,
  callback?: (ack: MessageAck) => void  // ACK 콜백
) {
  try {
    // ... 메시지 처리 ...
    
    // 성공 시 ACK
    callback?.({ 
      success: true, 
      messageId,
      timestamp
    })
  } catch (error) {
    // 실패 시 ACK
    callback?.({ 
      success: false, 
      messageId,
      error: 'Failed to send message' 
    })
  }
}
```

#### 9. 연결 해제 시 세션 저장

```typescript
private handleDisconnection(socket: Socket, userId: string, reason?: string) {
  const userConnection = this.connectedUsers.get(userId)
  if (userConnection) {
    const { roomId, characterId } = userConnection

    // 세션 정보 저장 (강제 종료가 아닌 경우만)
    if (reason !== 'server namespace disconnect') {
      this.userSessions.set(userId, {
        roomId,
        characterId,
        disconnectedAt: new Date()
      })
    }
    // ... 나머지 정리 로직 ...
  }
}
```

---

## 🎨 프론트엔드 변경 사항

### 1. `packages/frontend/src/lib/hooks/useSocket.ts`

**목적:** Socket.IO 연결 관리

```typescript
export function useSocket(options: UseSocketOptions): UseSocketReturn {
  // 반환값
  return {
    socket,              // Socket 인스턴스
    isConnected,         // 연결 상태
    connectionState,     // 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed'
    reconnectAttempts,   // 재연결 시도 횟수
    lastError,           // 마지막 에러 메시지
    connect,             // 수동 연결
    disconnect,          // 수동 해제
    reconnect,           // 수동 재연결
  }
}
```

**주요 기능:**
- 자동 재연결 (지수 백오프)
- 하트비트 (30초 간격)
- `connection:replaced` 이벤트 처리
- `session:restored` 이벤트 처리

### 2. `packages/frontend/src/lib/hooks/useSocketChat.ts`

**목적:** 채팅 기능 (메시지, 스트리밍, 방 관리)

```typescript
export function useSocketChat(options: UseSocketChatOptions) {
  return {
    // 상태
    messages,            // ChatMessage[]
    streamingMessages,   // Map<string, string> (진행 중인 스트리밍)
    isTyping,            // 타이핑 중 여부
    typingUsers,         // 타이핑 중인 사용자들
    isInRoom,            // 방 참여 여부
    pendingMessages,     // 전송 대기 중인 메시지 ID들

    // 방 관리
    joinRoom,            // 방 참여
    rejoinRoom,          // 방 재참여 (재연결용)
    leaveRoom,           // 방 나가기

    // 메시지
    sendMessage,         // ACK 기반 메시지 전송
    retryMessage,        // 실패한 메시지 재전송
    clearMessages,       // 메시지 초기화
    loadMessageHistory,  // 히스토리 로드

    // 타이핑
    startTyping,
    stopTyping,
  }
}
```

**메시지 상태 타입:**
```typescript
type MessageStatus = 'pending' | 'sent' | 'failed'
```

### 3. `packages/frontend/src/components/ui/ConnectionStatus.tsx`

**컴포넌트:**

| 컴포넌트 | 설명 |
|----------|------|
| `ConnectionStatus` | 상단 배너 (연결 상태 표시) |
| `ConnectionReplacedModal` | 다른 기기 로그인 알림 모달 |
| `MessageStatusIndicator` | 메시지 옆 상태 표시 (✓, ⏳, ⚠️) |

### 4. `packages/frontend/src/lib/types/socket.ts`

**추가된 이벤트 타입:**
```typescript
export type SocketEvent =
  | 'message:send:stream'
  | 'message:stream:start'
  | 'message:stream:chunk'
  | 'message:stream:end'
  | 'message:stream:error'
  | 'messages:history'
  | 'room:rejoin'
  | 'room:rejoined'
  | 'heartbeat'
  | 'heartbeat:ack'
  | 'connection:replaced'
  | 'session:restored'
  | 'user:reconnected'
  // ... 기존 이벤트들
```

### 5. `packages/frontend/src/app/globals.css`

**추가된 애니메이션:**
```css
@keyframes slideDown { /* 연결 상태 배너 */ }
@keyframes scaleIn { /* 모달 */ }
@keyframes blink { /* 타이핑 커서 */ }

.animate-slideDown { ... }
.animate-scaleIn { ... }
.typing-cursor::after { ... }
```

---

## 📡 이벤트 흐름

### 1. 메시지 전송 (ACK)

```
Client                          Server
  |                                |
  |-- message:send:stream -------->|
  |   { content, roomId, ... }     |
  |                                |
  |<-------- ACK callback ---------|
  |   { success: true, messageId } |
  |                                |
  |<-- message:stream:start -------|
  |<-- message:stream:chunk (n회) -|
  |<-- message:stream:end ---------|
```

### 2. 재연결

```
Client                          Server
  |                                |
  |-- (연결 해제) ---------------->|
  |                                |-- 세션 저장 (5분)
  |                                |
  |-- (재연결) ------------------->|
  |                                |
  |<-- session:restored -----------|
  |   { previousRoomId, ... }      |
  |                                |
  |-- room:rejoin ---------------->|
  |   { roomId }                   |
  |                                |
  |<-- room:rejoined --------------|
```

### 3. 중복 연결 감지

```
Device A                        Server                        Device B
  |                                |                              |
  |-- (연결 중) ------------------>|                              |
  |                                |<--------- (새 연결) ---------|
  |                                |                              |
  |<-- connection:replaced --------|                              |
  |   "다른 기기에서 로그인"        |                              |
  |-- (연결 종료) ---------------->|                              |
  |                                |<-- (연결 유지) --------------|
```

---

## 🔑 설정 값

| 항목 | 값 | 위치 |
|------|-----|------|
| 세션 타임아웃 | 5분 | `SESSION_TIMEOUT_MS` |
| ACK 타임아웃 | 5초 | `ACK_TIMEOUT_MS` |
| 최대 재시도 | 2회 | `MAX_RETRY_COUNT` |
| 하트비트 간격 | 30초 | `heartbeatInterval` |
| 재연결 지연 | 1초~5초 (지수 백오프) | `reconnectionDelay` |
| 최대 재연결 시도 | 10회 | `maxReconnectionAttempts` |

---

## 💡 사용 예시

### 기본 사용

```tsx
import { useSocket, useSocketChat } from '@/lib/hooks'
import { ConnectionStatus, MessageStatusIndicator } from '@/components/ui/ConnectionStatus'

function ChatPage() {
  const [showReplacedModal, setShowReplacedModal] = useState(false)
  
  // 소켓 연결
  const { 
    socket, 
    isConnected, 
    connectionState, 
    reconnect 
  } = useSocket({
    onSessionRestored: (data) => {
      if (data.canReconnect && data.previousRoomId) {
        rejoinRoom(data.previousRoomId, data.previousCharacterId)
      }
    },
    onReplaced: () => setShowReplacedModal(true)
  })

  // 채팅
  const { 
    messages, 
    sendMessage, 
    retryMessage,
    joinRoom,
    rejoinRoom 
  } = useSocketChat({
    socket,
    isConnected,
    roomId: 'room_123',
    characterId: 'char_456'
  })

  const handleSend = async (content: string) => {
    const success = await sendMessage(content)
    if (!success) {
      // UI에서 자동으로 'failed' 상태 표시
    }
  }

  return (
    <>
      {/* 연결 상태 배너 */}
      <ConnectionStatus
        connectionState={connectionState}
        onReconnect={reconnect}
      />

      {/* 메시지 목록 */}
      {messages.map(msg => (
        <div key={msg.id}>
          {msg.content}
          <MessageStatusIndicator 
            status={msg.status || 'sent'}
            onRetry={() => retryMessage(msg.id)}
          />
        </div>
      ))}

      {/* 다른 기기 로그인 모달 */}
      <ConnectionReplacedModal
        isOpen={showReplacedModal}
        onClose={() => setShowReplacedModal(false)}
        onReconnect={reconnect}
      />
    </>
  )
}
```

---

## 🚀 향후 개선 사항

1. **Redis 도입** - 다중 서버 환경에서 세션 공유
2. **메시지 큐잉** - 오프라인 시 메시지 저장 후 재연결 시 전송
3. **읽음 확인** - 메시지 읽음 상태 추적
4. **Presence 시스템** - 실시간 온라인 상태 표시
5. **연결 품질 모니터링** - 네트워크 상태에 따른 품질 조절

---

## 📁 변경된 파일 목록

### 백엔드
- `packages/backend/src/services/SocketService.ts` - 핵심 로직

### 프론트엔드
- `packages/frontend/src/lib/hooks/useSocket.ts` - 🆕 신규
- `packages/frontend/src/lib/hooks/useSocketChat.ts` - 🆕 신규
- `packages/frontend/src/lib/hooks/index.ts` - export 추가
- `packages/frontend/src/components/ui/ConnectionStatus.tsx` - 🆕 신규
- `packages/frontend/src/lib/types/socket.ts` - 이벤트 타입 추가
- `packages/frontend/src/app/globals.css` - 애니메이션 추가


