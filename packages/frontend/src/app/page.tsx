import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'AI 캐릭터 채팅 플랫폼',
  description: 'AI 캐릭터와 실시간으로 대화하고 이미지를 생성해보세요',
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* 헤더 */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">
                AI Character Chat
              </h1>
            </div>
            <div className="flex space-x-4">
              <Link
                href="/auth/login"
                className="text-gray-700 hover:text-gray-900 font-medium"
              >
                로그인
              </Link>
              <Link
                href="/auth/register"
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium"
              >
                회원가입
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* 히어로 섹션 */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            AI 캐릭터와의 특별한 대화
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            다양한 성격의 AI 캐릭터와 실시간으로 대화하고,
            AI가 생성한 아름다운 이미지를 만나보세요.
          </p>
          <div className="flex justify-center space-x-4">
            <Link
              href="/chat"
              className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 font-medium text-lg"
            >
              채팅 시작하기
            </Link>
            <Link
              href="/image-generation"
              className="bg-white text-blue-600 px-8 py-3 rounded-lg border border-blue-600 hover:bg-blue-50 font-medium text-lg"
            >
              이미지 생성하기
            </Link>
          </div>
        </div>

        {/* 기능 소개 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              실시간 채팅
            </h3>
            <p className="text-gray-600">
              다양한 성격의 AI 캐릭터와 실시간으로 대화하세요.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              AI 이미지 생성
            </h3>
            <p className="text-gray-600">
              텍스트 프롬프트로 아름다운 이미지를 생성하세요.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              맞춤형 캐릭터
            </h3>
            <p className="text-gray-600">
              자신만의 AI 캐릭터를 만들고 커스터마이징하세요.
            </p>
          </div>
        </div>

        {/* 시작하기 섹션 */}
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            지금 바로 시작하세요
          </h3>
          <p className="text-gray-600 mb-6">
            무료로 가입하고 AI 캐릭터와의 대화를 경험해보세요.
          </p>
          <Link
            href="/auth/register"
            className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 font-medium text-lg inline-block"
          >
            무료로 시작하기
          </Link>
        </div>
      </main>

      {/* 푸터 */}
      <footer className="bg-gray-800 text-white py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p>&copy; 2024 AI Character Chat Platform. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}