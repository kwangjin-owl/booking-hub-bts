import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'

const ADMIN_EMAIL = 'kwangjin.owl@gmail.com'

interface LoginPageProps {
  onLoginSuccess: () => void
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // StrictMode에서 effect가 두 번 실행되어 signOut이 중복 호출되는 것을 막습니다.
  const handledRef = useRef(false)

  useEffect(() => {
    const handleAuthCallback = async () => {
      if (handledRef.current) return

      // OAuth 진행 중에 뜬 에러(동의 거부 등)를 URL에서 읽어 표시합니다.
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

      if (data?.session) {
        handledRef.current = true
        const userEmail = data.session.user.email

        if (userEmail === ADMIN_EMAIL) {
          onLoginSuccess()
        } else {
          setError(`접근 거부: ${userEmail} 은(는) 허가되지 않은 이메일입니다.`)
          await supabase.auth.signOut()
        }
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
        // 이 앱에는 라우터가 없습니다. /auth/callback 같은 하위 경로로 돌아오면
        // 서버에 해당 파일이 없어 404가 납니다. 항상 루트로 돌아오게 합니다.
        redirectTo: window.location.origin,
        queryParams: {
          prompt: 'select_account',
        },
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
            ADMIN PORTAL
          </span>
          <h1 className="text-3xl font-black text-[#042c60]">
            예약 관리 허브
          </h1>
          <p className="text-[#777777] mt-1 font-medium">
            관리자 로그인이 필요합니다
          </p>
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
          <svg
            className="w-5 h-5 bg-white rounded-full p-0.5"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          {loading ? '이동 중...' : 'Google로 로그인'}
        </button>

        <div className="mt-6 pt-6 border-t-2 border-[#e5e5e5]">
          <p className="text-xs text-[#777777] text-center font-bold">
            {ADMIN_EMAIL} 계정으로만 접속 가능합니다.
          </p>
        </div>
      </div>
    </div>
  )
}
