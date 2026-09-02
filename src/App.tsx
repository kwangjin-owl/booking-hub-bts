import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import BookingTable from './components/BookingTable'
import BookingForm from './components/BookingForm'
import StatCards from './components/StatCards'
import CalendarView from './components/CalendarView'
import LoginPage from './components/LoginPage'

const ADMIN_EMAIL = 'kwangjin.owl@gmail.com'

type TabType = '대시보드' | '예약목록' | '예약추가' | '캘린더' | '상태관리' | '위치확인'

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [userName, setUserName] = useState('')
  const [userImage, setUserImage] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('대시보드')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession()
      if (data?.session?.user?.email === ADMIN_EMAIL) {
        setIsLoggedIn(true)
        setUserEmail(data.session.user.email)
        setUserName(data.session.user.user_metadata?.full_name || 'Admin')
        setUserImage(data.session.user.user_metadata?.avatar_url || '')
      }
      setLoading(false)
    }

    checkAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user?.email === ADMIN_EMAIL) {
        setIsLoggedIn(true)
        setUserEmail(session.user.email || '')
        setUserName(session.user.user_metadata?.full_name || 'Admin')
        setUserImage(session.user.user_metadata?.avatar_url || '')
      } else if (event === 'SIGNED_OUT') {
        setIsLoggedIn(false)
        setUserEmail('')
        setUserName('')
        setUserImage('')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setIsLoggedIn(false)
    setUserEmail('')
  }

  const handleFormSuccess = () => {
    setRefreshKey((prev) => prev + 1)
    setActiveTab('예약목록')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  if (!isLoggedIn) {
    return <LoginPage onLoginSuccess={() => setIsLoggedIn(true)} />
  }

  const tabs: { id: TabType; label: string }[] = [
    { id: '대시보드', label: '대시보드' },
    { id: '예약목록', label: '예약목록' },
    { id: '예약추가', label: '예약추가' },
    { id: '캘린더', label: '캘린더' },
    { id: '상태관리', label: '상태관리' },
    { id: '위치확인', label: '위치확인' },
  ]

  return (
    <div className="min-h-screen bg-white text-[#3c3c3c] pb-24 font-['Pretendard',sans-serif]">
      {/* 듀오링고 스타일 탑 내비게이션 바 */}
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
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                ) : (
                  <span>{userName?.charAt(0).toUpperCase() || 'A'}</span>
                )}
              </div>
              <div className="hidden sm:block">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold text-[#3c3c3c]">{userName}</p>
                  <span className="px-2 py-0.5 bg-[#d7ffb8] text-[#58a700] text-[10px] font-black uppercase rounded-full">
                    관리자
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

      {/* 본문 영역 */}
      <div className="max-w-6xl mx-auto p-6 md:p-8">
        {/* 대시보드 탭 */}
        {activeTab === '대시보드' && (
          <div className="space-y-6">
            <div className="bg-[#d7ffb8]/30 border-2 border-[#a5ed6e] p-6 rounded-2xl flex items-center justify-between">
              <div>
                <span className="inline-block bg-[#58cc02] text-white text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full mb-2">
                  FREE. FUN. EFFECTIVE.
                </span>
                <h2 className="text-3xl font-black text-[#042c60]">오늘의 예약 현황을 한눈에 확인하세요!</h2>
                <p className="text-[#777777] mt-1 font-medium">듀오링고 스타일로 새롭게 단장된 프리미엄 예약 관리 허브입니다.</p>
              </div>
              <div className="hidden md:block text-5xl">
                🚀
              </div>
            </div>
            <StatCards refreshKey={refreshKey} />
          </div>
        )}

        {/* 예약목록 탭 */}
        {activeTab === '예약목록' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-black text-[#042c60]">예약 목록</h2>
              <span className="text-xs font-bold text-[#777777] bg-[#f7f7f7] border-2 border-[#e5e5e5] px-3 py-1.5 rounded-xl">
                실시간 연동됨
              </span>
            </div>
            <BookingTable refreshKey={refreshKey} />
          </div>
        )}

        {/* 예약추가 탭 */}
        {activeTab === '예약추가' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="inline-block bg-[#1cb0f6] text-white text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full mb-2">
                  NEW BOOKING
                </span>
                <h2 className="text-3xl font-black text-[#042c60]">새로운 예약 등록</h2>
                <p className="text-[#777777] mt-1 font-medium">필수 정보를 입력하여 새로운 예약을 간편하게 추가하세요.</p>
              </div>
            </div>
            <BookingForm onSuccess={handleFormSuccess} />
          </div>
        )}

        {/* 캘린더 탭 */}
        {activeTab === '캘린더' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="inline-block bg-[#ff9600] text-white text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full mb-2">
                  SCHEDULE
                </span>
                <h2 className="text-3xl font-black text-[#042c60]">캘린더 예약 보기</h2>
                <p className="text-[#777777] mt-1 font-medium">월별 예약 일정을 캘린더 형태로 한눈에 확인하고 관리하세요.</p>
              </div>
            </div>
            <CalendarView refreshKey={refreshKey} />
          </div>
        )}

        {/* 상태관리 탭 */}
        {activeTab === '상태관리' && (
          <div className="space-y-6">
            <div className="bg-[#f7f7f7] border-2 border-[#e5e5e5] p-6 rounded-2xl">
              <h2 className="text-3xl font-black text-[#042c60] mb-2">상태 관리</h2>
              <p className="text-[#777777] font-medium">예약의 상태를 대기(Pending)와 확정(Confirmed) 간에 간편하게 전환할 수 있습니다. 배지를 클릭해 보세요!</p>
            </div>
            <BookingTable refreshKey={refreshKey} />
          </div>
        )}

        {/* 위치확인 탭 */}
        {activeTab === '위치확인' && (
          <div className="space-y-6">
            <div className="bg-[#f7f7f7] border-2 border-[#e5e5e5] p-6 rounded-2xl">
              <h2 className="text-3xl font-black text-[#042c60] mb-2">위치 확인</h2>
              <p className="text-[#777777] font-medium">등록된 주소 링크를 클릭하여 OpenStreetMap 지도를 통해 위치를 시각적으로 확인하세요.</p>
            </div>
            <BookingTable refreshKey={refreshKey} />
          </div>
        )}
      </div>

      {/* 하단 듀오링고 스타일 탭 네비게이션 바 */}
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
