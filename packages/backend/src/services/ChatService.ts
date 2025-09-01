import { Chat, Message, User, Character, MessageRole } from '@prisma/client'
import { prisma } from '../config/database'
import { OpenAI } from 'openai'

export interface CreateChatData {
  userId: string
  characterId: string
  title?: string
}

export interface SendMessageData {
  chatId: string
  content: string
  role: MessageRole
}

export interface ChatResult {
  success: boolean
  chat?: Chat & {
    character: Character
    messages: Message[]
  }
  message?: Message
  aiResponse?: string
  error?: string
}

export class ChatService {
  private static openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })

  /**
   * 새 채팅 세션 생성
   */
  static async createChat(data: CreateChatData): Promise<ChatResult> {
    try {
      // 캐릭터 존재 확인
      const character = await prisma.character.findUnique({
        where: { id: data.characterId },
      })

      if (!character) {
        return {
          success: false,
          error: '캐릭터를 찾을 수 없습니다',
        }
      }

      // 채팅 생성
      const chat = await prisma.chat.create({
        data: {
          userId: data.userId,
          characterId: data.characterId,
          title: data.title || `${character.name}과의 대화`,
        },
        include: {
          character: true,
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      })

      return {
        success: true,
        chat,
      }
    } catch (error) {
      console.error('Create chat error:', error)
      return {
        success: false,
        error: '채팅 생성 중 오류가 발생했습니다',
      }
    }
  }

  /**
   * 채팅 조회
   */
  static async getChat(chatId: string, userId: string): Promise<ChatResult> {
    try {
      const chat = await prisma.chat.findFirst({
        where: {
          id: chatId,
          userId, // 소유자 확인
        },
        include: {
          character: true,
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      })

      if (!chat) {
        return {
          success: false,
          error: '채팅을 찾을 수 없습니다',
        }
      }

      return {
        success: true,
        chat,
      }
    } catch (error) {
      console.error('Get chat error:', error)
      return {
        success: false,
        error: '채팅 조회 중 오류가 발생했습니다',
      }
    }
  }

  /**
   * 사용자의 채팅 목록 조회
   */
  static async getUserChats(userId: string): Promise<{
    success: boolean
    chats?: (Chat & { character: Character })[]
    error?: string
  }> {
    try {
      const chats = await prisma.chat.findMany({
        where: { userId },
        include: {
          character: true,
        },
        orderBy: { updatedAt: 'desc' },
      })

      return {
        success: true,
        chats,
      }
    } catch (error) {
      console.error('Get user chats error:', error)
      return {
        success: false,
        error: '채팅 목록 조회 중 오류가 발생했습니다',
      }
    }
  }

  /**
   * 메시지 전송 및 AI 응답 생성
   */
  static async sendMessage(data: SendMessageData): Promise<ChatResult> {
    try {
      // 채팅 존재 확인
      const chat = await prisma.chat.findUnique({
        where: { id: data.chatId },
        include: { character: true },
      })

      if (!chat) {
        return {
          success: false,
          error: '채팅을 찾을 수 없습니다',
        }
      }

      // 사용자 메시지 저장
      const userMessage = await prisma.message.create({
        data: {
          chatId: data.chatId,
          role: data.role,
          content: data.content,
        },
      })

      // 채팅 통계 업데이트
      await prisma.chat.update({
        where: { id: data.chatId },
        data: {
          messageCount: { increment: 1 },
          lastActivity: new Date(),
        },
      })

      // AI 응답 생성
      let aiResponse = ''
      try {
        aiResponse = await this.generateAIResponse(chat, data.content)
      } catch (error) {
        console.error('AI response generation error:', error)
        aiResponse = '죄송합니다. AI 응답을 생성하는 중 오류가 발생했습니다.'
      }

      // AI 메시지 저장
      const aiMessage = await prisma.message.create({
        data: {
          chatId: data.chatId,
          role: MessageRole.ASSISTANT,
          content: aiResponse,
        },
      })

      // 채팅 통계 업데이트 (AI 메시지도 포함)
      await prisma.chat.update({
        where: { id: data.chatId },
        data: {
          messageCount: { increment: 1 },
          updatedAt: new Date(),
        },
      })

      return {
        success: true,
        message: aiMessage,
        aiResponse,
      }
    } catch (error) {
      console.error('Send message error:', error)
      return {
        success: false,
        error: '메시지 전송 중 오류가 발생했습니다',
      }
    }
  }

  /**
   * AI 응답 생성
   */
  private static async generateAIResponse(
    chat: Chat & { character: Character },
    userMessage: string
  ): Promise<string> {
    try {
      // 최근 메시지 히스토리 조회 (최근 10개)
      const recentMessages = await prisma.message.findMany({
        where: { chatId: chat.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      })

      // 메시지 히스토리 구성
      const messages = recentMessages.reverse().map(msg => ({
        role: msg.role.toLowerCase() as 'user' | 'assistant' | 'system',
        content: msg.content,
      }))

      // 시스템 프롬프트 추가
      const systemPrompt = chat.character.systemPrompt ||
        `${chat.character.name}은 ${chat.character.description || '친근한 AI 캐릭터'}입니다. ${chat.character.personality || '친절하고 도움이 되는'} 성격으로 대화합니다.`

      messages.unshift({
        role: 'system',
        content: systemPrompt,
      })

      // 현재 사용자 메시지 추가
      messages.push({
        role: 'user',
        content: userMessage,
      })

      // OpenAI API 호출
      const completion = await this.openai.chat.completions.create({
        model: chat.model,
        messages,
        max_tokens: chat.maxTokens || 1000,
        temperature: chat.temperature || 0.7,
      })

      const response = completion.choices[0]?.message?.content || '응답을 생성할 수 없습니다.'

      // 토큰 수 계산 및 저장 (실제로는 completion.usage에서 가져와야 함)
      const estimatedTokens = Math.ceil(response.length / 4) // 대략적인 추정

      // 채팅 토큰 수 업데이트
      await prisma.chat.update({
        where: { id: chat.id },
        data: {
          totalTokens: { increment: estimatedTokens },
        },
      })

      return response
    } catch (error) {
      console.error('Generate AI response error:', error)
      throw error
    }
  }

  /**
   * 채팅 삭제
   */
  static async deleteChat(chatId: string, userId: string): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      // 채팅 존재 및 소유권 확인
      const chat = await prisma.chat.findFirst({
        where: {
          id: chatId,
          userId,
        },
      })

      if (!chat) {
        return {
          success: false,
          error: '채팅을 찾을 수 없거나 삭제 권한이 없습니다',
        }
      }

      // 채팅 삭제 (연관된 메시지는 cascade로 자동 삭제)
      await prisma.chat.delete({
        where: { id: chatId },
      })

      return {
        success: true,
      }
    } catch (error) {
      console.error('Delete chat error:', error)
      return {
        success: false,
        error: '채팅 삭제 중 오류가 발생했습니다',
      }
    }
  }

  /**
   * 채팅 제목 업데이트
   */
  static async updateChatTitle(
    chatId: string,
    userId: string,
    title: string
  ): Promise<ChatResult> {
    try {
      // 채팅 존재 및 소유권 확인
      const chat = await prisma.chat.findFirst({
        where: {
          id: chatId,
          userId,
        },
      })

      if (!chat) {
        return {
          success: false,
          error: '채팅을 찾을 수 없거나 수정 권한이 없습니다',
        }
      }

      // 제목 업데이트
      const updatedChat = await prisma.chat.update({
        where: { id: chatId },
        data: { title },
        include: {
          character: true,
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      })

      return {
        success: true,
        chat: updatedChat,
      }
    } catch (error) {
      console.error('Update chat title error:', error)
      return {
        success: false,
        error: '채팅 제목 업데이트 중 오류가 발생했습니다',
      }
    }
  }
}
