import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import { isAdminEmail } from './lib/auth'
import BookingTable from './components/BookingTable'
import BookingForm from './components/BookingForm'
import StatCards from './components/StatCards'
import CalendarView from './components/CalendarView'
import LoginPage from './components/LoginPage'

type TabType = '대시보드' | '예약목록' | '예약추가' | '상태관리' | '위치확인'
type ListViewType = '목록' | '캘린더'

/** 구글에서 돌아온 뒤 주소창에 남는 ?code=... / #access_token=... 을 지운다. */
function cleanAuthParamsFromUrl() {
  const { pathname, search, hash } = window.location
  const hasAuthArtifact =
    hash.includes('access_token') ||
    hash.includes('error') ||
    new URLSearchParams(search).has('code') ||
    new URLSearchParams(search).has('error')

  if (hasAuthArtifact) {
    window.history.replaceState({}, document.title, pathname)
  }
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [userName, setUserName] = useState('')
  const [userImage, setUserImage] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('대시보드')
  const [listView, setListView] = useState<ListViewType>('목록')
  const [refreshKey, setRefreshKey] = useState(0)

  /** 세션 하나로 로그인 상태 전체를 갱신하는 단일 진입점 */
  const applySession = useCallback((session: Session | null) => {
    if (session?.user) {
      const email = session.user.email ?? ''
      setIsLoggedIn(true)
      setIsAdmin(isAdminEmail(email))
      setUserEmail(email)
      setUserName(session.user.user_metadata?.full_name || '사용자')
      setUserImage(session.user.user_metadata?.avatar_url || '')
    } else {
      setIsLoggedIn(false)
      setIsAdmin(false)
      setUserEmail('')
      setUserName('')
      setUserImage('')
    }
  }, [])

  const handleLoginSuccess = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    applySession(data?.session ?? null)
    cleanAuthParamsFromUrl()
  }, [applySession])

  useEffect(() => {
    let mounted = true

    const init = async () => {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      applySession(data?.session ?? null)
      cleanAuthParamsFromUrl()
      setLoading(false)
    }

    init()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return

      if (event === 'SIGNED_OUT') {
        applySession(null)
        return
      }

      applySession(session)
      if (event === 'SIGNED_IN') cleanAuthParamsFromUrl()
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [applySession])

  const handleFormSuccess = () => {
    setRefreshKey((prev) => prev + 1)
    setListView('목록')
    setActiveTab('예약목록')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    applySession(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#58cc02] mb-4"></div>
          <p className="text-[#777777] font-bold">로딩 중...</p>
        </div>
      </div>
    )
  }

  if (!isLoggedIn) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />
  }

  // 상태관리·위치확인은 전체 예약을 다루는 화면이라 관리자에게만 보인다.
  const tabs: { id: TabType; label: string }[] = [
    { id: '대시보드', label: '대시보드' },
    { id: '예약목록', label: isAdmin ? '예약목록' : '내 예약' },
    { id: '예약추가', label: '예약추가' },
    ...(isAdmin
      ? ([
          { id: '상태관리', label: '상태관리' },
          { id: '위치확인', label: '위치확인' },
        ] as { id: TabType; label: string }[])
      : []),
  ]

  const listViews: { id: ListViewType; label: string }[] = [
    { id: '목록', label: '📋 목록 보기' },
    { id: '캘린더', label: '📅 캘린더 보기' },
  ]

  return (
    <div className="min-h-screen bg-white text-[#3c3c3c] pb-24 font-['Pretendard',sans-serif]">
      {/* 탑 내비게이션 바 */}
      <div className="bg-white border-b-2 border-[#e5e5e5] sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-[70px] flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#58cc02] flex items-center justify-center text-white font-black text-xl shadow-[0_4px_0_#46a302]">
              🦉
            </div>
            <h1 className="text-2xl font-black text-[#042c60] tracking-tight">예약 관리 허브</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-[#f7f7f7] border-2 border-[#e5e5e5] px-3 py-1.5 rounded-2xl">
              <div className="w-9 h-9 rounded-full bg-[#58cc02] flex items-center justify-center flex-shrink-0 text-white font-bold">
                {userImage ? (
                  <img
                    src={userImage}
                    alt="profile"
                    className="w-9 h-9 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                ) : (
                  <span>{userName?.charAt(0).toUpperCase() || 'U'}</span>
                )}
              </div>
              <div className="hidden sm:block">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold text-[#3c3c3c]">{userName}</p>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-black uppercase rounded-full ${
                      isAdmin ? 'bg-[#d7ffb8] text-[#58a700]' : 'bg-[#e5f4ff] text-[#1cb0f6]'
                    }`}
                  >
                    {isAdmin ? '관리자' : '사용자'}
                  </span>
                </div>
                <p className="text-[11px] text-[#777777]">{userEmail}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="bg-white text-[#ff4b4b] border-2 border-[#e5e5e5] hover:border-[#ff4b4b] px-4 py-2 text-xs font-black uppercase rounded-2xl transition-all shadow-[0_3px_0_#e5e5e5] active:translate-y-[3px] active:shadow-none cursor-pointer"
            >
              로그아웃
            </button>
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div className="max-w-6xl mx-auto p-6 md:p-8">
        {activeTab === '대시보드' && (
          <div className="space-y-6">
            <div className="bg-[#d7ffb8]/30 border-2 border-[#a5ed6e] p-6 rounded-2xl flex items-center justify-between">
              <div>
                <span className="inline-block bg-[#58cc02] text-white text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full mb-2">
                  {isAdmin ? 'ADMIN DASHBOARD' : 'MY BOOKINGS'}
                </span>
                <h2 className="text-3xl font-black text-[#042c60]">
                  {isAdmin
                    ? '오늘의 예약 현황을 한눈에 확인하세요!'
                    : '내 예약 현황을 확인하세요!'}
                </h2>
                <p className="text-[#777777] mt-1 font-medium">
                  {isAdmin
                    ? '전체 예약을 관리하고 확정할 수 있습니다.'
                    : '등록한 예약은 관리자가 확인 후 확정합니다.'}
                </p>
              </div>
              <div className="hidden md:block text-5xl">🚀</div>
            </div>
            <StatCards refreshKey={refreshKey} />
          </div>
        )}

        {activeTab === '예약목록' && (
          <div className="space-y-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-3xl font-black text-[#042c60]">
                  {isAdmin ? '예약 목록' : '내 예약'}
                </h2>
                <p className="text-[#777777] mt-1 font-medium">
                  {listView === '목록'
                    ? isAdmin
                      ? '등록된 모든 예약을 표 형태로 확인합니다.'
                      : '내가 등록한 예약을 표 형태로 확인합니다.'
                    : '월별 예약 일정을 캘린더 형태로 조망합니다.'}
                </p>
              </div>
              <span className="text-xs font-bold text-[#777777] bg-[#f7f7f7] border-2 border-[#e5e5e5] px-3 py-1.5 rounded-xl">
                실시간 연동됨
              </span>
            </div>

            <div className="flex gap-2 p-1.5 bg-[#f7f7f7] border-2 border-[#e5e5e5] rounded-2xl w-fit">
              {listViews.map((view) => {
                const isActive = listView === view.id
                return (
                  <button
                    key={view.id}
                    onClick={() => setListView(view.id)}
                    className={`px-4 py-2 text-xs md:text-sm font-black rounded-xl transition-all cursor-pointer ${
                      isActive
                        ? 'bg-white text-[#58cc02] border-2 border-[#58cc02] shadow-[0_2px_0_#46a302]'
                        : 'bg-transparent text-[#777777] border-2 border-transparent hover:text-[#3c3c3c]'
                    }`}
                  >
                    {view.label}
                  </button>
                )
              })}
            </div>

            <div className="min-h-[720px]">
              {listView === '목록' ? (
                <BookingTable refreshKey={refreshKey} isAdmin={isAdmin} />
              ) : (
                <CalendarView refreshKey={refreshKey} />
              )}
            </div>
          </div>
        )}

        {activeTab === '예약추가' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="inline-block bg-[#1cb0f6] text-white text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full mb-2">
                  NEW BOOKING
                </span>
                <h2 className="text-3xl font-black text-[#042c60]">새로운 예약 등록</h2>
                <p className="text-[#777777] mt-1 font-medium">
                  필수 정보를 입력하여 새로운 예약을 간편하게 추가하세요.
                </p>
              </div>
            </div>
            <BookingForm onSuccess={handleFormSuccess} />
          </div>
        )}

        {isAdmin && activeTab === '상태관리' && (
          <div className="space-y-6">
            <div className="bg-[#f7f7f7] border-2 border-[#e5e5e5] p-6 rounded-2xl">
              <h2 className="text-3xl font-black text-[#042c60] mb-2">상태 관리</h2>
              <p className="text-[#777777] font-medium">
                대기 중인 예약을 확정하면 구글 캘린더에 일정이 자동으로 등록됩니다. 확정을 되돌리면
                일정도 함께 삭제됩니다.
              </p>
            </div>
            <BookingTable refreshKey={refreshKey} isAdmin={isAdmin} />
          </div>
        )}

        {isAdmin && activeTab === '위치확인' && (
          <div className="space-y-6">
            <div className="bg-[#f7f7f7] border-2 border-[#e5e5e5] p-6 rounded-2xl">
              <h2 className="text-3xl font-black text-[#042c60] mb-2">위치 확인</h2>
              <p className="text-[#777777] font-medium">
                등록된 주소 링크를 클릭하여 OpenStreetMap 지도를 통해 위치를 시각적으로 확인하세요.
              </p>
            </div>
            <BookingTable refreshKey={refreshKey} isAdmin={isAdmin} />
          </div>
        )}
      </div>

      {/* 하단 탭 바 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-[#e5e5e5] shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-40">
        <div className="max-w-6xl mx-auto flex">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-3.5 px-2 text-center font-black text-xs md:text-sm uppercase tracking-wider transition-all cursor-pointer flex flex-col items-center gap-1 ${
                  isActive
                    ? 'text-[#58cc02] border-t-4 border-[#58cc02] bg-[#f7f7f7]/50'
                    : 'text-[#777777] hover:text-[#3c3c3c] hover:bg-[#f7f7f7]/30'
                }`}
              >
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
