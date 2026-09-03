import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'

interface LoginPageProps {
  onLoginSuccess: () => void
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // StrictMode 에서 effect 가 두 번 실행되는 것을 막는다.
  const handledRef = useRef(false)

  useEffect(() => {
    const handleAuthCallback = async () => {
      if (handledRef.current) return

      // 구글에서 에러를 달고 돌아온 경우(동의 거부 등)를 화면에 보여준다.
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const queryParams = new URLSearchParams(window.location.search)
      const oauthError =
        hashParams.get('error_description') ||
        hashParams.get('error') ||
        queryParams.get('error_description') ||
        queryParams.get('error')

      if (oauthError) {
        handledRef.current = true
        setError(`로그인 실패: ${decodeURIComponent(oauthError)}`)
        window.history.replaceState({}, document.title, window.location.pathname)
        return
      }

      const { data, error: sessionError } = await supabase.auth.getSession()

      if (sessionError) {
        setError('세션 확인 실패: ' + sessionError.message)
        return
      }

      // 이제 누구나 들어올 수 있다. 권한 차이는 로그인 뒤에 갈린다.
      if (data?.session) {
        handledRef.current = true
        onLoginSuccess()
      }
    }

    handleAuthCallback()
  }, [onLoginSuccess])

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError('')

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // 이 앱에는 라우터가 없다. 하위 경로로 돌아오면 404 가 나므로 항상 루트로 보낸다.
        redirectTo: window.location.origin,
        queryParams: { prompt: 'select_account' },
      },
    })

    if (oauthError) {
      setError('로그인 실패: ' + oauthError.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 font-['Pretendard',sans-serif]">
      <div className="bg-white rounded-2xl border-2 border-[#e5e5e5] p-8 max-w-md w-full shadow-[0_8px_0_#e5e5e5]">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-[#58cc02] mx-auto flex items-center justify-center text-white text-3xl font-black shadow-[0_4px_0_#46a302] mb-4">
            🦉
          </div>
          <span className="inline-block bg-[#d7ffb8] text-[#58a700] text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full mb-2">
            BOOKING HUB
          </span>
          <h1 className="text-3xl font-black text-[#042c60]">예약 관리 허브</h1>
          <p className="text-[#777777] mt-1 font-medium">구글 계정으로 시작하세요</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-[#ff4b4b]/10 border-2 border-[#ff4b4b] rounded-2xl text-[#ff4b4b] text-xs font-bold">
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-[#58cc02] hover:bg-[#46a302] disabled:bg-gray-300 text-white font-black py-4 px-6 rounded-2xl flex items-center justify-center gap-3 transition-all uppercase tracking-wider text-sm shadow-[0_4px_0_#46a302] active:translate-y-[4px] active:shadow-none cursor-pointer"
        >
          <svg className="w-5 h-5 bg-white rounded-full p-0.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          {loading ? '이동 중...' : 'Google로 로그인'}
        </button>

        <div className="mt-6 pt-6 border-t-2 border-[#e5e5e5]">
          <p className="text-xs text-[#777777] text-center font-bold">
            예약 등록은 누구나 가능하며, 등록한 예약은 본인만 확인할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  )
}
