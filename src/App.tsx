import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import BookingTable from './components/BookingTable'
import BookingForm from './components/BookingForm'
import StatCards from './components/StatCards'
import LoginPage from './components/LoginPage'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const ADMIN_EMAIL = 'kwangjin.owl@gmail.com'

type TabType = '대시보드' | '예약목록' | '예약추가' | '상태관리' | '위치확인'

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
    { id: '상태관리', label: '상태관리' },
    { id: '위치확인', label: '위치확인' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto p-6 flex justify-between items-center">
          <h1 className="text-4xl font-bold">예약 관리 허브</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                {userImage ? (
                  <img
                    src={userImage}
                    alt="profile"
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-white font-bold text-sm">
                    {userName?.charAt(0).toUpperCase() || 'A'}
                  </span>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-800">{userName}</p>
                <p className="text-xs text-gray-500">{userEmail}</p>
                <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded">
                  관리자 모드
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div className="max-w-6xl mx-auto p-6">
        {/* 대시보드 탭 */}
        {activeTab === '대시보드' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">대시보드</h2>
            <StatCards refreshKey={refreshKey} />
          </div>
        )}

        {/* 예약목록 탭 */}
        {activeTab === '예약목록' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">예약 목록</h2>
            <BookingTable refreshKey={refreshKey} />
          </div>
        )}

        {/* 예약추가 탭 */}
        {activeTab === '예약추가' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">새로운 예약</h2>
            <BookingForm onSuccess={handleFormSuccess} />
          </div>
        )}

        {/* 상태관리 탭 */}
        {activeTab === '상태관리' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">상태 관리</h2>
            <p className="text-gray-600 mb-4">예약의 상태를 변경할 수 있습니다. 배지를 클릭하면 pending(대기)과 confirmed(확정)이 토글됩니다.</p>
            <BookingTable refreshKey={refreshKey} />
          </div>
        )}

        {/* 위치확인 탭 */}
        {activeTab === '위치확인' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">위치 확인</h2>
            <p className="text-gray-600 mb-4">주소를 클릭하면 Google Maps에서 해당 위치를 확인할 수 있습니다.</p>
            <BookingTable refreshKey={refreshKey} />
          </div>
        )}
      </div>

      {/* 하단 탭 바 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-6xl mx-auto flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-4 px-3 text-center font-semibold transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
